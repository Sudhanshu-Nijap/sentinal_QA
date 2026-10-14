import React from 'react';
import { motion } from 'framer-motion';
import { Zap, AlertTriangle, RefreshCw, ExternalLink, Activity, TrendingUp, TrendingDown, Minus } from 'lucide-react';

const ScoreRing = ({ score, size = 48 }) => {
  const radius = (size - 8) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - ((score || 0) / 100) * circumference;
  const color = score >= 80 ? '#22c55e' : score >= 50 ? '#f59e0b' : '#ef4444';
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size/2} cy={size/2} r={radius} fill="transparent" className="stroke-[var(--eu-text-main)] opacity-10" strokeWidth="4" />
        <circle cx={size/2} cy={size/2} r={radius} fill="transparent" stroke={color} strokeWidth="4"
          strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 1s ease' }} />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-[11px] font-black" style={{ color }}>{score ?? '--'}</span>
      </div>
    </div>
  );
};

const DeltaBadge = ({ val, label }) => {
  if (val === null || val === undefined) return null;
  const isPos = val > 0, isNeg = val < 0;
  const Icon = isPos ? TrendingUp : isNeg ? TrendingDown : Minus;
  const cls = isPos ? 'text-green-400 bg-green-500/10 border-green-500/20'
    : isNeg ? 'text-red-400 bg-red-500/10 border-red-500/20'
    : 'text-slate-400 bg-white/5 border-white/10';
  return (
    <div className={`flex items-center gap-1 px-2 py-0.5 rounded-lg border text-[9px] font-black ${cls}`}>
      <Icon size={9} />
      {isPos ? '+' : ''}{val} {label}
    </div>
  );
};

const ScanSummaryCard = ({ message, onViewReport, isRescan }) => {
  const { reportSummary, scanReportId, createdAt } = message;
  if (!reportSummary) return null;

  const { healthScore, lighthouseScores, stats, comparison } = reportSummary;
  const time = new Date(createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full max-w-sm"
    >
      {/* Header Badge */}
      <div className="flex items-center gap-2 mb-2">
        {isRescan ? (
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-eu-accent/10 border border-eu-accent/20 rounded-lg">
            <RefreshCw size={8} className="text-eu-accent" />
            <span className="text-[8px] font-black uppercase tracking-widest text-eu-accent">Rescan</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-white/5 border border-white/10 rounded-lg">
            <span className="text-[8px] font-black uppercase tracking-widest text-slate-400">Scan Report</span>
          </div>
        )}
        <span className="text-[8px] text-slate-600 font-mono">{time}</span>
      </div>

      {/* Card Body */}
      <div className="glass-euphoria rounded-[20px] border border-white/5 overflow-hidden">
        {/* Top: Health + Lighthouse */}
        <div className="p-4 flex items-center gap-4 border-b border-white/5">
          <div className="flex flex-col items-center gap-1">
            <ScoreRing score={healthScore} size={52} />
            <span className="text-[8px] font-black uppercase tracking-wider text-slate-500">Health</span>
          </div>
          <div className="flex-1 grid grid-cols-2 gap-2">
            {[
              { label: 'Perf', val: lighthouseScores?.performance },
              { label: 'SEO', val: lighthouseScores?.seo },
              { label: 'A11y', val: lighthouseScores?.accessibility },
              { label: 'Best', val: lighthouseScores?.bestPractices },
            ].map(({ label, val }) => (
              <div key={label} className="flex items-center justify-between bg-white/3 rounded-lg px-2 py-1">
                <span className="text-[8px] font-black uppercase tracking-wider text-slate-500">{label}</span>
                <span className="text-[11px] font-black text-white font-mono">{val ?? '--'}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Middle: Issue Counts across All Audit Sensors */}
        <div className="px-3 py-3 grid grid-cols-6 gap-1 border-b border-white/5 bg-slate-900/50">
          {[
            { label: 'UI/UX', val: stats?.uiIssues ?? (reportSummary?.reportData?.uiIssues?.length || 0), color: 'text-amber-400' },
            { label: 'Forms', val: stats?.formIssues ?? (reportSummary?.reportData?.formIssues?.length || 0), color: 'text-orange-400' },
            { label: 'Security', val: stats?.securityIssues ?? 0, color: 'text-rose-400' },
            { label: 'Console', val: stats?.consoleErrors ?? 0, color: 'text-yellow-400' },
            { label: 'Links', val: stats?.brokenLinks ?? 0, color: 'text-red-400' },
            { label: 'A11y', val: stats?.accessibilityIssues ?? 0, color: 'text-blue-400' },
          ].map(({ label, val, color }) => (
            <div key={label} className="text-center">
              <p className={`text-xs font-black font-mono ${val > 0 ? color : 'text-slate-500'}`}>{val ?? 0}</p>
              <p className="text-[8px] font-bold uppercase tracking-wider text-slate-400 truncate">{label}</p>
            </div>
          ))}
        </div>

        {/* Delta row (only for rescans) */}
        {comparison && (
          <div className="px-4 py-2.5 bg-white/2 flex flex-wrap gap-1.5 border-b border-white/5">
            <DeltaBadge val={comparison.scoreDelta} label="pts" />
            {comparison.newErrors > 0 && (
              <div className="flex items-center gap-1 px-2 py-0.5 rounded-lg border text-[9px] font-black text-red-400 bg-red-500/10 border-red-500/20">
                <AlertTriangle size={9} /> +{comparison.newErrors} new
              </div>
            )}
            {comparison.fixedErrors > 0 && (
              <div className="flex items-center gap-1 px-2 py-0.5 rounded-lg border text-[9px] font-black text-green-400 bg-green-500/10 border-green-500/20">
                −{comparison.fixedErrors} fixed
              </div>
            )}
            <div className={`flex items-center gap-1 px-2 py-0.5 rounded-lg border text-[9px] font-black ml-auto
              ${comparison.impact === 'Improved' ? 'text-green-400 bg-green-500/10 border-green-500/20'
              : comparison.impact === 'Regressed' ? 'text-red-400 bg-red-500/10 border-red-500/20'
              : 'text-slate-400 bg-white/5 border-white/10'}`}>
              {comparison.impact === 'Improved' ? '↑' : comparison.impact === 'Regressed' ? '↓' : '→'} {comparison.impact}
            </div>
          </div>
        )}

        {/* Action */}
        <div className="px-4 py-3">
          <button
            onClick={() => onViewReport(scanReportId)}
            className="w-full flex items-center justify-center gap-2 py-2 bg-eu-accent/10 hover:bg-eu-accent border border-eu-accent/30 rounded-xl text-[10px] font-black uppercase tracking-widest text-eu-accent hover:text-white transition-all"
          >
            <ExternalLink size={11} />
            View Full Report
          </button>
        </div>
      </div>
    </motion.div>
  );
};

export default ScanSummaryCard;
