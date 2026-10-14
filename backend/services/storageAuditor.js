/**
 * storageAuditor - Client-Side Storage & Sensitive Token Sniffer
 * Audits window.localStorage and window.sessionStorage for:
 * 1. Unencrypted JWT Tokens (should ideally use HttpOnly cookies)
 * 2. Cleartext passwords or sensitive API keys in client storage
 * 3. Sensitive user PII (SSN, credit card, auth credentials) stored insecurely
 */

async function auditStorage(page, url) {
    try {
        return await page.evaluate(() => {
            const issues = [];

            const checkStorage = (storage, storageName) => {
                if (!storage) return;

                const sensitiveKeyPatterns = [
                    /password/i, /pwd/i, /secret/i, /private_key/i,
                    /api_key/i, /access_token/i, /id_token/i, /bearer/i,
                    /credit_card/i, /ssn/i
                ];

                const jwtPattern = /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+$/;

                for (let i = 0; i < storage.length; i++) {
                    const key = storage.key(i);
                    if (!key) continue;
                    const value = storage.getItem(key) || '';

                    // Check for JWT token in localStorage/sessionStorage
                    if (jwtPattern.test(value.trim()) || (value.startsWith('Bearer ') && jwtPattern.test(value.substring(7).trim()))) {
                        issues.push({
                            type: 'CLIENT_STORAGE_JWT_EXPOSURE',
                            issue: `Unencrypted JWT token stored in ${storageName} ["${key}"]`,
                            severity: 'High',
                            selector: `${storageName}['${key}']`,
                            technicalImpact: 'Security risk. Tokens stored in localStorage are accessible to any JavaScript running on the page, making them vulnerable to Cross-Site Scripting (XSS) token theft. Recommended practice is HttpOnly, SameSite=Strict cookies.',
                            recommendation: `Migrate token storage for "${key}" from ${storageName} to Secure, HttpOnly cookies with SameSite attributes.`
                        });
                        continue;
                    }

                    // Check for sensitive keys
                    const isSensitiveKey = sensitiveKeyPatterns.some(p => p.test(key));
                    if (isSensitiveKey && value.length > 0) {
                        issues.push({
                            type: 'SENSITIVE_DATA_IN_STORAGE',
                            issue: `Potentially sensitive credential in ${storageName} ["${key}"]`,
                            severity: 'Medium',
                            selector: `${storageName}['${key}']`,
                            technicalImpact: `Cleartext persistence of credentials or sensitive identifiers in ${storageName} increases exposure to local device inspection and client-side script exploitation.`,
                            recommendation: `Avoid persisting sensitive data in ${storageName} or ensure strong client-side encryption.`
                        });
                    }
                }
            };

            try { checkStorage(window.localStorage, 'localStorage'); } catch (e) {}
            try { checkStorage(window.sessionStorage, 'sessionStorage'); } catch (e) {}

            return issues;
        });
    } catch (err) {
        return [];
    }
}

module.exports = { auditStorage };
