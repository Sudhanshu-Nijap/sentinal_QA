const { chromium } = require('playwright');
const ScanReport = require('../models/ScanReport');
const crawler = require('./crawler');
const path = require('path');
const linkGuardian = require('./linkGuardian');
const axios = require('axios');
const secretSniffer = require('./secretSniffer');
const { scanInteractions } = require('./interactionScanner');
const { auditLayout } = require('./layoutAuditor');
const { auditStorage } = require('./storageAuditor');
const { fuzzEdgeCases } = require('./edgeCaseFuzzer');
const { auditResponsiveMatrix } = require('./responsiveMatrixAuditor');
const { auditPerformance } = require('./performanceOptimizer');

// Import Specialist Agents
const fs = require('fs');

const screenshotsDir = path.join(__dirname, '../screenshots');
if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
}

// Helper: wrap promise with timeout
const withTimeout = (promise, ms, taskName) => {
    const timeout = new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`${taskName} timed out after ${ms}ms`)), ms)
    );
    return Promise.race([promise, timeout]);
};

/**
 * scanConsole - Captures JS exceptions and console warnings
 */
const scanConsole = async (page) => {
    const logs = [];
    page.on('console', msg => {
        if (msg.type() === 'error') {
            const text = msg.text();
            if (text.includes('[HMR]') || text.includes('[WDS]') || text.includes('React DevTools')) return;
            logs.push({
                page: page.url(),
                message: text.substring(0, 500),
                type: 'error',
                location: msg.location().url || 'inline'
            });
        }
    });
    return logs;
};

/**
 * scanNetwork - Captures 4xx/5xx failures
 */
const scanNetwork = async (page) => {
    const failures = [];
    page.on('response', response => {
        const status = response.status();
        if (status >= 400) {
            failures.push({
                method: response.request().method(),
                url: response.url(),
                status,
                type: response.request().resourceType()
            });
        }
    });
    return failures;
};

/**
 * scanForms - Basic validation and accessibility check for forms
 */
const scanForms = async (page) => {
    return await page.evaluate(() => {
        return Array.from(document.querySelectorAll('form')).map(form => ({
            id: form.id || 'anonymous',
            action: form.action,
            inputs: form.querySelectorAll('input').length,
            missingLabels: Array.from(form.querySelectorAll('input:not([aria-label]):not([id])')).length
        }));
    });
};

/**
 * scanUI - Detects basic layout issues (overflow, empty headers)
 */
const scanUI = async (page) => {
    return await page.evaluate(() => {
        const issues = [];
        
        // 1. Layout Integrity
        if (document.body.scrollWidth > window.innerWidth) {
            issues.push({ type: 'UX_VISUAL', issue: 'Horizontal overflow detected', severity: 'Medium', recommendation: 'Check for elements with fixed widths or absolute positioning leaking outside of viewport.' });
        }
        
        // 2. SEO & Structure
        if (!document.querySelector('h1')) {
            issues.push({ type: 'SEO_STRUCTURAL', issue: 'Missing H1 heading', severity: 'Low', recommendation: 'Every page should have exactly one H1 for optimal search indexing.' });
        }

        // --- Spatial Intelligence Helpers ---
        const getSpatialContext = (el) => {
            try {
                // Find nearest heading or section title
                let current = el.parentElement;
                while (current && current !== document.body) {
                    const heading = current.querySelector('h1, h2, h3, h4, h5, h6');
                    if (heading && heading.innerText?.trim()) return heading.innerText.trim();
                    current = current.parentElement;
                }
                return 'Main Content';
            } catch { return 'Global'; }
        };

        const generateIdentifiableSelector = (el) => {
            if (el.tagName === 'IMG') return el.src;
            const id = el.id ? `#${el.id}` : '';
            const cls = (el.className && typeof el.className === 'string') 
                ? `.${el.className.split(/\s+/).filter(Boolean).slice(0, 3).join('.')}` 
                : '';
            const text = el.innerText?.trim().substring(0, 20);
            return `${el.tagName.toLowerCase()}${id}${cls}${text ? ` [${text}]` : ''}` || el.tagName.toLowerCase();
        };

        const addIssue = (item, issueObj) => {
            if (!window.__sentinel_atlas) window.__sentinel_atlas = new Set();
            const signature = `${issueObj.type}|${issueObj.selector}`;
            if (window.__sentinel_atlas.has(signature)) return;
            window.__sentinel_atlas.add(signature);
            
            // Capture a safe snippet of the offending element
            let htmlSnippet = 'UNAVAILABLE';
            let rect = { x: 0, y: 0, width: 0, height: 0 };
            try {
                htmlSnippet = item.outerHTML?.substring(0, 500);
                const r = item.getBoundingClientRect();
                rect = { x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height) };
            } catch (e) {}

            issues.push({
                ...issueObj,
                location: getSpatialContext(item),
                htmlSnippet: htmlSnippet,
                rect: rect,
                timestamp: new Date().toISOString()
            });
        };

        // 3. Image UX
        const images = Array.from(document.querySelectorAll('img'));
        images.forEach(img => {
            const rect = img.getBoundingClientRect();
            if (rect.width < 30 && rect.height < 30) return;

            if (!img.alt && !img.hasAttribute('aria-label') && !img.hasAttribute('alt')) {
                addIssue(img, { 
                    type: 'UX_ACCESSIBILITY', 
                    issue: 'Image missing alternate text', 
                    severity: 'Low', 
                    selector: img.src,
                    technicalImpact: 'Visually impaired visitors using screen readers cannot understand this image without descriptive text (WCAG 1.1.1). Also impacts SEO ranking.',
                    recommendation: 'Add descriptive alt text to the <img> tag (e.g. alt="Organization Logo"), or alt="" if purely decorative.' 
                });
            }
        });

        // 4. Interactive Target Integrity (Only audit standalone buttons and primary CTAs, avoid inline text links)
        const buttons = Array.from(document.querySelectorAll('button, [role="button"], input[type="button"], input[type="submit"]'));
        buttons.forEach(el => {
            const rect = el.getBoundingClientRect();
            
            if (rect.width >= 12 && rect.height >= 12 && (rect.width < 32 || rect.height < 32)) {
                addIssue(el, {
                    type: 'UX_MOBILE',
                    issue: 'Small button touch target (<32px)',
                    severity: 'Low',
                    selector: generateIdentifiableSelector(el),
                    technicalImpact: 'Sub-optimal mobile experience. Buttons below 32px increase user tap error rates on mobile viewports.',
                    recommendation: 'Increase button size to at least 44x44px for optimal mobile touch ergonomics.'
                });
            }

            const hasIcon = el.querySelector('svg, img, i, span, em');
            if (!el.innerText?.trim() && !el.getAttribute('aria-label') && !hasIcon) {
                addIssue(el, {
                    type: 'UX_VISUAL',
                    issue: 'Empty button detected (No text or icon)',
                    severity: 'Medium',
                    selector: generateIdentifiableSelector(el),
                    technicalImpact: 'Interaction dead-end. Without labels or icons, users cannot identify the purpose of this button.',
                    recommendation: 'Ensure all buttons have visible text, an icon, or an aria-label.'
                });
            }
        });

        return issues.slice(0, 100);
    });
};

/**
 * neuralScroll - Simulates a human scroll sequence to trigger lazy-loaded assets.
 */
const neuralScroll = async (page) => {
    await page.evaluate(async () => {
        await new Promise((resolve) => {
            let totalHeight = 0;
            const distance = 100;
            const timer = setInterval(() => {
                const scrollHeight = document.body.scrollHeight;
                window.scrollBy(0, distance);
                totalHeight += distance;
                if (totalHeight >= scrollHeight) {
                    clearInterval(timer);
                    window.scrollTo(0, 0);
                    resolve();
                }
            }, 50);
        });
    });
    await new Promise(res => setTimeout(res, 500));
};

/**
 * runSinglePageScan - Fast, converged audit of one URL
 */
const runSinglePageScan = async (reportId, url, scannedModules = [], emitProgress, atlas = null) => {
    let isBrowserClosed = false;
    let browser;
    try {
        const urlObj = new URL(url);
        const domain = urlObj.hostname;

        console.log(`[scanEngine]: Initiating Converged Lean Scan: ${url} | Modules: ${scannedModules.join(', ')}`);
        emitProgress(5, 'Establishing neural uplink...');
    
        const port = 9222 + Math.floor(Math.random() * 100);
        browser = await chromium.launch({ 
            headless: true,
            args: [
                `--remote-debugging-port=${port}`, 
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-blink-features=AutomationControlled' // Stealth: mask playwright presence
            ]
        });

        const context = await browser.newContext({
            viewport: { width: 1440, height: 900 },
            deviceScaleFactor: 2,
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
                'adnxs.com', 'impactradius-event.com', 'hotjar.com'
            ];
            
            if (blockedDomains.some(d => url.includes(d))) {
                return route.abort();
            }
            route.continue();
        });

        const page = await context.newPage();
        
        // --- GHOST PROTOCOL: Stealth Fingerprinting (V6 Hardening) ---
        await applyStealthPatches(page);

        // Initialize the global atlas for this page session if provided
        if (atlas) {
            await page.evaluate((serializedAtlas) => {
                window.__sentinel_atlas = new Set(serializedAtlas);
            }, Array.from(atlas));
        }

        const rawConsole = [];
        const rawNetwork = [];
        const securityIssues = [];
        const failedApiEndpoints = [];
        let totalSize = 0;
        let requestCount = 0;

        page.on('console', msg => {
            // High-Signal Filter: Only capture real errors, ignore trivial dev warnings and violations
            if (msg.type() === 'error') {
                const text = msg.text();
                if (text.includes('[HMR]') || text.includes('[WDS]') || text.includes('React DevTools')) return;
                // Do not log browser 404 resource loading errors as JavaScript runtime exceptions
                if (text.includes('Failed to load resource:') && text.includes('404')) return;

                const errorLocation = msg.location().url || '';
                rawConsole.push({
                    page: url,
                    message: text.substring(0, 500),
                    type: 'error',
                    location: errorLocation || 'inline',
                    recommendation: 'Fix JavaScript runtime failure or verify API payload handling.'
                });
            }
        });

        page.on('pageerror', err => {
            rawConsole.push({
                page: url,
                message: (err.message || 'Unknown Error').substring(0, 500),
                type: 'error',
                location: 'Uncaught Exception',
                recommendation: 'Fix unhandled JavaScript exception causing the browser to crash.'
            });
        });

        page.on('response', async (response) => {
            const status = response.status();
            requestCount++;
            try {
                const size = parseInt(response.headers()['content-length'] || '0');
                totalSize += size;
                const reqUrl = response.url();
                const resourceType = response.request().resourceType();
                const contentType = response.headers()['content-type'] || '';

                if (status >= 400) {
                    // Noise Filter: Ignore 3rd-party ad-trackers and favicon 404s
                    const isNoise = [
                        'google-analytics', 'googletagmanager', 'doubleclick', 'facebook.net',
                        'hotjar', 'clarity.ms', 'segment.io', 'favicon.ico'
                    ].some(noise => reqUrl.includes(noise));

                    if (!isNoise) {
                        const isPluginAsset = reqUrl.includes('/plugins/') || reqUrl.includes('/wp-content/plugins/') || reqUrl.includes('/modules/') || reqUrl.includes('revslider');
                        let issueDesc = `HTTP ${status} on ${response.request().method()} ${reqUrl}`;
                        let recDesc = status === 404 ? 'Asset or endpoint not found on server.' : 'Server or request failure.';
                        let customSeverity = status >= 500 ? 'High' : 'Medium';

                        if (isPluginAsset && status === 404) {
                            const fileName = reqUrl.split('/').pop().split('?')[0];
                            issueDesc = `Missing plugin asset (HTTP 404): ${fileName}`;
                            recDesc = 'The webpage template references a stylesheet or script from an uninstalled or inactive plugin. Remove the orphaned tag from the HTML layout to eliminate this 404 error and cut load latency.';
                            customSeverity = 'Low';
                        }

                        rawNetwork.push({
                            page: url,
                            method: response.request().method(),
                            url: reqUrl,
                            status,
                            type: isPluginAsset ? 'plugin_asset' : resourceType,
                            severity: customSeverity,
                            issue: issueDesc,
                            recommendation: recDesc
                        });

                        // ── Advanced API Telemetry & Stack Trace Inspection ──
                        if (resourceType === 'fetch' || resourceType === 'xhr' || contentType.includes('application/json')) {
                            failedApiEndpoints.push({
                                method: response.request().method(),
                                url: reqUrl,
                                status
                            });

                            response.text().then(body => {
                                if (body && body.length > 20) {
                                    const stackPatterns = [
                                        /at\s+[a-zA-Z0-9_\.]+\s+\([^\)]+:\d+:\d+\)/,
                                        /Traceback\s+\(most recent call last\):/,
                                        /(SequelizeDatabaseError|MongoServerError|PostgreSQL query failed|SQLException)/i,
                                        /SyntaxError:\s+Unexpected token/
                                    ];
                                    const hasStack = stackPatterns.some(p => p.test(body));
                                    if (hasStack) {
                                        securityIssues.push({
                                            page: url,
                                            type: 'SERVER_STACK_TRACE_LEAK',
                                            issue: `Internal server stack trace / database error leaked in API response (${status})`,
                                            severity: 'Critical',
                                            selector: reqUrl,
                                            details: body.substring(0, 350),
                                            technicalImpact: 'Critical CWE-209 flaw. API error body exposes internal backend file paths, framework details, or database schemas.',
                                            suggestedFix: 'Implement production error handling middleware to sanitize API error responses and log details server-side only.'
                                        });
                                    }
                                }
                            }).catch(() => {});
                        }
                    }
                }

                // ── Secret & Sensitive Data Sniffer ──
                const respUrl = reqUrl;

                if (status === 200 && (resourceType === 'script' || respUrl.endsWith('.js') || contentType.includes('javascript'))) {
                    response.text().then(scriptBody => {
                        if (scriptBody) {
                            const leaks = secretSniffer.auditScriptContent(scriptBody, respUrl, url);
                            if (leaks.length > 0) securityIssues.push(...leaks);
                        }
                    }).catch(() => {});

                    secretSniffer.checkSourceMapExposure(respUrl, url).then(mapIssue => {
                        if (mapIssue) securityIssues.push(mapIssue);
                    }).catch(() => {});
                }

                if (status === 200 && (contentType.includes('application/json') || resourceType === 'fetch' || resourceType === 'xhr')) {
                    response.json().then(jsonBody => {
                        if (jsonBody) {
                            const leaks = secretSniffer.auditJsonResponse(jsonBody, respUrl, url);
                            if (leaks.length > 0) securityIssues.push(...leaks);
                        }
                    }).catch(() => {});
                }
            } catch (_) {}
        });
        
        // --- Adaptive Navigation Strategy (WAF Bypass V2) ---
        const startTime = Date.now();
        console.log(`[scanEngine]: Initializing Ghost-Protocol Level 2 navigation for ${url}...`);
        
        const jitter = 200 + Math.floor(Math.random() * 600);
        await new Promise(res => setTimeout(res, jitter));

        try {
            await page.goto(url, { waitUntil: 'load', timeout: 35000 });
            console.log(`[scanEngine]: Uplink stable (${url}). Commencing Neural Drift...`);
            await page.waitForLoadState('domcontentloaded');
            await neuralDrift(page);
            await new Promise(r => setTimeout(r, 1000));
        } catch (navError) {
            console.warn(`[scanEngine]: Tactical Navigation delay: ${navError.message}. Triggering High-Resiliency Fallback...`);
            await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => {});
        }
        
        const loadTime = Date.now() - startTime;
        console.log(`[scanEngine]: Page stabilized through Neural Drift in ${loadTime}ms.`);
        
        emitProgress(25, 'Stabilizing page & triggering dynamic assets...');
        await neuralScroll(page).catch(() => {});
        
        await page.evaluate(() => {
            const selectors = [
                '[id*=\"cookie\"]', '[class*=\"cookie\"]', 
                '[id*=\"consent\"]', '[class*=\"consent\"]',
                '[id*=\"banner\"]', '[class*=\"banner\"]',
                '.modal-backdrop', '.modal-open',
                '[class*=\"overlay\"]', '[id*=\"overlay\"]',
                '#GdprBanner', '.cc-banner'
            ];
            selectors.forEach(s => {
                try {
                    document.querySelectorAll(s).forEach(el => {
                        el.style.display = 'none';
                        el.style.pointerEvents = 'none';
                        el.style.opacity = '0';
                    });
                } catch(e) {}
            });
        }).catch(() => {});

        // Optimized async stabilization
        await page.waitForTimeout(800);

        const screenshotName = `screenshot-${Date.now()}.png`;
        const screenshotPath = path.join(__dirname, '../screenshots', screenshotName);
        
        emitProgress(30, 'Capturing high-fidelity visual context...');
        await page.screenshot({ 
            path: screenshotPath, 
            fullPage: true, 
            animations: 'disabled',
            timeout: 30000 
        }).catch((e) => {
            console.warn('[scanEngine]: Full-page screenshot failed, falling back to viewport:', e.message);
            return page.screenshot({ path: screenshotPath, fullPage: false, timeout: 15000 });
        });

        // ── 1. Silent API Failure Detection ──
        if (failedApiEndpoints.length > 0) {
            const hasVisibleErrorState = await page.evaluate(() => {
                const errorSelectors = [
                    '[role="alert"]', '.toast', '.alert', '[class*="alert"]', 
                    '[class*="toast"]', '[class*="error-banner"]', '[class*="error-message"]',
                    '.notification', '.snackbar'
                ];
                return errorSelectors.some(sel => {
                    const els = document.querySelectorAll(sel);
                    return Array.from(els).some(el => {
                        const r = el.getBoundingClientRect();
                        return r.width > 20 && r.height > 10 && window.getComputedStyle(el).display !== 'none';
                    });
                });
            }).catch(() => false);

            if (!hasVisibleErrorState) {
                for (const failedApi of failedApiEndpoints.slice(0, 3)) {
                    rawNetwork.push({
                        page: url,
                        method: failedApi.method,
                        url: failedApi.url,
                        status: failedApi.status,
                        type: 'SILENT_API_FAILURE',
                        severity: 'High',
                        issue: `Silent API failure: ${failedApi.method} ${failedApi.url} (${failedApi.status}) returned error with zero visible UI feedback`,
                        technicalImpact: `Severe UX bug. An essential background API request failed with status ${failedApi.status}, but the interface presented no error toast, banner, or retry state to the user, causing a stalled or broken view.`,
                        recommendation: 'Attach error handling callbacks (try/catch or HTTP interceptor) to render user-facing error notifications when network requests fail.'
                    });
                }
            }
        }

        // ── 2. Client Storage & Token Leak Audit ──
        emitProgress(35, 'Auditing client-side storage for token & session leaks...');
        const storageIssues = await auditStorage(page, url).catch(() => []);
        if (storageIssues.length > 0) {
            securityIssues.push(...storageIssues);
        }

        // ── 3. Enhanced Form Fuzzer & State Diagnostics ──
        let formIssues = [];
        if (scannedModules.includes('forms') || scannedModules.includes('ui')) {
            emitProgress(40, 'Auditing form interaction layers & boundary validation...');
            const formScanner = require('./formScanner');
            formIssues = await formScanner.scanForms(page);
        }

        const uiIssues = scannedModules.includes('ui') ? await scanUI(page).catch(() => []) : [];

        // ── 4. Advanced Visual Collision & Click Interception Audit ──
        emitProgress(44, 'Auditing viewport collisions, click interception & clipped content...');
        const layoutIssues = await auditLayout(page, url).catch(() => []);
        if (layoutIssues.length > 0) {
            uiIssues.push(...layoutIssues);
        }

        // ── 5. Autonomous Dead-Click & Interaction Audit ──
        emitProgress(48, 'Auditing interactive buttons for dead-clicks & crashes...');
        const interactionIssues = await scanInteractions(page, url).catch(() => []);
        if (interactionIssues.length > 0) {
            uiIssues.push(...interactionIssues);
        }

        // ── 6. Autonomous Boundary, Security & Edge-Case Fuzzing ──
        emitProgress(52, 'Injecting edge-case fuzzing payloads & boundary stress tests...');
        const fuzzIssues = await fuzzEdgeCases(page, url).catch(() => []);
        if (fuzzIssues.length > 0) {
            formIssues.push(...fuzzIssues);
        }

        // ── 7. Multi-Viewport & Mobile Stress Matrix ──
        emitProgress(56, 'Auditing mobile (375px) responsive matrix & tap target collisions...');
        const responsiveIssues = await auditResponsiveMatrix(page, url).catch(() => []);
        if (responsiveIssues.length > 0) {
            uiIssues.push(...responsiveIssues);
        }

        // ── 8. Website Performance & Architectural Optimization Engine ──
        emitProgress(60, 'Auditing asset bloat, oversized images & render-blocking scripts...');
        const perfIssues = await auditPerformance(page, url).catch(() => []);
        if (perfIssues.length > 0) {
            uiIssues.push(...perfIssues);
        }

        const results = {
            url,
            consoleErrors: rawConsole,
            networkLogs: rawNetwork,
            uiIssues: uiIssues.map(u => ({ ...u, page: url })),
            formIssues: formIssues.map(f => ({ ...f, page: url })),
            securityIssues: securityIssues.map(s => ({ ...s, page: url })),
            loadTime,
            totalSize,
            requestCount,
            screenshot: { 
                page: url, 
                path: `/screenshots/${screenshotName}`, 
                type: 'High-Fidelity Scan',
                timestamp: new Date().toISOString()
            },
            accessibilityIssues: []
        };

        // --- 2c. Modular Deep Diagnostic (Pulse) ---
        if (scannedModules.includes('lighthouse')) {
            emitProgress(70, 'Running Lighthouse deep diagnostic (Synthetic Pulse)...');
            
            // --- SELF-HEALING PULSE PROTOCOL (V2) ---
            let lhResult = null;
            let attempts = 0;
            const maxAttempts = 2;

            while (attempts < maxAttempts) {
                try {
                    lhResult = await (require('./qaScanner').runDedicatedScan(url));
                    if (lhResult && lhResult.scores?.performance > 0) break;
                    throw new Error('Incomplete telemetry captured');
                } catch (lhErr) {
                    attempts++;
                    console.warn(`[scanEngine]: Lighthouse attempt ${attempts} failed: ${lhErr.message}`);
                    if (attempts < maxAttempts) {
                        emitProgress(72, `Pulse failure. Triggering Neural Reset (Attempt ${attempts + 1})...`);
                        await new Promise(r => setTimeout(r, 2500)); 
                    }
                }
            }

            if (lhResult) {
                results.lighthouseScores = lhResult.scores;
                results.accessibilityIssues.push(...lhResult.accessibilityIssues);
            }
        }

        let updatedAtlas = atlas;
        if (!isBrowserClosed) {
            const atlasData = await page.evaluate(() => Array.from(window.__sentinel_atlas || []));
            updatedAtlas = new Set(atlasData);
        }

        results.atlas = updatedAtlas;
        results.cdpPort = port;
        return results;

    } catch (criticalError) {
        console.error(`[scanEngine CRITICAL]: Neural Audit Gated: ${criticalError.message}`);
        await ScanReport.findByIdAndUpdate(reportId, { 
            status: 'failed', 
            error: criticalError.message 
        });
        throw criticalError;
    } finally {
        if (browser && !isBrowserClosed) await browser.close();
    }
};

/**
 * runTargetedCrawlScan - Ultra-fast multi-worker site-wide crawl and deep audit
 */
const runTargetedCrawlScan = async (reportId, url, tests, emitProgress, scope = 'site') => {
    console.log(`[scanEngine]: Initiating High-Throughput Worker Crawl & Audit: ${url} | Scope: ${scope}`);
    
    // Leverage the unified multi-worker crawler that discovers and audits all pages in parallel
    const auditResults = await crawler.crawlAndAuditWebsite(reportId, url, emitProgress, { 
        scope: scope,
        maxPages: scope === 'site' ? 25 : 1, 
        maxDepth: scope === 'site' ? 3 : 0,
        tests: tests,
        maxWorkers: 4
    });

    return auditResults;
};

/**
 * persistScanData - Centralized persistence for all audit results.
 */
const persistScanData = async (reportId, results) => {
    console.log(`[scanEngine]: Persisting tactical telemetry for report ${reportId}...`);
    
    const prune = (arr, fingerprint) => {
        const seen = new Set();
        return (arr || []).filter(item => {
            const sig = fingerprint(item);
            if (seen.has(sig)) return false;
            seen.add(sig);
            return true;
        });
    };

    const finalUI = prune(results.uiIssues, u => `${u.type}|${u.issue}|${u.selector}|${u.location}`);
    const finalForms = prune(results.formIssues, f => `${f.formName}|${f.type}|${f.fieldName}`);
    const finalConsole = prune(results.consoleErrors, c => `${c.message}|${c.location}`);
    const finalSecurity = prune(results.securityIssues || [], s => `${s.issue}|${s.selector}`);
    const finalBrokenLinks = prune(results.brokenLinks || [], b => `${b.link}|${b.page}`);
    const finalResponsive = prune(results.responsiveIssues || [], r => `${r.issue}|${r.selector}`);

    await ScanReport.findByIdAndUpdate(reportId, {
        $set: {
            consoleErrors: finalConsole.slice(0, 100),
            uiIssues: finalUI.slice(0, 100),
            formIssues: finalForms.slice(0, 100),
            securityIssues: finalSecurity.slice(0, 100),
            brokenLinks: finalBrokenLinks.slice(0, 100),
            responsiveIssues: finalResponsive.slice(0, 100),
            accessibilityIssues: (results.accessibilityIssues || []).slice(0, 100),
            lighthouseScores: results.lighthouseScores,
            networkLogs: (results.networkLogs || []).slice(0, 200),
            screenshots: (results.screenshots && results.screenshots.length > 0) ? results.screenshots : (results.screenshot ? [results.screenshot] : []),
            'performanceMetrics.loadTime': results.loadTime,
            'performanceMetrics.pageSize': results.totalSize,
            'performanceMetrics.requestCount': results.requestCount
        }
    });
};

/**
 * runFullScan - System Optimized Audit (Single Page)
 */
const runFullScan = async (reportId, url, emitProgress) => {
    const tests = ['console', 'network', 'ui', 'lighthouse', 'accessibility', 'links', 'forms'];
    const result = await runSinglePageScan(reportId, url, tests, emitProgress).catch(err => {
        console.error(`[scanEngine]: Full scan execution failed: ${err.message}`);
        return null;
    });

    if (result) {
        await persistScanData(reportId, result);
    }
};

/**
 * crawlPages - Discovery module
 */
const crawlPages = async (url, options = {}) => {
    return await crawler.crawlWebsite(null, url, null, options);
};

/**
 * neuralDrift - Simulates human mechanical interaction to bypass bot-detection challenges.
 */
async function neuralDrift(page) {
    try {
        const { width, height } = page.viewportSize();
        for (let i = 0; i < 1; i++) {
            const x = Math.floor(Math.random() * width);
            const y = Math.floor(Math.random() * height);
            await page.mouse.move(x, y, { steps: 15 });
            await new Promise(r => setTimeout(r, 100 + Math.random() * 200));
        }
        await page.mouse.wheel(0, 400 + Math.floor(Math.random() * 200));
        await new Promise(r => setTimeout(r, 400));
        await page.mouse.wheel(0, -(200 + Math.floor(Math.random() * 100)));
    } catch (e) {
        console.warn('[scanEngine]: Neural Drift encountered non-critical turbulence:', e.message);
    }
}

/**
 * applyStealthPatches - Hardens the browser context against WAF/Bot detection.
 */
async function applyStealthPatches(page) {
    const memOptions = [4, 8];
    const cpuOptions = [4, 8, 12];
    const pickedMem = memOptions[Math.floor(Math.random() * memOptions.length)];
    const pickedCpu = cpuOptions[Math.floor(Math.random() * cpuOptions.length)];

    await page.addInitScript(({ memory, cpu }) => {
        const getParameter = WebGLRenderingContext.prototype.getParameter;
        WebGLRenderingContext.prototype.getParameter = function(parameter) {
            if (parameter === 37445) return 'Intel Inc.'; 
            if (parameter === 37446) return 'Intel(R) Iris(R) Xe Graphics (0x9A49)'; 
            return getParameter.apply(this, arguments);
        };
        Object.defineProperty(navigator, 'webdriver', { get: () => false });
        Object.defineProperty(navigator, 'deviceMemory', { get: () => memory });
        Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => cpu });
        Object.defineProperty(navigator, 'maxTouchPoints', { get: () => 0 });
        Object.defineProperty(navigator, 'pdfViewerEnabled', { get: () => true });
        Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
        Object.defineProperty(navigator, 'plugins', { 
            get: () => ({
                length: 3,
                0: { name: 'PDF Viewer' },
                1: { name: 'Chrome PDF Viewer' },
                2: { name: 'Chromium PDF Viewer' },
                item: (i) => this[i],
                namedItem: (n) => this[0]
            }) 
        });
        const originalQuery = window.navigator.permissions.query;
        window.navigator.permissions.query = (parameters) => (
            parameters.name === 'notifications' ?
                Promise.resolve({ state: Notification.permission }) :
                originalQuery(parameters)
        );
    }, { memory: pickedMem, cpu: pickedCpu });
}

/**
 * normalizeUrl - Ensures consistent URL comparison for target identification.
 */
function normalizeUrl(url) {
    try {
        const u = new URL(url);
        let path = u.pathname.replace(/\/+$/, '');
        if (path === '') path = '/';
        return `${u.protocol}//${u.hostname}${path}`;
    } catch (_) {
        return url;
    }
}

module.exports = {
    runSinglePageScan,
    runTargetedCrawlScan,
    persistScanData,
    runFullScan,
    crawlPages,
    scanConsole,
    scanNetwork,
    scanForms,
    scanUI
};
