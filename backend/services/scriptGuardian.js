/**
 * ScriptGuardian - Intelligent JavaScript Static Analysis Engine
 * Detects malicious patterns, obfuscation, DOM XSS sinks, and data exfiltration in JS source code.
 */
class ScriptGuardian {
    constructor() {
        this.dangerTokens = [
            { id: 'DYNAMIC_EXEC', pattern: /eval\s*\(/g, severity: 'Critical', label: 'Dynamic Execution (eval)' },
            { id: 'DYNAMIC_EXEC', pattern: /new\s+Function\s*\(/g, severity: 'Critical', label: 'Dynamic Function Constructor' },
            { id: 'DOM_XSS', pattern: /\.innerHTML\s*=|\.outerHTML\s*=|document\.write\s*\(/g, severity: 'High', label: 'DOM XSS Sink Injection' },
            { id: 'BASE64_EXEC', pattern: /atob\s*\(/g, severity: 'High', label: 'Base64 Decoding (Potential Payload)' },
            { id: 'COOKIE_THEFT', pattern: /document\.cookie/g, severity: 'High', label: 'Session Access' },
            { id: 'HTTP_LEAK', pattern: /fetch\s*\(|XMLHttpRequest|navigator\.sendBeacon/g, severity: 'Low', label: 'Network Request' },
            { id: 'REDIRECTION', pattern: /window\.location\.href\s*=|location\.assign/g, severity: 'Medium', label: 'Automatic Redirection' },
            { id: 'PROTOTYPE_POLLUTION', pattern: /__proto__|Object\.prototype/g, severity: 'High', label: 'Prototype Pollution Vulnerability' },
            { id: 'KEYLOGGER', pattern: /addEventListener\s*\(\s*['"]key(?:down|press|up)['"]/g, severity: 'High', label: 'Keylogger / Input Interceptor' },
            { id: 'CORS_BYPASS', pattern: /cors-anywhere|allorigins|herokuapp\.com/g, severity: 'Medium', label: 'CORS Proxy Bypass Service' },
            { id: 'CRYPTO_MINER', pattern: /CoinHive|coinhive|cryptonight|webminer/gi, severity: 'Critical', label: 'Cryptojacking Script' }
        ];
    }

    /**
     * analyze(code, filename) - Heuristic analyzer for JavaScript content
     */
    analyze(code, filename = 'script.js') {
        if (!code || typeof code !== 'string') return { isMalicious: false, riskScore: 0, findings: [], filename };

        const findings = [];
        let totalRisk = 0;

        // 1. Token Match & Contextual Correlation
        const detectedTokens = this.dangerTokens.map(dt => {
            const matches = code.match(dt.pattern);
            return matches ? { ...dt, count: matches.length } : null;
        }).filter(Boolean);

        // Detect Data Exfiltration (Cookie Access + Network Request)
        const hasCookie = detectedTokens.some(t => t.id === 'COOKIE_THEFT');
        const hasNetwork = detectedTokens.some(t => t.id === 'HTTP_LEAK');
        
        if (hasCookie && hasNetwork) {
            findings.push({
                type: 'Malicious Pattern: Data Exfiltration',
                severity: 'Critical',
                evidence: 'Code contains both session cookie access and external network dispatch logic.',
                impact: 'May harvest active session tokens and transmit them to external C2 endpoints.'
            });
            totalRisk += 80;
        }

        // 2. Hex/Unicode Escape Obfuscation Detection
        const hexEscapes = code.match(/\\x[0-9a-fA-F]{2}/g) || [];
        if (hexEscapes.length > 15) {
            findings.push({
                type: 'Obfuscated Hex Strings',
                severity: 'High',
                evidence: `High density of hex-escaped strings detected (${hexEscapes.length} matches).`,
                impact: 'Conceals malicious variable names or payload URLs from static scanners.'
            });
            totalRisk += 45;
        }

        // 3. Obfuscation Detection (Entropy Heuristic)
        const entropy = this.calculateEntropy(code);
        if (entropy > 5.5 && code.length > 500) {
            findings.push({
                type: 'Suspicious Obfuscation',
                severity: 'High',
                evidence: `High character entropy detected (${entropy.toFixed(2)}).`,
                impact: 'Code is likely packed or obfuscated to hide its true purpose.'
            });
            totalRisk += 50;
        }

        // 4. Direct Dangerous Token Warnings
        detectedTokens.forEach(token => {
            if (token.severity === 'Critical') {
                findings.push({
                    type: token.label,
                    severity: 'Critical',
                    evidence: `Detected ${token.count} instance(s) of dangerous execution logic.`,
                    impact: 'Allows arbitrary code execution or script hijacking.'
                });
                totalRisk += 40;
            } else if (token.severity === 'High' && !findings.some(f => f.type === token.label)) {
                findings.push({
                    type: token.label,
                    severity: 'High',
                    evidence: `Detected ${token.count} instance(s) of sensitive system call.`,
                    impact: token.label.includes('DOM XSS') 
                        ? 'Renders unescaped strings directly into the DOM tree.' 
                        : 'Exposes application state or browser credentials.'
                });
                totalRisk += 25;
            }
        });

        const isMalicious = totalRisk >= 60 || findings.some(f => f.severity === 'Critical');

        return {
            isMalicious,
            riskScore: Math.min(totalRisk, 100),
            findings: findings.slice(0, 6),
            filename
        };
    }

    /**
     * analyzeInlineScripts - Analyzes an array of inline scripts extracted from HTML
     */
    analyzeInlineScripts(scripts = []) {
        const aggregatedFindings = [];
        let maxRiskScore = 0;

        scripts.forEach((scriptCode, index) => {
            const res = this.analyze(scriptCode, `inline-script-${index + 1}.js`);
            if (res.riskScore > maxRiskScore) maxRiskScore = res.riskScore;
            if (res.findings.length > 0) {
                aggregatedFindings.push(...res.findings);
            }
        });

        return {
            isMalicious: maxRiskScore >= 60,
            riskScore: maxRiskScore,
            findings: aggregatedFindings.slice(0, 10)
        };
    }

    /**
     * calculateEntropy - Estimates character distribution randomness
     */
    calculateEntropy(str) {
        if (!str) return 0;
        const frequencies = {};
        for (let char of str) {
            frequencies[char] = (frequencies[char] || 0) + 1;
        }
        let entropy = 0;
        const len = str.length;
        for (let char in frequencies) {
            const p = frequencies[char] / len;
            entropy -= p * Math.log2(p);
        }
        return entropy;
    }
}

module.exports = new ScriptGuardian();

