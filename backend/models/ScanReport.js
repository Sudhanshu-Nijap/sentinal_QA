const mongoose = require('mongoose');

const scanReportSchema = new mongoose.Schema({
    url: { type: String, required: true },
    userId: { type: String, required: true },
    jobId: { type: mongoose.Schema.Types.ObjectId, ref: 'Job' },
    callbackUrl: { type: String }, // NEW: Store for external scheduler notifications
    scanDate: { type: Date, default: Date.now },
    pagesCrawled: { type: Number, default: 0 },
    status: { type: String, enum: ['pending', 'in-progress', 'completed', 'failed'], default: 'pending' },
    brokenLinks: [{
        page: String,
        link: String,
        status: Number,
        recommendation: String,
        suggestedFix: String
    }],
    consoleErrors: [mongoose.Schema.Types.Mixed],
    uiIssues: [mongoose.Schema.Types.Mixed],
    formIssues: [mongoose.Schema.Types.Mixed],
    networkLogs: [mongoose.Schema.Types.Mixed],
    performanceMetrics: {
        loadTime: Number,
        apiResponseTime: Number,
        requestCount: Number,
        pageSize: Number,
        slowRequests: Number
    },
    lighthouseScores: {
        performance: { type: Number, default: 0 },
        accessibility: { type: Number, default: 0 },
        bestPractices: { type: Number, default: 0 },
        seo: { type: Number, default: 0 }
    },
    responsiveIssues: [{
        page: String,
        device: String,
        issue: String,
        selector: String,
        recommendation: String,
        suggestedFix: String
    }],
    accessibilityIssues: [mongoose.Schema.Types.Mixed],
    securityIssues: [mongoose.Schema.Types.Mixed],
    screenshots: [mongoose.Schema.Types.Mixed],
    aiInsights: {
        classification: String,
        qaVerdict: String,
        summary: String,
        performancePlaybook: [String],
        issues: [{
            source: { type: String, enum: ['local', 'llm'] },
            title: String, // UI friendly name
            issue: String, // Short explanation
            reason: String, // Why it happened
            fix: [String], // Step-by-step solution array
            severity: { type: String, enum: ['Low', 'Medium', 'High', 'Critical'] },
            suggested_pattern: String, // Normalized error pattern
            remediationCode: String,
            timeToFix: String
        }],
        keyFindings: [String],
        criticalVulnerabilities: [String]
    },
    siteStructure: {
        nodes: [{ id: String, label: String, url: String, depth: Number }],
        links: [{ source: String, target: String }]
    },
    healthScore: { type: Number, default: 0 },
    isPinned: { type: Boolean, default: false },
    isShared: { type: Boolean, default: false },
    isArchived: { type: Boolean, default: false },
    customName: { type: String },
    scannedModules: [String], // NEW: Track what was audited
    mode: { type: String, default: 'full' }, // NEW: 'specific' or 'full'
    chatHistory: [{
        role: { type: String, enum: ['user', 'ai'] },
        content: String,
        timestamp: String
    }],
    comparison: {
        previousReportId: { type: mongoose.Schema.Types.ObjectId, ref: 'ScanReport' },
        scoreDelta: { type: Number, default: 0 },
        stats: {
            newErrors: { type: Number, default: 0 },
            fixedErrors: { type: Number, default: 0 },
            impact: { type: String, enum: ['Improved', 'Regressed', 'Stable'], default: 'Stable' }
        },
        lighthouseDelta: {
            performance: { type: Number, default: 0 },
            accessibility: { type: Number, default: 0 },
            bestPractices: { type: Number, default: 0 },
            seo: { type: Number, default: 0 }
        }
    }
}, { timestamps: true });

// Tactical Indexes for performance and caching
scanReportSchema.index({ url: 1, userId: 1, createdAt: -1 });
scanReportSchema.index({ userId: 1, isPinned: -1, scanDate: -1 });

module.exports = mongoose.model('ScanReport', scanReportSchema);
