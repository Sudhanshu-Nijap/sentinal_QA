const Job = require('../models/Job');
const ScanReport = require('../models/ScanReport');
const Chat = require('../models/Chat');

/**
 * Tactical Scheduler Service
 * Manages the lifecycle of scheduled neural scans with memory-locked concurrent protection.
 */
class SchedulerService {
    constructor() {
        this.runningJobs = new Set(); // Tracks actively executing job IDs in memory
        this.checkInterval = null;
        this.stats = {
            totalExecutions: 0,
            failedExecutions: 0,
            lastRunTime: null
        };
    }

    /**
     * Initializes the scheduler substrate
     */
    async init() {
        console.log('[Scheduler]: Initializing tactical job substrate...');
        this.startWatcher();
    }

    /**
     * Periodically checks for jobs that need execution.
     * 15-second precision tick rate for tactical timing.
     */
    startWatcher() {
        if (this.checkInterval) clearInterval(this.checkInterval);
        
        this.checkInterval = setInterval(() => {
            this.processPendingJobs();
        }, 15000);

        // Run immediately on startup
        this.processPendingJobs();
    }

    /**
     * Analyzes active database jobs and triggers scheduled runs.
     */
    async processPendingJobs() {
        try {
            const now = new Date();
            const istTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
            
            const currentDay = istTime.getDay(); // 0-6
            const currentHHMM = istTime.toLocaleTimeString('en-GB', { 
                hour: '2-digit', 
                minute: '2-digit', 
                hour12: false,
                timeZone: 'Asia/Kolkata' 
            });
            const currentDate = istTime.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }); // YYYY-MM-DD

            // Query active jobs not currently running in DB
            const jobs = await Job.find({ 
                isActive: true, 
                status: { $ne: 'running' } 
            });

            for (const job of jobs) {
                const jobIdStr = job._id.toString();
                // Skip if job is already locked in local execution memory
                if (this.runningJobs.has(jobIdStr)) continue;

                let shouldRun = false;

                if (job.mode === 'one-time') {
                    if (job.date === currentDate && job.time === currentHHMM) {
                        shouldRun = true;
                    }
                } else if (job.mode === 'daily') {
                    if (job.time === currentHHMM) {
                        shouldRun = true;
                    }
                } else if (job.mode === 'weekly') {
                    if (job.dayOfWeek === currentDay && job.time === currentHHMM) {
                        shouldRun = true;
                    }
                }

                if (shouldRun) {
                    const lastRunAt = job.lastRun ? new Date(job.lastRun) : null;
                    if (lastRunAt && (now - lastRunAt) < 61000) {
                        continue; // Already triggered within current minute
                    }

                    console.log(`[Scheduler]: Triggering ${job.scanType} scan for ${job.url} (Job: ${jobIdStr})`);
                    this.executeJob(job);
                }
            }
        } catch (error) {
            console.error('[Scheduler Error]:', error.message);
        }
    }

    /**
     * Dispatches job execution to the scan engine with lock handling
     */
    async executeJob(job, retryCount = 0) {
        const jobIdStr = job._id.toString();
        this.runningJobs.add(jobIdStr);

        try {
            job.status = 'running';
            job.lastRun = new Date();
            await job.save();
            this.stats.totalExecutions++;
            this.stats.lastRunTime = new Date();

            const tests = job.scanType === 'full' 
                ? ['console', 'network', 'lighthouse', 'accessibility', 'links', 'ui', 'forms']
                : ['console', 'network', 'ui', 'lighthouse', 'accessibility'];
            const mode = job.scanType === 'full' ? 'full' : 'specific';
            const scope = job.scanType === 'full' ? 'site' : 'single';

            // 1. Permanent chat thread lookup or creation
            let chat = await Chat.findOne({ url: job.url, userId: job.userId });
            if (!chat) {
                chat = new Chat({ url: job.url, userId: job.userId });
                await chat.save();
            }

            // 2. Previous baseline report lookup
            const previousReport = await ScanReport.findOne({ 
                url: job.url, 
                userId: job.userId, 
                status: 'completed' 
            }).sort({ createdAt: -1 });

            // 3. Create active ScanReport entry
            const report = new ScanReport({
                url: job.url,
                userId: job.userId,
                status: 'in-progress',
                scannedModules: tests,
                mode: mode,
                jobId: job._id,
                comparison: previousReport ? { previousReportId: previousReport._id } : undefined
            });
            await report.save();

            // 4. Socket real-time telemetry emission
            if (global.io) {
                global.io.emit('job-sync', { 
                    jobId: jobIdStr, 
                    reportId: report._id.toString(), 
                    status: 'running',
                    lastRun: job.lastRun
                });

                global.io.emit('scan-progress', {
                    reportId: report._id.toString(),
                    percent: 0,
                    stage: 'Initializing autonomous scan...',
                    status: 'in-progress'
                });

                global.io.to(`user_${job.userId.toString()}`).emit('report-update', {
                    type: 'scan_started',
                    reportId: report._id.toString()
                });
            }

            // 5. Run async scan pipeline
            const { runFullScan } = require('../routes/scanRoutes');
            runFullScan(
                report._id, 
                job.url, 
                'standard', 
                job.scanType === 'quick', 
                tests, 
                scope, 
                mode,
                chat._id,
                previousReport?._id
            ).catch(async (e) => {
                console.error(`[Scheduler Task Failure]: ${e.message}`);
                this.stats.failedExecutions++;
                if (retryCount < 1) {
                    console.log(`[Scheduler]: Retrying job ${jobIdStr} (Attempt ${retryCount + 1})...`);
                    this.runningJobs.delete(jobIdStr);
                    return this.executeJob(job, retryCount + 1);
                }
                job.status = 'failed';
                await job.save();
                this.runningJobs.delete(jobIdStr);
            }).finally(() => {
                // Release lock after scan finishes
                this.runningJobs.delete(jobIdStr);
            });

        } catch (error) {
            console.error(`[Job Execution Error]: ${error.message}`);
            this.stats.failedExecutions++;
            job.status = 'failed';
            await job.save();
            this.runningJobs.delete(jobIdStr);
        }
    }

    /**
     * Cancels / removes job from memory registry
     */
    async removeJob(jobId) {
        const idStr = jobId.toString();
        this.runningJobs.delete(idStr);
    }
}

const scheduler = new SchedulerService();
module.exports = scheduler;

