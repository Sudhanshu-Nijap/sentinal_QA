# Sentinel QA

Sentinel QA is an AI-powered QA and security auditing platform designed to scan websites for performance, accessibility, network logs, and JS exceptions, with an interactive AI debugging chat.

### How it works:
*   **Automated Scanning**: Spawns headless browsers via Playwright and launches Lighthouse to run audits on performance, accessibility (WCAG 2.1), SEO, and forms.
*   **Security Analysis**: Flags local SSRF exploits, checks for typosquatted brand mimicry, and queries Google Safe Browsing and AI classifiers.
*   **Interactive Debugging**: Features a RAG (Retrieval-Augmented Generation) chat interface that reviews logs, explains root causes, and proposes line-level patches to resolve bugs.

---

## 🛠️ Tech Stack
*   **Frontend**: React, Tailwind CSS, Vite, Socket.io-client
*   **Backend**: Node.js, Express, Playwright, Lighthouse, Groq SDK, MongoDB

---

## 🚀 Quick Start

### 1. Setup Backend
1. Go to the [backend](file:///c:/Users/sudha/OneDrive/Desktop/sentinal/sentinal_QA/backend) directory:
   ```bash
   cd backend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create a `.env` file in the backend folder:
   ```env
   PORT=5005
   MONGODB_URI=your_mongodb_connection_uri
   GROQ_API_KEY=your_groq_api_key
   ```
4. Start the server:
   ```bash
   npm run dev
   ```

### 2. Setup Frontend
1. Go to the [frontend](file:///c:/Users/sudha/OneDrive/Desktop/sentinal/sentinal_QA/frontend) directory:
   ```bash
   cd frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the application:
   ```bash
   npm run dev
   ```

---

## 📁 Core Files
*   **Backend Entry**: [backend/server.js](file:///c:/Users/sudha/OneDrive/Desktop/Sudhu/sentinal/sentinal_QA/backend/server.js)
*   **Frontend Entry**: [frontend/src/main.jsx](file:///c:/Users/sudha/OneDrive/Desktop/Sudhu/sentinal/sentinal_QA/frontend/src/main.jsx)
*   **Chat Agent**: [backend/services/chatAgent.js](file:///c:/Users/sudha/OneDrive/Desktop/Sudhu/sentinal/sentinal_QA/backend/services/chatAgent.js)
*   **Scan Engine**: [backend/services/scanEngine.js](file:///c:/Users/sudha/OneDrive/Desktop/Sudhu/sentinal/sentinal_QA/backend/services/scanEngine.js)
*   **Secret Sniffer**: [backend/services/secretSniffer.js](file:///c:/Users/sudha/OneDrive/Desktop/Sudhu/sentinal/sentinal_QA/backend/services/secretSniffer.js)
*   **Interaction Scanner**: [backend/services/interactionScanner.js](file:///c:/Users/sudha/OneDrive/Desktop/Sudhu/sentinal/sentinal_QA/backend/services/interactionScanner.js)

---

## 📂 File Structure
```text
sentinal_QA/
├── backend/                  # Node.js & Express REST API & worker cluster
│   ├── data/                 # Knowledge base datasets & distilled pattern fixes
│   ├── models/               # Mongoose schemas (ScanReport, User, Job, Chat, Message)
│   ├── routes/               # API controllers (scan, auth, chat, job)
│   ├── scripts/              # Database maintenance & migration scripts
│   ├── services/             # Core audit engines (scanEngine, secretSniffer, interactionScanner, crawler, qaAgent)
│   ├── workers/              # Isolated worker threads (scanWorker, lighthouseWorker, playwrightWorker)
│   ├── reports/              # Generated diagnostic PDF reports (runtime output)
│   ├── screenshots/          # Captured full-page visual audits (runtime output)
│   └── server.js             # HTTP server entry point & WebSocket registry
└── frontend/                 # React 19 + Tailwind CSS + Vite web client
    ├── public/               # Static icons & assets
    └── src/
        ├── assets/           # Global styles and assets
        ├── components/       # UI dashboard components (ReportDetail, ReportDashboard, BentoDashboard, ScanForm, ChatInterface)
        ├── config/           # API endpoints and client configuration (api.js)
        ├── data/             # Frontend reference data (learningHubData.json)
        ├── App.jsx           # Application shell & view router
        └── main.jsx          # React bootstrap mount point
```

---

## 📜 License
Licensed under the [ISC License](file:///c:/Users/sudha/OneDrive/Desktop/Sudhu/sentinal/sentinal_QA/backend/package.json#L13).
