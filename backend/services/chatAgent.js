const { Groq } = require('groq-sdk');
const fs = require('fs');
const path = require('path');
const linkGuardian = require('./linkGuardian');

class ChatAgent {
    constructor() {
        const apiKey = process.env.GROQ_API_KEY || process.env.GROQ_CHAT_API_KEY;
        if (apiKey) {
            this.client = new Groq({ apiKey });
        }
        
        // Load knowledge base
        try {
            const kbPath = path.join(__dirname, '../data/knowledgeBase.json');
            this.knowledgeBase = JSON.parse(fs.readFileSync(kbPath, 'utf8'));
        } catch (e) {
            this.knowledgeBase = [];
        }

        this.distilledPath = path.join(__dirname, '../data/aiDistilledFixes.json');
    }

    /**
     * analyzeReportQuestion - The 4-Layer Hybrid RAG Engine with Memory Sliding Window
     */
    async analyzeReportQuestion(history = [], reportData = {}) {
        if (!reportData) return "Neural link lost. Report context missing.";
        
        // Trim history to 8 most recent messages to prevent token window overflow
        const recentHistory = Array.isArray(history) ? history.slice(-8) : [];
        const lastUserMsg = [...recentHistory].reverse().find(h => h.role === 'user');
        if (!lastUserMsg) return "Neural sync required. Please state your query.";
        
        const message = lastUserMsg.content;
        const msg = message.toLowerCase().trim();

        // --- LAYER 0: Rule Engine (Deterministic Count & Metric Telemetry) ---
        if (msg.includes("how many") || msg.includes("count") || msg.includes("total") || msg.includes("list all") || msg.includes("stat")) {
            if (msg.includes("total") || msg.includes("all") || msg.includes("summary") || msg.includes("overview")) {
                const broken = reportData.brokenLinks?.length || 0;
                const security = reportData.securityIssues?.length || 0;
                const a11y = reportData.accessibilityIssues?.length || 0;
                const ui = (reportData.uiIssues?.length || 0) + (reportData.responsiveIssues?.length || 0);
                const network = reportData.networkLogs?.filter(n => n.status >= 400)?.length || 0;
                const console = reportData.consoleErrors?.length || 0;
                const total = broken + security + a11y + ui + network + console;

                return `### Telemetry Summary for ${reportData.url || 'Target Site'}\n\nThe audit uncovered **${total}** total signals:\n- **${broken}** Broken Link(s)\n- **${console}** Console Exception(s)\n- **${a11y}** Accessibility Violation(s)\n- **${ui}** UI/Layout Inconsistency(ies)\n- **${network}** HTTP Failure(s)\n- **${security}** Security Risk(s)\n\nOverall Health Score: **${reportData.healthScore || 100}/100**`;
            }

            if (msg.includes("broken link") || msg.includes("dead link") || msg.includes("404")) 
                return `There are **${reportData.brokenLinks?.length || 0}** broken links in this scan report.`;
            
            if (msg.includes("security") || msg.includes("vulnerability") || msg.includes("threat") || msg.includes("risk")) 
                return `There are **${reportData.securityIssues?.length || 0}** security findings flagged in this scan.`;
            
            if (msg.includes("accessibility") || msg.includes("a11y") || msg.includes("compliance")) 
                return `There are **${reportData.accessibilityIssues?.length || 0}** accessibility compliance warnings.`;
            
            if (msg.includes("ui") || msg.includes("ux") || msg.includes("layout") || msg.includes("design")) 
                return `The layout engine detected **${(reportData.uiIssues?.length || 0) + (reportData.responsiveIssues?.length || 0)}** design inconsistencies.`;
            
            if (msg.includes("network") || msg.includes("api") || msg.includes("http") || msg.includes("request")) 
                return `There are **${reportData.networkLogs?.filter(n => n.status >= 400)?.length || 0}** network failures captured.`;
            
            if (msg.includes("console") || msg.includes("js error") || msg.includes("exception")) 
                return `I detected **${reportData.consoleErrors?.length || 0}** active console errors.`;
        }

        // --- LAYER 1: Knowledge Base Lookup ---
        if (Array.isArray(this.knowledgeBase) && this.knowledgeBase.length > 0) {
            const matches = this.knowledgeBase.map(kb => {
                let score = 0;
                const issueName = kb.issue?.toLowerCase() || "";
                if (msg.includes(issueName)) score += 50; 
                if (msg.split(' ').some(word => word.length > 3 && issueName.includes(word))) score += 10;
                return { kb, score };
            }).filter(m => m.score > 0).sort((a, b) => b.score - a.score);

            const entry = matches[0]?.kb;
            
            if (entry && (msg.includes("fix") || msg.includes("how") || msg.includes("help") || matches[0].score >= 50)) {
                const fixList = Array.isArray(entry.fix) ? entry.fix.map(f => `- ${f}`).join('\n') : entry.fix;
                return `### Recommended Fix: ${entry.issue}\n\n**Root Cause:** ${entry.reason}\n\n**Actionable Recommendation:**\n${fixList}\n\n**Remediation Patch:**\n\`\`\`javascript\n${entry.remediationCode}\n\`\`\``;
            }
        }

        // --- LAYER 2: Context Extraction & Malicious Link Detection ---
        const context = { url: reportData.url };
        
        const urlMatch = message.match(/https?:\/\/[^\s]+/g);
        if (urlMatch) {
            const securityResults = urlMatch.map(u => linkGuardian.analyze(u)).filter(r => r.isMalicious);
            if (securityResults.length > 0) {
                context.malicious_links_detected_in_query = securityResults.map(r => ({
                    url: r.url,
                    threat: r.threatType,
                    risk: `${r.riskScore}%`,
                    reason: r.reason
                }));
            }
        }
        
        // Topic-based filters
        if (msg.includes("security")) context.security_findings = (reportData.securityIssues || []).slice(0, 8);
        if (msg.includes("accessibility")) context.accessibility_findings = (reportData.accessibilityIssues || []).slice(0, 8);
        if (msg.includes("ui") || msg.includes("ux")) context.ui_findings = (reportData.uiIssues || []).slice(0, 8);
        if (msg.includes("link") || msg.includes("broken")) context.broken_links = (reportData.brokenLinks || []).slice(0, 8);
        if (msg.includes("console") || msg.includes("error")) context.console_errors = (reportData.consoleErrors || []).slice(0, 8);

        // --- LAYER 3: Grounded Groq Intelligence (RAG Engine) ---
        if (!this.client) {
            return `### Audit Telemetry for ${reportData.url || 'Target Site'}\n\nFound **${reportData.consoleErrors?.length || 0}** console errors, **${reportData.brokenLinks?.length || 0}** broken links, and **${reportData.accessibilityIssues?.length || 0}** accessibility warnings.`;
        }

        const systemPrompt = `You are the Sentinel AI QA Diagnostic Assistant.
        
Context Telemetry: ${reportData.url}
- Health Score: ${reportData.healthScore || 100}/100
- Console Errors: ${reportData.consoleErrors?.length || 0}
- Broken Links: ${reportData.brokenLinks?.length || 0}
- Accessibility Violations: ${reportData.accessibilityIssues?.length || 0}

RAG CONTEXT DATA:
${JSON.stringify(context, null, 2)}

INSTRUCTIONS:
1. Answer the user's question clearly using Markdown headers and code blocks.
2. Provide root cause and exact code fix suggestions whenever relevant.`;

        try {
            const chatCompletion = await this.client.chat.completions.create({
                messages: [
                    { role: 'system', content: systemPrompt },
                    ...recentHistory.map(h => ({ role: h.role === 'user' ? 'user' : 'assistant', content: h.content })),
                    { role: 'user', content: message }
                ],
                model: process.env.GROQ_CHAT_MODEL || 'llama-3.1-8b-instant',
                temperature: 0.2,
                max_tokens: 1200
            });

            const reply = chatCompletion.choices[0].message.content;
            
            if (reply.includes("```") && reply.toLowerCase().includes("fix")) {
                this.distillFix(message, reply);
            }

            return reply;
        } catch (error) {
            console.error('[ChatAgent RAG Fault]:', error.message);
            return `### Diagnostic Summary\n\nThe AI neural uplink is offline, but static telemetry shows:\n- **${reportData.consoleErrors?.length || 0}** Console Error(s)\n- **${reportData.brokenLinks?.length || 0}** Broken Link(s)\n- **${reportData.accessibilityIssues?.length || 0}** Accessibility Issue(s)`;
        }
    }

    /**
     * distillFix - Background mechanism to save AI-generated fixes
     */
    async distillFix(query, reply) {
        try {
            let distilled = [];
            if (fs.existsSync(this.distilledPath)) {
                distilled = JSON.parse(fs.readFileSync(this.distilledPath, 'utf8') || "[]");
            }
            distilled.push({
                query,
                fixSummary: reply.substring(0, 500),
                timestamp: new Date().toISOString(),
                status: 'pending-review'
            });
            fs.writeFileSync(this.distilledPath, JSON.stringify(distilled.slice(-50), null, 2));
        } catch (e) {
            // Background error ignored
        }
    }
}

module.exports = new ChatAgent();

