const { GoogleGenerativeAI } = require('@google/generative-ai');
const Groq = require('groq-sdk');
const ScanReport = require('../models/ScanReport');
const fs = require('fs');
const path = require('path');

// Helper: wrap promise with timeout
const withTimeout = (promise, ms, taskName) => {
    const timeout = new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`${taskName} timed out after ${ms}ms`)), ms)
    );
    return Promise.race([promise, timeout]);
};

// Helper: strip emojis for clean corporate standard
const stripEmojis = (str) => {
    if (!str || typeof str !== 'string') return str;
    return str
        .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{2B50}\u{200D}\u{FE0F}]/gu, '')
        .trim();
};

class QAAgent {
    constructor(reportId) {
        this.reportId = reportId;
        this.geminiKey = process.env.GEMINI_API_KEY;
        this.groqKey = process.env.GROQ_QA_API_KEY || process.env.GROQ_API_KEY;
        this.groqModel = process.env.GROQ_QA_MODEL || 'llama-3.3-70b-versatile';
    }

    async analyzeResults(currentReport, previousReport = null) {
        let comparisonNotice = "";
        if (previousReport) {
            comparisonNotice = `
            BASELINE COMPARISON (AGAINST PREVIOUS SCAN):
            - Previous Health Score: ${previousReport.healthScore || 0}
            - Previous Broken Links: ${previousReport.brokenLinks?.length || 0}
            - Previous Console Errors: ${previousReport.consoleErrors?.length || 0}
            - Previous Lighthouse Performance: ${previousReport.lighthouseScores?.performance || 0}
            `;
        }

        // Clean and prepare telemetry sample for AI
        const rawNetwork = (currentReport.networkLogs || []).filter(n => n.status >= 400);
        const pluginErrors = rawNetwork.filter(n => (n.url || '').includes('/plugin') || (n.url || '').includes('revslider') || (n.type === 'plugin_asset'));
        const apiErrors = rawNetwork.filter(n => !pluginErrors.includes(n));

        const prompt = `
You are a Principal QA Automation Lead and Quality Architect.
Analyze the following diagnostic audit results for: ${currentReport.url}
${comparisonNotice}

AUDIT TELEMETRY:
- SECURITY THREATS: ${JSON.stringify((currentReport.securityIssues || []).slice(0, 10))}
- JAVASCRIPT RUNTIME CONSOLE CRASHES: ${JSON.stringify((currentReport.consoleErrors || []).slice(0, 15))}
- FAILED API ENDPOINTS (HTTP 4xx/5xx): ${JSON.stringify(apiErrors.slice(0, 10))}
- MISSING PLUGIN ASSETS (404 on plugin stylesheets/scripts): ${JSON.stringify(pluginErrors.slice(0, 10))}
- UI & LAYOUT DEFECTS: ${JSON.stringify((currentReport.uiIssues || []).slice(0, 15))}
- FORM & INPUT ANOMALIES: ${JSON.stringify((currentReport.formIssues || []).slice(0, 10))}
- ACCESSIBILITY & IMAGES: ${JSON.stringify((currentReport.accessibilityIssues || []).slice(0, 15))}
- BROKEN NAVIGATION LINKS: ${JSON.stringify((currentReport.brokenLinks || []).slice(0, 10))}
- LIGHTHOUSE SCORES: ${JSON.stringify(currentReport.lighthouseScores || {})}

IMPORTANT INSTRUCTIONS FOR EXPLANATION QUALITY:
1. Explain every issue in CLEAR, SIMPLE, PROFESSIONAL PLAIN ENGLISH that any developer or product manager can immediately understand.
2. DIFFERENTIATE CAREFULLY:
   - Missing Plugin Assets (HTTP 404): Explain clearly that these are orphaned files (e.g. Revolution Slider or WordPress plugin files) requested in the HTML header that do not exist on the server. They are NOT code crashes. The remedy is to remove the unused <link> or <script> tag from the HTML template.
   - Missing Image Alt Text: Explain that visually impaired visitors using screen readers cannot understand the image without an 'alt' description. Remedy: add alt="description" or alt="" if decorative.
   - Missing H1 Heading: Explain that each page should have one main <h1> heading for clarity and SEO.
   - JavaScript Runtime Crashes: Clearly name the function or syntax that failed and why.
3. Formulate an authoritative QA Deployment Verdict: "BLOCK DEPLOYMENT", "CONDITIONAL APPROVAL", or "PRODUCTION READY".
4. Provide a crisp 2-3 sentence Executive Assessment synthesizing overall release stability and security.
5. Provide a Performance Booster Playbook with 2-3 concrete tips.
6. Detail the top 5 distinct findings with exact root cause and actionable steps. Do NOT repeat identical findings.
7. Tone: Professional enterprise QA. Do NOT use emojis.

OUTPUT FORMAT (STRICT JSON ONLY):
{
  "classification": "BLOCK_DEPLOYMENT|SECURITY_CRITICAL|PERFORMANCE_DEGRADED|STABLE_PASS",
  "qaVerdict": "BLOCK DEPLOYMENT|CONDITIONAL APPROVAL|PRODUCTION READY",
  "summary": "Crisp executive QA assessment in plain English.",
  "performancePlaybook": [
    "Prioritized step 1 to reduce load times or bundle size",
    "Prioritized step 2 to improve Core Web Vitals"
  ],
  "issues": [
    { 
      "title": "Clear, concise title",
      "issue": "What is happening in plain English",
      "reason": "Why it happens and its real-world effect",
      "fix": ["Clear step 1 to fix", "Clear step 2 to fix"],
      "suggestedFix": "Code snippet or HTML tag correction",
      "severity": "Critical|High|Medium|Low",
      "source": "ai"
    }
  ]
}
`;

        // 1. Try Gemini 3.5 Flash Lite (Fast, High Quality)
        if (this.geminiKey) {
            try {
                const genAI = new GoogleGenerativeAI(this.geminiKey);
                const model = genAI.getGenerativeModel({ 
                    model: 'gemini-3.5-flash-lite',
                    generationConfig: { responseMimeType: 'application/json' }
                });

                const result = await withTimeout(
                    model.generateContent(prompt),
                    18000,
                    'Gemini Analysis'
                );

                const text = result.response.text();
                const parsed = JSON.parse(text);

                return {
                    classification: stripEmojis(parsed.classification) || 'STABLE_PASS',
                    qaVerdict: stripEmojis(parsed.qaVerdict) || 'CONDITIONAL APPROVAL',
                    summary: stripEmojis(parsed.summary) || 'Comprehensive diagnostic QA audit completed.',
                    performancePlaybook: (parsed.performancePlaybook || [
                        "Implement modern WebP/AVIF formats and responsive srcsets to reduce image transfer payloads.",
                        "Remove unused plugin stylesheets and defer non-critical JavaScript to optimize Core Web Vitals."
                    ]).map(p => stripEmojis(p)),
                    issues: (parsed.issues || []).slice(0, 6).map(i => ({
                        ...i,
                        title: stripEmojis(i.title),
                        issue: stripEmojis(i.issue),
                        reason: stripEmojis(i.reason),
                        fix: Array.isArray(i.fix) ? i.fix.map(f => stripEmojis(f)) : stripEmojis(i.fix),
                        source: 'llm'
                    }))
                };
            } catch (geminiErr) {
                console.warn(`[qaAgent]: Gemini primary synthesis encountered issue (${geminiErr.message}). Attempting failover...`);
            }
        }

        // 2. Try Groq (if key available and active)
        if (this.groqKey) {
            try {
                const groq = new Groq({ apiKey: this.groqKey });
                const result = await withTimeout(
                    groq.chat.completions.create({
                        messages: [{ role: 'user', content: prompt }],
                        model: this.groqModel,
                        temperature: 0.2,
                        response_format: { type: "json_object" }
                    }),
                    15000,
                    'Groq Analysis'
                );
                
                const parsed = JSON.parse(result.choices[0].message.content);
                return {
                    classification: stripEmojis(parsed.classification) || 'STABLE_PASS',
                    qaVerdict: stripEmojis(parsed.qaVerdict) || 'CONDITIONAL APPROVAL',
                    summary: stripEmojis(parsed.summary) || 'Comprehensive diagnostic QA audit completed.',
                    performancePlaybook: (parsed.performancePlaybook || []).map(p => stripEmojis(p)),
                    issues: (parsed.issues || []).slice(0, 6).map(i => ({
                        ...i,
                        title: stripEmojis(i.title),
                        issue: stripEmojis(i.issue),
                        reason: stripEmojis(i.reason),
                        fix: Array.isArray(i.fix) ? i.fix.map(f => stripEmojis(f)) : stripEmojis(i.fix),
                        source: 'llm'
                    }))
                };
            } catch (groqErr) {
                console.warn(`[qaAgent]: Groq synthesis encountered issue (${groqErr.message}). Engaging local high-fidelity synthesis...`);
            }
        }

        // 3. High-Fidelity Local Synthesis (Deterministic, Crystal-Clear Plain English)
        return this.synthesizeLocalFindings(currentReport);
    }

    synthesizeLocalFindings(currentReport) {
        const localIssues = [];
        const seenSignatures = new Set();

        const addUnique = (issueObj) => {
            const sig = `${issueObj.title}|${issueObj.issue}`.toLowerCase();
            if (seenSignatures.has(sig)) return;
            seenSignatures.add(sig);
            localIssues.push({
                ...issueObj,
                title: stripEmojis(issueObj.title),
                issue: stripEmojis(issueObj.issue),
                reason: stripEmojis(issueObj.reason),
                fix: Array.isArray(issueObj.fix) ? issueObj.fix.map(f => stripEmojis(f)) : stripEmojis(issueObj.fix),
                source: 'local'
            });
        };

        // 1. Critical Security Vulnerabilities
        (currentReport.securityIssues || []).forEach(s => {
            const isApiLeak = s.type === 'SERVER_STACK_TRACE_LEAK' || s.testCaseId?.includes('SEC-STACK');
            if (isApiLeak) {
                addUnique({
                    title: "Internal Server Stack Trace Leaked in API Response",
                    issue: `The server endpoint ${s.selector || 'API'} returned detailed backend error traces or database paths in its response body.`,
                    reason: "Unhandled backend exceptions expose internal code structure, database queries, and server paths to potential attackers (CWE-209).",
                    fix: [
                        "Configure production error-handling middleware to return sanitized generic error messages.",
                        "Log detailed stack traces exclusively to secure server-side monitoring logs."
                    ],
                    suggestedFix: "// Express Error Handler Middleware:\napp.use((err, req, res, next) => {\n  console.error(err);\n  res.status(500).json({ error: 'An unexpected internal error occurred.' });\n});",
                    severity: "Critical"
                });
            } else {
                addUnique({
                    title: s.type || "Exposed Secret or Token",
                    issue: s.issue || s.details || "Potentially sensitive token or key identified in client scripts.",
                    reason: "Credentials or API tokens embedded in frontend client bundles can be extracted by any user.",
                    fix: [
                        "Revoke the exposed key immediately in your service dashboard.",
                        "Move third-party API calls behind a secure backend proxy server."
                    ],
                    suggestedFix: "// Store secrets in server environment variables:\nconst API_SECRET = process.env.API_SECRET;",
                    severity: "High"
                });
            }
        });

        // 2. Real JavaScript Runtime Crashes
        (currentReport.consoleErrors || []).forEach(c => {
            const msg = c.message || '';
            // Skip 404 resource messages in console - handled in network section below
            if (msg.includes('404') || msg.includes('Failed to load resource')) return;

            addUnique({
                title: "JavaScript Runtime Exception",
                issue: msg.substring(0, 180) || "Uncaught browser script exception occurred.",
                reason: "A script on the page attempted an illegal operation (such as calling an undefined function or accessing a property of null), halting further code execution.",
                fix: [
                    "Check the browser console stack trace for the exact file and line number.",
                    "Verify that all dependent libraries and DOM elements exist before executing dependent functions."
                ],
                suggestedFix: "if (typeof targetFunction === 'function') {\n  targetFunction();\n}",
                severity: "High"
            });
        });

        // 3. Missing Plugin / Template Assets (HTTP 404) vs Real API Failures
        (currentReport.networkLogs || []).filter(n => n.status >= 400).forEach(n => {
            const url = n.url || '';
            const isPlugin = url.includes('/plugins/') || url.includes('/wp-content/plugins/') || url.includes('/modules/') || url.includes('revslider');
            
            if (isPlugin && n.status === 404) {
                const assetName = url.split('/').pop().split('?')[0];
                addUnique({
                    title: `Orphaned Plugin Asset Not Found (${assetName})`,
                    issue: `The webpage requests a plugin stylesheet or script that does not exist on the server: ${url}`,
                    reason: "A plugin (e.g., Slider Revolution or WordPress extension) was removed or uninstalled, but its <link> or <script> tag was left in the HTML template. While the page may still render, this generates unnecessary 404 errors and slows down page loading.",
                    fix: [
                        "Open your website's header/template file and remove the orphaned reference to this stylesheet/script.",
                        "If you still use this plugin, ensure all required assets are uploaded to the correct server folder."
                    ],
                    suggestedFix: `<!-- Remove this orphaned tag from your HTML <head>: -->\n<!-- <link rel=\"stylesheet\" href=\"${url}\"> -->`,
                    severity: "Low"
                });
            } else if (n.status === 404) {
                addUnique({
                    title: `Resource Not Found (HTTP 404)`,
                    issue: `Request to ${url} failed with HTTP status 404 Not Found.`,
                    reason: "The requested file or API endpoint does not exist at the specified path on the web server.",
                    fix: [
                        "Verify that the URL path and filename are spelled correctly.",
                        "Update the link or restore the missing file to the server."
                    ],
                    suggestedFix: `// Verify endpoint path:\nfetch('${url}')`,
                    severity: "Medium"
                });
            }
        });

        // 4. Broken Navigation Links
        (currentReport.brokenLinks || []).forEach(b => {
            addUnique({
                title: `Broken Navigation Link (HTTP ${b.status || 404})`,
                issue: `A link pointing to ${b.link} returned status ${b.status || 404}.`,
                reason: "Users clicking this link will encounter a dead end or error page, disrupting website navigation.",
                fix: [
                    `Update the href on page ${b.page || 'the site'} to point to the correct active URL.`,
                    "If the destination page was moved, configure a 301 permanent redirect."
                ],
                suggestedFix: `<a href="/new-valid-destination">Updated Link Text</a>`,
                severity: "Medium"
            });
        });

        // 5. Form Integrity and Boundary Issues
        (currentReport.formIssues || []).forEach(f => {
            addUnique({
                title: f.issue || f.type || "Form Validation Anomaly",
                issue: f.issue || f.observed || "Form boundary or validation defect detected.",
                reason: f.technicalImpact || "Missing validation allows invalid data submission, empty requests, or double-clicks.",
                fix: f.stepsToReproduce || [
                    f.recommendation || "Add HTML5 required attributes and debounce submit buttons on click."
                ],
                suggestedFix: `<button type="submit" onClick={(e) => { e.currentTarget.disabled = true; submitForm(); }}>\n  Submit\n</button>`,
                severity: f.severity || "Medium"
            });
        });

        // 6. Accessibility & Image Alt Text
        (currentReport.accessibilityIssues || []).forEach(a => {
            if (a.issue?.includes('alt') || a.issue?.includes('Image')) {
                addUnique({
                    title: "Image Missing Alternate Text (WCAG 1.1.1)",
                    issue: `An image is missing an 'alt' attribute: ${a.selector || 'Image element'}`,
                    reason: "Visually impaired users relying on screen readers cannot understand the content or purpose of this image because no text alternative is provided. This also hurts SEO ranking.",
                    fix: [
                        "Add a descriptive alt attribute explaining the image (e.g. alt='Campus Library Entrance').",
                        "If the image is purely decorative, add alt='' so screen readers know to skip it."
                    ],
                    suggestedFix: `<img src="${a.selector || '/image.png'}" alt="Clear description of the image content" />`,
                    severity: "Low"
                });
            } else if (a.issue?.includes('H1') || a.type?.includes('SEO')) {
                addUnique({
                    title: "Missing Primary H1 Heading Tag",
                    issue: "The webpage lacks an <h1> heading element.",
                    reason: "Every web page should have one main <h1> heading to establish the page hierarchy for search engines and screen readers.",
                    fix: [
                        "Add a single, descriptive <h1> heading near the top of the main content area."
                    ],
                    suggestedFix: `<h1>Main Page Title</h1>`,
                    severity: "Low"
                });
            } else {
                addUnique({
                    title: a.issue || "Accessibility Compliance Warning",
                    issue: a.issue || "Semantic HTML or ARIA landmark non-compliance detected.",
                    reason: "Interactive element does not conform to WCAG 2.1 AA accessibility guidelines.",
                    fix: [a.recommendation || "Ensure proper semantic elements, color contrast, and aria-labels are present."],
                    suggestedFix: `<button aria-label="Descriptive action name" type="button">\n  <span>Click</span>\n</button>`,
                    severity: "Low"
                });
            }
        });

        // 7. Spatial Layout and Visual Overflows
        (currentReport.uiIssues || []).forEach(u => {
            if (u.issue?.includes('overflow') || u.type?.includes('OVERFLOW')) {
                addUnique({
                    title: "Horizontal Content Overflow Detected",
                    issue: "Content on the page exceeds the browser viewport width.",
                    reason: "Elements with fixed pixel widths or absolute positioning break viewport boundaries, causing undesirable horizontal scrolling on smaller screens.",
                    fix: [
                        "Replace fixed widths (e.g. width: 1200px) with responsive widths (e.g. max-width: 100%).",
                        "Ensure containers use box-sizing: border-box."
                    ],
                    suggestedFix: `/* Responsive container fix: */\n.container {\n  width: 100%;\n  max-width: 1200px;\n  box-sizing: border-box;\n}`,
                    severity: "Medium"
                });
            } else if (u.issue?.includes('touch') || u.issue?.includes('Small button')) {
                addUnique({
                    title: "Button Touch Target Below 44px (Mobile UX)",
                    issue: `Interactive element ${u.selector || 'button'} is smaller than standard finger tap dimensions.`,
                    reason: "Buttons smaller than 44x44px are difficult for mobile users to tap accurately, causing accidental misclicks.",
                    fix: [
                        "Increase padding or min-height to at least 44px on mobile viewports."
                    ],
                    suggestedFix: `button {\n  min-height: 44px;\n  min-width: 44px;\n  padding: 10px 16px;\n}`,
                    severity: "Low"
                });
            }
        });

        const hasCritical = localIssues.some(i => i.severity === 'Critical');
        const hasHigh = localIssues.some(i => i.severity === 'High');

        return {
            classification: hasCritical ? 'BLOCK_DEPLOYMENT' : (hasHigh ? 'PERFORMANCE_DEGRADED' : 'STABLE_PASS'),
            qaVerdict: hasCritical ? 'BLOCK DEPLOYMENT' : 'CONDITIONAL APPROVAL',
            summary: 'Comprehensive diagnostic audit completed. All detected anomalies have been classified into clear, actionable recommendations.',
            performancePlaybook: [
                "Remove orphaned plugin stylesheets and scripts from template headers to eliminate unnecessary 404 requests and cut latency.",
                "Add descriptive alt text to all informational images and set alt='' on decorative graphics to satisfy WCAG 1.1.1 compliance.",
                "Ensure server endpoints handle errors gracefully with production middleware without exposing internal stack traces."
            ],
            issues: localIssues.slice(0, 6)
        };
    }
}

const runAgent = async (reportId, prevReportId = null, currentReport = null, previousReport = null) => {
    const report = currentReport || await ScanReport.findById(reportId);
    if (!report) return null;
    
    const prev = previousReport || (prevReportId ? await ScanReport.findById(prevReportId) : null);

    const agent = new QAAgent(reportId);
    return await agent.analyzeResults(report, prev);
};

module.exports = { runAgent };
