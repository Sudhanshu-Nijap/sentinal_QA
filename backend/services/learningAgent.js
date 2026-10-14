const Groq = require('groq-sdk');

class LearningAgent {
    constructor() {
        const apiKey = process.env.GROQ_API_KEY;
        if (apiKey) {
            this.groq = new Groq({ apiKey });
        }
        this.modelName = process.env.GROQ_LEARNING_MODEL || 'llama-3.1-8b-instant';

        // Context-aware fallback knowledge base for instant answers offline or when API fails
        this.knowledgeBase = [
            {
                keywords: ['cors', 'origin', 'cross-origin', 'preflight', 'header'],
                explanation: 'CORS (Cross-Origin Resource Sharing) blocks browser requests when the backend response lacks required Access-Control-Allow-Origin headers.',
                example: "app.use(cors({\n  origin: 'http://localhost:5173',\n  credentials: true\n}));",
                fix: 'Configure CORS middleware on your backend server to explicitly allow your frontend domain origin.',
                steps: [
                    'Step 1: Install the CORS package (npm install cors).',
                    'Step 2: Add middleware before your route handlers in your Express/Node app.',
                    'Step 3: Ensure preflight OPTIONS requests return a 200/204 HTTP status.'
                ]
            },
            {
                keywords: ['render', 'loop', 'too many re-renders', 'infinite', 'useeffect'],
                explanation: 'Infinite re-renders occur when a state update trigger inside a component body or useEffect runs on every cycle without dependency constraints.',
                example: "useEffect(() => {\n  fetchData();\n}, []); // Empty dependency array prevents re-executing",
                fix: 'Pass a correct dependency array to useEffect or avoid calling state setters directly in the body.',
                steps: [
                    'Step 1: Check useEffect hook calls for missing or improperly updated dependency arrays.',
                    'Step 2: Wrap state-derived functions in useCallback if passed as dependencies.',
                    'Step 3: Verify inline event handlers use arrow functions: onClick={() => handleClick()}.'
                ]
            },
            {
                keywords: ['hydration', 'mismatch', 'ssr', 'nextjs'],
                explanation: 'Hydration mismatches occur when initial server-rendered HTML does not match the first client-side DOM render.',
                example: "// Avoid dynamic data like Date.now() during initial SSR\nconst [isClient, setIsClient] = useState(false);\nuseEffect(() => setIsClient(true), []);",
                fix: 'Defer client-only state (e.g. localStorage or window references) to useEffect.',
                steps: [
                    'Step 1: Identify elements using browser-only APIs (window, localStorage).',
                    'Step 2: Wrap client-only renders in a mount check (useEffect set flag).',
                    'Step 3: Ensure HTML tag nesting is valid (e.g. no <p> inside <p>).'
                ]
            },
            {
                keywords: ['xss', 'security', 'sanitize', 'script', 'injection'],
                explanation: 'Cross-Site Scripting (XSS) occurs when untrusted user input is executed as active HTML/JS in the user browser context.',
                example: "import DOMPurify from 'dompurify';\nconst cleanHTML = DOMPurify.sanitize(userInput);",
                fix: 'Sanitize user HTML with DOMPurify or use framework default escaping (JSX text nodes).',
                steps: [
                    'Step 1: Avoid dangerouslySetInnerHTML or innerHTML when outputting raw input.',
                    'Step 2: Use DOMPurify.sanitize() on any unavoidable rich text inputs.',
                    'Step 3: Enforce a strong Content-Security-Policy (CSP) HTTP header.'
                ]
            }
        ];
    }

    /**
     * Finds match in static knowledge base based on question keywords
     */
    findStaticMatch(question) {
        const lower = question.toLowerCase();
        for (const entry of this.knowledgeBase) {
            if (entry.keywords.some(kw => lower.includes(kw))) {
                return entry;
            }
        }
        return null;
    }

    async askDebugging(question) {
        if (!question || typeof question !== 'string') {
            return {
                explanation: "Invalid query submitted.",
                example: "// Enter a valid question",
                fix: "Provide a question about web development or QA testing.",
                steps: ["Step 1: Type your debugging question in the text box."]
            };
        }

        const prompt = `
            You are a Senior QA Automation Engineer and Security Debugging Expert for Sentinel AI.
            User Question: "${question}"
            
            TASK: 
            Provide a clear, practical, and highly accurate debugging explanation.
            
            OUTPUT FORMAT (STRICT JSON ONLY):
            {
              "explanation": "Concise 2-3 sentence technical overview of the problem.",
              "example": "Clean 2-5 line code snippet demonstrating the fix or diagnostic.",
              "fix": "Single actionable sentence outlining the permanent solution.",
              "steps": ["Step 1: ...", "Step 2: ...", "Step 3: ..."]
            }
        `;

        try {
            if (this.groq) {
                const result = await this.groq.chat.completions.create({
                    messages: [{ role: 'user', content: prompt }],
                    model: this.modelName,
                    temperature: 0.3,
                    response_format: { type: "json_object" }
                });
                
                const parsed = JSON.parse(result.choices[0].message.content);
                if (parsed.explanation && parsed.fix) {
                    return parsed;
                }
            }
        } catch (e) {
            console.error('[learningAgent]: LLM query failed, falling back to knowledge base:', e.message);
        }

        // Try static knowledge base lookup
        const staticMatch = this.findStaticMatch(question);
        if (staticMatch) {
            const { keywords, ...cleanResponse } = staticMatch;
            return cleanResponse;
        }

        // Default intelligent fallback
        return {
            explanation: "This issue typically stems from asynchronous state synchronization, network CORS policies, or missing environment variables in the active environment.",
            example: "// Universal Diagnostic Trace\nconsole.log('[DEBUG Trace]:', { timestamp: new Date().toISOString(), question: `${question.slice(0, 40)}...` });",
            fix: "Check browser console logs, verify API endpoints, and ensure environment keys are loaded.",
            steps: [
                "Step 1: Inspect the Developer Tools Console & Network tab for active error codes.",
                "Step 2: Verify API endpoint connectivity and backend server health.",
                "Step 3: Check variable declarations and asynchronous execution handling."
            ]
        };
    }
}

module.exports = new LearningAgent();

