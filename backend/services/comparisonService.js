const mongoose = require('mongoose');

/**
 * calculateDelta - High-performance comparison engine between two scan reports.
 * 
 * @param {Object} current - The newly completed report
 * @param {Object} previous - The last successful report for the same URL/User
 * @returns {Object} The comparison delta object
 */
async function calculateDelta(current, previous) {
    if (!current) {
        return {
            previousReportId: null,
            scoreDelta: 0,
            stats: { newErrors: 0, fixedErrors: 0, impact: 'Stable', severity: 'neutral' },
            categoryDeltas: {},
            lighthouseDelta: { performance: 0, accessibility: 0, bestPractices: 0, seo: 0 }
        };
    }

    if (!previous) {
        return {
            previousReportId: null,
            scoreDelta: 0,
            stats: { newErrors: 0, fixedErrors: 0, impact: 'Initial Baseline Scan', severity: 'neutral' },
            categoryDeltas: {
                brokenLinks: current.brokenLinks?.length || 0,
                consoleErrors: current.consoleErrors?.length || 0,
                accessibility: current.accessibilityIssues?.length || 0,
                ui: current.uiIssues?.length || 0,
                network: current.networkLogs?.filter(n => n.status >= 400)?.length || 0
            },
            lighthouseDelta: { performance: 0, accessibility: 0, bestPractices: 0, seo: 0 }
        };
    }

    console.log(`[ComparisonService]: Calculating differential for report ${current._id} vs ${previous._id}`);

    // 1. Overall Health Score Delta
    const scoreDelta = (current.healthScore || 0) - (previous.healthScore || 0);
    
    // 2. Core Web Vitals / Lighthouse Score Deltas
    const lighthouseDelta = {
        performance: (current.lighthouseScores?.performance || 0) - (previous.lighthouseScores?.performance || 0),
        accessibility: (current.lighthouseScores?.accessibility || 0) - (previous.lighthouseScores?.accessibility || 0),
        bestPractices: (current.lighthouseScores?.bestPractices || 0) - (previous.lighthouseScores?.bestPractices || 0),
        seo: (current.lighthouseScores?.seo || 0) - (previous.lighthouseScores?.seo || 0)
    };

    // 3. Fast O(N) Signature Set Differential Matching
    const currentSigArray = extractSignatures(current);
    const previousSigArray = extractSignatures(previous);

    const currentSigSet = new Set(currentSigArray);
    const previousSigSet = new Set(previousSigArray);

    let newErrors = 0;
    for (const sig of currentSigArray) {
        if (!previousSigSet.has(sig)) newErrors++;
    }

    let fixedErrors = 0;
    for (const sig of previousSigArray) {
        if (!currentSigSet.has(sig)) fixedErrors++;
    }

    // 4. Category Breakdown Deltas
    const categoryDeltas = {
        brokenLinks: (current.brokenLinks?.length || 0) - (previous.brokenLinks?.length || 0),
        consoleErrors: (current.consoleErrors?.length || 0) - (previous.consoleErrors?.length || 0),
        accessibility: (current.accessibilityIssues?.length || 0) - (previous.accessibilityIssues?.length || 0),
        ui: (current.uiIssues?.length || 0) - (previous.uiIssues?.length || 0),
        network: (current.networkLogs?.filter(n => n.status >= 400)?.length || 0) - (previous.networkLogs?.filter(n => n.status >= 400)?.length || 0)
    };

    // 5. Impact & Regression Assessment
    let impact = 'Stable';
    let severity = 'neutral';

    if (scoreDelta >= 10 || fixedErrors > newErrors + 5) {
        impact = 'Significant Improvement';
        severity = 'major_improvement';
    } else if (scoreDelta > 2 || fixedErrors > newErrors) {
        impact = 'Minor Improvement';
        severity = 'minor_improvement';
    } else if (scoreDelta <= -10 || newErrors > fixedErrors + 5) {
        impact = 'Critical Regression';
        severity = 'critical_regression';
    } else if (scoreDelta < -2 || newErrors > fixedErrors) {
        impact = 'Minor Regression';
        severity = 'minor_regression';
    }

    return {
        previousReportId: previous._id,
        scoreDelta,
        stats: { newErrors, fixedErrors, impact, severity },
        categoryDeltas,
        lighthouseDelta
    };
}

/**
 * extractSignatures - Generates unique signatures for issue matching
 */
function extractSignatures(report) {
    const signatures = [];
    if (!report) return signatures;

    // Console Errors
    if (report.consoleErrors) {
        report.consoleErrors.forEach(err => {
            if (err.message && err.page) signatures.push(`console:${err.message.trim()}:${err.page.trim()}`);
        });
    }

    // Network Logs
    if (report.networkLogs) {
        report.networkLogs.forEach(log => {
            if (log.url && log.status) signatures.push(`network:${log.url.trim()}:${log.status}`);
        });
    }

    // Broken Links
    if (report.brokenLinks) {
        report.brokenLinks.forEach(link => {
            if (link.link && link.page) signatures.push(`link:${link.link.trim()}:${link.page.trim()}`);
        });
    }

    // Accessibility Issues
    if (report.accessibilityIssues) {
        report.accessibilityIssues.forEach(isu => {
            if (isu.issue && isu.page) signatures.push(`access:${isu.issue.trim()}:${isu.page.trim()}`);
        });
    }

    // UI Issues
    if (report.uiIssues) {
        report.uiIssues.forEach(isu => {
            if (isu.type && isu.issue && isu.page) signatures.push(`ui:${isu.type.trim()}:${isu.issue.trim()}:${isu.page.trim()}`);
        });
    }
    
    // Form Issues
    if (report.formIssues) {
        report.formIssues.forEach(isu => {
           if (isu.id && isu.page) signatures.push(`form:${isu.id.trim()}:${isu.page.trim()}`);
        });
    }

    return signatures;
}

module.exports = { calculateDelta };

