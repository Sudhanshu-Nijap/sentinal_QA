const Groq = require('groq-sdk');
const ScanReport = require('../models/ScanReport');
const fs = require('fs');
const path = require('path');

const LOG_FILE = path.join(__dirname, '../groq_errors.log');

// Helper: wrap promise with timeout
const withTimeout = (promise, ms, taskName) => {
    const timeout = new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`${taskName} timed out after ${ms}ms`)), ms)
    );
    return Promise.race([promise, timeout]);
};

// Helper: strip emojis for enterprise corporate QA standard
const stripEmojis = (str) => {
    if (!str || typeof str !== 'string') return str;
    return str
        .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{2B50}\u{200D}\u{FE0F}]/gu, '')
        .trim();
};

class QAAgent {
    constructor(reportId) {
        this.reportId = reportId;
        const apiKey = process.env.GROQ_QA_API_KEY || process.env.GROQ_API_KEY;
        this.groq = new Groq({ apiKey });
        this.modelName = process.env.GROQ_QA_MODEL || 'llama-3.3-70b-versatile';
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
            
            Compare the current numbers with these baseline metrics. Highlight if things got better or worse in the summary.
            `;
        }

        const prompt = `
            You are a Principal QA Automation Lead and Application Security Architect replacing manual QA testing teams.
            Analyze website diagnostic data for: ${currentReport.url}
            ${comparisonNotice}
            
            AUDIT TELEMETRY DATA:
            - SECURITY RISKS & DATA LEAKS: ${JSON.stringify((currentReport.securityIssues || []).slice(0, 15))}
            - RUNTIME EXCEPTIONS & CRASHES: ${JSON.stringify((currentReport.consoleErrors || []).slice(0, 20))}
            - NETWORK & API TELEMETRY: ${JSON.stringify((currentReport.networkLogs || []).slice(0, 20))}
            - UI / RESPONSIVE / LAYOUT ISSUES: ${JSON.stringify((currentReport.uiIssues || []).slice(0, 20))}
            - FORM INTEGRITY & BOUNDARY TESTS: ${JSON.stringify((currentReport.formIssues || []).slice(0, 20))}
            - LIGHTHOUSE PERFORMANCE SCORES: ${JSON.stringify(currentReport.lighthouseScores || {})}
            
            YOUR TASK:
            1. Formulate an authoritative QA Deployment Verdict: "BLOCK DEPLOYMENT", "CONDITIONAL APPROVAL", or "PRODUCTION READY".
            2. Write a crisp 2-3 sentence Executive Assessment synthesizing overall release health, security posture, and edge-case stability.
            3. Provide a concrete Performance Booster Playbook with 2-3 prioritized architectural improvements to boost Core Web Vitals (LCP, FCP, TTFB).
            4. Detail the top 5 urgent issues with exact reproduction context, root cause, and copy-paste remediation code.
            5. STYLE SPECIFICATION: Write in a clean, executive corporate enterprise tone. DO NOT include any emojis anywhere in the output.
            
            OUTPUT FORMAT (STRICT JSON ONLY):
            {
              "classification": "BLOCK_DEPLOYMENT|SECURITY_CRITICAL|PERFORMANCE_DEGRADED|STABLE_PASS",
              "qaVerdict": "BLOCK DEPLOYMENT|CONDITIONAL APPROVAL|PRODUCTION READY",
              "summary": "Crisp executive QA assessment summarizing functional stability, security posture, and test coverage.",
              "performancePlaybook": [
                "Actionable step 1 to reduce load times or bundle size",
                "Actionable step 2 to improve Core Web Vitals"
              ],
              "issues": [
                { 
                  "title": "Clear bug title (e.g. Double-Submit Race Condition on Checkout)",
                  "issue": "Technical defect explanation",
                  "reason": "Root cause mechanism",
                  "fix": ["Reproduction & Fix Step 1", "Reproduction & Fix Step 2"],
                  "suggestedFix": "Code patch or header configuration snippet",
                  "severity": "Critical|High|Medium|Low",
                  "source": "llm"
                }
              ]
            }
        `;

        try {
            const result = await withTimeout(
                this.groq.chat.completions.create({
                    messages: [{ role: 'user', content: prompt }],
                    model: this.modelName,
                    temperature: 0.2,
                    response_format: { type: "json_object" }
                }),
                15000,
                'Groq Analysis'
            );
            
            const parsed = JSON.parse(result.choices[0].message.content);
            return {
                classification: stripEmojis(parsed.classification) || 'ANALYSIS COMPLETE',
                qaVerdict: stripEmojis(parsed.qaVerdict) || (currentReport.securityIssues?.length > 0 ? 'BLOCK DEPLOYMENT' : 'CONDITIONAL APPROVAL'),
                summary: stripEmojis(parsed.summary) || 'Strategic QA audit complete.',
                performancePlaybook: (parsed.performancePlaybook || [
                    "Implement responsive srcset and modern WebP/AVIF formats to reduce image transfer size.",
                    "Defer non-critical JavaScript to eliminate render-blocking delays."
                ]).map(p => stripEmojis(p)),
                issues: (parsed.issues || []).slice(0, 5).map(i => ({
                    ...i,
                    title: stripEmojis(i.title),
                    issue: stripEmojis(i.issue),
                    reason: stripEmojis(i.reason),
                    fix: Array.isArray(i.fix) ? i.fix.map(f => stripEmojis(f)) : stripEmojis(i.fix)
                }))
            };
        } catch (e) {
            console.warn(`[qaAgent]: Neural analysis pulse failed (${e.message}). Triggering local high-fidelity synthesis...`);
            
            // --- Local High-Fidelity Synthesis (Failover) ---
            const localIssues = [];

            // 1. Map real Form Issues (High Priority)
            (currentReport.formIssues || []).slice(0, 3).forEach(f => {
                localIssues.push({
                    title: f.issue || f.type || "Form Integrity Deviation",
                    issue: f.issue || f.observed || "Form boundary or validation defect detected.",
                    reason: f.technicalImpact || f.rootCause || "Input validation or state submission gap.",
                    fix: f.stepsToReproduce || [
                        f.recommendation || "Implement client-side validation constraints and debounce submit buttons on click."
                    ],
                    suggestedFix: f.suggestedFix || f.remediationCode || "",
                    severity: f.severity || "High",
                    source: "local"
                });
            });

            // 2. Map real UI/UX Issues (Layout, Collisions, Dead Clicks)
            (currentReport.uiIssues || []).slice(0, 3).forEach(u => {
                localIssues.push({
                    title: u.issue || u.type || "UI/UX Layout Deviation",
                    issue: u.issue || u.observed || "Dead click, layout overflow, or touch target collision detected.",
                    reason: u.technicalImpact || u.rootCause || "Interactive element failed to trigger handler or overlaps viewport bounds.",
                    fix: u.stepsToReproduce || [
                        u.recommendation || "Verify event binding, z-index hierarchy, and ensure interactive elements receive pointer events."
                    ],
                    suggestedFix: u.suggestedFix || u.remediationCode || "",
                    severity: u.severity || "Medium",
                    source: "local"
                });
            });

            // 3. Map real Security Issues
            (currentReport.securityIssues || []).slice(0, 3).forEach(s => {
                localIssues.push({
                    title: s.issue || s.type || "Security Threat Detected",
                    issue: s.issue || s.details || "API key leak, unencrypted storage, or malicious link pattern detected.",
                    reason: s.technicalImpact || s.reason || "Client-side exposure of sensitive credentials or dangerous external resource.",
                    fix: [s.suggestedFix || s.recommendation || "Revoke exposed credential immediately and route queries through secure backend proxy."],
                    suggestedFix: s.suggestedFix || "",
                    severity: s.severity || "Critical",
                    source: "local"
                });
            });

            // 4. Map real Console Errors
            (currentReport.consoleErrors || []).slice(0, 2).forEach(c => {
                localIssues.push({
                    title: "Runtime JavaScript Exception",
                    issue: c.message ? c.message.substring(0, 200) : "Uncaught browser exception captured.",
                    reason: "Client-side code crash or unhandled promise rejection.",
                    fix: [c.recommendation || "Inspect call stack for null-reference collision or unhandled promise in source bundle."],
                    suggestedFix: `try {\n  // Target execution block\n} catch (error) {\n  console.error("Safeguarded exception:", error);\n}`,
                    severity: "High",
                    source: "local"
                });
            });

            // 5. Map Broken Links
            (currentReport.brokenLinks || []).slice(0, 2).forEach(b => {
                localIssues.push({
                    title: `Broken Navigation Link (HTTP ${b.status || 404})`,
                    issue: `Link to ${b.link} returned HTTP status ${b.status || 'failure'}.`,
                    reason: "Resource permanently moved, endpoint deleted, or host connection refused.",
                    fix: [b.recommendation || "Update or remove invalid navigation href."],
                    suggestedFix: `// Verify destination endpoint: ${b.link}`,
                    severity: "Medium",
                    source: "local"
                });
            });

            // 6. Map Accessibility Violations
            (currentReport.accessibilityIssues || []).slice(0, 2).forEach(a => {
                localIssues.push({
                    title: a.issue || "ADA / WCAG Accessibility Violation",
                    issue: a.issue || "Missing ARIA landmarks or semantic markup violation.",
                    reason: "Interactive element not conforming to WCAG 2.1 accessibility criteria.",
                    fix: [a.recommendation || "Add proper aria-label, role, or form label attributes."],
                    suggestedFix: `<button aria-label="Action Button" type="button">\n  <span>Click</span>\n</button>`,
                    severity: a.severity || "Medium",
                    source: "local"
                });
            });

            const hasCritical = localIssues.some(i => i.severity === 'Critical');
            return {
                classification: hasCritical ? 'BLOCK_DEPLOYMENT' : 'STABLE_PASS',
                qaVerdict: hasCritical ? 'BLOCK DEPLOYMENT' : 'CONDITIONAL APPROVAL',
                summary: 'Diagnostic telemetry synthesized by Autonomous QA Lead into structured remediation findings and edge-case verification.',
                performancePlaybook: [
                    "Implement responsive srcset and modern WebP/AVIF formats to cut initial image payloads.",
                    "Defer or eliminate render-blocking synchronous scripts in <head> to improve First Contentful Paint.",
                    "Ensure client-side data queries are cached and debounce form submit actions to prevent duplicate API payloads."
                ],
                issues: localIssues
            };
        }
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
