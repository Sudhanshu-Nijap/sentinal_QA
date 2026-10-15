const express = require('express');
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const router = express.Router();
const ScanReport = require('../models/ScanReport');
const Job = require('../models/Job');
const crawler = require('../services/crawler');
const qaScanner = require('../services/qaScanner');
const qaAgent = require('../services/qaAgent');
const reportExporter = require('../services/reportExporter');
const scanEngine = require('../services/scanEngine');
const axios = require('axios');
const linkGuardian = require('../services/linkGuardian');
const Message = require('../models/Message');
const Chat = require('../models/Chat');
const { analyzeURLSecurity } = require('../services/urlSecurityAnalyzer');

// Global registry of tactical workers for lifecycle control
const activeWorkers = new Map();

// ── Start a new scan ──────────────────────────────────────────────────────────
router.post('/scan', async (req, res) => {
    const { url, userId, force, singlePageOnly, tests, scope, mode, chatId } = req.body;
    if (!url) return res.status(400).json({ error: 'URL is required' });
    if (!userId) return res.status(400).json({ error: 'User ID is required' });

    const urlPattern = /^(https?:\/\/)/i;
    if (!urlPattern.test(url))
        return res.status(400).json({ error: 'Protocol (http/https) is required.' });

    try { new URL(url); }
    catch (e) { return res.status(400).json({ error: 'Invalid URL format.' }); }

    // INTEGRATION POINT: FAST URL Security Analyzer (Blocking Mode)
    const verdict = await analyzeURLSecurity(url);
    if (verdict.blocked) {
        console.error(`[Security Gateway]: Neural Link Blocked for ${url}. Risk: ${verdict.riskLevel.toUpperCase()}`);
        const shortExplanation = `Security Block [${verdict.riskLevel.toUpperCase()}] - ${verdict.reason}. ${verdict.explanation || ''}`;
        
        // Notify chat if context exists
        if (chatId) {
            try {
                const Message = require('../models/Message');
                const Chat = require('../models/Chat');
                const msg = await Message.create({
                    chatId: chatId,
                    type: 'ai',
                    content: `**Security Hazard Detected**\n\n${verdict.explanation || verdict.reason || "Suspicious morphology detected."}`,
                    metadata: { 
                        riskLevel: verdict.riskLevel,
                        reason: verdict.reason,
                        status: 'blocked'
                    }
                });
                
                // Update chat timestamp for sorting
                await Chat.findByIdAndUpdate(chatId, { lastMessageAt: new Date() });
                
                if (global.io) {
                    global.io.to(chatId.toString()).emit('new-message', msg);
                }
            } catch (e) {
                console.error('Failed to persist security block message:', e.message);
            }
        }
        
        // Return 400 but ensure frontend can display the payload
        return res.status(400).json({ 
            error: shortExplanation, 
            blocked: true, 
            riskLevel: verdict.riskLevel 
        });
    }

    // LEGIT URL CASE: Proceed to scan...
    console.log(`[Security Gateway]: Neural Link Verified for ${url}. Risk: LOW`);

    // Provide the short explanation to the chat UI for successful verification
    if (chatId) {
        try {
            const Message = require('../models/Message');
            const msg = await Message.create({
                chatId: chatId,
                type: 'system',
                content: `Security Check Passed: ${verdict.riskLevel.toUpperCase()} Risk. Scanning permitted.`
            });
            if (global.io) {
                global.io.to(chatId.toString()).emit('new-message', msg);
            }
        } catch (e) {
            console.error('Failed to post security verification system message:', e.message);
        }
    }

    try {
        const resolvedScope = singlePageOnly ? 'single' : (scope || 'site');
        // Run scan fully async — returns reportId immediately to the client
        const { reportId, isCached, threat } = await startScan(url, userId, force, 'standard', singlePageOnly, tests, resolvedScope, mode, chatId);

        if (threat) {
            return res.status(403).json({ 
                error: 'Security Breach Protocol: Targeted domain is flagged as malicious.',
                threat: threat.threatType,
                riskScore: threat.riskScore
            });
        }

        if (isCached) {
            return res.status(200).json({
                message: 'Using cached report',
                reportId: reportId,
                chatId: chatId || null,
                isCached: true
            });
        } else {
            res.status(202).json({ message: 'Scan started', reportId: reportId, chatId: chatId || null });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ── Get the most recent active/in-progress scan for a user ─────────────────────
router.get('/scan/active/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const activeScan = await ScanReport.findOne({
            userId,
            status: 'in-progress'
        }).sort({ createdAt: -1 });

        if (!activeScan) return res.status(200).json({ message: 'No active scan in progress', status: 'idle' });
        res.json(activeScan);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ── Get all reports ───────────────────────────────────────────────────────────
router.get('/reports', async (req, res) => {
    try {
        const { userId } = req.query;
        const filter = userId ? { userId } : {};
        const reports = await ScanReport.find(filter).sort({ isPinned: -1, scanDate: -1 });
        res.json(reports);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ── Get a specific report ─────────────────────────────────────────────────────
router.get('/report/:id', async (req, res) => {
    try {
        const report = await ScanReport.findById(req.params.id);
        if (!report) return res.status(404).json({ error: 'Report not found' });

        // Return full report - filtering removed to ensure total data visibility
        res.json(report);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.patch('/report/:id/pin', async (req, res) => {
    try {
        const report = await ScanReport.findById(req.params.id);
        if (!report) return res.status(404).json({ error: 'Report not found' });

        report.isPinned = !report.isPinned;
        await report.save({ validateBeforeSave: false }); // Bypass validation for tactical updates

        res.json(report);
    } catch (error) {
        console.error("Pin toggle error:", error);
        res.status(500).json({ error: error.message });
    }
});

// ── Stateful Rescan Protocol (Memory Inheritance) ────────────────────────────
router.post('/report/:id/rescan', async (req, res) => {
    try {
        const oldReport = await ScanReport.findById(req.params.id);
        if (!oldReport) return res.status(404).json({ error: 'Original neural trace not found' });

        // Inherit tactical configuration from the previous report
        const config = {
            url: oldReport.url,
            userId: oldReport.userId,
            tests: oldReport.scannedModules || ['console', 'network', 'lighthouse', 'accessibility', 'links', 'ui', 'forms'],
            scope: oldReport.mode === 'full' ? 'site' : 'single',
            mode: oldReport.mode || 'specific',
            force: true // CRITICAL: Skip cache to ensure fresh diagnostic
        };

        // Reuse the core startScan logic to dispatch the new audit
        const { reportId } = await startScan(
            config.url, 
            config.userId, 
            config.force, 
            'standard', // chaosIntensity (Default)
            config.scope === 'single', // singlePageOnly (Derive from scope)
            config.tests, 
            config.scope, 
            config.mode,
            config.chatId || null // chatId (Ensure context handoff)
        );

        res.status(202).json({ 
            message: 'Stateful rescan protocol initiated.', 
            reportId,
            inheritedFrom: oldReport._id
        });
    } catch (error) {
        console.error('[Rescan Route failure]:', error);
        res.status(500).json({ error: error.message });
    }
});

// ── Share Report ─────────────────────────────────────────────────────────────
router.patch('/report/:id/share', async (req, res) => {
    try {
        const report = await ScanReport.findById(req.params.id);
        if (!report) return res.status(404).json({ error: 'Report not found' });
        report.isShared = true;
        await report.save();
        res.json({ message: 'Share link activated', url: `http://localhost:5173/report/${report._id}` });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ── Rename Report ────────────────────────────────────────────────────────────
router.patch('/report/:id/rename', async (req, res) => {
    try {
        const { name } = req.body;
        const report = await ScanReport.findByIdAndUpdate(req.params.id, { customName: name }, { new: true });
        if (!report) return res.status(404).json({ error: 'Report not found' });
        res.json(report);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ── Archive / Unarchive Report ───────────────────────────────────────────────
router.patch('/report/:id/archive', async (req, res) => {
    try {
        const report = await ScanReport.findById(req.params.id);
        if (!report) return res.status(404).json({ error: 'Report not found' });
        report.isArchived = !report.isArchived;
        await report.save();
        res.json(report);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ── Delete a specific report ──────────────────────────────────────────────────
router.delete('/report/:id', async (req, res) => {
    try {
        const report = await ScanReport.findById(req.params.id);
        if (!report) return res.status(404).json({ error: 'Report not found' });

        // Terminate any active tactical worker for this report
        const activeWorker = activeWorkers.get(req.params.id);
        if (activeWorker) {
            console.log(`[Main]: Terminating active worker for deleted report ${req.params.id}`);
            await activeWorker.terminate();
            activeWorkers.delete(req.params.id);
        }

        // Clean up full page screenshots
        if (report.screenshots && report.screenshots.length > 0) {
            report.screenshots.forEach(screenshot => {
                if (screenshot.path) {
                    const imgPath = path.join(__dirname, '..', screenshot.path);
                    if (fs.existsSync(imgPath)) fs.unlinkSync(imgPath);
                }
            });
        }

        // Clean up smart form test screenshots
        if (report.smartFormTests && report.smartFormTests.length > 0) {
            report.smartFormTests.forEach(test => {
                if (test.screenshot) {
                    const imgPath = path.join(__dirname, '..', test.screenshot);
                    if (fs.existsSync(imgPath)) fs.unlinkSync(imgPath);
                }
            });
        }

        // Clean up exported PDF report
        const pdfPath = path.join(__dirname, '..', 'reports', `report-${req.params.id}.pdf`);
        if (fs.existsSync(pdfPath)) {
            fs.unlinkSync(pdfPath);
        }

        await ScanReport.findByIdAndDelete(req.params.id);

        res.json({ message: 'Report and associated files deleted successfully' });
    } catch (error) {
        console.error('[Delete Report Error]:', error);
        res.status(500).json({ error: error.message });
    }
});

// ── Export PDF ────────────────────────────────────────────────────────────────
router.get('/report/:id/export', async (req, res) => {
    try {
        const pdfUrl = await reportExporter.generatePDF(req.params.id);
        if (!pdfUrl) return res.status(404).json({ error: 'Report not found' });
        res.json({ url: pdfUrl });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ── Stop an active scan ───────────────────────────────────────────────────────
router.post('/stop', async (req, res) => {
    try {
        const { reportId } = req.body;
        if (!reportId) return res.status(400).json({ error: 'Report ID required' });

        const worker = activeWorkers.get(reportId.toString());
        if (!worker) return res.status(404).json({ error: 'Active scan not found' });

        await worker.terminate();
        activeWorkers.delete(reportId.toString());

        await ScanReport.findByIdAndUpdate(reportId, { status: 'failed', customName: 'Scan Terminated by User' });

        if (global.io) {
            global.io.to(reportId.toString()).emit('scan-progress', { percent: 100, stage: 'Scan Terminated.', status: 'failed' });
        }

        res.json({ message: 'Neural scan terminated successfully.' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ── Historical Trends ──────────────────────────────────────────────────────────
router.get('/stats/trends', async (req, res) => {
    try {
        const { url, userId } = req.query;
        if (!url || !userId) return res.status(400).json({ error: 'URL and UserID required' });

        const history = await ScanReport.find({ url, userId, status: 'completed' })
            .select('healthScore performanceMetrics lighthouseScores createdAt')
            .sort({ createdAt: 1 })
            .limit(10);

        res.json(history);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * calculateReportHealth - Centralized logic for scoring a report.
 * Matches the frontend weighting system.
 */
const calculateReportHealth = (report) => {
    if (!report) return 0;
    const weights = { network: 0.1, links: 10, console: 5, ui: 10, accessibility: 10 };
    const counts = {
        network: report.networkLogs?.length || 0,
        links: report.brokenLinks?.length || 0,
        console: report.consoleErrors?.length || 0,
        ui: (report.uiIssues?.length || 0) + (report.responsiveIssues?.length || 0),
        accessibility: report.accessibilityIssues?.length || 0
    };

    const rawDeduction = Object.keys(weights).reduce((acc, key) => acc + (counts[key] * weights[key] || 0), 0);
    const score = Math.max(1, Math.round(100 * Math.exp(-rawDeduction / 400)));
    return score;
};

/**
 * startScan - Initiates the background scan process.
 * Separated from runFullScan for cleaner async handling.
 */
async function startScan(baseUrl, userId, force = false, chaosIntensity = 'standard', singlePageOnly = false, tests = [], scope = 'site', mode = 'specific', chatId = null) {
    // ── Pre-Scan Security Gate (PRIORITY #1) ──
    const securityCheck = linkGuardian.analyze(baseUrl);
    if (securityCheck.isMalicious) {
        console.log(`[SecurityGate]: Blocking malicious scan for ${baseUrl}`);
        
        if (chatId) {
            try {
                const threatMsg = `### SECURITY HAZARD DETECTED\n\n**Sentinel QA Engine** has intercepted this request because the target domain matches critical phishing or malware distribution patterns.\n\n- **Threat Type**: ${securityCheck.threatType}\n- **Risk Score**: ${securityCheck.riskScore}%\n- **Logic**: ${securityCheck.reason}\n\n**Recommendation**: Protocol aborted for system security. Do not interact with this domain.`;
                
                const msg = await Message.create({
                    chatId: chatId,
                    type: 'ai',
                    content: threatMsg
                });
                
                await Chat.findByIdAndUpdate(chatId, { lastMessageAt: new Date() });

                if (global.io) {
                    global.io.to(chatId.toString()).emit('new-message', msg);
                }
            } catch (err) {
                console.error('[SecurityGate]: Failed to post warning:', err.message);
            }
        }

        return { threat: securityCheck };
    }

    // ── CACHE CHECK (GLOBAL REDUNDANCY MITIGATION) ───────────────────
    if (!force) {
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

        // Try to find a recent report for this URL (global)
        const existingReport = await ScanReport.findOne({
            url: baseUrl,
            status: 'completed',
            createdAt: { $gt: oneHourAgo }
        }).sort({ createdAt: -1 });

        if (existingReport) {
            console.log(`[Cache]: Reusing recent global report for ${baseUrl} (Source: ${existingReport.userId === userId ? 'Self' : 'Other User'})`);
            return { reportId: existingReport._id, isCached: true };
        }
    }

    const defaultModules = ['console', 'network', 'lighthouse', 'accessibility', 'links', 'ui', 'forms', 'security'];
    let finalModules = defaultModules;

    if (Array.isArray(tests) && tests.length > 0) {
        finalModules = tests;
    } else if (typeof tests === 'string' && tests.length > 0) {
        try {
            const parsed = JSON.parse(tests);
            if (Array.isArray(parsed) && parsed.length > 0) finalModules = parsed;
        } catch (_) {
            finalModules = defaultModules;
        }
    }

    const previousReport = await ScanReport.findOne({
        url: baseUrl,
        userId,
        status: 'completed',
    }).sort({ createdAt: -1 });

    // Check if the trigger request provided a callbackUrl (handled via startScan call site or context)
    // For now we rely on the report creation to handle it via direct Job triggering


    const report = new ScanReport({
        url: baseUrl,
        userId,
        status: 'in-progress',
        scannedModules: finalModules,
        mode: mode || 'full',
        comparison: previousReport ? { previousReportId: previousReport._id } : undefined
    });
    await report.save();

    // Global User Room Update: Notify dashboard that a new report (in-progress) exists
    if (global.io) {
        global.io.to(`user_${userId.toString()}`).emit('report-update', {
            type: 'scan_started',
            reportId: report._id.toString()
        });
        
        // INSTANT HUD ENGAGEMENT: Trigger global progress HUD immediately for all scan types
        global.io.to(`user_${userId.toString()}`).emit('job-sync', {
            reportId: report._id.toString(),
            status: 'running'
        });
    }

    // Launch background processor
    runFullScan(report._id, baseUrl, userId, chaosIntensity, singlePageOnly, finalModules, scope, mode, chatId, previousReport?._id).catch(e => {
        console.error(`[Pipeline Critical Failure]: ${e.message}`);
    });

    return { reportId: report._id, isCached: false, chatId };
}

// ── Helper: wrap promise with timeout ────────────────────────────────────────
const withTimeout = (promise, ms, taskName) => {
    const timeout = new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`${taskName} timed out after ${ms}ms`)), ms)
    );
    return Promise.race([promise, timeout]);
};

/**
 * runFullScan - Spawns a background worker thread for the pipeline.
 */
async function runFullScan(reportId, baseUrl, userId, chaosIntensity, singlePageOnly = false, tests = [], scope = 'site', mode = 'specific', chatId = null, prevReportId = null) {
    const { Worker } = require('worker_threads');
    const path = require('path');

    console.log(`[Main]: Spawning Tactical Worker for ${reportId} with baseline ${prevReportId}...`);

    const worker = new Worker(path.join(__dirname, '../workers/scanWorker.js'), {
        workerData: { reportId: reportId.toString(), baseUrl, userId, chaosIntensity, singlePageOnly, tests, scope, mode, chatId: chatId ? chatId.toString() : null, prevReportId: prevReportId?.toString() }
    });

    console.log(`[Worker Lifecycle]: Spawned background process for Report ${reportId} (Thread ID: ${worker.threadId || 'Main Inheritance'})`);

    activeWorkers.set(reportId.toString(), worker);

    worker.on('message', (msg) => {
        if (msg.type === 'progress') {
            console.log(`[Worker Lifecycle]: Progress Update [Report: ${reportId}] -> ${msg.percent}%: ${msg.stage}`);
            const progressData = {
                reportId: reportId.toString(),
                percent: msg.percent,
                stage: msg.stage,
                pagesCrawled: msg.pagesCrawled || 0,
                currentUrl: msg.currentUrl || null,
                issuesFound: msg.issuesFound || 0,
                status: 'in-progress'
            };
            if (global.io) {
                global.io.to(reportId.toString()).emit('scan-progress', progressData);
                if (userId) {
                    global.io.to(`user_${userId}`).emit('scan-progress', progressData);
                }
            }
        }
        if (msg.type === 'new-message') {
            if (global.io) {
                global.io.to(msg.message.chatId.toString()).emit('new-message', msg.message);
            }
        }
        if (msg.type === 'completed') {
            if (global.io) {
                global.io.to(reportId.toString()).emit('scan-progress', {
                    reportId: reportId.toString(),
                    percent: 100,
                    stage: 'Scan complete.',
                    status: 'completed',
                    finalReportId: msg.reportId || reportId.toString()
                });
            }
        }
        if (msg.type === 'failed') {
            if (global.io) {
                global.io.to(reportId.toString()).emit('scan-progress', {
                    reportId: reportId.toString(), // CRITICAL: Ensures HUD can identify failure
                    percent: 100,
                    stage: 'Scan failed: ' + msg.error,
                    status: 'failed'
                });
            }
        }
    });

    worker.on('error', (err) => {
        console.error('[Main]: Worker Critical Error:', err);
    });

    worker.on('exit', (code) => {
        activeWorkers.delete(reportId.toString());

        // ── SYNC JOB LIFECYCLE ───────────────────────────────────────
        ScanReport.findById(reportId).then(async report => {
            if (report && report.jobId) {
                const job = await Job.findById(report.jobId);
                if (job) {
                    if (code === 0) {
                        if (job.mode === 'one-time') {
                            job.status = 'completed';
                            job.isActive = false;
                        } else {
                            job.status = 'pending'; // Ready for next cycle
                        }
                    } else {
                        job.status = 'failed';
                    }
                    await job.save();

                    // ── SOCKET EMISSION ──────────────────────────────────────
                    if (global.io) {
                        global.io.emit('job-sync', {
                            jobId: job._id.toString(),
                            status: job.status,
                            isActive: job.isActive,
                            lastRun: job.lastRun
                        });
                    }

                }
            }

            if (code === 0 && report && report.callbackUrl) {
                console.log(`[Main]: Despatching tactical callback to n8n: ${report.callbackUrl}`);
                axios.post(report.callbackUrl, {
                    event: 'scan_completed',
                    reportId: report._id,
                    url: report.url,
                    healthScore: report.healthScore,
                    summary: report.aiInsights?.summary,
                    timestamp: new Date().toISOString()
                }).catch(e => console.error(`[Callback Failure]: ${e.message}`));
            }
            if (code === 0 && global.io) {
                global.io.to(reportId.toString()).emit('scan-progress', {
                    reportId: reportId.toString(),
                    chatId: chatId ? chatId.toString() : null,
                    percent: 100,
                    stage: 'Scan complete.',
                    status: 'completed'
                });

                // Global User Room Update: Ensure all views (Dashboard, Sidebar) refresh
                ScanReport.findById(reportId).then(report => {
                    if (report?.userId) {
                        global.io.to(`user_${report.userId.toString()}`).emit('report-update', {
                            type: 'scan_completed',
                            reportId: reportId.toString()
                        });
                    }
                });
            }
        });
    });
}

router.post('/learning/ask', async (req, res) => {
    try {
        const { question } = req.body;
        if (!question || question.trim().length < 2) {
            return res.status(400).json({ error: 'Uplink request is too sparse.' });
        }

        const learningAgent = require('../services/learningAgent');
        const response = await learningAgent.askDebugging(question);
        res.json(response);
    } catch (e) {
        console.error('[LearningHub Error]:', e.message);
        res.status(500).json({ error: 'Neural substrate consult failed.' });
    }
});

module.exports = { router, runFullScan, activeWorkers };
