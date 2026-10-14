const url = require('url');

/**
 * LinkGuardian - Neural URL Security Analyzer
 * Implements a multi-tiered heuristic engine to identify malicious links.
 */
class LinkGuardian {
    constructor() {
        this.suspiciousKeywords = [
            'login', 'signin', 'verify', 'account', 'update', 'secure', 'bank', 
            'wallet', 'crypto', 'bonus', 'claim', 'refund', 'invoice'
        ];
        
        this.maliciousTlds = [
            '.xyz', '.top', '.icu', '.club', '.work', '.info', '.biz', '.best'
        ];
    }

    /**
     * analyze(rawUrl) - Performs a deep diagnostic on a URL
     * @returns {Object} { isMalicious, riskScore, threatType, reason }
     */
    analyze(rawUrl) {
        if (!rawUrl || typeof rawUrl !== 'string') return { isMalicious: false, riskScore: 0 };
        
        let riskScore = 0;
        const reasons = [];
        const threatTypes = new Set();

        try {
            const parsed = new URL(rawUrl);
            const hostname = parsed.hostname.toLowerCase();
            const fullUrl = rawUrl.toLowerCase();

            // 1. IP-based Hostname Check (Highly suspicious for phishing)
            if (/^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/.test(hostname)) {
                riskScore += 60;
                reasons.push("Uses naked IP address as hostname.");
                threatTypes.add("Phishing / C2 Distribution");
            }

            // 2. Lexical Complexity (Phishing usually has long, dash-heavy URLs)
            if (fullUrl.length > 75) {
                riskScore += 15;
                reasons.push("Extreme URL length detected.");
            }
            
            const dashCount = (hostname.match(/-/g) || []).length;
            if (dashCount > 3) {
                riskScore += 20;
                reasons.push("Excessive hyphenation in domain (common in domain squatting).");
            }

            // 3. Subdomain Depth Analysis
            const subdomainCount = hostname.split('.').length - 2;
            if (subdomainCount > 3) {
                riskScore += 25;
                reasons.push(`High subdomain depth (${subdomainCount} levels).`);
                threatTypes.add("Phishing / Redirection");
            }

            // 4. Keyword Masquerading
            this.suspiciousKeywords.forEach(keyword => {
                if (hostname.includes(keyword)) {
                    riskScore += 30;
                    reasons.push(`Contains high-risk trigger word: "${keyword}"`);
                    threatTypes.add("Phishing / Social Engineering");
                }
            });

            // 5. TLD Reputation Check
            this.maliciousTlds.forEach(tld => {
                if (hostname.endsWith(tld)) {
                    riskScore += 25;
                    reasons.push(`Uses high-risk TLD: ${tld}`);
                    threatTypes.add("Malware Distribution / Spam");
                }
            });

            // 6. Suspicious Special Characters
            if (hostname.includes('@') || hostname.includes('_')) {
                riskScore += 40;
                reasons.push("Uses user-info delimiter (@) or underscore in hostname.");
                threatTypes.add("Credential Harvesting");
            }

            // 7. Punycode / Homoglyph Attack Check (IDN Squatting)
            if (hostname.startsWith('xn--') || hostname.includes('.xn--')) {
                riskScore += 50;
                reasons.push("Uses Punycode encoding (potential IDN homoglyph spoofing attack).");
                threatTypes.add("IDN Homoglyph Spoofing");
            }

            // 8. Dangerous Executable & Malware Payload Extensions
            const dangerousExtensions = ['.exe', '.scr', '.apk', '.bat', '.vbs', '.sh', '.dmg', '.jar', '.ps1'];
            if (dangerousExtensions.some(ext => parsed.pathname.toLowerCase().endsWith(ext))) {
                riskScore += 60;
                reasons.push("Target URL points directly to executable binary payload.");
                threatTypes.add("Drive-by Malware Delivery");
            }

            // 9. Open Redirect Parameter Exploitation
            const openRedirectParams = ['redirect=', 'url=', 'next=', 'dest=', 'destination=', 'out='];
            if (openRedirectParams.some(param => fullUrl.includes(param))) {
                riskScore += 25;
                reasons.push("Contains open-redirect query parameter.");
                threatTypes.add("Open Redirect Vulnerability");
            }

            const isMalicious = riskScore >= 50;

            return {
                isMalicious,
                riskScore: Math.min(riskScore, 100),
                threatType: Array.from(threatTypes).join(' & ') || 'General Suspicion',
                reason: reasons.join(' ') || 'Low correlation with known threat patterns.',
                url: rawUrl
            };

        } catch (e) {
            return {
                isMalicious: true,
                riskScore: 100,
                threatType: 'Malformed / Deceptive URL',
                reason: 'URL parsing failed - likely using deceptive encoding or malformed syntax.',
                url: rawUrl
            };
        }
    }
}

module.exports = new LinkGuardian();
