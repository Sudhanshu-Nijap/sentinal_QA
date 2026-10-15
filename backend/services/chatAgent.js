const { GoogleGenerativeAI } = require('@google/generative-ai');
const { Groq } = require('groq-sdk');
const fs = require('fs');
const path = require('path');
const linkGuardian = require('./linkGuardian');

class ChatAgent {
    constructor() {
        this.geminiKey = process.env.GEMINI_API_KEY;
        this.groqKey = process.env.GROQ_API_KEY || process.env.GROQ_CHAT_API_KEY;
        
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
     * analyzeReportQuestion - Hybrid RAG Engine with Gemini 3.5 & Groq
     */
    async analyzeReportQuestion(history = [], reportData = {}) {
        if (!reportData) return "Neural link lost. Report context missing.";
        
        // Trim history to 8 most recent messages
        const recentHistory = Array.isArray(history) ? history.slice(-8) : [];
        const lastUserMsg = [...recentHistory].reverse().find(h => h.role === 'user');
        if (!lastUserMsg) return "Please state your query or select an issue from the report.";
        
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
            
            if (msg.includes("accessibility") || msg.includes("a11y") || msg.includes("compliance") || msg.includes("alt") || msg.includes("image")) 
                return `There are **${reportData.accessibilityIssues?.length || 0}** accessibility compliance findings (such as missing image alt text or missing H1 landmarks).`;
            
            if (msg.includes("ui") || msg.includes("layout") || msg.includes("overflow")) 
                return `The layout engine detected **${(reportData.uiIssues?.length || 0) + (reportData.responsiveIssues?.length || 0)}** design inconsistencies.`;

            if (msg.includes("console") || msg.includes("error") || msg.includes("crash") || msg.includes("exception")) 
                return `There are **${reportData.consoleErrors?.length || 0}** console errors captured.`;

            if (msg.includes("plugin") || msg.includes("404")) {
                const plugin404s = (reportData.networkLogs || []).filter(n => n.status === 404 && (n.url?.includes('/plugin') || n.url?.includes('revslider') || n.type === 'plugin_asset'));
                return `There are **${plugin404s.length}** 404 responses for plugin assets. These happen when the HTML header references stylesheets or scripts from removed or uninstalled plugins.`;
            }
        }

        // --- LAYER 1: Link Guardian Verification ---
        let linkCheck = null;
        if (typeof linkGuardian.verifyLinkContext === 'function') {
            try { linkCheck = linkGuardian.verifyLinkContext(message, reportData); } catch (_) {}
        }
        if (linkCheck) {
            return `### Navigation Telemetry for ${linkCheck.link}\n\n${linkCheck.analysis}\n\n**Remediation:** ${linkCheck.suggestedFix}`;
        }

        // --- LAYER 2: Semantic Issue Retrieval & Context Synthesis ---
        let context = {};
        
        if (msg.includes("broken") || msg.includes("link") || msg.includes("404")) context.broken_links = (reportData.brokenLinks || []).slice(0, 5);
        if (msg.includes("security") || msg.includes("auth") || msg.includes("key") || msg.includes("secret") || msg.includes("leak")) context.security_findings = (reportData.securityIssues || []).slice(0, 5);
        if (msg.includes("console") || msg.includes("error") || msg.includes("crash") || msg.includes("stack")) context.console_exceptions = (reportData.consoleErrors || []).slice(0, 5);
        if (msg.includes("accessibility") || msg.includes("a11y") || msg.includes("contrast") || msg.includes("image") || msg.includes("alt") || msg.includes("h1")) context.accessibility_issues = (reportData.accessibilityIssues || []).slice(0, 8);
        if (msg.includes("ui") || msg.includes("ux") || msg.includes("layout") || msg.includes("overflow")) context.ui_findings = (reportData.uiIssues || []).slice(0, 8);
        if (msg.includes("form") || msg.includes("input") || msg.includes("button")) context.form_findings = (reportData.formIssues || []).slice(0, 5);
        if (msg.includes("plugin") || msg.includes("css") || msg.includes("asset")) {
            context.plugin_and_asset_logs = (reportData.networkLogs || []).filter(n => n.status >= 400 && (n.url?.includes('plugin') || n.url?.includes('css') || n.url?.includes('js'))).slice(0, 8);
        }

        if (Object.keys(context).length === 0) {
            context = {
                key_issues: (reportData.aiInsights?.issues || []).slice(0, 5),
                console_sample: (reportData.consoleErrors || []).slice(0, 3),
                network_errors: (reportData.networkLogs || []).filter(n => n.status >= 400).slice(0, 5),
                accessibility_sample: (reportData.accessibilityIssues || []).slice(0, 4),
                summary: reportData.aiInsights?.summary || 'Standard audit summary.'
            };
        }

        const systemPrompt = `You are Sentinel AI, an expert Principal QA Lead and Web Architect.
You assist developers and managers in understanding audit findings for: ${reportData.url || 'Target Site'}.

DIAGNOSTIC CONTEXT:
- Overall Health Score: ${reportData.healthScore || 100}/100
- Console Errors: ${reportData.consoleErrors?.length || 0}
- Broken Links: ${reportData.brokenLinks?.length || 0}
- Accessibility Violations: ${reportData.accessibilityIssues?.length || 0}
- UI/Layout Issues: ${(reportData.uiIssues?.length || 0) + (reportData.responsiveIssues?.length || 0)}
- Network 4xx/5xx Errors: ${(reportData.networkLogs || []).filter(n => n.status >= 400).length}

TELEMETRY CONTEXT DATA:
${JSON.stringify(context, null, 2)}

COMMUNICATION RULES:
1. Explain issues in clear, approachable plain English. Avoid overwhelming jargon.
2. If asked about 404 errors on plugins (e.g. revslider/settings.css): Explain clearly that these are orphaned plugin assets requested in the HTML template that don't exist on the server. They are NOT code crashes. If the plugin was uninstalled or is unused, the fix is to remove the unused <link> or <script> tag from the HTML header.
3. If asked about image issues: Explain that missing alt attributes prevent screen readers from describing the image for visually impaired visitors and hurt SEO. Fix: Add alt="description" or alt="" if decorative.
4. If asked about JavaScript exceptions (like 'a.sf_menu_position is not a function'): Explain that a script tried to call a function that wasn't loaded or defined, which can break site navigation.
5. Provide actionable code snippets or steps where appropriate. Use clean Markdown headers.`;

        // 1. Try Google Gemini
        if (this.geminiKey) {
            try {
                const genAI = new GoogleGenerativeAI(this.geminiKey);
                const model = genAI.getGenerativeModel({ 
                    model: 'gemini-3.5-flash-lite',
                    systemInstruction: systemPrompt
                });

                const chatContents = [
                    ...recentHistory.map(h => ({
                        role: h.role === 'user' ? 'user' : 'model',
                        parts: [{ text: h.content }]
                    })),
                    { role: 'user', parts: [{ text: message }] }
                ];

                const chat = model.startChat({
                    history: chatContents.slice(0, -1)
                });

                const result = await chat.sendMessage(message);
                const reply = result.response.text();

                if (reply.includes("```") && reply.toLowerCase().includes("fix")) {
                    this.distillFix(message, reply);
                }

                return reply;
            } catch (geminiErr) {
                console.warn('[ChatAgent Gemini Fault]:', geminiErr.message);
            }
        }

        // 2. Try Groq (if key active)
        if (this.groqKey) {
            try {
                const groq = new Groq({ apiKey: this.groqKey });
                const chatCompletion = await groq.chat.completions.create({
                    messages: [
                        { role: 'system', content: systemPrompt },
                        ...recentHistory.map(h => ({ role: h.role === 'user' ? 'user' : 'assistant', content: h.content })),
                        { role: 'user', content: message }
                    ],
                    model: 'llama-3.1-8b-instant',
                    temperature: 0.2,
                    max_tokens: 1200
                });

                const reply = chatCompletion.choices[0].message.content;
                if (reply.includes("```") && reply.toLowerCase().includes("fix")) {
                    this.distillFix(message, reply);
                }
                return reply;
            } catch (error) {
                console.error('[ChatAgent Groq Fault]:', error.message);
            }
        }

        // 3. Fallback: Intelligent Deterministic Response
        if (msg.includes("plugin") || (msg.includes("404") && msg.includes("issue"))) {
            return `### Why 404 on Plugin Assets is Flagged as an Issue\n\nWhen a scan reports **HTTP 404 on a plugin asset** (such as \`plugins/revslider/.../settings.css\`):\n\n1. **What is happening:** The website's HTML template includes a \`<link rel="stylesheet">\` or \`<script>\` pointing to a plugin file that no longer exists on the server.\n2. **Why it's an issue:** Even though the plugin might be uninstalled or optional, the browser still tries to download this missing file on **every single page load**, which:\n   - Wastes network bandwidth and causes delay while waiting for the server to reply 404.\n   - Clutters browser developer tools with failed network requests.\n   - Can trigger JavaScript runtime errors if other scripts expect the plugin's code or styling to be present.\n3. **How to resolve it:** Open your site's global header/template file and delete the orphaned \`<link>\` tag for the uninstalled plugin.`;
        }

        if (msg.includes("image") || msg.includes("alt")) {
            return `### Image Alt Text Issues Explained\n\n1. **What is happening:** Images on your website (such as logos or banner graphics) are missing the \`alt="..."\` attribute in their HTML \`<img>\` tags.\n2. **Why it's an issue:** \n   - **Accessibility (WCAG 1.1.1):** Screen readers used by visually impaired visitors cannot explain what the image depicts.\n   - **SEO:** Search engine crawlers (Google, Bing) rely on alt attributes to understand image content and index visual assets.\n3. **How to fix it:** Add descriptive text to the image tag:\n   \`\`\`html\n   <img src="logo.png" alt="Xavier Institute of Engineering Logo">\n   \`\`\`\n   If the image is purely decorative, use \`alt=""\` so screen readers skip it.`;
        }

        return `### Diagnostic Telemetry Summary\n\n- **Target:** ${reportData.url || 'Web Application'}\n- **Console Errors:** ${reportData.consoleErrors?.length || 0}\n- **Accessibility Violations:** ${reportData.accessibilityIssues?.length || 0}\n- **Broken Links:** ${reportData.brokenLinks?.length || 0}\n- **Network 4xx/5xx Requests:** ${(reportData.networkLogs || []).filter(n => n.status >= 400).length}\n\nAsk me about specific findings (e.g. *Why are plugin 404s an issue?*, *How do I fix image alt text?*, or *Explain the navigation menu exception*).`;
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
