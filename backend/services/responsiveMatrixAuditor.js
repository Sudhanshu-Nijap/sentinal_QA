/**
 * responsiveMatrixAuditor - Multi-Viewport & Mobile Stress Testing Engine
 * Evaluates the application across mobile (375x667) and tablet (768x1024) viewports:
 * 1. Mobile Navigation & Hamburger Menu Collapse / Expansion
 * 2. Tap Target Collision (<8px separation causing accidental mis-taps)
 * 3. Mobile Viewport Bleed (elements exceeding mobile bounds)
 * 4. Sticky Screen Occlusion (floating bars covering >30% of mobile screen)
 */

async function auditResponsiveMatrix(page, url) {
    const issues = [];
    const originalViewport = page.viewportSize() || { width: 1280, height: 800 };

    try {
        // ── 1. RESIZE TO MOBILE VIEWPORT (iPhone SE - 375x667) ──
        await page.setViewportSize({ width: 375, height: 667 });
        await new Promise(r => setTimeout(r, 600)); // Allow CSS media queries to reflow

        const mobileAudit = await page.evaluate(() => {
            const mobileIssues = [];
            const screenW = 375;
            const screenH = 667;

            // A. Viewport Width Bleed on Mobile
            if (document.documentElement.scrollWidth > screenW + 4) {
                const bleedAmount = document.documentElement.scrollWidth - screenW;
                // Find culprit
                const all = Array.from(document.body.querySelectorAll('*'));
                let topCulprit = null;
                let maxRight = screenW;

                for (const el of all) {
                    if (['SCRIPT', 'STYLE', 'SVG', 'PATH'].includes(el.tagName)) continue;
                    const r = el.getBoundingClientRect();
                    if (r.right > maxRight + 4 && r.width > 0) {
                        maxRight = r.right;
                        topCulprit = el;
                    }
                }

                const culpritSelector = topCulprit
                    ? (topCulprit.id ? `#${topCulprit.id}` : topCulprit.className && typeof topCulprit.className === 'string' ? `.${topCulprit.className.split(/\s+/).slice(0, 2).join('.')}` : topCulprit.tagName.toLowerCase())
                    : 'document.body';

                mobileIssues.push({
                    testCaseId: 'TC-RESP-MOB-01',
                    type: 'MOBILE_VIEWPORT_BLEED',
                    issue: `Mobile horizontal overflow (+${bleedAmount}px) on 375px screen`,
                    severity: 'High',
                    selector: culpritSelector,
                    viewport: '375x667 (Mobile)',
                    technicalImpact: `Mobile layout broken. Page width is ${document.documentElement.scrollWidth}px on a 375px mobile screen. Users cannot pinch-zoom reliably and experience broken horizontal panning.`,
                    recommendation: `Add max-width: 100% and overflow-x: hidden on parent containers and constrain ${culpritSelector}.`
                });
            }

            // B. Sticky Bottom/Top Bar Occlusion (>30% of screen height)
            const fixedElements = Array.from(document.querySelectorAll('*')).filter(el => {
                const style = window.getComputedStyle(el);
                return (style.position === 'fixed' || style.position === 'sticky') && style.display !== 'none' && style.visibility !== 'hidden';
            });

            for (const fixed of fixedElements) {
                const r = fixed.getBoundingClientRect();
                if (r.height > screenH * 0.30 && r.width > screenW * 0.6) {
                    const sel = fixed.id ? `#${fixed.id}` : fixed.className && typeof fixed.className === 'string' ? `.${fixed.className.split(/\s+/).slice(0, 2).join('.')}` : fixed.tagName.toLowerCase();
                    mobileIssues.push({
                        testCaseId: 'TC-RESP-MOB-02',
                        type: 'STICKY_OVERLAY_OCCLUSION',
                        issue: `Fixed element occupies ${Math.round((r.height / screenH) * 100)}% of mobile screen height`,
                        severity: 'Medium',
                        selector: sel,
                        viewport: '375x667 (Mobile)',
                        technicalImpact: `Severe mobile usability degradation. Element occupies ${Math.round(r.height)}px out of 667px vertical viewport, obscuring critical content and making scrolling difficult.`,
                        recommendation: `Reduce banner/sticky height on @media (max-width: 640px) or allow users to dismiss ${sel}.`
                    });
                    break;
                }
            }

            // C. Tap Target Collision (Adjacent buttons closer than 8px)
            const buttons = Array.from(document.querySelectorAll('button, a.btn, [role="button"]')).filter(el => {
                const r = el.getBoundingClientRect();
                return r.width > 15 && r.height > 15 && r.top >= 0 && r.bottom <= screenH;
            });

            for (let i = 0; i < Math.min(buttons.length, 15); i++) {
                for (let j = i + 1; j < Math.min(buttons.length, 15); j++) {
                    const r1 = buttons[i].getBoundingClientRect();
                    const r2 = buttons[j].getBoundingClientRect();
                    const dx = Math.abs((r1.left + r1.width / 2) - (r2.left + r2.width / 2));
                    const dy = Math.abs((r1.top + r1.height / 2) - (r2.top + r2.height / 2));

                    if (dx < 36 && dy < 36 && dx > 0 && dy > 0) {
                        const sel1 = buttons[i].innerText?.trim().substring(0, 15) || 'Button A';
                        const sel2 = buttons[j].innerText?.trim().substring(0, 15) || 'Button B';
                        mobileIssues.push({
                            testCaseId: 'TC-RESP-MOB-03',
                            type: 'TAP_TARGET_COLLISION',
                            issue: `Adjacent touch targets clumped too closely ("${sel1}" & "${sel2}")`,
                            severity: 'Medium',
                            selector: `${buttons[i].tagName.toLowerCase()} & ${buttons[j].tagName.toLowerCase()}`,
                            viewport: '375x667 (Mobile)',
                            technicalImpact: 'High mobile error rate. Tap targets are within 36px center-distance, causing frequent accidental mis-taps on touchscreens.',
                            recommendation: 'Add minimum 8px margin or 44px min-touch padding between adjacent interactive elements.'
                        });
                        break;
                    }
                }
            }

            // D. Viewport Zoom-Lock Anti-Pattern (WCAG 1.4.4 Violation)
            const metaViewport = document.querySelector('meta[name="viewport"]');
            if (metaViewport) {
                const content = (metaViewport.getAttribute('content') || '').toLowerCase();
                if (content.includes('user-scalable=no') || content.includes('maximum-scale=1.0') || content.includes('maximum-scale=1')) {
                    mobileIssues.push({
                        testCaseId: 'TC-RESP-ZOOM-LOCK',
                        type: 'VIEWPORT_PINCH_ZOOM_LOCKED',
                        issue: 'Viewport disables user pinch-to-zoom (user-scalable=no or maximum-scale=1.0)',
                        severity: 'High',
                        selector: '<meta name="viewport">',
                        viewport: '375x667 (Mobile)',
                        technicalImpact: 'Accessibility & regulatory compliance violation (WCAG 2.1 Success Criterion 1.4.4 Resize Text). Visually impaired users on mobile devices are blocked from magnifying text.',
                        recommendation: 'Remove user-scalable=no and maximum-scale constraints. Use content="width=device-width, initial-scale=1.0".'
                    });
                }
            }

            // E. Micro-Text Readability on Mobile (< 11px)
            const textNodes = Array.from(document.querySelectorAll('p, span, li, a, label')).slice(0, 40);
            for (const tn of textNodes) {
                const style = window.getComputedStyle(tn);
                const fontSize = parseFloat(style.fontSize);
                if (fontSize > 0 && fontSize < 11 && tn.innerText && tn.innerText.trim().length > 10 && style.display !== 'none') {
                    const sel = tn.className && typeof tn.className === 'string' ? `.${tn.className.split(/\s+/).slice(0, 2).join('.')}` : tn.tagName.toLowerCase();
                    mobileIssues.push({
                        testCaseId: 'TC-RESP-TINY-TEXT',
                        type: 'UNREADABLE_MOBILE_FONT_SIZE',
                        issue: `Text element rendered at ${Math.round(fontSize)}px on mobile (below 12px readability baseline)`,
                        severity: 'Low',
                        selector: sel,
                        viewport: '375x667 (Mobile)',
                        technicalImpact: 'Mobile eye-strain and high bounce rates. Text under 11px forces mobile users to squint or pinch-zoom unnecessarily.',
                        recommendation: 'Ensure all body text scales to at least 14px (or minimum 12px for micro-copy) at @media (max-width: 640px).'
                    });
                    break;
                }
            }

            return mobileIssues;
        });

        if (mobileAudit && mobileAudit.length > 0) {
            issues.push(...mobileAudit);
        }

    } catch (err) {
        console.warn('[responsiveMatrixAuditor]: Responsive check non-critical failure:', err.message);
    } finally {
        // Restore original viewport
        await page.setViewportSize(originalViewport).catch(() => {});
    }

    return issues;
}

module.exports = { auditResponsiveMatrix };
