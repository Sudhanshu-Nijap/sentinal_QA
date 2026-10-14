const axios = require('axios');
const Groq = require('groq-sdk');

// In-memory cache with auto-pruning
const cache = new Map();
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes cache for efficiency

// High-risk TLDs commonly used in phishing campaigns
const HIGH_RISK_TLDS = ['.zip', '.mov', '.top', '.xyz', '.tk', '.ml', '.ga', '.cf', '.gq', '.work', '.click'];

// Provided Google Safe Browsing API Key
const GOOGLE_SB_API_KEY = process.env.GOOGLE_SB_API_KEY || 'AIzaSyBbWmbL4QowadQXO07yZ2ODLuFADjhDXuQ';

/**
 * Prunes expired entries from in-memory cache to maintain low memory overhead
 */
function pruneCache() {
    const now = Date.now();
    for (const [key, value] of cache.entries()) {
        if (now - value.timestamp > CACHE_TTL) {
            cache.delete(key);
        }
    }
}

/**
 * analyzeURLSecurity - Enterprise URL Threat & Phishing Detection Engine
 */
async function analyzeURLSecurity(urlString) {
    if (!urlString || typeof urlString !== 'string') {
        return { blocked: false, riskLevel: 'low', reason: 'Invalid URL string' };
    }

    try {
        pruneCache();

        const urlObj = new URL(urlString.trim());
        // Canonicalize URL by stripping common tracking parameters
        const canonicalParams = new URLSearchParams(urlObj.search);
        ['utm_source', 'utm_medium', 'utm_campaign', 'fbclid', 'gclid'].forEach(p => canonicalParams.delete(p));
        const normalizedUrl = urlObj.origin + urlObj.pathname + (canonicalParams.toString() ? '?' + canonicalParams.toString() : '');

        // 0. Cache Check (Fast path)
        if (cache.has(normalizedUrl)) {
            const cachedResult = cache.get(normalizedUrl);
            if (Date.now() - cachedResult.timestamp < CACHE_TTL) {
                return { ...cachedResult.verdict, cached: true };
            } else {
                cache.delete(normalizedUrl);
            }
        }

        const hostname = urlObj.hostname.toLowerCase();

        // 1. SSRF & Private IP Address Blocklist (allows local scanning in development)
        const isLocalHost = (
            hostname === 'localhost' || 
            hostname === '127.0.0.1' || 
            hostname === '0.0.0.0' || 
            hostname === '::1'
        );
        const isPrivateIp = (
            hostname.startsWith('192.168.') || 
            hostname.startsWith('10.') ||
            hostname.startsWith('172.16.')
        );
        const allowLocal = process.env.ALLOW_LOCAL_SCAN === 'true' || process.env.NODE_ENV !== 'production';

        if ((isLocalHost && !allowLocal) || (isPrivateIp && !allowLocal)) {
            const blockVerdict = { 
                blocked: true, 
                riskLevel: 'high', 
                reason: "Internal Address Blocked (SSRF Guard)", 
                explanation: "Target URL resolves to an internal or non-routable private IP address space." 
            };
            cache.set(normalizedUrl, { timestamp: Date.now(), verdict: blockVerdict });
            return blockVerdict;
        }

        // 2. High-Risk TLD Check
        const matchesHighRiskTLD = HIGH_RISK_TLDS.some(tld => hostname.endsWith(tld));

        // 3. Typo-Squatting / Homoglyph Brand Protection
        const PREMIUM_BRANDS = ['google.com', 'paypal.com', 'microsoft.com', 'facebook.com', 'apple.com', 'amazon.com', 'github.com', 'gmail.com', 'netflix.com'];
        const subbedHostname = hostname
            .replace(/0/g, 'o')
            .replace(/1/g, 'l')
            .replace(/vv/g, 'w')
            .replace(/rn/g, 'm')
            .replace(/q/g, 'g')
            .replace(/5/g, 's');
        
        if (hostname !== subbedHostname) {
            const matchesBrand = PREMIUM_BRANDS.some(brand => subbedHostname === brand || subbedHostname.endsWith('.' + brand));
            if (matchesBrand && !PREMIUM_BRANDS.includes(hostname)) {
                const blockVerdict = { 
                    blocked: true, 
                    riskLevel: 'high', 
                    reason: "Typo-squatted brand mimicry", 
                    explanation: `Homoglyph pattern detected (${hostname} visually mimics high-value target ${subbedHostname}).` 
                };
                cache.set(normalizedUrl, { timestamp: Date.now(), verdict: blockVerdict });
                return blockVerdict;
            }
        }

        // 4. Heuristic Threat Scoring
        const suspiciousKeywords = ["login", "verify", "secure", "account", "update", "bank", "payment", "billing", "invoice", "wallet", "signin", "auth"];
        const lowerUrl = normalizedUrl.toLowerCase();
        let heuristicScore = 0;

        for (const kw of suspiciousKeywords) {
            if (lowerUrl.includes(kw)) heuristicScore += 0.2;
        }
        if (lowerUrl.includes("redirect=") || lowerUrl.includes("url=")) heuristicScore += 0.3;
        if (normalizedUrl.length > 150) heuristicScore += 0.2;
        if (normalizedUrl.includes("%") || normalizedUrl.includes("base64")) heuristicScore += 0.2;
        if (matchesHighRiskTLD) heuristicScore += 0.3;

        // Heavy penalty for unencrypted HTTP sensitive endpoints
        if (lowerUrl.startsWith("http://") && heuristicScore > 0) {
            heuristicScore += 0.4;
        }

        if (heuristicScore >= 0.7) {
            const blockVerdict = {
                blocked: true,
                riskLevel: "high",
                reason: "Suspicious Heuristic Profile",
                explanation: `URL structure accumulated high threat probability score (${(heuristicScore * 100).toFixed(0)}%).`
            };
            cache.set(normalizedUrl, { timestamp: Date.now(), verdict: blockVerdict });
            return blockVerdict;
        }

        // 5. Google Safe Browsing API Check (with 1.5s fast timeout)
        try {
            const sbResponse = await axios.post(
                `https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${GOOGLE_SB_API_KEY}`, 
                {
                    client: { clientId: "sentinel-qa", clientVersion: "2.0.0" },
                    threatInfo: {
                        threatTypes: ["MALWARE", "SOCIAL_ENGINEERING", "UNWANTED_SOFTWARE", "POTENTIALLY_HARMFUL_APPLICATION"],
                        platformTypes: ["ANY_PLATFORM"],
                        threatEntryTypes: ["URL"],
                        threatEntries: [{ url: normalizedUrl }]
                    }
                }, 
                { timeout: 1500 }
            );

            if (sbResponse.data && sbResponse.data.matches && sbResponse.data.matches.length > 0) {
                const threatType = sbResponse.data.matches[0].threatType || 'MALWARE';
                const blockVerdict = {
                    blocked: true,
                    riskLevel: "critical",
                    reason: `Global Threat Intelligence Flagged (${threatType})`,
                    explanation: "This URL has been flagged by global intelligence registries as active malware or phishing."
                };
                cache.set(normalizedUrl, { timestamp: Date.now(), verdict: blockVerdict });
                return blockVerdict;
            }
        } catch (sbError) {
            // Fail silently to heuristic/AI checks if API key or network fails
        }

        // 6. AI Risk Classification via Groq (Fast Tier)
        try {
            const groqApiKey = process.env.GROQ_API_KEY;
            if (groqApiKey) {
                const groq = new Groq({ apiKey: groqApiKey });
                const aiResponse = await groq.chat.completions.create({
                    messages: [
                        { 
                            role: 'system', 
                            content: `You are an AI Security Gatekeeper analyzing target URLs for security risk. Return JSON with format: {"riskLevel": "low"|"medium"|"high", "reason": "concise explanation"}` 
                        },
                        { role: 'user', content: `Analyze URL: ${normalizedUrl}` }
                    ],
                    model: process.env.GROQ_AI_DEBUGGER_MODEL || 'llama-3.3-70b-versatile',
                    temperature: 0.2,
                    response_format: { type: "json_object" }
                });

                const aiResult = JSON.parse(aiResponse.choices[0].message.content);
                const riskLevel = (aiResult.riskLevel || aiResult.risk_level || "low").toLowerCase();

                if (riskLevel === "high" || riskLevel === "critical") {
                    const blockVerdict = {
                        blocked: true,
                        riskLevel: "high",
                        reason: "AI Security Risk Model",
                        explanation: aiResult.reason || "Suspicious phishing or credential harvesting pattern detected by AI."
                    };
                    cache.set(normalizedUrl, { timestamp: Date.now(), verdict: blockVerdict });
                    return blockVerdict;
                } else if (riskLevel === "medium") {
                    const allowedVerdict = {
                        blocked: false,
                        riskLevel: "medium",
                        warning: aiResult.reason || "Potential caution advised on this domain."
                    };
                    cache.set(normalizedUrl, { timestamp: Date.now(), verdict: allowedVerdict });
                    return allowedVerdict;
                }
            }
        } catch (aiError) {
            // Log and fallback to default allow
        }

        // Default: Clean verdict
        const allowVerdict = { blocked: false, riskLevel: matchesHighRiskTLD ? "medium" : "low" };
        cache.set(normalizedUrl, { timestamp: Date.now(), verdict: allowVerdict });
        return allowVerdict;

    } catch (e) {
        console.error("[URL Security Analyzer]: Exception during evaluation:", e.message);
        return { blocked: false, riskLevel: "low", error: e.message };
    }
}

module.exports = { analyzeURLSecurity };

