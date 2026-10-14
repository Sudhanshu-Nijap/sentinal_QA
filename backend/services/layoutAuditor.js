/**
 * layoutAuditor - Advanced Viewport Collision & Visual Bug Engine
 * Detects real-world UX and layout bugs that QA engineers search for:
 * 1. Click Interception (buttons obscured by overlapping transparent/fixed overlays)
 * 2. Rogue Horizontal Overflow Elements (pinpoints exact offending DOM node)
 * 3. Truncated Critical Text (text clipped inside containers with overflow: hidden)
 */

async function auditLayout(page, url) {
    return await page.evaluate(() => {
        const issues = [];
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        const getSpatialContext = (el) => {
            try {
                let current = el.parentElement;
                while (current && current !== document.body) {
                    const heading = current.querySelector('h1, h2, h3, h4, h5, h6');
                    if (heading && heading.innerText?.trim()) return heading.innerText.trim();
                    current = current.parentElement;
                }
                return 'Main Content';
            } catch { return 'Global'; }
        };

        const generateSelector = (el) => {
            if (!el) return 'unknown';
            if (el.id) return `#${el.id}`;
            const tag = el.tagName.toLowerCase();
            const classes = el.className && typeof el.className === 'string'
                ? `.${el.className.split(/\s+/).filter(Boolean).slice(0, 2).join('.')}`
                : '';
            const text = (el.innerText || el.getAttribute('aria-label') || '').trim().substring(0, 20);
            return `${tag}${classes}${text ? ` ["${text}"]` : ''}`;
        };

        // ── 1. CLICK INTERCEPTION / OBSCURED INTERACTIVE ELEMENTS ──
        // Finds buttons/links whose center point is covered by a rogue overlay or higher z-index element
        const clickables = Array.from(document.querySelectorAll('button, a.btn, [role="button"], input[type="submit"]'));
        const checkedClickables = clickables.slice(0, 25);

        for (const el of checkedClickables) {
            const rect = el.getBoundingClientRect();
            // Only check visible elements within initial or scrolled viewport
            if (rect.width < 16 || rect.height < 16) continue;
            if (rect.bottom < 0 || rect.top > viewportHeight || rect.right < 0 || rect.left > viewportWidth) continue;

            const style = window.getComputedStyle(el);
            if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') continue;

            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;

            if (centerX >= 0 && centerX <= viewportWidth && centerY >= 0 && centerY <= viewportHeight) {
                const topElement = document.elementFromPoint(centerX, centerY);
                if (topElement && topElement !== el && !el.contains(topElement)) {
                    // Check if topElement is merely an SVG/icon child
                    const isChild = el.contains(topElement);
                    if (!isChild) {
                        const topStyle = window.getComputedStyle(topElement);
                        // If top element intercepts pointer events, user clicks will NOT reach the button!
                        if (topStyle.pointerEvents !== 'none') {
                            const btnSelector = generateSelector(el);
                            const blockerSelector = generateSelector(topElement);

                            issues.push({
                                type: 'CLICK_INTERCEPTION',
                                issue: `Button is obscured by overlapping layer (${blockerSelector})`,
                                severity: 'Critical',
                                selector: btnSelector,
                                location: getSpatialContext(el),
                                htmlSnippet: el.outerHTML?.substring(0, 400) || '',
                                technicalImpact: `Critical functional blocker. When a user clicks at (${Math.round(centerX)}, ${Math.round(centerY)}), clicks are intercepted by <${topElement.tagName.toLowerCase()}> with z-index: ${topStyle.zIndex || 'auto'}, preventing button action trigger.`,
                                recommendation: `Adjust z-index or set pointer-events: none on the overlaying container ${blockerSelector}.`,
                                rect: { x: Math.round(rect.x), y: Math.round(rect.y), width: Math.round(rect.width), height: Math.round(rect.height) }
                            });
                        }
                    }
                }
            }
        }

        // ── 2. ROGUE HORIZONTAL OVERFLOW ELEMENT ISOLATOR ──
        // Pinpoints the EXACT DOM element breaking mobile/desktop layout with horizontal scrollbar bleed
        if (document.documentElement.scrollWidth > viewportWidth + 3) {
            const allElements = Array.from(document.body.querySelectorAll('*'));
            const overflowCandidates = [];

            for (const el of allElements) {
                // Ignore script, style, svg paths
                if (['SCRIPT', 'STYLE', 'SVG', 'PATH', 'G', 'DEFS'].includes(el.tagName)) continue;
                const r = el.getBoundingClientRect();
                if (r.width === 0 || r.height === 0) continue;

                if (r.right > viewportWidth + 4) {
                    const overflowPx = Math.round(r.right - viewportWidth);
                    overflowCandidates.push({ el, rect: r, overflowPx });
                }
            }

            // Sort by largest overflow to find the root culprit
            overflowCandidates.sort((a, b) => b.overflowPx - a.overflowPx);
            const topOffenders = overflowCandidates.slice(0, 3);

            for (const offender of topOffenders) {
                const sel = generateSelector(offender.el);
                issues.push({
                    type: 'LAYOUT_OVERFLOW_BLEED',
                    issue: `Element exceeds viewport by ${offender.overflowPx}px causing horizontal scroll`,
                    severity: 'High',
                    selector: sel,
                    location: getSpatialContext(offender.el),
                    htmlSnippet: offender.el.outerHTML?.substring(0, 300) || '',
                    technicalImpact: `Layout breakage. Element width (${Math.round(offender.rect.width)}px) exceeds viewport width (${viewportWidth}px) by ${offender.overflowPx}px, forcing unwanted horizontal scrollbars on mobile and desktop viewports.`,
                    recommendation: `Add max-w-full, overflow-hidden, or box-sizing: border-box on ${sel} to prevent viewport leakage.`,
                    rect: { x: Math.round(offender.rect.x), y: Math.round(offender.rect.y), width: Math.round(offender.rect.width), height: Math.round(offender.rect.height) }
                });
            }
        }

        // ── 3. TRUNCATED / CLIPPED CRITICAL TEXT ──
        // Finds headings, primary buttons, or alert texts that are clipped by container overflow
        const textNodes = Array.from(document.querySelectorAll('h1, h2, h3, button, [role="button"], [role="alert"], .alert'));
        for (const el of textNodes.slice(0, 30)) {
            const style = window.getComputedStyle(el);
            if (style.display === 'none' || style.visibility === 'hidden') continue;

            const isClippedHorizontal = el.scrollWidth > el.clientWidth + 6 && (style.overflowX === 'hidden' || style.overflow === 'hidden' || style.textOverflow === 'ellipsis');
            const isClippedVertical = el.scrollHeight > el.clientHeight + 6 && (style.overflowY === 'hidden' || style.overflow === 'hidden');

            if (isClippedHorizontal || isClippedVertical) {
                const text = el.innerText?.trim();
                if (text && text.length > 5) {
                    const sel = generateSelector(el);
                    issues.push({
                        type: 'TEXT_TRUNCATION_CLIPPED',
                        issue: `Critical content clipped inside container: "${text.substring(0, 35)}..."`,
                        severity: 'Medium',
                        selector: sel,
                        location: getSpatialContext(el),
                        htmlSnippet: el.outerHTML?.substring(0, 300) || '',
                        technicalImpact: `Text clipping prevents complete reading of essential user information. Scroll dimensions (${el.scrollWidth}x${el.scrollHeight}) exceed container visible bounds (${el.clientWidth}x${el.clientHeight}).`,
                        recommendation: `Allow flexible line wrapping (white-space: normal) or expand container dimensions on ${sel}.`,
                        rect: { x: Math.round(el.getBoundingClientRect().x), y: Math.round(el.getBoundingClientRect().y), width: Math.round(el.clientWidth), height: Math.round(el.clientHeight) }
                    });
                }
            }
        }

        return issues.slice(0, 20);
    });
}

module.exports = { auditLayout };
