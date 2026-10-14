/**
 * interactionScanner - Autonomous Dead-Click & Broken Interaction Engine
 * Simulates user clicks on interactive DOM elements to detect unhandled JS crashes,
 * failing backend API triggers, and completely dead/unresponsive buttons.
 */

async function scanInteractions(page, url) {
    const issues = [];

    try {
        // 1. Identify Candidate Interactive Elements
        const candidates = await page.evaluate(() => {
            const elements = Array.from(document.querySelectorAll(
                'button, [role="button"], a[href="#"], a:not([href]), input[type="button"], input[type="submit"]'
            ));

            return elements.slice(0, 12).map((el, index) => {
                const rect = el.getBoundingClientRect();
                const style = window.getComputedStyle(el);
                const isVisible = rect.width > 12 && rect.height > 12 && 
                                  style.display !== 'none' && 
                                  style.visibility !== 'hidden' && 
                                  style.opacity !== '0';

                const text = (el.innerText || el.getAttribute('aria-label') || el.id || el.getAttribute('title') || '').trim();
                const truncatedText = text.length > 30 ? text.substring(0, 30) + '...' : text;
                const selector = el.id ? `#${el.id}` : 
                                 el.className && typeof el.className === 'string' ? `.${el.className.split(/\s+/).slice(0, 2).join('.')}` : 
                                 el.tagName.toLowerCase();

                return {
                    index,
                    tagName: el.tagName.toLowerCase(),
                    text: truncatedText || 'Unnamed Button',
                    selector,
                    isVisible
                };
            }).filter(item => item.isVisible);
        });

        if (!candidates || candidates.length === 0) return [];

        // 2. Audit Top 6 Visible Candidates with Micro-Click Probes
        const auditPool = candidates.slice(0, 6);

        for (const candidate of auditPool) {
            let uncaughtError = null;
            let failedNetworkCall = null;
            let networkTriggered = false;

            // Transient error & network trap for this specific interaction
            const errorHandler = (err) => {
                uncaughtError = (err.message || 'Unknown Exception').substring(0, 300);
            };

            const responseHandler = (response) => {
                networkTriggered = true;
                if (response.status() >= 500) {
                    failedNetworkCall = {
                        url: response.url(),
                        status: response.status()
                    };
                }
            };

            page.once('pageerror', errorHandler);
            page.on('response', responseHandler);

            const initialUrl = page.url();

            try {
                // Execute micro-click with a strict timeout
                const elementHandle = await page.$$('button, [role="button"], a[href="#"], a:not([href]), input[type="button"], input[type="submit"]');
                if (elementHandle[candidate.index]) {
                    await elementHandle[candidate.index].click({ timeout: 1500, force: false }).catch(() => {});
                    // Allow 350ms for asynchronous micro-tasks to register
                    await new Promise(r => setTimeout(r, 350));
                }
            } catch (_) {}

            page.removeListener('pageerror', errorHandler);
            page.removeListener('response', responseHandler);

            const finalUrl = page.url();
            const didNavigate = initialUrl !== finalUrl;

            // Scenario A: Click threw an unhandled JavaScript crash
            if (uncaughtError) {
                issues.push({
                    type: 'UX_CRASH_CLICK',
                    issue: `Uncaught Exception on Click: "${candidate.text}"`,
                    severity: 'Critical',
                    selector: candidate.selector,
                    location: candidate.text,
                    technicalImpact: `Clicking this element triggered an unhandled runtime error: ${uncaughtError}`,
                    recommendation: 'Check the click event handler or state listener for null pointers or undefined properties.'
                });
                continue;
            }

            // Scenario B: Click triggered a 5xx backend server error
            if (failedNetworkCall) {
                issues.push({
                    type: 'UX_ZOMBIE_API',
                    issue: `Backend 500 Error on Click: "${candidate.text}"`,
                    severity: 'High',
                    selector: candidate.selector,
                    location: candidate.text,
                    technicalImpact: `Clicking triggered a failing API request to ${failedNetworkCall.url} with HTTP status ${failedNetworkCall.status}.`,
                    recommendation: 'Inspect backend endpoint logs and verify client payload validation before dispatch.'
                });
                continue;
            }

            // Scenario C: Dead Click (Element looks like CTA but does nothing)
            if (!didNavigate && !networkTriggered && candidate.tagName === 'button' && candidate.text) {
                // Only flag if element lacks disabled attribute
                const isDisabled = await page.evaluate((idx) => {
                    const btns = document.querySelectorAll('button, [role="button"], a[href="#"]');
                    const b = btns[idx];
                    return b ? (b.disabled || b.getAttribute('aria-disabled') === 'true') : true;
                }, candidate.index).catch(() => true);

                if (!isDisabled) {
                    issues.push({
                        type: 'UX_DEAD_CLICK',
                        issue: `Dead Click Detected: "${candidate.text}"`,
                        severity: 'Medium',
                        selector: candidate.selector,
                        location: candidate.text,
                        technicalImpact: 'Element appears clickable but triggers no route change, API call, or visible action.',
                        recommendation: 'Verify that an onClick event handler or valid link href is wired to this element.'
                    });
                }
            }
        }
    } catch (err) {
        console.warn(`[interactionScanner]: Non-fatal interaction audit bypass: ${err.message}`);
    }

    return issues;
}

module.exports = { scanInteractions };
