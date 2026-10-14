const axios = require('axios');

/**
 * secretSniffer - Deep Automated Secret, Token & Data Leak Engine
 * Audits public client-side JavaScript bundles and API responses for leaked credentials.
 * 
 * 1. Known Cloud & SaaS Signatures (AWS, GCP, Stripe, OpenAI, Anthropic, GitHub, Slack, etc.)
 * 2. Generic Assignment & High-Entropy Secret Scanner (detects ANY unlisted/custom API key)
 * 3. Embedded Database Connection URIs (MongoDB, PostgreSQL, MySQL, Redis)
 * 4. Sensitive JSON API Response Field Leaks (passwords, salts, SSNs, credit cards, auth tokens)
 * 5. Production Source Map (.js.map) Exposure Probe
 */

// ── 1. KNOWN ENTERPRISE PROVIDER SIGNATURES ──
const KNOWN_SIGNATURES = [
    // ── Payment & Financial ──
    {
        name: 'Stripe Live Secret Key',
        pattern: /sk_live_[0-9a-zA-Z]{24,}/g,
        severity: 'Critical',
        guide: 'Immediately revoke this Stripe key from your Stripe dashboard and move billing logic to a secure server.'
    },
    {
        name: 'Stripe Restricted Secret Key',
        pattern: /rk_live_[0-9a-zA-Z]{24,}/g,
        severity: 'Critical',
        guide: 'Revoke this restricted Stripe key immediately and rotate secrets.'
    },
    {
        name: 'Stripe Webhook Signing Secret',
        pattern: /whsec_[0-9a-zA-Z]{32,}/g,
        severity: 'Critical',
        guide: 'Revoke webhook secret. Attackers can forge fake webhook events (e.g. invoice.paid) into your application.'
    },
    {
        name: 'Square Access Token',
        pattern: /sq0atp-[0-9A-Za-z\-_]{22,}/g,
        severity: 'Critical',
        guide: 'Revoke Square access token. Anyone can process unauthorized payments or read merchant records.'
    },
    {
        name: 'Shopify Custom App Access Token',
        pattern: /shpat_[a-fA-F0-9]{32}/g,
        severity: 'Critical',
        guide: 'Revoke Shopify custom app token from your store admin.'
    },
    {
        name: 'Razorpay Live Key Secret',
        pattern: /rzp_live_[0-9a-zA-Z]{14,}/g,
        severity: 'Critical',
        guide: 'Revoke Razorpay live credentials from Razorpay dashboard.'
    },

    // ── Cloud Infrastructure & Hosting ──
    {
        name: 'AWS Access Key ID',
        pattern: /(?:A3T[A-Z0-9]|AKIA|AGPA|AIDA|AROA|AIPA|ANPA|ANVA|ASIA)[A-Z0-9]{16}/g,
        severity: 'Critical',
        guide: 'Revoke AWS IAM credentials immediately. Client-side code must use temporary Cognito or STS credentials instead.'
    },
    {
        name: 'AWS Secret Access Key Assignment',
        pattern: /(?:aws_secret_access_key|aws_secret_key)\s*[:=]\s*['"]([0-9a-zA-Z/+]{40})['"]/gi,
        severity: 'Critical',
        guide: 'Severe AWS compromise. Revoke root or IAM secret keys immediately.'
    },
    {
        name: 'Google API / Maps / Firebase Key',
        pattern: /AIzaSy[0-9A-Za-z\-_]{33}/g,
        severity: 'High',
        guide: 'If this key is used client-side (e.g. Google Maps), enforce strict HTTP Referrer restrictions in Google Cloud Console.'
    },
    {
        name: 'Google OAuth Access Token',
        pattern: /ya29\.[0-9A-Za-z\-_]{40,}/g,
        severity: 'Critical',
        guide: 'Revoke OAuth token immediately. Grants access to Google APIs under the authenticated account.'
    },
    {
        name: 'DigitalOcean Personal Access Token',
        pattern: /dop_v1_[a-f0-9]{64}/g,
        severity: 'Critical',
        guide: 'Revoke DigitalOcean personal access token. Attackers can spin up or delete cloud droplets.'
    },
    {
        name: 'Heroku API Key',
        pattern: /(?:heroku_api_key|heroku_key)\s*[:=]\s*['"]([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})['"]/gi,
        severity: 'Critical',
        guide: 'Revoke Heroku API key from Account Settings.'
    },

    // ── AI & Machine Learning ──
    {
        name: 'OpenAI Secret Key (Legacy/Project)',
        pattern: /sk-(?:proj-)?[a-zA-Z0-9_\-]{20,80}/g,
        severity: 'Critical',
        guide: 'Revoke OpenAI key immediately. Route AI requests through a protected backend proxy to prevent balance theft.'
    },
    {
        name: 'Anthropic Claude API Key',
        pattern: /sk-ant-[a-zA-Z0-9_\-]{32,100}/g,
        severity: 'Critical',
        guide: 'Revoke Anthropic API key immediately. Rotate key from Anthropic Console.'
    },
    {
        name: 'Hugging Face Access Token',
        pattern: /hf_[a-zA-Z0-9]{34,40}/g,
        severity: 'Critical',
        guide: 'Revoke Hugging Face token. Prevents unauthorized model inference and private repository access.'
    },
    {
        name: 'Replicate API Token',
        pattern: /r8_[a-zA-Z0-9]{32,40}/g,
        severity: 'Critical',
        guide: 'Revoke Replicate token from Replicate account dashboard.'
    },

    // ── Code & Package Repositories ──
    {
        name: 'GitHub Personal Access Token',
        pattern: /(?:ghp|gho|ghu|ghs|ghr)_[0-9a-zA-Z]{36}/g,
        severity: 'Critical',
        guide: 'Revoke this GitHub token from your account settings. Never commit personal access tokens into client bundles.'
    },
    {
        name: 'GitHub Fine-Grained Access Token',
        pattern: /github_pat_[0-9a-zA-Z_]{82}/g,
        severity: 'Critical',
        guide: 'Revoke fine-grained personal access token in GitHub Developer Settings.'
    },
    {
        name: 'GitLab Personal Access Token',
        pattern: /glpat-[0-9a-zA-Z_\-]{20,}/g,
        severity: 'Critical',
        guide: 'Revoke GitLab personal access token immediately.'
    },
    {
        name: 'NPM Access Token',
        pattern: /npm_[a-zA-Z0-9]{36}/g,
        severity: 'Critical',
        guide: 'Revoke NPM token immediately. Attackers can publish malicious releases to your packages.'
    },
    {
        name: 'Postman API Key',
        pattern: /PMAK-[a-zA-Z0-9]{59}/g,
        severity: 'Critical',
        guide: 'Revoke Postman API key. Anyone can view private workspace collections and environments.'
    },

    // ── Communications & Notifications ──
    {
        name: 'Slack Incoming Webhook URL',
        pattern: /https:\/\/hooks\.slack\.com\/services\/T[a-zA-Z0-9_]+\/B[a-zA-Z0-9_]+\/[a-zA-Z0-9_]+/g,
        severity: 'Critical',
        guide: 'Anyone with this URL can post spam or malicious messages into your Slack channels. Revoke and proxy via server.'
    },
    {
        name: 'Slack Bot User Token',
        pattern: /xoxb-[0-9]{11,13}-[0-9]{11,13}-[a-zA-Z0-9]{24}/g,
        severity: 'Critical',
        guide: 'Revoke bot token immediately. Bot tokens grant automated workspace read/write access.'
    },
    {
        name: 'Discord Webhook URL',
        pattern: /https:\/\/discord(?:app)?\.com\/api\/webhooks\/[0-9]{18,20}\/[A-Za-z0-9_\-]{60,70}/g,
        severity: 'Critical',
        guide: 'Anyone with this webhook can send messages to your Discord server. Delete webhook in channel settings.'
    },
    {
        name: 'Discord Bot Token',
        pattern: /(?:discord_bot_token|bot_token)\s*[:=]\s*['"]([MN][A-Za-z0-9]{23,26}\.[A-Za-z0-9_\-]{6}\.[A-Za-z0-9_\-]{27,38})['"]/gi,
        severity: 'Critical',
        guide: 'Regenerate Discord bot token in Discord Developer Portal.'
    },
    {
        name: 'Twilio Account SID & Auth Token',
        pattern: /(?:AC[a-f0-9]{32}|SK[a-f0-9]{32})/g,
        severity: 'Critical',
        guide: 'Revoke Twilio credentials from Twilio Console to prevent SMS/voice toll fraud.'
    },
    {
        name: 'SendGrid API Key',
        pattern: /SG\.[a-zA-Z0-9_\-\.]{66}/g,
        severity: 'Critical',
        guide: 'Revoke SendGrid API key. Attackers can send phishing emails from your verified domain.'
    },
    {
        name: 'Mailgun Private API Key',
        pattern: /key-[0-9a-zA-Z]{32}/g,
        severity: 'Critical',
        guide: 'Revoke Mailgun API key from Mailgun dashboard.'
    },
    {
        name: 'Telegram Bot Token',
        pattern: /[0-9]{9,10}:[a-zA-Z0-9_-]{35}/g,
        severity: 'Critical',
        guide: 'Revoke Telegram bot token via @BotFather.'
    },

    // ── Databases with Embedded Credentials ──
    {
        name: 'MongoDB Connection String with Password',
        pattern: /mongodb(?:\+srv)?:\/\/[^:\s'"]+:[^@\s'"]+@[a-zA-Z0-9\-.]+(?::[0-9]+)?(?:\/[^\s'"]*)?/g,
        severity: 'Critical',
        guide: 'Catastrophic database exposure. Change database credentials immediately and restrict IP access.'
    },
    {
        name: 'PostgreSQL Connection String with Password',
        pattern: /postgres(?:ql)?:\/\/[^:\s'"]+:[^@\s'"]+@[a-zA-Z0-9\-.]+(?::[0-9]+)?(?:\/[^\s'"]*)?/g,
        severity: 'Critical',
        guide: 'Catastrophic PostgreSQL exposure. Rotate database user password immediately.'
    },
    {
        name: 'MySQL Connection String with Password',
        pattern: /mysql:\/\/[^:\s'"]+:[^@\s'"]+@[a-zA-Z0-9\-.]+(?::[0-9]+)?(?:\/[^\s'"]*)?/g,
        severity: 'Critical',
        guide: 'Catastrophic MySQL exposure. Rotate database user password immediately.'
    },
    {
        name: 'Redis Connection String with Password',
        pattern: /redis:\/\/:[^@\s'"]+@[a-zA-Z0-9\-.]+(?::[0-9]+)?(?:\/[^\s'"]*)?/g,
        severity: 'Critical',
        guide: 'Rotate Redis auth password immediately.'
    },

    // ── Cryptographic & Certificate Keys ──
    {
        name: 'Private RSA/EC/SSH Cryptographic Key',
        pattern: /-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/g,
        severity: 'Critical',
        guide: 'Severe data compromise. Rotate the private key pair immediately.'
    },
    {
        name: 'PGP Private Key Block',
        pattern: /-----BEGIN PGP PRIVATE KEY BLOCK-----/g,
        severity: 'Critical',
        guide: 'Rotate compromised PGP private key immediately.'
    }
];

// ── 2. SENSITIVE DATABASE / JSON OBJECT KEYS ──
const SENSITIVE_JSON_KEYS = new Set([
    // Passwords & Hashes
    'password', 'passwd', 'password_hash', 'passwd_hash', 'passwordhash', 'pass_hash', 'salt', 'pwd',
    // Authentication & Tokens
    'auth_token', 'access_token', 'refresh_token', 'refreshtoken', 'session_token', 'sessiontoken',
    'jwt', 'id_token', 'bearer_token', 'user_token',
    // Secrets & Keys
    'secret', 'secret_key', 'secretkey', 'client_secret', 'clientsecret', 'private_key', 'privatekey',
    'api_key', 'apikey', 'encryption_key', 'signing_key', 'master_key', 'webhook_secret',
    // Financial & Payment
    'credit_card', 'card_number', 'cardnumber', 'cvv', 'cvc', 'card_security_code', 'iban', 'routing_number',
    // PII / Identity
    'ssn', 'social_security_number', 'tax_id', 'national_id', 'passport_number', 'driver_license', 'pin',
    // Internal Infrastructure
    'database_url', 'db_password', 'aws_secret', 'stripe_secret', 'service_role'
]);

// ── 3. SHANNON ENTROPY CALCULATOR ──
// Measures information randomness: Random API keys typically have H >= 3.2 - 4.5
function calculateShannonEntropy(str) {
    if (!str || str.length === 0) return 0;
    const len = str.length;
    const frequencies = {};
    for (let i = 0; i < len; i++) {
        const char = str[i];
        frequencies[char] = (frequencies[char] || 0) + 1;
    }
    let entropy = 0;
    for (const char in frequencies) {
        const p = frequencies[char] / len;
        entropy -= p * Math.log2(p);
    }
    return entropy;
}

// Common non-secret false positives
const COMMON_FALSE_POSITIVES = new Set([
    'application/json', 'application/x-www-form-urlencoded', 'multipart/form-data',
    '00000000-0000-0000-0000-000000000000', '11111111-1111-1111-1111-111111111111',
    'undefined', 'null', 'true', 'false', 'localhost', '127.0.0.1',
    'webpackChunk', 'create-react-app', 'vite/client'
]);

class SecretSniffer {
    constructor() {
        this.scannedScripts = new Set();
        this.scannedMaps = new Set();
    }

    /**
     * Inspects plain text content of a downloaded JavaScript file
     */
    auditScriptContent(code, scriptUrl, pageUrl) {
        if (!code || typeof code !== 'string') return [];
        const issues = [];

        // Avoid re-scanning identical script assets
        if (this.scannedScripts.has(scriptUrl)) return [];
        this.scannedScripts.add(scriptUrl);

        const seenMatches = new Set();

        // ── STEP 1: Known Provider Signatures ──
        for (const sig of KNOWN_SIGNATURES) {
            sig.pattern.lastIndex = 0; // Reset regex state
            let match;
            while ((match = sig.pattern.exec(code)) !== null) {
                const rawMatch = match[1] || match[0];
                if (seenMatches.has(rawMatch)) continue;
                seenMatches.add(rawMatch);

                const masked = rawMatch.length > 10 
                    ? `${rawMatch.substring(0, 6)}...${rawMatch.substring(rawMatch.length - 4)}`
                    : '***REDACTED***';

                issues.push({
                    testCaseId: 'TC-SEC-SECRET-01',
                    page: pageUrl,
                    type: 'EXPOSED_API_CREDENTIAL',
                    issue: `Leaked Secret: ${sig.name}`,
                    severity: sig.severity,
                    selector: scriptUrl,
                    details: `Exposed token (${masked}) found embedded inside public script: ${scriptUrl}`,
                    technicalImpact: `Severe unauthorized access risk. Visitors can extract this key directly from browser sources, spoofing requests or draining service quotas.`,
                    suggestedFix: sig.guide
                });
            }
        }

        // ── STEP 2: Generic Assignment & High-Entropy Secret Scanner ──
        // Catches ANY unlisted custom or proprietary API key (e.g. const apiKey = "...", secret: "...")
        const genericAssignmentRegex = /(?:api_?key|auth_?token|access_?token|client_?secret|secret_?key|app_?secret|private_?key|bearer_?token|encryption_?key|service_?role_?key)\s*[:=]\s*['"]([a-zA-Z0-9_\-\.]{16,128})['"]/gi;

        let assignMatch;
        while ((assignMatch = genericAssignmentRegex.exec(code)) !== null) {
            const candidateToken = assignMatch[1];
            if (!candidateToken || seenMatches.has(candidateToken)) continue;

            // False positive filtering
            if (COMMON_FALSE_POSITIVES.has(candidateToken.toLowerCase())) continue;
            if (candidateToken.includes(' ') || candidateToken.includes('/') || candidateToken.startsWith('http')) continue;

            const entropy = calculateShannonEntropy(candidateToken);

            // True random secret keys have entropy >= 3.1 and diverse characters
            if (candidateToken.length >= 20 && entropy >= 3.1) {
                seenMatches.add(candidateToken);

                const masked = `${candidateToken.substring(0, 4)}...${candidateToken.substring(candidateToken.length - 4)}`;
                const contextKeyword = assignMatch[0].split(/[:=]/)[0].trim();

                issues.push({
                    testCaseId: 'TC-SEC-SECRET-GENERIC',
                    page: pageUrl,
                    type: 'GENERIC_HIGH_ENTROPY_SECRET',
                    issue: `Leaked Generic API Key / Secret (${contextKeyword})`,
                    severity: 'Critical',
                    selector: scriptUrl,
                    details: `Suspicious high-entropy key/token (${masked}, entropy: ${entropy.toFixed(2)}) assigned to "${contextKeyword}" inside public script ${scriptUrl}.`,
                    technicalImpact: `Potential exposure of internal or third-party service credential. Public client bundles should never contain private server secrets.`,
                    suggestedFix: `Move ${contextKeyword} to server-side environment variables (.env) and access it only via authenticated backend endpoints.`
                });
            }
        }

        // ── STEP 3: Standalone Hardcoded JWT Token Detection ──
        const jwtRegex = /(?:eyJ[a-zA-Z0-9_-]{10,}\.eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,})/g;
        let jwtMatch;
        while ((jwtMatch = jwtRegex.exec(code)) !== null) {
            const token = jwtMatch[0];
            if (seenMatches.has(token)) continue;
            seenMatches.add(token);

            issues.push({
                testCaseId: 'TC-SEC-JWT-LEAK',
                page: pageUrl,
                type: 'CLIENT_BUNDLE_JWT_LEAK',
                issue: 'Hardcoded JWT Authentication Token Embedded in Script',
                severity: 'High',
                selector: scriptUrl,
                details: `Pre-signed JWT token embedded inside client JavaScript bundle. If this token belongs to an admin or service account, attackers can impersonate backend services.`,
                technicalImpact: 'Authentication bypass risk. Hardcoded JWTs cannot be invalidated without rotating the JWT signing secret.',
                suggestedFix: 'Never hardcode JWT tokens in source code. Issue tokens dynamically via authentication routes and store in HttpOnly cookies.'
            });
            break; // One JWT warning per script is sufficient
        }

        return issues;
    }

    /**
     * Inspects JSON response payloads from backend APIs for sensitive database columns
     */
    auditJsonResponse(jsonBody, apiUrl, pageUrl) {
        if (!jsonBody || typeof jsonBody !== 'object') return [];
        const issues = [];
        const leakedKeys = [];

        const walk = (obj, depth = 0) => {
            if (depth > 6 || !obj) return;
            if (Array.isArray(obj)) {
                obj.slice(0, 5).forEach(item => walk(item, depth + 1));
                return;
            }
            if (typeof obj === 'object') {
                for (const key of Object.keys(obj)) {
                    const normalizedKey = key.toLowerCase().replace(/[^a-z0-9_]/g, '');
                    if (SENSITIVE_JSON_KEYS.has(normalizedKey)) {
                        leakedKeys.push(key);
                    }
                    walk(obj[key], depth + 1);
                }
            }
        };

        try {
            walk(jsonBody);
        } catch (_) {}

        if (leakedKeys.length > 0) {
            const uniqueKeys = [...new Set(leakedKeys)];
            issues.push({
                testCaseId: 'TC-SEC-DATA-LEAK',
                page: pageUrl,
                type: 'SENSITIVE_API_RESPONSE_FIELD',
                issue: `Sensitive Data Leak in API Response (${uniqueKeys.join(', ')})`,
                severity: 'Critical',
                selector: apiUrl,
                details: `Endpoint ${apiUrl} returned sensitive field(s): [${uniqueKeys.join(', ')}]. Even if hidden from UI, visitors can read this data via Network inspection.`,
                technicalImpact: 'Severe credential or PII disclosure. Database hashes, internal secrets, or financial fields are transmitted directly to the client browser.',
                suggestedFix: 'Update backend API serialization (e.g. Mongoose transform, DTO, or Prisma select) to strip sensitive/internal database columns before sending JSON.'
            });
        }

        return issues;
    }

    /**
     * Checks if public source maps (.js.map) exist and are openly accessible
     */
    async checkSourceMapExposure(scriptUrl, pageUrl) {
        if (!scriptUrl || !scriptUrl.endsWith('.js') || this.scannedMaps.has(scriptUrl)) return null;
        this.scannedMaps.add(scriptUrl);

        try {
            const mapUrl = `${scriptUrl}.map`;
            const res = await axios.get(mapUrl, { 
                timeout: 3000, 
                validateStatus: s => s === 200,
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
            });

            if (res.data && (typeof res.data === 'object' || (typeof res.data === 'string' && res.data.includes('"sources"')))) {
                return {
                    testCaseId: 'TC-SEC-SOURCEMAP',
                    page: pageUrl,
                    type: 'EXPOSED_PRODUCTION_SOURCEMAP',
                    issue: 'Public Production Source Map Exposed (.js.map)',
                    severity: 'High',
                    selector: mapUrl,
                    details: `Unminified source map openly reachable at ${mapUrl}. Anyone can reconstruct your full original frontend source code, file structures, and comments.`,
                    technicalImpact: 'Source code reconnaissance risk. Attackers can view original unminified TypeScript/React code, internal endpoints, and developer comments.',
                    suggestedFix: 'Configure your build bundler (Vite/Webpack/Next.js) to set `sourcemap: false` in production builds.'
                };
            }
        } catch (_) {}

        return null;
    }
}

module.exports = new SecretSniffer();
