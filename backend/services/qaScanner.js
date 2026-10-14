
/**
 * runDedicatedScan - Ultimate fallback using a fresh browser instance
 */
async function runDedicatedScan(url, existingPort = null) {
    let chrome;
    try {
        const lighthouse = (await import('lighthouse')).default;
        const chromeLauncher = await import('chrome-launcher');
        const { chromium } = require('playwright');
        
        console.log(`[qaScanner]: Initiating tactical pulse for ${url}...`);

        let port;
        if (existingPort) {
            console.log(`[qaScanner]: Attaching to existing tactical port ${existingPort} (Flash-Mode Active).`);
            port = existingPort;
        } else {
            console.log(`[qaScanner]: Launching dedicated Chromium pulse...`);
            let chromePath;
            try {
                chromePath = chromium.executablePath();
                console.log(`[qaScanner]: Bound to Playwright Chromium: ${chromePath}`);
            } catch (e) {
                console.warn('[qaScanner]: Could not determine Playwright Chromium path, letting chrome-launcher decide.');
            }

            chrome = await chromeLauncher.launch({ 
                chromePath: chromePath, 
                startingPort: 9300, 
                chromeFlags: [
                    '--headless=new', // Modern headless mode for better WAF evasion
                    '--no-sandbox', 
                    '--disable-gpu',
                    '--disable-web-security',
                    '--ignore-certificate-errors',
                    '--remote-allow-origins=*',
                    '--disable-blink-features=AutomationControlled',
                    '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
                ] 
            });
            port = chrome.port;
            console.log(`[qaScanner]: Pulse Port Active: ${port}. Adaptive Stabilization (2.5s)...`);
            await new Promise(res => setTimeout(res, 2500));
        }

        const result = await lighthouse(url, {
            port: port,
            output: 'json',
            logLevel: 'silent', 
            onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'],
            settings: {
                throttlingMethod: 'simulate',
                throttling: {
                    rttMs: 40,
                    throughputKbps: 10240,
                    requestLatencyMs: 0,
                    downloadThroughputKbps: 0,
                    uploadThroughputKbps: 0,
                    cpuSlowdownMultiplier: 1
                },
                skipAudits: ['screenshot-thumbnails', 'final-screenshot', 'full-page-screenshot'], // Speed: Skip heavy assets
                screenEmulation: {
                    mobile: false,
                    width: 1440,
                    height: 900,
                    deviceScaleFactor: 1,
                    disabled: false,
                },
                extraHeaders: {
                    'Accept-Language': 'en-US,en;q=0.9',
                    'Sec-CH-UA': '"Not A(Brand";v="99", "Google Chrome";v="122", "Chromium";v="122"',
                    'Sec-CH-UA-Mobile': '?0',
                    'Sec-CH-UA-Platform': '"Windows"',
                    'Sec-Fetch-Dest': 'document',
                    'Sec-Fetch-Mode': 'navigate',
                    'Sec-Fetch-Site': 'none',
                    'Sec-Fetch-User': '?1'
                }
            }
        });

        if (result && result.lhr) {
            console.log(`[qaScanner]: Telemetry Captured for ${url}. Scores -> Perf: ${Math.round(result.lhr.categories.performance?.score * 100 || 0)}`);
            return processLhr(result.lhr, url);
        }
        
        throw new Error('Dedicated pulse returned no telemetry.');
    } catch (err) {
        console.error(`[qaScanner Critical Failure]: Dedicated Pulse failed for ${url}: ${err.message}`);
        return {
            scores: { performance: 0, accessibility: 0, bestPractices: 0, seo: 0 },
            accessibilityIssues: []
        };
    } finally {
        if (chrome) {
            console.log('[qaScanner]: Closing dedicated bridge...');
            try {
                if (typeof chrome.kill === 'function') {
                    await chrome.kill();
                }
            } catch (killErr) {
                console.warn('[qaScanner]: Non-critical cleanup failure:', killErr.message);
            }
            // --- High-Resiliency Cleanup Window (V34) ---
            await new Promise(res => setTimeout(res, 100));
        }
    }
}

/**
 * processLhr - Extracts strategic telemetry from the Lighthouse Result
 */
function processLhr(lhr, url) {
    const accessibilityAudits = [];
    const audits = lhr.audits || {};
    const accessCategory = lhr.categories.accessibility;
    
    if (accessCategory && accessCategory.auditRefs) {
        accessCategory.auditRefs.forEach(ref => {
            const audit = audits[ref.id];
            if (audit && audit.score !== null && audit.score < 1) {
                accessibilityAudits.push({
                    page: url,
                    issue: audit.title,
                    severity: ref.weight > 7 ? 'Critical' : ref.weight > 3 ? 'Medium' : 'Low',
                    element: audit.description?.substring(0, 300) || 'Structural non-compliance detected.',
                    recommendation: audit.title,
                    suggestedFix: audit.description
                });
            }
        });
    }

    const coreWebVitals = {
        lcp: audits['largest-contentful-paint']?.displayValue || 'N/A',
        cls: audits['cumulative-layout-shift']?.displayValue || 'N/A',
        fcp: audits['first-contentful-paint']?.displayValue || 'N/A',
        tbt: audits['total-blocking-time']?.displayValue || 'N/A'
    };

    const finalScores = {
        performance: Math.round((lhr.categories.performance?.score || 0) * 100),
        accessibility: Math.round((lhr.categories.accessibility?.score || 0) * 100),
        bestPractices: Math.round((lhr.categories['best-practices']?.score || 0) * 100),
        seo: Math.round((lhr.categories.seo?.score || 0) * 100)
    };

    console.log(`[qaScanner]: Processed Pulse Scores for ${url} | Perf: ${finalScores.performance} | SEO: ${finalScores.seo}`);

    return {
        scores: finalScores,
        coreWebVitals,
        accessibilityIssues: accessibilityAudits
    };
}

module.exports = { runDedicatedScan };
