const { parentPort, workerData } = require('worker_threads');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

// 1. Load Environment
dotenv.config({ path: path.join(__dirname, '../.env') });

// 2. Import Scanning Services
const ScanReport = require('../models/ScanReport');
const Message = require('../models/Message');
const Chat = require('../models/Chat');
const crawler = require('../services/crawler');
const qaScanner = require('../services/qaScanner');
const qaAgent = require('../services/qaAgent');
const scanEngine = require('../services/scanEngine');
const comparisonService = require('../services/comparisonService');
const linkGuardian = require('../services/linkGuardian');

// 3. Connection Substrate Logic (Hardened)
const connectWithRetry = async (attempts = 0) => {
    const MAX_ATTEMPTS = 5;
    try {
        await mongoose.connect(process.env.MONGODB_URI, {
            serverSelectionTimeoutMS: 15000,
        });
        console.log('[Worker]: Connected to Tactical Database');
    } catch (err) {
        if (attempts >= MAX_ATTEMPTS) {
            console.error('[Worker]: Critical DB Failure: Max retries exceeded. Aborting scan.');
            throw new Error(`Database connection timed out after ${MAX_ATTEMPTS} attempts.`);
        }
        console.warn(`[Worker]: DB connection attempt ${attempts + 1} failed. Retrying in 5s...`, err.message);
        await new Promise(res => setTimeout(res, 5000));
        return connectWithRetry(attempts + 1);
    }
};

// 4. Tactical Event Substrate
let mainChatMessageDispatcher = null;
const earlyInsightQueue = [];

const persistMessageLocally = async (chatId, type, content, scanReportId, reportSummary) => {
    if (!chatId) return null;
    try {
        const msg = await Message.create({ chatId, type, content, scanReportId, reportSummary });
        await Chat.findByIdAndUpdate(chatId, { lastMessageAt: new Date() });
        return msg;
    } catch (e) {
        console.warn('[Worker]: Local persistence failed:', e.message);
        return null;
    }
};

const safeMessageUplink = async (chatId, type, content, scanReportId, reportSummary) => {
    if (mainChatMessageDispatcher) {
        return await mainChatMessageDispatcher(chatId, type, content, scanReportId, reportSummary);
    }
    
    console.log('[Worker]: Dispatcher not ready. Persisting early insight locally...');
    const msg = await persistMessageLocally(chatId, type, content, scanReportId, reportSummary);
    if (msg) earlyInsightQueue.push(msg);
    return msg;
};

const calculateReportHealth = (report, lhMetrics = null) => {
    if (!report) return 0;
    
    if (lhMetrics && (lhMetrics.performance || lhMetrics.accessibility || lhMetrics.seo || lhMetrics.bestPractices)) {
        const lhAvg = (
            (lhMetrics.performance || 0) + 
            (lhMetrics.accessibility || 0) + 
            (lhMetrics.seo || 0) + 
            (lhMetrics.bestPractices || 0)
        ) / 4;
        
        const tacticalPenalty = (
            (report.brokenLinks?.length || 0) * 2 + 
            (report.consoleErrors?.length || 0) * 0.5 +
            (report.networkLogs?.filter(n => n.status >= 500).length || 0) * 2
        );

        const score = Math.max(1, Math.round(lhAvg - tacticalPenalty));
        console.log(`[Scoring]: Lighthouse Centric -> Avg: ${lhAvg}, Penalty: ${tacticalPenalty}, Final: ${score}`);
        return score;
    }

    const weights = { network: 0.1, links: 10, console: 5, ui: 10, accessibility: 10 };
    const counts = {
        network: report.networkLogs?.length || 0,
        links: report.brokenLinks?.length || 0,
        console: report.consoleErrors?.length || 0,
        ui: (report.uiIssues?.length || 0) + (report.responsiveIssues?.length || 0),
        accessibility: report.accessibilityIssues?.length || 0,
        security: report.securityIssues?.length || 0
    };
    
    const rawDeduction = Object.keys(weights).reduce((acc, key) => acc + (counts[key] * weights[key] || 0), 0);
    const decayConstant = 400; 
    const scaledScore = 100 * Math.exp(-rawDeduction / decayConstant);
    const score = Math.max(1, Math.round(scaledScore));
    
    console.log(`[Scoring]: Fallback Heuristic -> RawDeduction: ${rawDeduction}, Score: ${score}%`);
    return score;
};

// 5. Orchestration Pipeline
async function runMasterOrchestrator(data) {
    const { reportId, baseUrl, tests, scope, chatId, prevReportId } = data;
    console.log(`[MasterWorker]: Starting Tactical Pulse for Report: ${reportId} (Target: ${baseUrl})`);
    
    mainChatMessageDispatcher = persistMessageLocally;

    try {
        let lighthouseMetrics = null;

        const emitProgress = (percent, stage, meta = {}) => {
            if (parentPort) {
                parentPort.postMessage({ 
                    type: 'progress', 
                    percent, 
                    stage,
                    pagesCrawled: meta.pagesCrawled || 0,
                    currentUrl: meta.currentUrl || null,
                    issuesFound: meta.issuesFound || 0
                });
            }
        };

        emitProgress(5, 'Engaging Integrated Audit Core...');

        if (scope === 'single') {
            console.log('[MasterWorker]: Executing Unified Session Audit (Standard Convergence)...');
            const result = await scanEngine.runSinglePageScan(reportId, baseUrl, tests, (p, s, meta) => {
                emitProgress(5 + Math.round(p * 0.80), s, meta || { pagesCrawled: 1, currentUrl: baseUrl });
            });
            
            if (result) {
                lighthouseMetrics = result.lighthouseScores;
                await scanEngine.persistScanData(reportId, result);
            }
        } else {
            console.log('[MasterWorker]: Executing Multi-Worker Crawl & Issue Audit...');
            await scanEngine.runTargetedCrawlScan(reportId, baseUrl, tests, (p, s, meta) => {
                emitProgress(5 + Math.round(p * 0.80), s, meta);
            }, scope);
            
            const consolidatedReport = await ScanReport.findById(reportId);
            lighthouseMetrics = consolidatedReport?.lighthouseScores;
        }

        // Parallel Secondary Insights
        await Promise.all([
            (async () => {
                if (prevReportId) return;
                try {
                    const insightSummary = "Strategic Analysis: Sentinel AI is engaging core diagnostics for " + baseUrl + "...";
                    const earlyMsg = await safeMessageUplink(chatId, 'ai', insightSummary, reportId, null);
                    if (earlyMsg && parentPort) {
                        parentPort.postMessage({ type: 'new-message', message: earlyMsg.toObject() });
                    }
                } catch (e) {
                    console.warn('[MasterWorker]: Early Insight delivery issue:', e.message);
                }
            })()
        ]);

        emitProgress(90, 'All tactical pulses converged. Finalizing Neural Report...');
        emitProgress(92, 'Syncing Final AI Analysis...');

        const currentReport = await ScanReport.findById(reportId);
        const previousReport = prevReportId ? await ScanReport.findById(prevReportId) : null;

        if (!currentReport) throw new Error('Neural focus lost: Report not found during synthesis.');

        const healthScore = calculateReportHealth(currentReport, lighthouseMetrics);
        currentReport.healthScore = healthScore; 

        const aiInsights = await qaAgent.runAgent(reportId, prevReportId, currentReport, previousReport);

        emitProgress(95, 'Calculating Performance Delta...');
        const comparison = await comparisonService.calculateDelta(currentReport, previousReport);

        console.log(`[MasterWorker]: Finalizing Atomic Update for ${reportId}...`);
        const finalSet = {
            status: 'completed',
            healthScore: healthScore,
            comparison: comparison,
            aiInsights: aiInsights
        };
        
        if (lighthouseMetrics) {
            finalSet.lighthouseScores = lighthouseMetrics;
        }

        // STEP 1: First commit completed scan telemetry to the database
        await ScanReport.findByIdAndUpdate(reportId, {
            $set: finalSet
        }, { new: true });

        // STEP 2: Reload the fresh, fully persisted document directly from MongoDB
        const finalReport = await ScanReport.findById(reportId).lean();

        // STEP 3: Compute unified, high-accuracy sensor stats directly from the database record
        const apiLeaksCount = (finalReport?.securityIssues || []).filter(s => 
            s.type === 'SERVER_STACK_TRACE_LEAK' || s.type === 'SENSITIVE_API_RESPONSE_FIELD' || s.testCaseId?.includes('SEC-STACK') || s.testCaseId?.includes('SEC-DATA')
        ).length;
        const netFailCount = (finalReport?.networkLogs?.filter(n => n.status >= 400) || []).length;
        const apiAndNetCount = netFailCount + apiLeaksCount;
        const secretSecurityCount = Math.max(0, (finalReport?.securityIssues?.length || 0) - apiLeaksCount);
        const uiCount = (finalReport?.uiIssues?.length || 0) + (finalReport?.responsiveIssues?.length || 0);
        const formCount = finalReport?.formIssues?.length || 0;
        const consoleCount = finalReport?.consoleErrors?.length || 0;
        const linkCount = finalReport?.brokenLinks?.length || 0;
        const a11yCount = finalReport?.accessibilityIssues?.length || 0;
        const totalIssuesCount = apiAndNetCount + formCount + uiCount + secretSecurityCount + consoleCount + linkCount + a11yCount;

        const reportStats = {
            totalIssues: totalIssuesCount,
            networkIssues: apiAndNetCount,
            securityIssues: secretSecurityCount,
            uiIssues: uiCount,
            formIssues: formCount,
            consoleErrors: consoleCount,
            brokenLinks: linkCount,
            accessibilityIssues: a11yCount,
            pagesCrawled: finalReport?.pagesCrawled || 1
        };

        // STEP 4: Store exact computed stats in the database record
        await ScanReport.findByIdAndUpdate(reportId, { $set: { stats: reportStats } });

        // STEP 5: Now dispatch the chat message containing the exact database numbers
        if (chatId) {
            const isPreviousScan = !!comparison?.previousReportId;
            const msgType = isPreviousScan ? 'rescan' : 'report';
            const reportSummary = {
                healthScore: finalReport?.healthScore ?? healthScore,
                status: 'completed',
                lighthouseScores: {
                    performance: finalReport?.lighthouseScores?.performance ?? lighthouseMetrics?.performance ?? 0,
                    accessibility: finalReport?.lighthouseScores?.accessibility ?? lighthouseMetrics?.accessibility ?? 0,
                    bestPractices: finalReport?.lighthouseScores?.bestPractices ?? lighthouseMetrics?.bestPractices ?? 0,
                    seo: finalReport?.lighthouseScores?.seo ?? lighthouseMetrics?.seo ?? 0
                },
                stats: reportStats,
                comparison: comparison?.previousReportId ? {
                    previousReportId: comparison.previousReportId,
                    scoreDelta: comparison.scoreDelta,
                    newErrors: comparison.stats.newErrors,
                    fixedErrors: comparison.stats.fixedErrors,
                    impact: comparison.stats.impact
                } : null
            };
            const chatMsg = await safeMessageUplink(chatId, msgType, baseUrl, reportId, reportSummary);
            if (chatMsg && parentPort) {
                parentPort.postMessage({ type: 'new-message', message: chatMsg.toObject() });
            }
        }
        
        console.log(`[MasterWorker]: Scan Cycle Optimized. Report ${reportId} is fully materialized.`);
        emitProgress(100, 'Strategic Evolution Complete.');
        if (parentPort) parentPort.postMessage({ type: 'completed', reportId: reportId });

    } catch (error) {
        console.error('[MasterWorker Fatal]:', error);
        await ScanReport.findByIdAndUpdate(reportId, { status: 'failed', customName: error.message }).catch(() => {});
        if (parentPort) parentPort.postMessage({ type: 'failed', error: error.message });
    } finally {
        await mongoose.disconnect().catch(() => {});
    }
}

// 6. Deadlock Watchdog (Adaptive Cutoff)
const SCOPE_TIMEOUTS = {
    'single': 300000,   // 5 minutes
    'site': 1200000     // 20 minutes
};

const timeoutMs = SCOPE_TIMEOUTS[workerData.scope] || 300000;

const watchdog = setTimeout(async () => {
    console.error(`[MasterWorker]: Neural Watchdog Triggered for ${workerData.reportId}. Force terminating...`);
    await ScanReport.findByIdAndUpdate(workerData.reportId, { 
        status: 'failed', 
        customName: `Scan timed out after ${Math.round(timeoutMs/60000)}m of inactivity.` 
    }).catch(() => {});
    if (parentPort) parentPort.postMessage({ type: 'failed', error: 'Neural substrate timeout' });
    process.exit(1);
}, timeoutMs); 

// Global Exception Guards
process.on('uncaughtException', (err) => {
    console.error('[MasterWorker Uncaught Exception]:', err.message);
    clearTimeout(watchdog);
    if (parentPort) parentPort.postMessage({ type: 'failed', error: err.message });
});

process.on('unhandledRejection', (reason) => {
    console.error('[MasterWorker Unhandled Rejection]:', reason);
});

// Start immediately with connection synchronization
connectWithRetry().then(() => {
    runMasterOrchestrator(workerData).then(() => clearTimeout(watchdog));
}).catch(err => {
    clearTimeout(watchdog);
    if (parentPort) parentPort.postMessage({ type: 'failed', error: err.message });
});

