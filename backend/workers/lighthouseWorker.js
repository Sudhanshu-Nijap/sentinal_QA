const { parentPort, workerData } = require('worker_threads');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

// 1. Load Environment
dotenv.config({ path: path.join(__dirname, '../.env') });

// 2. Import Scanning Services
const ScanReport = require('../models/ScanReport');
const qaScanner = require('../services/qaScanner');

// 3. Database Connection Hardening
const connectWithRetry = async (attempts = 0) => {
    const MAX_ATTEMPTS = 5;
    try {
        await mongoose.connect(process.env.MONGODB_URI, {
            serverSelectionTimeoutMS: 15000,
        });
        console.log('[LighthouseWorker]: Connected to Tactical Database');
    } catch (err) {
        if (attempts >= MAX_ATTEMPTS) {
            console.error('[LighthouseWorker]: Critical DB Failure: Max retries exceeded.');
            throw new Error(`Lighthouse database connection timed out after ${MAX_ATTEMPTS} attempts.`);
        }
        console.warn(`[LighthouseWorker]: DB connection attempt ${attempts + 1} failed. Retrying in 3s...`);
        await new Promise(res => setTimeout(res, 3000));
        return connectWithRetry(attempts + 1);
    }
};

// 4. Main Audit Pipeline
async function runLighthouseAudit(data) {
    const { reportId, baseUrl, tests } = data;
    
    try {
        console.log(`[LighthouseWorker]: Initiating Performance Audit for ${baseUrl}`);

        const emitProgress = (percent, stage) => {
            if (parentPort) parentPort.postMessage({ type: 'progress', percent, stage });
        };

        // Skip if Lighthouse / Performance is not requested
        const isLighthouseRequired = Array.isArray(tests) && (
            tests.includes('lighthouse') || 
            tests.includes('performance') || 
            tests.includes('accessibility')
        );

        if (!isLighthouseRequired) {
            console.log('[LighthouseWorker]: Bypassing audit, modules not selected.');
            if (parentPort) parentPort.postMessage({ type: 'completed' });
            return;
        }

        emitProgress(15, 'Engaging Dedicated Lighthouse Core...');

        // Run dedicated scan for isolation
        emitProgress(40, 'Measuring Core Web Vitals & Accessibility...');
        const dedicatedData = await qaScanner.runDedicatedScan(baseUrl).catch(err => {
            console.error(`[LighthouseWorker]: Dedicated Audit FAILED: ${err.message}`);
            return null;
        });

        emitProgress(75, 'Persisting Performance Telemetry...');
        if (dedicatedData && dedicatedData.scores?.performance > 0) {
            await ScanReport.findByIdAndUpdate(reportId, {
                $set: { lighthouseScores: dedicatedData.scores },
                $push: { accessibilityIssues: { $each: dedicatedData.accessibilityIssues || [] } }
            });
            console.log(`[LighthouseWorker]: Audit Success for ${baseUrl}`);
        } else {
            console.warn(`[LighthouseWorker]: Audit returned no telemetry for ${baseUrl}`);
        }

        emitProgress(100, 'Lighthouse Audit Complete.');
        if (parentPort) parentPort.postMessage({ type: 'completed' });

    } catch (error) {
        console.error('[LighthouseWorker Fatal]:', error);
        if (parentPort) parentPort.postMessage({ type: 'failed', error: error.message });
    } finally {
        await mongoose.disconnect().catch(() => {});
    }
}

// Global Exception Guards
process.on('uncaughtException', (err) => {
    console.error('[LighthouseWorker Uncaught Exception]:', err.message);
    if (parentPort) parentPort.postMessage({ type: 'failed', error: err.message });
});

process.on('unhandledRejection', (reason) => {
    console.error('[LighthouseWorker Unhandled Rejection]:', reason);
});

// Start with connection guard
connectWithRetry().then(() => {
    runLighthouseAudit(workerData);
}).catch(err => {
    if (parentPort) parentPort.postMessage({ type: 'failed', error: err.message });
});

