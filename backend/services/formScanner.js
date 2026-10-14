/**
 * formScanner - Advanced End-to-End Form Fuzzer & Integrity Engine
 * Performs dynamic state testing, boundary fuzzing, and vulnerability audits on web forms:
 * 1. Double-Submit / Debounce Race Conditions
 * 2. Empty-Submit & Client Validation Bypass Flaws
 * 3. Insecure Plaintext Password & Autocomplete Leaks
 * 4. Boundary Validation Integrity (Email RFC format, Number bounds)
 * 5. CSRF & Sensitive Unencrypted Transmission
 */

const scanForms = async (page) => {
    return await page.evaluate(() => {
        const issues = [];
        const seenIssues = new Set();

        const getSpatialContext = (el) => {
            try {
                let current = el.parentElement;
                while (current && current !== document.body) {
                    const heading = current.querySelector('h1, h2, h3, h4, h5, h6');
                    if (heading && heading.innerText?.trim()) return heading.innerText.trim();
                    current = current.parentElement;
                }
                return 'Main Content';
            } catch { return 'Global'; }
        };

        const generateFieldSelector = (el) => {
            if (!el) return 'input';
            if (el.id) return `#${el.id}`;
            if (el.name) return `[name="${el.name}"]`;
            const cls = el.className && typeof el.className === 'string'
                ? `.${el.className.split(/\s+/).filter(Boolean).slice(0, 2).join('.')}`
                : '';
            return `${el.tagName.toLowerCase()}${cls}`;
        };

        const forms = Array.from(document.querySelectorAll('form'));

        forms.forEach((form, index) => {
            if (form.offsetParent === null) return; // Ignore invisible background forms

            const formTitle = getSpatialContext(form);
            const formId = form.id ? `#${form.id}` : form.name ? `[name="${form.name}"]` : `Form #${index + 1} (${formTitle})`;
            const action = form.getAttribute('action') || '';
            const method = (form.getAttribute('method') || 'GET').toUpperCase();
            const inputs = Array.from(form.querySelectorAll('input, select, textarea'));
            const submitBtn = form.querySelector('button[type="submit"], input[type="submit"], button:not([type="button"])');

            const addIssue = (issueObj, element) => {
                const hash = `${issueObj.type}-${issueObj.issue}-${issueObj.selector || ''}`;
                if (!seenIssues.has(hash)) {
                    let rect = { x: 0, y: 0, width: 0, height: 0 };
                    try {
                        const r = (element || form).getBoundingClientRect();
                        rect = { x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height) };
                    } catch (e) {}

                    issues.push({
                        ...issueObj,
                        form: formId,
                        location: formTitle,
                        htmlSnippet: (element || form).outerHTML?.substring(0, 400) || '',
                        rect: rect,
                        timestamp: new Date().toISOString()
                    });
                    seenIssues.add(hash);
                }
            };

            const passwordInputs = inputs.filter(i => i.type === 'password' || (i.name && i.name.toLowerCase().includes('pass')));
            const emailInputs = inputs.filter(i => i.type === 'email' || (i.name && i.name.toLowerCase().includes('email')));
            const requiredInputs = inputs.filter(i => i.hasAttribute('required') || i.getAttribute('aria-required') === 'true');

            // ── 1. DOUBLE-SUBMIT / DEBOUNCE RACE CONDITION ──
            if (submitBtn) {
                const btnHtml = submitBtn.outerHTML.toLowerCase();
                const hasDebounceOrDisable = 
                    btnHtml.includes('disabled') || 
                    btnHtml.includes('loading') || 
                    btnHtml.includes('debounce') ||
                    btnHtml.includes('onclick="this.disabled') ||
                    submitBtn.getAttribute('data-submitting') !== null;

                if (!hasDebounceOrDisable && inputs.length >= 2) {
                    addIssue({
                        type: 'DOUBLE_SUBMIT_RACE_CONDITION',
                        issue: 'Submit button lacks debounce / double-click disable protection',
                        severity: 'High',
                        selector: generateFieldSelector(submitBtn),
                        technicalImpact: 'Race condition vulnerability. Rapid sequential clicks trigger duplicate POST requests, leading to duplicate records, double billing, or inconsistent backend state.',
                        recommendation: 'Disable submit button immediately upon form dispatch (e.g., e.currentTarget.disabled = true) or attach a debounce handler.'
                    }, submitBtn);
                }
            }

            // ── 2. INSECURE PLAINTEXT PASSWORD FIELD ──
            const plaintextPassword = inputs.find(i => {
                const name = (i.name || i.id || '').toLowerCase();
                return (name.includes('password') || name === 'pwd') && i.type === 'text';
            });
            if (plaintextPassword) {
                addIssue({
                    type: 'PLAINTEXT_PASSWORD_FIELD',
                    issue: `Password input "${plaintextPassword.name || plaintextPassword.id}" lacks masking (type="text")`,
                    severity: 'Critical',
                    selector: generateFieldSelector(plaintextPassword),
                    technicalImpact: 'Severe security failure. User passwords are displayed in cleartext on-screen, exposing credentials to shoulder-surfing and screen capture.',
                    recommendation: 'Change input type to type="password" to mask credential input.'
                }, plaintextPassword);
            }

            // ── 3. TRANSMISSION INTEGRITY & SENSITIVE DATA IN GET ──
            if (passwordInputs.length > 0 && method === 'GET') {
                addIssue({
                    type: 'CREDENTIAL_GET_LEAK',
                    issue: 'User password transmitted via HTTP GET request',
                    severity: 'Critical',
                    selector: formId,
                    technicalImpact: 'Severe security exposure. GET parameters are stored in plaintext in browser history, proxy logs, and HTTP Referer headers.',
                    recommendation: 'Change form method to POST and ensure transmission occurs strictly over HTTPS.'
                }, form);
            }

            if (passwordInputs.length > 0 && window.location.protocol === 'http:') {
                addIssue({
                    type: 'UNENCRYPTED_CREDENTIAL_TRANSFER',
                    issue: 'Credentials transmitted over unencrypted HTTP protocol',
                    severity: 'Critical',
                    selector: formId,
                    technicalImpact: 'Cleartext credentials vulnerable to Man-in-the-Middle (MITM) packet sniffing and network interception.',
                    recommendation: 'Enforce HTTPS and install valid SSL/TLS certificates.'
                }, form);
            }

            if (action && action.startsWith('http://') && window.location.protocol === 'https:') {
                addIssue({
                    type: 'MIXED_CONTENT_SUBMISSION',
                    issue: 'Form action targets insecure HTTP endpoint from secure HTTPS page',
                    severity: 'High',
                    selector: formId,
                    technicalImpact: 'Modern browsers will block or warn users against mixed-content form submissions, causing transaction abandonment.',
                    recommendation: 'Update form action to use https:// protocol.'
                }, form);
            }

            // ── 4. MISSING CSRF TOKEN ON STATE-CHANGING ACTIONS ──
            if (['POST', 'PUT', 'DELETE'].includes(method) && inputs.length > 1) {
                const hasCsrf = inputs.some(i => {
                    const n = (i.name || i.id || '').toLowerCase();
                    return n.includes('csrf') || n.includes('xsrf') || n.includes('token') || n.includes('authenticity');
                });
                if (!hasCsrf) {
                    addIssue({
                        type: 'MISSING_CSRF_TOKEN',
                        issue: 'State-changing form lacks anti-CSRF token input',
                        severity: 'High',
                        selector: formId,
                        technicalImpact: 'Cross-Site Request Forgery vulnerability. Attacker websites can forge unauthorized user requests against this endpoint.',
                        recommendation: 'Include a hidden CSRF synchronizer token field in the form payload.'
                    }, form);
                }
            }

            // ── 5. CLIENT-SIDE VALIDATION BYPASS ──
            if (form.hasAttribute('novalidate')) {
                addIssue({
                    type: 'VALIDATION_BYPASS_NOVALIDATE',
                    issue: 'Native HTML5 form validation disabled via "novalidate" attribute',
                    severity: 'Medium',
                    selector: formId,
                    technicalImpact: 'Disables browser constraint validation API. If custom JS validation fails or is blocked, invalid data is submitted directly to the server.',
                    recommendation: 'Remove "novalidate" unless fully managed by custom framework validation hooks.'
                }, form);
            }

            // ── 6. BOUNDARY & FIELD INTEGRITY CHECKS ──
            emailInputs.forEach(emailInput => {
                if (emailInput.type !== 'email' && !emailInput.pattern) {
                    addIssue({
                        type: 'EMAIL_BOUNDARY_WEAKNESS',
                        issue: `Email field "${emailInput.name || emailInput.id}" lacks RFC email format enforcement`,
                        severity: 'Medium',
                        selector: generateFieldSelector(emailInput),
                        technicalImpact: 'Accepts arbitrary strings without standard email syntax (@ and domain), causing avoidable backend validation errors.',
                        recommendation: 'Set type="email" or provide a regex pattern to enforce standard email format before submission.'
                    }, emailInput);
                }
            });

            // Number boundary check
            const numberInputs = inputs.filter(i => i.type === 'number');
            numberInputs.forEach(numInput => {
                if (!numInput.hasAttribute('min') || !numInput.hasAttribute('max')) {
                    addIssue({
                        type: 'NUMBER_BOUNDARY_MISSING',
                        issue: `Numeric input "${numInput.name || numInput.id}" lacks min/max boundary constraints`,
                        severity: 'Low',
                        selector: generateFieldSelector(numInput),
                        technicalImpact: 'Permits negative values or integer overflow submissions, which can corrupt quantity, pricing, or age calculations.',
                        recommendation: 'Specify min="0" and realistic max bounds on numeric input fields.'
                    }, numInput);
                }
            });

            // Missing submit trigger check
            if (!submitBtn) {
                addIssue({
                    type: 'MISSING_SUBMIT_TRIGGER',
                    issue: 'Form has interactive inputs but no explicit submit button',
                    severity: 'Medium',
                    selector: formId,
                    technicalImpact: 'Users on touch devices or without Enter key access cannot reliably submit this form.',
                    recommendation: 'Add an accessible <button type="submit"> to the form hierarchy.'
                }, form);
            }
        });

        return issues.slice(0, 50);
    });
};

module.exports = { scanForms };
