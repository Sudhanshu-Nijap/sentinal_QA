const Redis = require('ioredis');
const crypto = require('crypto');

let redisClient = null;
let isConnected = false;

// In-memory fallback stores (used if Redis is offline)
const fallbackQueues = new Map();
const fallbackVisited = new Map();
const fallbackCache = new Map();

function getClient() {
    if (redisClient) return redisClient;

    try {
        const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
        redisClient = new Redis(redisUrl, {
            maxRetriesPerRequest: 2,
            enableReadyCheck: true,
            lazyConnect: true,
            connectTimeout: 3000,
            retryStrategy(times) {
                if (times > 3) {
                    console.warn('[Redis]: Max reconnection retries exceeded. Falling back to high-speed in-memory engine.');
                    return null;
                }
                return Math.min(times * 200, 1000);
            }
        });

        redisClient.on('connect', () => {
            isConnected = true;
            console.log('[Redis]: Connected to high-throughput Redis instance on port 6379.');
        });

        redisClient.on('error', (err) => {
            isConnected = false;
            console.warn('[Redis]: Connection warning, operating in adaptive fallback mode:', err.message);
        });

        redisClient.connect().catch(() => {
            isConnected = false;
            console.log('[Redis]: Operating in high-speed in-memory engine mode.');
        });
    } catch (e) {
        isConnected = false;
        console.warn('[Redis]: Initialization bypassed:', e.message);
    }

    return redisClient;
}

// Initialize on module load
getClient();

const hashUrl = (url) => crypto.createHash('sha256').update(url).digest('hex').substring(0, 16);

const redisService = {
    isAvailable: () => isConnected,

    /**
     * Atomically adds URL to visited set. Returns true if URL was newly added, false if already visited.
     */
    async markVisited(crawlId, url) {
        if (isConnected && redisClient) {
            try {
                const added = await redisClient.sadd(`sentinel:crawl:${crawlId}:visited`, url);
                // Set TTL of 2 hours on the crawl set
                redisClient.expire(`sentinel:crawl:${crawlId}:visited`, 7200).catch(() => {});
                return added === 1;
            } catch (err) {
                console.warn('[Redis]: markVisited fallback:', err.message);
            }
        }

        if (!fallbackVisited.has(crawlId)) {
            fallbackVisited.set(crawlId, new Set());
        }
        const set = fallbackVisited.get(crawlId);
        if (set.has(url)) return false;
        set.add(url);
        return true;
    },

    async isVisited(crawlId, url) {
        if (isConnected && redisClient) {
            try {
                return (await redisClient.sismember(`sentinel:crawl:${crawlId}:visited`, url)) === 1;
            } catch (_) {}
        }
        const set = fallbackVisited.get(crawlId);
        return set ? set.has(url) : false;
    },

    async getVisitedCount(crawlId) {
        if (isConnected && redisClient) {
            try {
                return await redisClient.scard(`sentinel:crawl:${crawlId}:visited`);
            } catch (_) {}
        }
        const set = fallbackVisited.get(crawlId);
        return set ? set.size : 0;
    },

    async getVisitedUrls(crawlId) {
        if (isConnected && redisClient) {
            try {
                return await redisClient.smembers(`sentinel:crawl:${crawlId}:visited`);
            } catch (_) {}
        }
        const set = fallbackVisited.get(crawlId);
        return set ? Array.from(set) : [];
    },

    /**
     * Push a URL item to the FIFO queue
     */
    async pushQueue(crawlId, item) {
        const payload = JSON.stringify(item);
        if (isConnected && redisClient) {
            try {
                await redisClient.rpush(`sentinel:crawl:${crawlId}:queue`, payload);
                redisClient.expire(`sentinel:crawl:${crawlId}:queue`, 7200).catch(() => {});
                return;
            } catch (_) {}
        }

        if (!fallbackQueues.has(crawlId)) {
            fallbackQueues.set(crawlId, []);
        }
        fallbackQueues.get(crawlId).push(item);
    },

    /**
     * Pop the next URL item from the FIFO queue
     */
    async popQueue(crawlId) {
        if (isConnected && redisClient) {
            try {
                const itemStr = await redisClient.lpop(`sentinel:crawl:${crawlId}:queue`);
                if (itemStr) return JSON.parse(itemStr);
                return null;
            } catch (_) {}
        }

        const queue = fallbackQueues.get(crawlId);
        if (queue && queue.length > 0) {
            return queue.shift();
        }
        return null;
    },

    async getQueueLength(crawlId) {
        if (isConnected && redisClient) {
            try {
                return await redisClient.llen(`sentinel:crawl:${crawlId}:queue`);
            } catch (_) {}
        }
        const queue = fallbackQueues.get(crawlId);
        return queue ? queue.length : 0;
    },

    /**
     * Cache page audit results for ultra-fast rescan retrieval
     */
    async cachePageAudit(url, auditData, ttlSeconds = 3600) {
        const key = `sentinel:audit:${hashUrl(url)}`;
        if (isConnected && redisClient) {
            try {
                await redisClient.setex(key, ttlSeconds, JSON.stringify(auditData));
                return;
            } catch (_) {}
        }
        fallbackCache.set(key, { data: auditData, expiresAt: Date.now() + ttlSeconds * 1000 });
    },

    async getCachedPageAudit(url) {
        const key = `sentinel:audit:${hashUrl(url)}`;
        if (isConnected && redisClient) {
            try {
                const cached = await redisClient.get(key);
                if (cached) return JSON.parse(cached);
            } catch (_) {}
        }
        const entry = fallbackCache.get(key);
        if (entry && entry.expiresAt > Date.now()) {
            return entry.data;
        }
        return null;
    },

    /**
     * Clean up keys for a completed crawl
     */
    async cleanCrawl(crawlId) {
        if (isConnected && redisClient) {
            try {
                await redisClient.del(
                    `sentinel:crawl:${crawlId}:visited`,
                    `sentinel:crawl:${crawlId}:queue`
                );
            } catch (_) {}
        }
        fallbackQueues.delete(crawlId);
        fallbackVisited.delete(crawlId);
    }
};

module.exports = redisService;
