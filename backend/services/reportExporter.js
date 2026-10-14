const ScanReport = require('../models/ScanReport');
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

/**
 * generatePDF
 * Generates a detailed, professional PDF report using Playwright with PDF caching & memory guards.
 */
const generatePDF = async (reportId) => {
    const idString = reportId.toString();
    const pdfPath = path.join(__dirname, `../reports/report-${idString}.pdf`);

    // Return cached PDF if it already exists and report hasn't modified recently
    if (fs.existsSync(pdfPath)) {
        try {
            const stat = fs.statSync(pdfPath);
            // If PDF was generated within last 5 minutes, serve cached version
            if (Date.now() - stat.mtimeMs < 5 * 60 * 1000) {
                return `/reports/report-${idString}.pdf`;
            }
        } catch (_) {}
    }

    const report = await ScanReport.findById(idString);
    if (!report) return null;

    // Helper: convert screenshot to base64 with 500KB safety size cap
    const toBase64 = (relPath) => {
        try {
            const absPath = path.join(__dirname, '..', relPath);
            if (fs.existsSync(absPath)) {
                const stat = fs.statSync(absPath);
                if (stat.size > 1.5 * 1024 * 1024) return null; // Skip images > 1.5MB to save PDF memory
                const data = fs.readFileSync(absPath);
                return `data:image/png;base64,${data.toString('base64')}`;
            }
        } catch (_) {}
        return null;
    };

    // ── Stats ──────────────────────────────────────────────────────────────────
    const totalIssues =
        (report.brokenLinks?.length || 0) +
        (report.consoleErrors?.length || 0) +
        (report.uiIssues?.length || 0) +
        (report.formIssues?.length || 0) +
        (report.accessibilityIssues?.length || 0) +
        (report.networkLogs?.filter(n => n.status >= 400)?.length || 0);

    const severityColor = (sev) => {
        if (!sev) return '#64748b';
        const s = sev.toLowerCase();
        if (s === 'critical') return '#dc2626';
        if (s === 'high') return '#f97316';
        if (s === 'medium') return '#eab308';
        return '#22c55e';
    };

    // ── Build AI issues section ────────────────────────────────────────────────
    const aiIssuesHtml = (report.aiInsights?.issues || []).map((issue, idx) => {
        const sc = severityColor(issue.severity);
        const codeBlock = issue.remediationCode
            ? `<pre class="code-block"><code>${escHtml(issue.remediationCode)}</code></pre>`
            : '';
        return `
        <div class="ai-issue-card">
            <div class="ai-issue-header">
                <span class="issue-num">${idx + 1}</span>
                <span class="issue-title">${escHtml(issue.title || 'Unknown Issue')}</span>
                <span class="severity-badge" style="background:${sc}20;color:${sc};border:1px solid ${sc}40">${issue.severity || 'Unknown'}</span>
                ${issue.timeToFix ? `<span class="time-badge">Est. ${issue.timeToFix}</span>` : ''}
            </div>
            <div class="ai-issue-body">
                ${issue.whatThisMeans ? `<div class="detail-row"><strong>What This Means:</strong> ${escHtml(issue.whatThisMeans)}</div>` : ''}
                ${issue.whyItMatters ? `<div class="detail-row"><strong>Why It Matters:</strong> ${escHtml(issue.whyItMatters)}</div>` : ''}
                ${issue.howToFix?.beginner ? `<div class="detail-row"><strong>Fix (General):</strong> ${escHtml(issue.howToFix.beginner)}</div>` : ''}
                ${issue.howToFix?.developer ? `<div class="detail-row fix-dev"><strong>Fix (Developer):</strong> ${escHtml(issue.howToFix.developer)}</div>` : ''}
                ${codeBlock}
            </div>
        </div>`;
    }).join('');

    // ── Build Visual Gallery (Limit to top 6 screenshots) ──────────────────────
    const visualGalleryHtml = (report.screenshots || []).slice(0, 6).map((s) => {
        const imgSrc = toBase64(s.path);
        return `
        <div class="gallery-card">
            <div class="gallery-header">
                <span class="gallery-page">${escHtml(s.page)}</span>
                <span class="badge" style="background:#60a5fa20;color:#60a5fa;border:1px solid #60a5fa40">${s.type}</span>
            </div>
            ${imgSrc ? `<img class="gallery-img" src="${imgSrc}" alt="Visual context for ${s.page}" />` : '<p class="empty-note">Image capture missing.</p>'}
        </div>`;
    }).join('');

    // ── Build issue log tables ─────────────────────────────────────────────────
    const issueTable = (items, fields) => {
        if (!items || items.length === 0) return `<p class="empty-note">None detected.</p>`;
        const headers = fields.map(f => `<th>${f.label}</th>`).join('');
        const rows = items.slice(0, 50).map(item =>
            `<tr>${fields.map(f => `<td>${escHtml(String(item[f.key] || '—'))}</td>`).join('')}</tr>`
        ).join('');
        return `<table class="data-table"><thead><tr>${headers}</tr></thead><tbody>${rows}</tbody></table>`;
    };

    // ── Lighthouse Scores dials ────────────────────────────────────────────────
    const lhScores = report.lighthouseScores || {};
    const scoreGauge = (label, val) => {
        const v = Math.round(val || 0);
        const color = v >= 90 ? '#22c55e' : v >= 50 ? '#eab308' : '#dc2626';
        return `<div class="gauge">
            <div class="gauge-circle" style="background:conic-gradient(${color} ${v * 3.6}deg, #1e293b 0deg)">
                <span class="gauge-val">${v}</span>
            </div>
            <div class="gauge-label">${label}</div>
        </div>`;
    };

    // ── Full HTML Template ─────────────────────────────────────────────────────
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;900&family=JetBrains+Mono:wght@400;700&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Inter', sans-serif; background: #0f172a; color: #e2e8f0; font-size: 11px; }
  .cover { width: 100%; min-height: 100vh; background: linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f2240 100%); display: flex; flex-direction: column; justify-content: center; align-items: center; padding: 60px; text-align: center; page-break-after: always; }
  .cover-logo { font-size: 64px; font-weight: 900; letter-spacing: -3px; background: linear-gradient(135deg, #60a5fa, #818cf8); -webkit-background-clip: text; -webkit-text-fill-color: transparent; margin-bottom: 8px; }
  .cover-sub { font-size: 14px; font-weight: 700; letter-spacing: 8px; text-transform: uppercase; color: #64748b; margin-bottom: 60px; }
  .cover-url { font-size: 20px; font-weight: 700; color: #60a5fa; margin-bottom: 12px; word-break: break-all; max-width: 80%; }
  .cover-meta { font-size: 12px; color: #64748b; }
  .cover-stats { display: flex; gap: 48px; margin: 48px 0; }
  .stat-box { text-align: center; }
  .stat-num { font-size: 48px; font-weight: 900; color: #f8fafc; }
  .stat-label { font-size: 10px; letter-spacing: 4px; text-transform: uppercase; color: #64748b; }
  .status-pill { display: inline-block; margin-top: 24px; padding: 8px 24px; border-radius: 999px; font-size: 11px; font-weight: 700; letter-spacing: 3px; text-transform: uppercase; background: #22c55e20; color: #22c55e; border: 1px solid #22c55e40; }
  .section { padding: 48px 60px; page-break-inside: avoid; }
  .section-header { display: flex; align-items: center; gap: 12px; margin-bottom: 28px; border-bottom: 1px solid #1e293b; padding-bottom: 16px; }
  .section-tag { font-size: 9px; font-weight: 700; letter-spacing: 4px; text-transform: uppercase; color: #60a5fa; }
  .section-title { font-size: 24px; font-weight: 800; color: #f8fafc; }
  .summary-box { background: #1e293b; border: 1px solid #334155; border-radius: 16px; padding: 32px; }
  .summary-text { font-size: 14px; line-height: 1.8; color: #cbd5e1; }
  .gauges { display: flex; gap: 32px; justify-content: center; margin: 32px 0; }
  .gauge { text-align: center; }
  .gauge-circle { width: 88px; height: 88px; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 8px; }
  .gauge-val { font-size: 22px; font-weight: 900; color: #f8fafc; }
  .gauge-label { font-size: 10px; letter-spacing: 2px; text-transform: uppercase; color: #64748b; }
  .ai-issue-card { background: #1e293b; border: 1px solid #334155; border-radius: 12px; padding: 20px 24px; margin-bottom: 16px; }
  .ai-issue-header { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; flex-wrap: wrap; }
  .issue-num { width: 28px; height: 28px; background: #60a5fa20; border: 1px solid #60a5fa40; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; color: #60a5fa; flex-shrink: 0; }
  .issue-title { font-size: 14px; font-weight: 700; color: #f8fafc; flex: 1; }
  .severity-badge, .time-badge { font-size: 9px; font-weight: 700; padding: 3px 10px; border-radius: 999px; letter-spacing: 1px; text-transform: uppercase; }
  .time-badge { background: #334155; color: #94a3b8; }
  .detail-row { margin-bottom: 8px; color: #94a3b8; line-height: 1.6; }
  .fix-dev { color: #6ee7b7; }
  .code-block { background: #0f172a; border: 1px solid #334155; border-radius: 8px; padding: 16px; margin-top: 12px; font-family: 'JetBrains Mono', monospace; font-size: 10px; color: #7dd3fc; white-space: pre-wrap; word-break: break-all; }
  .gallery-card { background: #1e293b; border: 1px solid #334155; border-radius: 12px; padding: 16px; margin-bottom: 24px; page-break-inside: avoid; }
  .gallery-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
  .gallery-page { font-size: 12px; font-weight: 700; color: #60a5fa; word-break: break-all; }
  .gallery-img { width: 100%; border-radius: 8px; border: 1px solid #334155; margin-top: 12px; }
  .data-table { width: 100%; border-collapse: collapse; font-size: 10px; }
  .data-table th { background: #1e293b; color: #64748b; font-size: 9px; letter-spacing: 2px; text-transform: uppercase; text-align: left; padding: 10px 12px; border-bottom: 1px solid #334155; }
  .data-table td { padding: 8px 12px; border-bottom: 1px solid #1e293b; color: #94a3b8; word-break: break-word; }
  .data-table tr:hover td { background: #1e293b; }
  .empty-note { color: #64748b; font-style: italic; padding: 16px 0; }
  .footer { text-align: center; padding: 32px; border-top: 1px solid #1e293b; color: #475569; font-size: 10px; letter-spacing: 2px; text-transform: uppercase; }
  .page-break { page-break-before: always; }
</style>
</head>
<body>

<div class="cover">
  <div class="cover-logo">SENTINEL</div>
  <div class="cover-sub">Tactical AI Audit Report</div>
  <div class="cover-url">${escHtml(report.url)}</div>
  <div class="cover-stats">
    <div class="stat-box"><div class="stat-num">${report.pagesCrawled || 0}</div><div class="stat-label">Pages Audited</div></div>
    <div class="stat-box"><div class="stat-num">${totalIssues}</div><div class="stat-label">Total Signals</div></div>
    <div class="stat-box"><div class="stat-num">${report.healthScore || 0}</div><div class="stat-label">Health Score</div></div>
  </div>
  <div class="cover-meta">Generated: ${new Date().toLocaleString()} &nbsp;|&nbsp; Report ID: ${idString}</div>
  <div class="status-pill">${report.status.toUpperCase()}</div>
</div>

<div class="section">
  <div class="section-header"><span class="section-tag">01</span><span class="section-title">Executive Summary</span></div>
  <div class="summary-box">
    <p class="summary-text">${escHtml(report.aiInsights?.summary || 'No executive summary generated for this diagnostic trace.')}</p>
  </div>
  
  <div class="gauges">
    ${scoreGauge('Performance', lhScores.performance)}
    ${scoreGauge('Accessibility', lhScores.accessibility)}
    ${scoreGauge('Best Practices', lhScores.bestPractices)}
    ${scoreGauge('SEO', lhScores.seo)}
  </div>
</div>

${report.aiInsights?.issues?.length > 0 ? `
<div class="section page-break">
  <div class="section-header"><span class="section-tag">02</span><span class="section-title">Critical Insight & Remediation</span></div>
  ${aiIssuesHtml}
</div>` : ''}

<div class="section page-break">
  <div class="section-header"><span class="section-tag">03</span><span class="section-title">UI/UX & Layout Diagnostics (${report.uiIssues?.length || 0})</span></div>
  ${issueTable(report.uiIssues, [
    { label: 'Page', key: 'page' },
    { label: 'Location', key: 'location' },
    { label: 'Issue', key: 'issue' },
    { label: 'Severity', key: 'severity' }
  ])}
</div>

<div class="section page-break">
  <div class="section-header"><span class="section-tag">04</span><span class="section-title">Form Interaction & Integrity (${report.formIssues?.length || 0})</span></div>
  ${issueTable(report.formIssues, [
    { label: 'Page', key: 'page' },
    { label: 'Form', key: 'formName' },
    { label: 'Type', key: 'type' },
    { label: 'Field', key: 'fieldName' }
  ])}
</div>

<div class="section page-break">
  <div class="section-header"><span class="section-tag">05</span><span class="section-title">Console & Script Alerts (${report.consoleErrors?.length || 0})</span></div>
  ${issueTable(report.consoleErrors, [
    { label: 'Page', key: 'page' },
    { label: 'Message', key: 'message' },
    { label: 'Type', key: 'type' },
    { label: 'Origin', key: 'location' }
  ])}
</div>

<div class="section page-break">
  <div class="section-header"><span class="section-tag">06</span><span class="section-title">Global Accessibility Compliance (${report.accessibilityIssues?.length || 0})</span></div>
  ${issueTable(report.accessibilityIssues, [
    { label: 'Page', key: 'page' },
    { label: 'Issue', key: 'issue' },
    { label: 'Severity', key: 'severity' },
    { label: 'Recommendation', key: 'recommendation' }
  ])}
</div>

<div class="section page-break">
  <div class="section-header"><span class="section-tag">07</span><span class="section-title">Network & Asset Failures (${report.networkLogs?.filter(n => n.status >= 400)?.length || 0})</span></div>
  ${issueTable(report.networkLogs?.filter(n => n.status >= 400), [
    { label: 'Page', key: 'page' },
    { label: 'Method', key: 'method' },
    { label: 'Status', key: 'status' },
    { label: 'URL', key: 'url' }
  ])}
</div>

<div class="section page-break">
  <div class="section-header"><span class="section-tag">08</span><span class="section-title">Broken Navigation Trace (${report.brokenLinks?.length || 0})</span></div>
  ${issueTable(report.brokenLinks, [
    { label: 'Page', key: 'page' },
    { label: 'Broken URL', key: 'link' },
    { label: 'Status', key: 'status' }
  ])}
</div>

<div class="section page-break">
  <div class="section-header"><span class="section-tag">09</span><span class="section-title">Visual Context Gallery (Appendix)</span></div>
  ${visualGalleryHtml || '<p class="empty-note">No visual telemetry captured.</p>'}
</div>

<div class="footer">Sentinel AI QA Platform &nbsp;|&nbsp; High-Fidelity Tactical Report &nbsp;|&nbsp; ${new Date().toLocaleDateString()}</div>
</body>
</html>`;

    // ── Render via Playwright ──────────────────────────────────────────────────
    let browser;
    try {
        browser = await chromium.launch({ 
            headless: true, 
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'] 
        });
        const page = await browser.newPage();
        await page.setContent(html, { waitUntil: 'domcontentloaded' });

        const pdfDir = path.dirname(pdfPath);
        if (!fs.existsSync(pdfDir)) fs.mkdirSync(pdfDir, { recursive: true });

        await page.pdf({
            path: pdfPath,
            format: 'A4',
            printBackground: true,
            margin: { top: '0', right: '0', bottom: '0', left: '0' }
        });

        return `/reports/report-${idString}.pdf`;
    } finally {
        if (browser) await browser.close();
    }
};

/**
 * generateCSV - Exports report findings as a clean CSV table string
 */
const generateCSV = async (reportId) => {
    const report = await ScanReport.findById(reportId);
    if (!report) return null;

    const rows = [
        ['Category', 'Page', 'Title/Message/Link', 'Severity/Status', 'Details']
    ];

    (report.brokenLinks || []).forEach(l => {
        rows.push(['Broken Link', l.page || '', l.link || '', l.status || '', '']);
    });

    (report.consoleErrors || []).forEach(c => {
        rows.push(['Console Error', c.page || '', c.message || '', c.type || '', c.location || '']);
    });

    (report.accessibilityIssues || []).forEach(a => {
        rows.push(['Accessibility', a.page || '', a.issue || '', a.severity || '', a.recommendation || '']);
    });

    (report.uiIssues || []).forEach(u => {
        rows.push(['UI Issue', u.page || '', u.issue || '', u.severity || '', u.location || '']);
    });

    return rows.map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
};

// Minimal HTML escape to prevent XSS inside report + strip emojis for professional enterprise formatting
function escHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{2B50}\u{200D}\u{FE0F}]/gu, '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .trim();
}

module.exports = { generatePDF, generateCSV };

