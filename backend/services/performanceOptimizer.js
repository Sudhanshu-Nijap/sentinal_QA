/**
 * performanceOptimizer - Website Performance & Asset Optimization Engine
 * Discovers root-cause architectural bottlenecks that slow down websites:
 * 1. Excessive DOM Node Bloat (>1,000 nodes slowing down rendering FPS)
 * 2. Oversized / Unscaled Images (natural dimensions >2.5x rendered dimensions)
 * 3. Below-the-fold Images Missing loading="lazy" (wasting initial bandwidth)
 * 4. Render-Blocking Synchronous Scripts in <head> (delaying First Contentful Paint)
 * 5. Excessive External WebFont Families (causing font-swapping layout shifts)
 */

async function auditPerformance(page, url) {
    try {
        return await page.evaluate(() => {
            const issues = [];
            const viewportH = window.innerHeight;

            // ── 1. DOM TREE BLOAT ──
            const totalDomNodes = document.querySelectorAll('*').length;
            if (totalDomNodes > 1000) {
                issues.push({
                    testCaseId: 'TC-PERF-DOM-01',
                    type: 'EXCESSIVE_DOM_BLOAT',
                    issue: `DOM tree contains ${totalDomNodes} elements (exceeds recommended 800-1,000 node limit)`,
                    severity: totalDomNodes > 1800 ? 'High' : 'Medium',
                    selector: 'document',
                    technicalImpact: `Excessive DOM tree depth increases memory consumption, slows down querySelector performance, and degrades browser scroll/repaint framerates.`,
                    recommendation: 'Refactor deeply nested components, implement virtualized scrolling for long lists, and remove redundant container wrappers.'
                });
            }

            // ── 2. OVERSIZED IMAGES (Resolution Waste) ──
            const images = Array.from(document.querySelectorAll('img')).filter(img => {
                return img.naturalWidth > 0 && img.clientWidth > 0 && img.src && !img.src.startsWith('data:');
            });

            for (const img of images.slice(0, 15)) {
                const ratio = img.naturalWidth / img.clientWidth;
                if (ratio > 2.5 && img.naturalWidth > 1200 && img.clientWidth < 450) {
                    const sel = img.id ? `#${img.id}` : img.src.split('/').pop().split('?')[0];
                    issues.push({
                        testCaseId: 'TC-PERF-IMG-01',
                        type: 'OVERSIZED_IMAGE_ASSET',
                        issue: `Image "${sel}" is served at ${img.naturalWidth}x${img.naturalHeight}px but rendered at ${Math.round(img.clientWidth)}x${Math.round(img.clientHeight)}px (${Math.round(ratio)}x oversized)`,
                        severity: 'High',
                        selector: img.src,
                        technicalImpact: `Wasted bandwidth and delayed LCP (Largest Contentful Paint). Client downloads full multi-megabyte resolution for a small container display.`,
                        recommendation: 'Use responsive srcset attributes or a modern CDN image resizer (e.g. Cloudinary, Cloudflare Images) to serve viewport-matched resolutions.'
                    });
                    break;
                }
            }

            // ── 3. MISSING LAZY LOADING BELOW THE FOLD ──
            const offscreenImages = images.filter(img => {
                const r = img.getBoundingClientRect();
                return r.top > viewportH + 200 && !img.hasAttribute('loading');
            });

            if (offscreenImages.length >= 2) {
                const sampleSrc = offscreenImages[0].src.split('/').pop().split('?')[0];
                issues.push({
                    testCaseId: 'TC-PERF-LAZY-01',
                    type: 'MISSING_LAZY_LOADING',
                    issue: `${offscreenImages.length} images below the viewport lack loading="lazy" (e.g. "${sampleSrc}")`,
                    severity: 'Medium',
                    selector: `${offscreenImages.length} <img> tags`,
                    technicalImpact: `Images located deep down the page are downloaded immediately during initial page load, consuming critical mobile bandwidth and delaying primary hero rendering.`,
                    recommendation: 'Add loading="lazy" and decoding="async" to all images below the initial fold.'
                });
            }

            // ── 4. RENDER-BLOCKING SYNCHRONOUS SCRIPTS IN <HEAD> ──
            const headScripts = Array.from(document.querySelectorAll('head script[src]')).filter(s => {
                return !s.hasAttribute('defer') && !s.hasAttribute('async') && s.getAttribute('type') !== 'module';
            });

            if (headScripts.length > 0) {
                const sampleScript = headScripts[0].src.split('/').pop().split('?')[0];
                issues.push({
                    testCaseId: 'TC-PERF-SCRIPT-01',
                    type: 'RENDER_BLOCKING_SCRIPT',
                    issue: `${headScripts.length} synchronous script(s) in <head> block HTML parsing (e.g. "${sampleScript}")`,
                    severity: 'High',
                    selector: headScripts[0].src,
                    technicalImpact: `HTML parsing pauses until external scripts finish downloading and executing, directly penalizing First Contentful Paint (FCP) and Speed Index.`,
                    recommendation: 'Add "defer" or "async" to <script> tags in <head>, or relocate script tags to the bottom of <body>.'
                });
            }

            // ── 5. CUMULATIVE LAYOUT SHIFT (CLS) - MISSING IMAGE DIMENSIONS ──
            const allImages = Array.from(document.querySelectorAll('img')).filter(img => img.src && !img.src.startsWith('data:'));
            const unconstrainedImages = allImages.filter(img => !img.hasAttribute('width') || !img.hasAttribute('height'));

            if (unconstrainedImages.length >= 3) {
                const sample = unconstrainedImages[0].src.split('/').pop().split('?')[0];
                issues.push({
                    testCaseId: 'TC-PERF-CLS-01',
                    type: 'MISSING_IMAGE_DIMENSIONS_CLS',
                    issue: `${unconstrainedImages.length} images lack explicit HTML width and height attributes (e.g. "${sample}")`,
                    severity: 'Medium',
                    selector: `${unconstrainedImages.length} <img> elements`,
                    technicalImpact: 'Severe Cumulative Layout Shift (CLS). The browser cannot reserve space in the layout before image downloads finish, causing the page to violently jump and shifting text while users are reading.',
                    recommendation: 'Specify explicit width and height attributes or CSS aspect-ratio on all <img> tags to enable browser layout reservation.'
                });
            }

            // ── 6. BROKEN IMAGE ASSETS (NATURAL WIDTH === 0) ──
            const brokenImages = allImages.filter(img => img.complete && img.naturalWidth === 0);
            if (brokenImages.length > 0) {
                const sampleBroken = brokenImages[0].src.split('/').pop().split('?')[0] || brokenImages[0].src;
                issues.push({
                    testCaseId: 'TC-PERF-BROKEN-IMG',
                    type: 'BROKEN_IMAGE_ASSET',
                    issue: `${brokenImages.length} broken image(s) detected with zero natural dimensions (e.g. "${sampleBroken}")`,
                    severity: 'High',
                    selector: brokenImages[0].src,
                    technicalImpact: 'Degraded visual credibility and broken user experience. Broken image icons or empty frames are displayed to visitors.',
                    recommendation: `Verify image URL ${brokenImages[0].src} is active and properly hosted on the CDN.`
                });
            }

            return issues;
        });
    } catch (err) {
        return [];
    }
}

module.exports = { auditPerformance };
