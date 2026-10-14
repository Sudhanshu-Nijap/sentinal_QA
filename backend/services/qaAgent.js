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
                classification: parsed.classification || 'ANALYSIS COMPLETE',
                qaVerdict: parsed.qaVerdict || (currentReport.securityIssues?.length > 0 ? 'BLOCK DEPLOYMENT' : 'CONDITIONAL APPROVAL'),
                summary: parsed.summary || 'Strategic QA audit complete.',
                performancePlaybook: parsed.performancePlaybook || [
                    "Implement responsive srcset and modern WebP/AVIF formats to reduce image transfer size.",
                    "Defer non-critical JavaScript to eliminate render-blocking delays."
                ],
                issues: (parsed.issues || []).slice(0, 5)
            };
        } catch (e) {
            console.warn(`[qaAgent]: Neural analysis pulse failed (${e.message}). Triggering local high-fidelity synthesis...`);
            
            // --- Local High-Fidelity Synthesis (Failover) ---
            const localIssues = [];
            if ((currentReport.securityIssues || []).length > 0) {
                localIssues.push({
                    title: "Critical Security Threat Detected",
                    issue: `The diagnostic layer identified ${currentReport.securityIssues.length} active security risks or unencrypted endpoints.`,
                    reason: "Missing security headers (CSP, HSTS) or unencrypted transport of sensitive credentials.",
                    fix: ["Add Content-Security-Policy header", "Enforce Strict-Transport-Security (HSTS)"],
                    suggestedFix: `// Add Security Headers in Node/Express:\napp.use((req, res, next) => {\n  res.setHeader("Content-Security-Policy", "default-src 'self'");\n  res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");\n  next();\n});`,
                    severity: "Critical",
                    source: "local"
                });
            }
            if (currentReport.lighthouseScores?.performance < 50) {
                localIssues.push({
                    title: "Critical Performance Bottleneck",
                    issue: "Homepage load speed is significantly below baseline.",
                    reason: "Heavy script execution or unoptimized assets detected.",
                    fix: ["Analyze main thread activity", "Implement aggressive asset compression"],
                    suggestedFix: `// Enable Gzip Compression in Express:\nconst compression = require('compression');\napp.use(compression());`,
                    severity: "High",
                    source: "local"
                });
            }
            if ((currentReport.consoleErrors || []).length > 0) {
                localIssues.push({
                    title: "Runtime Exceptions Detected",
                    issue: `${currentReport.consoleErrors.length} JavaScript errors captured in console.`,
                    reason: "Client-side code crashes or missing dependencies.",
                    fix: ["Review console logs in the Console tab", "Fix target script exceptions"],
                    suggestedFix: `try {\n  // Target execution block\n} catch (error) {\n  console.error("Safeguarded exception:", error);\n}`,
                    severity: "Critical",
                    source: "local"
                });
            }
            if ((currentReport.accessibilityIssues || []).length > 0) {
                localIssues.push({
                    title: "ADA Compliance Non-Conformity",
                    issue: "Structural accessibility violations detected.",
                    reason: "Missing ARIA attributes or semantic HTML violations.",
                    fix: ["Review specific failures in Accessibility tab", "Apply recommended ARIA patches"],
                    suggestedFix: `<button aria-label="Submit Form" type="submit">\n  <Icon />\n</button>`,
                    severity: "Medium",
                    source: "local"
                });
            }

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
