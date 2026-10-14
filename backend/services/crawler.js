const { chromium } = require('playwright');
const ScanReport = require('../models/ScanReport');
const axios = require('axios');
const path = require('path');
const linkGuardian = require('./linkGuardian');
const scriptGuardian = require('./scriptGuardian');

/**
 * crawlWebsite - Universal Crawler with Discovery Constraints
 * @param {Object} options - { maxPages, maxDepth, emitProgress }
 */
const crawlWebsite = async (reportId, baseUrl, emitProgress, options = {}) => {
    const visited = new Set();
    const queue = [{ url: baseUrl, depth: 0 }];
    const internalPages = new Set();
    // Use a Map to track the source page for each link to provide better context
    const linkSourceMap = new Map(); 
    const brokenLinks = [];
    const securityIssues = [];
    
    const scope = options.scope || 'single';
    const maxPages = scope === 'site' ? (options.maxPages || 50) : 1;
    const maxDepth = scope === 'site' ? (options.maxDepth !== undefined ? options.maxDepth : 3) : 0;
    const maxLinksToCheck = scope === 'site' ? 50 : 20;
    const structure = { nodes: [], links: [] };

    const progress = (p, s) => {
        if (emitProgress) emitProgress(p, s);
    };
    
    let domain;
    try {
        domain = new URL(baseUrl).hostname;
    } catch (_) {
        return [baseUrl];
    }

    progress(7, `Initializing diagnostics for ${domain}...`);

    // ─── Phase 0: Pre-flight Reachability ─────────────────
    // (Security Pattern for baseUrl is handled by Master Worker for deduplication)

    try {
        progress(8, `Probing host reachability...`);
        await axios.get(baseUrl, { 
            timeout: 5000, 
            headers: { 'User-Agent': 'Sentinel-Safe-Probe/1.0' },
            validateStatus: () => true 
        });
    } catch (e) {
        console.warn(`[Crawler]: Host ${domain} appears offline. Skipping browser scan.`);
        progress(10, "Target host is unreachable. Finalizing telemetry...");
        
        // Return only baseUrl since we're offline
        return [baseUrl];
    }

    // ─── Phase 0.5: Sitemap Auto-Discovery ─────────────────────────────
    const fetchSitemapUrls = async (targetBaseUrl, targetDomain) => {
        const discovered = [];
        try {
            const origin = new URL(targetBaseUrl).origin;
            const candidates = [`${origin}/sitemap.xml`, `${origin}/sitemap_index.xml` ];
            for (const smUrl of candidates) {
                try {
                    const res = await axios.get(smUrl, { 
                        timeout: 4000, 
                        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }, 
                        validateStatus: s => s === 200 
                    });
                    if (res.data && typeof res.data === 'string') {
                        const matches = res.data.match(/<loc>(.*?)<\/loc>/gi);
                        if (matches) {
                            matches.forEach(m => {
                                const u = m.replace(/<\/?loc>/gi, '').trim();
                                try {
                                    if (new URL(u).hostname === targetDomain && !discovered.includes(u)) {
                                        discovered.push(u);
                                    }
                                } catch (_) {}
                            });
                        }
                    }
                } catch (_) {}
                if (discovered.length > 0) break;
            }
        } catch (_) {}
        return discovered;
    };

    let browser;
    try {
        if (scope === 'site') {
            progress(9, `Extracting sitemap index for ${domain}...`);
            const sitemapUrls = await fetchSitemapUrls(baseUrl, domain);
            if (sitemapUrls.length > 0) {
                console.log(`[Crawler]: Discovered ${sitemapUrls.length} canonical URLs from sitemap.`);
                sitemapUrls.slice(0, 40).forEach(smUrl => {
                    if (!queue.some(q => q.url === smUrl)) {
                        queue.push({ url: smUrl, depth: 1 });
                    }
                });
            }
        }

        const port = 9222 + Math.floor(Math.random() * 100);
        browser = await chromium.launch({
            headless: true,
            args: [
                `--remote-debugging-port=${port}`,
                '--no-sandbox', 
                '--disable-setuid-sandbox',
                '--disable-blink-features=AutomationControlled'
            ]
        });

        const context = await browser.newContext({
            viewport: { width: 1440, height: 900 },
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            extraHTTPHeaders: {
                'Accept-Language': 'en-US,en;q=0.9',
                'Sec-CH-UA': '"Not A(Brand";v="99", "Google Chrome";v="122", "Chromium";v="122"',
                'Sec-CH-UA-Mobile': '?0',
                'Sec-CH-UA-Platform': '"Windows"',
                'Sec-Fetch-Dest': 'document',
                'Sec-Fetch-Mode': 'navigate',
                'Sec-Fetch-Site': 'none',
                'Sec-Fetch-User': '?1',
                'Upgrade-Insecure-Requests': '1'
            }
        });

        // --- FLASH-MODE: Resource Shield (V3) ---
        await context.route('**/*', (route) => {
            const url = route.request().url();
            const blockedDomains = [
                'google-analytics.com', 'googletagmanager.com', 'facebook.com', 
                'connect.facebook.net', 'ads-twitter.com', 'doubleclick.net', 
                'adnxs.com', 'hotjar.com'
            ];
            if (blockedDomains.some(d => url.includes(d))) return route.abort();
            route.continue();
        });

        const page = await context.newPage();

        // ─── Phase 1: Distributed Page Discovery ──────────────────────────────
        while (queue.length > 0 && visited.size < maxPages) {
            const { url, depth } = queue.shift();
            if (visited.has(url) || depth > maxDepth) continue;
            visited.add(url);

            try {
                // Tactical Navigation: Wait for 'commit' to bypass WAF hangs
                await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
                
                // Trigger dynamic scroll hydration for SPAs & lazy loaded routes
                await page.evaluate(() => {
                    window.scrollTo({ top: document.body.scrollHeight / 2, behavior: 'smooth' });
                });
                await page.waitForTimeout(2000).catch(() => {});
                
                internalPages.add(url);
                progress(10, `Hydration Stabilized: Scanned ${new URL(url).pathname}`);

                // Site Structure Mapping
                const pathName = new URL(url).pathname || '/';
                if (!structure.nodes.find(n => n.id === url)) {
                    structure.nodes.push({ id: url, label: pathName, url, depth });
                }

                // Deep Link Extraction across a[href], data-href, router-link
                const links = await page.evaluate(() => {
                    const raw = Array.from(document.querySelectorAll('a[href], [data-href], [router-link]'))
                        .map(el => el.getAttribute('href') || el.getAttribute('data-href') || el.getAttribute('router-link'))
                        .filter(Boolean);
                    
                    return raw.map(attr => {
                        try {
                            const abs = new URL(attr, window.location.href);
                            abs.hash = ''; // Strip fragments
                            return abs.href;
                        } catch {
                            return null;
                        }
                    }).filter(h => h && h.startsWith('http') && !h.includes('mailto:') && !h.includes('tel:'));
                });
                
                // --- INDUSTRY AST & ENDPOINT MINER: Extract hidden routes from JavaScript bundles ---
                const scriptUrls = await page.evaluate(() => 
                    Array.from(document.querySelectorAll('script[src]'))
                        .map(s => s.src)
                        .filter(src => src.startsWith('http'))
                );

                // Mine same-origin JavaScript files for hidden API/Application endpoints
                const sameOriginScripts = scriptUrls.filter(s => {
                    try { return new URL(s).hostname === domain; } catch { return false; }
                }).slice(0, 5);

                for (const scriptUrl of sameOriginScripts) {
                    try {
                        const scriptRes = await axios.get(scriptUrl, {
                            timeout: 4000,
                            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
                            validateStatus: s => s === 200
                        });
                        if (typeof scriptRes.data === 'string') {
                            const routeRegex = /(?:"|')(\/(?:[a-zA-Z0-9_\-\.]+\/)*[a-zA-Z0-9_\-\.]+)(?:"|')/g;
                            let match;
                            let minedCount = 0;
                            while ((match = routeRegex.exec(scriptRes.data)) !== null && minedCount < 15) {
                                const routePath = match[1];
                                if (!/\.(png|jpg|jpeg|gif|css|svg|woff2?|ttf|ico|json)$/i.test(routePath) && routePath.length > 2) {
                                    const minedUrl = `https://${domain}${routePath}`;
                                    if (!visited.has(minedUrl) && !queue.some(q => q.url === minedUrl)) {
                                        queue.push({ url: minedUrl, depth: depth + 1 });
                                        minedCount++;
                                    }
                                }
                            }
                        }
                    } catch (_) {}
                }

                links.forEach(link => {
                    if (!linkSourceMap.has(link)) {
                        linkSourceMap.set(link, url);
                    }
                    
                    try {
                        const linkUrl = new URL(link);
                        if (linkUrl.hostname === domain && scope === 'site') {
                            if (!visited.has(link) && !queue.find(q => q.url === link)) {
                                queue.push({ url: link, depth: depth + 1 });
                            }
                        }
                    } catch (_) {}
                });
            } catch (e) {
                console.warn(`[Crawler]: Failed to discover links on ${url}: ${e.message}`);
            }
        }

        await browser.close();
        browser = null;

        // ─── Phase 2: Bot-Tolerant Centralized Link Audit (Warp-Drive) ─
        const maxLinksToCheck = scope === 'site' ? 30 : 15; // Optimized for Speed
        const uniqueLinks = Array.from(linkSourceMap.keys()).slice(0, maxLinksToCheck);
        progress(12, `Neural Tracing: Verifying ${uniqueLinks.length} navigation nodes...`);

        const linkBatchSize = 10; // Concurrency for link checks
        for (let i = 0; i < uniqueLinks.length; i += linkBatchSize) {
            const batch = uniqueLinks.slice(i, i + linkBatchSize);
            await Promise.allSettled(
                batch.map(async (link) => {
                    try {
                        let status = 0;
                        const config = {
                            timeout: 4000,
                            maxRedirects: 3,
                            validateStatus: () => true,
                            headers: { 
                                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
                                'Accept-Language': 'en-US,en;q=0.5'
                            }
                        };

                    try {
                        const res = await axios.head(link, config);
                        status = res.status;
                        if (status === 405 || status === 403 || status === 999) {
                            const getRes = await axios.get(link, config);
                            status = getRes.status;
                        }
                    } catch (e) {
                        status = e.response ? e.response.status : 0;
                    }

                    // Bot-Block Tolerance: Ignore 403, 429, and 999 for external domains 
                    // as they represent bot filtering rather than broken links.
                    const isExternal = new URL(link).hostname !== domain;
                    const botBlockedCodes = [403, 429, 999];
                    
                    if (isExternal && botBlockedCodes.includes(status)) {
                        return; // Assume functional but filtered
                    }

                    const isBroken = status === 0 || status === 404 || status === 410 || (status >= 500 && !isExternal);

                    // --- NEW: LinkGuardian AI Analysis ---
                    const securityCheck = linkGuardian.analyze(link);
                    if (securityCheck.isMalicious) {
                        securityIssues.push({
                            page: baseUrl,
                            issue: `Malicious Link Detected: ${securityCheck.threatType}`,
                            link: link,
                            severity: 'Critical',
                            reason: securityCheck.reason,
                            suggestedFix: `Remove or replace this link immediately. It matches high-risk phishing or malware distribution patterns (${securityCheck.riskScore}% risk confidence).`
                        });
                    }

                    if (isBroken) {
                        brokenLinks.push({
                            page: linkSourceMap.get(link) || baseUrl,
                            link: link,
                            status: status,
                            recommendation:
                                status === 0 ? 'Connection failed — host may be down or URL is malformed.' :
                                status === 404 ? 'Page/resource not found. Update or remove this link.' :
                                status === 410 ? 'Resource permanently removed. Remove this link.' :
                                status >= 500 ? 'Server error on destination. Contact server owner.' :
                                'Link appears broken. Verify the destination URL.'
                        });
                    }
                } catch (_) {}
            })
        );
    }

        const update = { $set: { pagesCrawled: internalPages.size, siteStructure: structure } };
        
        if (brokenLinks.length > 0) {
            update.$push = { brokenLinks: { $each: brokenLinks } };
        }

        if (securityIssues.length > 0) {
            update.$push = update.$push || {};
            update.$push.securityIssues = { $each: securityIssues };
            console.log(`[Crawler]: ${securityIssues.length} malicious links detected.`);
        }

        await ScanReport.findByIdAndUpdate(reportId, update);
        progress(15, `Audit complete. Optimized ${uniqueLinks.length} link checks.`);
        return Array.from(internalPages);

    } catch (error) {
        console.error(`[Crawler] Critical failure: ${error.message}`);
        return [baseUrl];
    } finally {
        if (browser) await browser.close();
    }
};

module.exports = { crawlWebsite };
