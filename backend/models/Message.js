const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
    chatId: { type: mongoose.Schema.Types.ObjectId, ref: 'Chat', required: true },
    type: { 
        type: String, 
        enum: ['user', 'system', 'report', 'rescan', 'ai'],
        required: true 
    },
    content: { type: String, default: '' },
    // For report/rescan messages — link to the ScanReport
    scanReportId: { type: mongoose.Schema.Types.ObjectId, ref: 'ScanReport' },
    // Embedded mini-summary so chat loads fast without extra queries
    reportSummary: {
        healthScore: Number,
        status: String,
        lighthouseScores: {
            performance: Number,
            accessibility: Number,
            bestPractices: Number,
            seo: Number
        },
        stats: {
            totalIssues: Number,
            brokenLinks: Number,
            consoleErrors: Number,
            accessibilityIssues: Number,
            networkIssues: Number,
            securityIssues: Number,
            uiIssues: Number,
            formIssues: Number,
            pagesCrawled: Number
        },
        comparison: {
            previousReportId: mongoose.Schema.Types.ObjectId,
            scoreDelta: Number,
            newErrors: Number,
            fixedErrors: Number,
            impact: String
        }
    }
}, { timestamps: true });

messageSchema.index({ chatId: 1, createdAt: 1 });

module.exports = mongoose.model('Message', messageSchema);
