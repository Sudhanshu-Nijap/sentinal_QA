import React from 'react';
import { motion } from 'framer-motion';
import {
  AlertTriangle, RefreshCw, ExternalLink, Activity,
  TrendingUp, TrendingDown, Minus, ArrowRight, Shield, CheckCircle2
} from 'lucide-react';

const formatScore = (val) => {
  if (val === null || val === undefined) return '--';
  const num = Number(val);
  if (isNaN(num)) return '--';
  return Math.round(num <= 1 && num > 0 ? num * 100 : num);
};

const getScoreColor = (val) => {
  const num = Number(val);
  if (isNaN(num)) return 'text-slate-500 dark:text-slate-400';
  const formatted = num <= 1 && num > 0 ? num * 100 : num;
  if (formatted >= 85) return 'text-emerald-600 dark:text-emerald-400';
  if (formatted >= 50) return 'text-amber-500 dark:text-amber-400';
  return 'text-rose-600 dark:text-rose-400';
};

const getScoreBg = (val) => {
  const num = Number(val);
  if (isNaN(num)) return 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700';
  const formatted = num <= 1 && num > 0 ? num * 100 : num;
  if (formatted >= 85) return 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800';
  if (formatted >= 50) return 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800';
  return 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800';
};

const DeltaBadge = ({ val, label }) => {
  if (val === null || val === undefined) return null;
  const isPos = val > 0, isNeg = val < 0;
  const Icon = isPos ? TrendingUp : isNeg ? TrendingDown : Minus;
  const cls = isPos
    ? 'text-emerald-700 bg-emerald-50 border-emerald-200 dark:text-emerald-300 dark:bg-emerald-950/60 dark:border-emerald-800'
    : isNeg
    ? 'text-rose-700 bg-rose-50 border-rose-200 dark:text-rose-300 dark:bg-rose-950/60 dark:border-rose-800'
    : 'text-slate-600 bg-slate-100 border-slate-200 dark:text-slate-400 dark:bg-slate-800 dark:border-slate-700';
  return (
    <div className={`flex items-center gap-1 px-2 py-0.5 rounded-md border text-[10px] font-bold uppercase tracking-wider ${cls}`}>
      <Icon size={10} />
      {isPos ? '+' : ''}{val} {label}
    </div>
  );
};

const ScanSummaryCard = ({ message, onViewReport, isRescan }) => {
  const { reportSummary, scanReportId, createdAt } = message;
  if (!reportSummary) return null;

  const { healthScore, stats, comparison } = reportSummary;
  const lighthouseScores = reportSummary.lighthouseScores || reportSummary.reportData?.lighthouseScores || {};

  const time = new Date(createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  // Safe issue counts fallback
  const uiCount = stats?.uiIssues ?? (reportSummary?.reportData?.uiIssues?.length || 0);
  const formCount = stats?.formIssues ?? (reportSummary?.reportData?.formIssues?.length || 0);
  const securityCount = stats?.securityIssues ?? (reportSummary?.reportData?.securityIssues?.length || 0);
  const consoleCount = stats?.consoleErrors ?? (reportSummary?.reportData?.consoleErrors?.length || 0);
  const linksCount = stats?.brokenLinks ?? (reportSummary?.reportData?.brokenLinks?.length || 0);
  const a11yCount = stats?.accessibilityIssues ?? (reportSummary?.reportData?.accessibilityIssues?.length || 0);

  const totalSensorIssues = uiCount + formCount + securityCount + consoleCount + linksCount + a11yCount;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm hover:shadow-md transition-all p-5 space-y-4 font-inter text-slate-900 dark:text-white"
    >
      {/* ── Card Header ── */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-900 dark:text-white font-outfit">
            {isRescan ? 'QA Rescan Completed' : 'QA Diagnostic Audit'}
          </span>
          {scanReportId && (
            <span className="text-[10px] font-bold text-slate-500 font-mono">
              #{String(scanReportId).slice(-6).toUpperCase()}
            </span>
          )}
        </div>
        <span className="text-[11px] font-medium text-slate-600 dark:text-slate-400">
          {time}
        </span>
      </div>

      {/* ── Health Score & Core Web Vitals Panel ── */}
      <div className="grid grid-cols-1 sm:grid-cols-12 gap-3.5 items-stretch">
        {/* Health Score Pillar */}
        <div className="sm:col-span-4 bg-slate-50 dark:bg-slate-850 p-3.5 rounded-xl border border-slate-200 dark:border-slate-750 flex flex-col items-center justify-center text-center">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1 font-outfit">
            Health Score
          </p>
          <div className="flex items-baseline gap-0.5">
            <span className={`text-3xl font-black font-outfit ${getScoreColor(healthScore)}`}>
              {healthScore ?? '--'}
            </span>
            <span className="text-xs font-bold text-slate-500">/100</span>
          </div>
          <span className={`mt-1.5 px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border ${getScoreBg(healthScore)} ${getScoreColor(healthScore)}`}>
            {healthScore >= 85 ? 'Approved' : healthScore >= 50 ? 'Conditional' : 'Action Req.'}
          </span>
        </div>

        {/* 4 Core Web Vitals (Lighthouse) */}
        <div className="sm:col-span-8 grid grid-cols-2 gap-2">
          {[
            { label: 'Performance', val: lighthouseScores?.performance },
            { label: 'SEO', val: lighthouseScores?.seo },
            { label: 'Accessibility', val: lighthouseScores?.accessibility },
            { label: 'Best Practices', val: lighthouseScores?.bestPractices },
          ].map(({ label, val }) => {
            const formatted = formatScore(val);
            return (
              <div
                key={label}
                className="bg-slate-50 dark:bg-slate-850 p-2.5 rounded-xl border border-slate-200 dark:border-slate-750 flex items-center justify-between"
              >
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 font-outfit">
                    {label}
                  </p>
                  <p className="text-[9px] text-slate-600 dark:text-slate-400 font-medium">Core Metric</p>
                </div>
                <span className={`text-sm font-black font-mono px-2 py-0.5 rounded-md border ${getScoreBg(formatted)} ${getScoreColor(formatted)}`}>
                  {formatted}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Sensor Diagnostics Findings (Clean 3x2 Grid - No Truncations) ── */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 font-outfit">
          <span>Audit Sensor Findings</span>
          <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
            totalSensorIssues > 0
              ? 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800'
              : 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800'
          }`}>
            {totalSensorIssues > 0 ? `${totalSensorIssues} Total Issues` : 'All Sensors Clean'}
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {[
            { label: 'UI / UX', count: uiCount },
            { label: 'Forms', count: formCount },
            { label: 'Security', count: securityCount },
            { label: 'Console', count: consoleCount },
            { label: 'Links', count: linksCount },
            { label: 'A11y', count: a11yCount },
          ].map(({ label, count }) => {
            const hasIssues = count > 0;
            return (
              <div
                key={label}
                className={`p-2.5 rounded-xl border text-center transition-all ${
                  hasIssues
                    ? 'bg-rose-50/70 border-rose-200 dark:bg-rose-950/30 dark:border-rose-900/60'
                    : 'bg-slate-50 dark:bg-slate-850 border-slate-200 dark:border-slate-750'
                }`}
              >
                <p className={`text-sm font-black font-mono ${hasIssues ? 'text-rose-600 dark:text-rose-400' : 'text-slate-700 dark:text-slate-300'}`}>
                  {count}
                </p>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mt-0.5 font-outfit">
                  {label}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Comparison Delta (For Rescans) ── */}
      {comparison && (
        <div className="p-3 bg-slate-50 dark:bg-slate-850 rounded-xl border border-slate-200 dark:border-slate-750 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <DeltaBadge val={comparison.scoreDelta} label="pts" />
            {comparison.newErrors > 0 && (
              <span className="text-[10px] font-bold text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/50 px-2 py-0.5 rounded border border-rose-200 dark:border-rose-800">
                +{comparison.newErrors} new
              </span>
            )}
            {comparison.fixedErrors > 0 && (
              <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
                −{comparison.fixedErrors} resolved
              </span>
            )}
          </div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 font-outfit">
            Trend: {comparison.impact || 'Stable'}
          </span>
        </div>
      )}

      {/* ── View Full Report Action ── */}
      <button
        type="button"
        onClick={() => onViewReport(scanReportId)}
        className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all shadow-sm font-outfit group"
      >
        <span>View Full Diagnostic Report</span>
        <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
      </button>
    </motion.div>
  );
};

export default ScanSummaryCard;
