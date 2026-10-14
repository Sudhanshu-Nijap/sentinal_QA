const { parentPort, workerData } = require('worker_threads');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

// 1. Load Environment
dotenv.config({ path: path.join(__dirname, '../.env') });

// 2. Import Scanning Services
const ScanReport = require('../models/ScanReport');
const scanEngine = require('../services/scanEngine');

// 3. Database Connection Hardening
const connectWithRetry = async (attempts = 0) => {
    const MAX_ATTEMPTS = 5;
    try {
        await mongoose.connect(process.env.MONGODB_URI, {
            serverSelectionTimeoutMS: 15000,
        });
        console.log('[PlaywrightWorker]: Connected to Tactical Database');
    } catch (err) {
        if (attempts >= MAX_ATTEMPTS) {
            console.error('[PlaywrightWorker]: Critical DB Failure: Max retries exceeded.');
            throw new Error(`Playwright database connection timed out after ${MAX_ATTEMPTS} attempts.`);
        }
        console.warn(`[PlaywrightWorker]: DB connection attempt ${attempts + 1} failed. Retrying in 3s...`);
        await new Promise(res => setTimeout(res, 3000));
        return connectWithRetry(attempts + 1);
    }
};

// 4. Main Diagnostic Pipeline
async function runPlaywrightDiagnostics(data) {
    const { reportId, baseUrl, tests, scope } = data;
    
    try {
        console.log(`[PlaywrightWorker]: Initiating Playwright Diagnostics for ${baseUrl}`);

        const emitProgress = (percent, stage) => {
            if (parentPort) parentPort.postMessage({ type: 'progress', percent, stage });
        };

        // Filter tests to only include Playwright-compatible modules
        const playwrightModules = ['console', 'network', 'ui', 'links', 'forms'];
        const activeSuite = Array.isArray(tests) ? tests.filter(t => playwrightModules.includes(t)) : [];

        if (scope === 'single') {
            await scanEngine.runSinglePageScan(reportId, baseUrl, activeSuite, emitProgress);
        } else {
            await scanEngine.runTargetedCrawlScan(reportId, baseUrl, activeSuite, emitProgress);
        }

        if (parentPort) parentPort.postMessage({ type: 'completed' });

    } catch (error) {
        console.error('[PlaywrightWorker Fatal]:', error);
        if (parentPort) parentPort.postMessage({ type: 'failed', error: error.message });
    } finally {
        await mongoose.disconnect().catch(() => {});
    }
}

// Global Exception Guards
process.on('uncaughtException', (err) => {
    console.error('[PlaywrightWorker Uncaught Exception]:', err.message);
    if (parentPort) parentPort.postMessage({ type: 'failed', error: err.message });
});

process.on('unhandledRejection', (reason) => {
    console.error('[PlaywrightWorker Unhandled Rejection]:', reason);
});

// Start with connection guard
connectWithRetry().then(() => {
    runPlaywrightDiagnostics(workerData);
}).catch(err => {
    if (parentPort) parentPort.postMessage({ type: 'failed', error: err.message });
});

