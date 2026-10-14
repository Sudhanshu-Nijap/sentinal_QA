import { API_URL, SOCKET_URL } from '../config/api';
import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeft, ExternalLink, AlertTriangle, Terminal, Layout,
  FormInput, Image, Zap, UserCheck, Loader2,
  CheckCircle2, Info, AlertCircle, BarChart3, Database, Shield, Cpu, Bot,
  Wifi, Trash2, Code, Copy, Check, Plus,
  Activity, Sparkles, X, Search
} from 'lucide-react';
import axios from 'axios';

const StatCard = ({ label, value, color, icon }) => (
  <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden group">
    <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-all duration-300 group-hover:scale-110 text-slate-900 dark:text-white">{icon}</div>
    <p className="text-[11px] text-slate-600 dark:text-slate-400 font-bold uppercase tracking-wider mb-1.5">{label}</p>
    <p className={`text-2xl font-black ${color} tracking-tight font-outfit`}>{value}</p>
  </div>
);

const SectionHeader = ({ title, icon }) => (
  <div className="flex items-center gap-3 mb-6">
    <div className="size-9 bg-indigo-50 dark:bg-indigo-950/60 rounded-xl flex items-center justify-center border border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400 shadow-sm">{icon}</div>
    <h3 className="text-xl font-black tracking-tight font-outfit text-slate-900 dark:text-white">{title} <span className="text-indigo-600 dark:text-indigo-400 font-semibold text-base">Diagnostics</span></h3>
  </div>
);

const RecommendationCard = ({ title, status, icon, description, statusColor }) => (
  <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md hover:border-indigo-300 dark:hover:border-indigo-700 transition-all duration-300">
    <div className="flex items-start justify-between mb-4">
      <div className="size-10 bg-slate-100 dark:bg-slate-800 rounded-lg flex items-center justify-center text-slate-700 dark:text-slate-300">{icon}</div>
      <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border ${statusColor}`}>{status}</span>
    </div>
    <h4 className="text-base font-bold text-slate-900 dark:text-white mb-1.5 font-outfit">{title}</h4>
    <p className="text-slate-700 dark:text-slate-300 text-xs leading-relaxed font-normal">{description}</p>
  </div>
);

const LighthouseCircle = ({ label, score, delta }) => {
  const getScoreColor = (s) => {
    if (s >= 90) return 'text-emerald-600 stroke-emerald-600 dark:text-emerald-400 dark:stroke-emerald-400';
    if (s >= 50) return 'text-amber-500 stroke-amber-500 dark:text-amber-400 dark:stroke-amber-400';
    return 'text-rose-600 stroke-rose-600 dark:text-rose-400 dark:stroke-rose-400';
  };
  const radius = 32;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (score / 100) * circumference;
  return (
    <div className="flex flex-col items-center gap-3 group">
      <div className="relative w-20 h-20">
        <svg className="w-full h-full transform -rotate-90">
          <circle cx="50%" cy="50%" r={radius} fill="transparent" stroke="currentColor" strokeWidth="4" className="text-slate-200 dark:text-slate-800" />
          <circle
            cx="50%" cy="50%" r={radius} fill="transparent" stroke="currentColor" strokeWidth="6"
            strokeDasharray={circumference} strokeDashoffset={strokeDashoffset} strokeLinecap="round"
            className={`${getScoreColor(score)} transition-all duration-1000 ease-out`}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`text-2xl font-black font-outfit tracking-tight ${getScoreColor(score).split(' ')[0]}`}>{Math.round(score)}</span>
        </div>
      </div>
      <div className="text-center">
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">{label}</span>
      </div>
      {/* Comparison Delta */}
      {delta !== undefined && delta !== 0 && (
        <div className={`mt-1 flex items-center justify-center gap-1 font-bold text-[10px] uppercase px-2.5 py-0.5 rounded-md border ${delta > 0 ? 'text-emerald-700 border-emerald-200 bg-emerald-50 dark:text-emerald-300 dark:border-emerald-800 dark:bg-emerald-950/40' : 'text-rose-700 border-rose-200 bg-rose-50 dark:text-rose-300 dark:border-rose-800 dark:bg-rose-950/40'
          }`}>
          {delta > 0 ? <Plus size={10} strokeWidth={3} /> : <div className="w-2 h-[2px] bg-rose-600 rounded-full shrink-0" />}
          {Math.abs(Math.round(delta))}
        </div>
      )}
    </div>
  );
};

const optimizeAndDeduplicateIssues = (items) => {
  if (!items || !Array.isArray(items) || items.length === 0) return [];

  const map = new Map();

  for (const item of items) {
    // Generate a unique fingerprint based on testCaseId, message/issue, and target selector/url/location
    const coreKey = item.testCaseId 
      ? `${item.testCaseId}-${item.selector || item.location || ''}`
      : `${item.type || ''}-${item.message || item.issue || item.link || item.url || ''}-${item.method || ''}`;

    if (!map.has(coreKey)) {
      map.set(coreKey, {
        ...item,
        _occurrences: 1,
        _affectedLocations: [item.page || item.location || item.url || 'Primary View'].filter(Boolean)
      });
    } else {
      const existing = map.get(coreKey);
      existing._occurrences += 1;
      const loc = item.page || item.location || item.url;
      if (loc && !existing._affectedLocations.includes(loc)) {
        existing._affectedLocations.push(loc);
      }
    }
  }

  return Array.from(map.values());
};

const getTabData = (report, tab) => {
  let raw = [];
  switch (tab) {
    case 'network': raw = report.networkLogs || []; break;
    case 'links': raw = report.brokenLinks || []; break;
    case 'console': raw = report.consoleErrors || []; break;
    case 'layout': raw = [...(report.uiIssues || []), ...(report.responsiveIssues || [])]; break;
    case 'accessibility': raw = report.accessibilityIssues || []; break;
    case 'forms': raw = report.formIssues || []; break;
    case 'security': raw = report.securityIssues || []; break;
    default: raw = []; break;
  }
  return optimizeAndDeduplicateIssues(raw);
};

const getTableColumns = (tab) => {
  switch (tab) {
    case 'network': return ['Page', 'Method', 'Status', 'Type', 'Url'];
    case 'links': return ['Page', 'Link', 'Status'];
    case 'console': return ['Page', 'Message', 'Severity', 'Type'];
    case 'layout': return ['Page', 'Context', 'Issue', 'Severity', 'Selector'];
    case 'accessibility': return ['Page', 'Issue', 'Severity', 'Element'];
    case 'forms': return ['Page', 'Context', 'Form', 'Type', 'Severity'];
    case 'security': return ['Page', 'Issue', 'Severity', 'Selector'];
    default: return [];
  }
};

const getAllIssuesForPage = (report, pageUrl) => {
  const issues = [];

  (report.consoleErrors || []).forEach(e => {
    if (e.page === pageUrl) issues.push({ ...e, _source: 'CONSOLE', _color: 'text-primary' });
  });

  (report.networkLogs || []).forEach(e => {
    if (e.page === pageUrl) issues.push({ ...e, _source: 'NETWORK', _color: 'text-eu-accent' });
  });

  (report.uiIssues || []).forEach(e => {
    if (e.page === pageUrl) issues.push({ ...e, _source: 'UI/UX', _color: 'text-yellow-400' });
  });

  (report.formIssues || []).forEach(e => {
    if (e.page === pageUrl) issues.push({ ...e, _source: 'FORMS', _color: 'text-blue-400' });
  });

  (report.brokenLinks || []).forEach(e => {
    if (e.page === pageUrl) issues.push({ ...e, _source: 'LINK', _color: 'text-red-400' });
  });

  (report.securityIssues || []).forEach(e => {
    if (e.page === pageUrl) issues.push({ ...e, _source: 'SECURITY', _color: 'text-red-500' });
  });

  return issues;
};

const IssueTable = ({ data, columns, setRemediationCode, onAskAI, reportId }) => {
  const [expandedRowId, setExpandedRowId] = useState(null);
  const [copiedTicketId, setCopiedTicketId] = useState(null);

  if (!data || data.length === 0) return (
    <div className="text-center py-20">
      <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-primary/20"><CheckCircle2 className="text-primary" size={32} /></div>
      <h3 className="text-xl font-bold text-[var(--eu-text-main)] mb-2">No Anomalies Detected</h3>
      <p className="text-[var(--eu-text-muted)] text-sm max-w-xs mx-auto">This protocol has returned zero active failures for the selected target parameters.</p>
    </div>
  );

  const getRemediationInfo = (row) => {
    // If the issue already comes with rich diagnostic telemetry, prioritize it directly!
    const customCause = row.details || row.issue || row.message;
    const customImpact = row.technicalImpact;
    const customGuide = row.suggestedFix || row.recommendation;

    if (customImpact && customGuide) {
      return {
        cause: customCause || "Diagnostic trigger identified non-standard runtime or layout behavior.",
        impact: customImpact,
        guide: customGuide
      };
    }

    if (row.issue && (row.issue.includes('Leaked') || row.issue.includes('Secret') || row.issue.includes('Source Map') || row.issue.includes('Malicious'))) {
      return {
        cause: row.details || "Security credential or unminified asset exposed to public clients.",
        impact: customImpact || "Severe risk of unauthorized API abuse, token hijacking, or source code reconstruction.",
        guide: customGuide || "Rotate compromised credentials immediately and ensure keys are protected behind server environment variables."
      };
    }
    if (row.type && (row.type.includes('DEAD_CLICK') || row.type.includes('CRASH_CLICK') || row.type.includes('ZOMBIE_API') || row.type.includes('CLICK_INTERCEPTION'))) {
      return {
        cause: customCause || "Interactive component failed to execute, dispatch handler, or was obscured by an overlay.",
        impact: customImpact || "Severe user friction and abandonment on primary call-to-action workflows.",
        guide: customGuide || "Verify event binding, z-index hierarchy, and ensure interactive elements receive unobstructed pointer events."
      };
    }
    if (row.type && (row.type.includes('DOUBLE_SUBMIT') || row.type.includes('PLAINTEXT_PASSWORD') || row.type.includes('CSRF') || row.type.includes('VALIDATION'))) {
      return {
        cause: customCause || "Form validation or state submission gap identified.",
        impact: customImpact || "Potential data corruption, duplicate charges/records, or credential security vulnerability.",
        guide: customGuide || "Implement client-side validation constraints and debounce submit buttons on click."
      };
    }
    if (row.method) return { // Network
      cause: customCause || "High latency or structural fetch failure detected in network cluster.",
      impact: customImpact || "Degraded page load performance and potential data synchronization loss.",
      guide: customGuide || `Verify endpoint ${row.url} is optimized for global distribution and properly handled in frontend UI.`
    };
    if (row.type === 'error' || row.message) return { // Console
      cause: customCause || "Runtime exception identified in the execution environment.",
      impact: customImpact || "Potential catastrophic failure of interactive UI components.",
      guide: customGuide || "Inspect call stack for unhandled promises or null-reference collisions in the source bundle."
    };
    if (row.severity) return { // A11y / Security
      cause: customCause || "Structural non-compliance with global standards.",
      impact: customImpact || row.issue || "Exclusion of users with assistive technological requirements or security risk.",
      guide: customGuide || "Ensure ARIA landmarks, semantic contrasts, or headers meet modern web standards."
    };
    if (row.field || row.form) return { // Forms
      cause: customCause || "Semantic or validation gap identified in the user interaction layer.",
      impact: customImpact || "Potential user frustration or failure to complete critical business flows.",
      guide: customGuide || `Review the ${row.field} field in ${row.form}. Ensure labels and validation constraints are correctly implemented.`
    };
    return {
      cause: customCause || "General deviation from optimized architectural standards.",
      impact: customImpact || row.issue || "Sub-optimal user experience and processing inefficiency.",
      guide: customGuide || "Audit target element's parent hierarchy for redundant styles or layout shifts."
    };
  };

  return (
    <div className="w-full overflow-x-auto">
      <table className="w-full text-left border-separate border-spacing-y-2">
        <thead>
          <tr>
            {columns.map(col => <th key={col} className="pb-3 px-4 text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">{col}</th>)}
            {!columns.includes('Outcome') && <th className="pb-3 px-4 text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider text-right">Action</th>}
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => {
            const rowId = i;
            const isExpanded = expandedRowId === rowId;
            const remediation = getRemediationInfo(row);

            return (
              <React.Fragment key={i}>
                <tr
                  onClick={() => setExpandedRowId(isExpanded ? null : rowId)}
                  className={`group cursor-pointer transition-all duration-300 ${isExpanded ? 'bg-indigo-50/60 dark:bg-slate-800/80 translate-x-1' : 'hover:bg-slate-50 dark:hover:bg-slate-850'}`}
                >
                  {columns.map(col => {
                    const columnToKey = { 'Form Selector': 'formSelector', 'Scan Date': 'scanDate', 'Fix Guide': 'recommendation' };
                    const key = columnToKey[col] || col.toLowerCase().replace(/\s/g, '');
                    let value = row[key];

                    if (col === 'Status') {
                      const statusNum = parseInt(value, 10);
                      const is5xx = statusNum >= 500;
                      const is4xx = statusNum >= 400 && statusNum < 500;
                      const is2xx = statusNum >= 200 && statusNum < 400;
                      return (
                        <td key={col} className="py-3.5 px-4 bg-white dark:bg-slate-900 first:rounded-l-xl last:rounded-r-xl border-y border-slate-200 dark:border-slate-800 first:border-l last:border-r shadow-xs">
                          <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold font-mono border ${
                            is5xx ? 'bg-rose-50 text-rose-700 border-rose-300 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800' :
                            is4xx ? 'bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800' :
                            is2xx ? 'bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800' :
                            'bg-indigo-50 text-indigo-700 border-indigo-200'
                          }`}>{value || '---'}</span>
                        </td>
                      );
                    }

                    if (col === 'Context') {
                      return (
                        <td key={col} className="py-3.5 px-4 bg-white dark:bg-slate-900 first:rounded-l-xl last:rounded-r-xl border-y border-slate-200 dark:border-slate-800 first:border-l last:border-r shadow-xs">
                          <div className="flex items-center gap-2">
                            <div className="size-2 rounded-full bg-indigo-600 animate-pulse" />
                            <span className="text-xs font-bold uppercase text-slate-800 dark:text-slate-200 tracking-wider">{value || 'Main Layout'}</span>
                          </div>
                        </td>
                      );
                    }

                    if (col === 'RiskLevel' || col === 'Outcome') {
                      return (
                        <td key={col} className="py-3.5 px-4 bg-white dark:bg-slate-900 first:rounded-l-xl last:rounded-r-xl border-y border-slate-200 dark:border-slate-800 first:border-l last:border-r shadow-xs">
                          <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800`}>{value}</span>
                        </td>
                      );
                    }

                    if (col === 'Severity') {
                      const sevStr = (value || row.severity || '').toString().toLowerCase();
                      const isCrit = sevStr.includes('crit');
                      const isHigh = sevStr.includes('high');
                      const isMed = sevStr.includes('med');
                      return (
                        <td key={col} className="py-3.5 px-4 bg-white dark:bg-slate-900 first:rounded-l-xl last:rounded-r-xl border-y border-slate-200 dark:border-slate-800 first:border-l last:border-r shadow-xs">
                          <span className={`px-2.5 py-1 rounded-md text-[10px] font-extrabold uppercase border tracking-wider font-outfit ${
                            isCrit ? 'bg-rose-50 text-rose-700 border-rose-300 dark:bg-rose-950 dark:text-rose-300 dark:border-rose-800' :
                            isHigh ? 'bg-orange-50 text-orange-700 border-orange-300 dark:bg-orange-950 dark:text-orange-300 dark:border-orange-800' :
                            isMed ? 'bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800' :
                            'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800'
                          }`}>{value || row.severity || 'Medium'}</span>
                        </td>
                      );
                    }

                    if (col === 'Issue' || col === 'Message' || col === 'Link') {
                      return (
                        <td key={col} className="py-3.5 px-4 bg-white dark:bg-slate-900 first:rounded-l-xl last:rounded-r-xl border-y border-slate-200 dark:border-slate-800 first:border-l last:border-r shadow-xs max-w-md">
                          <div className="flex flex-col gap-1">
                            <div className="flex flex-wrap items-center gap-1.5">
                              {row.testCaseId && (
                                <span className="px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 text-[10px] font-bold uppercase tracking-wider border border-indigo-200 dark:border-indigo-800 font-mono shrink-0">
                                  {row.testCaseId}
                                </span>
                              )}
                              {row._occurrences > 1 && (
                                <span className="px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 text-[10px] font-bold uppercase tracking-wider border border-amber-300 dark:border-amber-700 shrink-0">
                                  x{row._occurrences}
                                </span>
                              )}
                              <span className="text-xs font-bold text-slate-900 dark:text-white break-words leading-snug font-outfit">
                                {value || '---'}
                              </span>
                            </div>
                            {row.expected && (
                              <span className="text-[11px] text-slate-600 dark:text-slate-400 font-medium truncate max-w-sm">
                                Expected: {row.expected}
                              </span>
                            )}
                          </div>
                        </td>
                      );
                    }

                    if (col === 'Payload' || col === 'FormSelector' || col === 'Element' || col === 'Selector') {
                      const looksLikeUrl = typeof value === 'string' && (value.startsWith('http') || value.startsWith('/') || value.includes('data:image'));
                      const isImageUrl = looksLikeUrl && (value.match(/\.(jpeg|jpg|gif|png|webp|svg)/i) || col === 'Selector' || col === 'Element');
                      const fileName = isImageUrl ? value.split('/').pop().split('?')[0] : null;

                      return (
                        <td key={col} className="py-3 px-4 glass-euphoria first:rounded-l-xl last:rounded-r-xl border-y border-white/5 first:border-l last:border-r max-w-sm">
                          <div className="flex flex-col gap-3">
                            {isImageUrl && (
                              <div className="flex items-center gap-3 bg-[var(--eu-bg-void)]/40 p-2 rounded-xl border border-white/5 group/img-preview">
                                <div className="relative size-10 rounded-lg overflow-hidden shrink-0 border border-white/10 bg-black/20 shadow-neon">
                                  <img
                                    src={value}
                                    alt="Issue context"
                                    className="w-full h-full object-cover group-hover/img-preview:scale-125 transition-transform duration-500"
                                    onError={(e) => {
                                      e.target.style.display = 'none';
                                      e.target.parentElement.classList.add('bg-primary/20');
                                    }}
                                  />
                                </div>
                                <div className="flex flex-col overflow-hidden">
                                  <span className="text-[10px] font-black text-eu-accent truncate uppercase tracking-widest">{fileName || 'Neural Asset'}</span>
                                  <span className="text-[8px] text-[var(--eu-text-muted)] truncate opacity-50">{value}</span>
                                </div>
                              </div>
                            )}
                            {!isImageUrl && (
                              <code className="text-[10px] bg-[var(--eu-bg-void)]/60 px-2 py-1 rounded-lg text-eu-accent/80 border border-[var(--eu-glass-border)] block break-all font-mono shadow-inner">{value || 'NULL'}</code>
                            )}
                          </div>
                        </td>
                      );
                    }

                    return (
                      <td key={col} className="py-3 px-4 glass-euphoria first:rounded-l-xl last:rounded-r-xl border-y border-white/5 first:border-l last:border-r">
                        <span className="text-[11px] font-bold text-[var(--eu-text-main)] opacity-80 block max-w-xs break-all leading-relaxed font-outfit">{value || '---'}</span>
                      </td>
                    );
                  })}
                  {!columns.includes('Outcome') && (
                    <td className="py-3 px-4 glass-euphoria first:rounded-l-xl last:rounded-r-xl border-y border-white/5 first:border-l last:border-r text-right">
                      <div className="flex items-center justify-end gap-3">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const issueTitle = row.issue || row.message || row.link || "this issue";
                            onAskAI(`Analyze this finding from the report: ${issueTitle}`, reportId);
                          }}
                          className="px-3 py-1.5 bg-primary/10 hover:bg-primary text-white rounded-lg text-[9px] font-black uppercase tracking-widest border border-primary/30 transition-all flex items-center gap-2 shadow-neon group"
                        >
                          <Cpu size={12} className="group-hover:rotate-12 transition-transform" /> Ask AI
                        </button>
                        {row.suggestedFix && (
                          <button
                            onClick={(e) => { e.stopPropagation(); setRemediationCode(row.suggestedFix); }}
                            className="px-3 py-1.5 bg-eu-accent/10 hover:bg-eu-accent text-white rounded-lg text-[9px] font-black uppercase tracking-widest border border-eu-accent/30 transition-all flex items-center gap-2 shadow-neon"
                          >
                            <Code size={12} /> Patch
                          </button>
                        )}
                        <Plus size={14} className={`text-slate-600 transition-transform duration-500 ${isExpanded ? 'rotate-45 text-eu-accent' : ''}`} />
                      </div>
                    </td>
                  )}
                </tr>
                {isExpanded && (
                  <tr>
                    <td colSpan={(columns.length || 0) + 1} className="py-0 px-4">
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        className="overflow-hidden"
                      >
                        <div className="mb-4 mt-2 p-8 glass-euphoria rounded-[32px] border border-eu-accent/20 bg-eu-accent/5 flex flex-col md:flex-row gap-8 shadow-2xl relative">
                          <div className="absolute top-0 right-0 p-8 opacity-5">
                            <Zap size={64} className="text-eu-accent" />
                          </div>

                          <div className="flex-1 space-y-6">
                            {/* Test Case & Severity Header */}
                            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
                              <div className="flex items-center gap-3">
                                <div className="size-8 bg-indigo-50 dark:bg-indigo-950/60 rounded-lg flex items-center justify-center text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800">
                                  <Shield size={14} />
                                </div>
                                <div>
                                  <div className="flex items-center gap-2">
                                    {row.testCaseId && (
                                      <span className="px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 text-[10px] font-mono font-bold border border-indigo-200 dark:border-indigo-800 tracking-wider">
                                        {row.testCaseId}
                                      </span>
                                    )}
                                    <h4 className="text-sm font-bold uppercase tracking-wider text-slate-900 dark:text-white font-outfit">
                                      {row.type || 'Diagnostic Dossier'}
                                    </h4>
                                  </div>
                                  <p className="text-xs text-slate-600 dark:text-slate-400 font-medium mt-0.5">
                                    {row.issue || row.message || 'System diagnostic finding'}
                                  </p>
                                </div>
                              </div>
                              {row._occurrences > 1 && (
                                <span className="px-3 py-1 rounded-full bg-amber-50 border border-amber-300 text-amber-800 dark:bg-amber-950/50 dark:border-amber-700 dark:text-amber-300 text-[10px] font-bold uppercase tracking-wider">
                                  Occurrences: {row._occurrences}x ({row._affectedLocations?.length || 1} locations)
                                </span>
                              )}
                            </div>

                            {/* Expected vs Observed Behavior */}
                            {(row.expected || row.observed) && (
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 space-y-1.5">
                                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 font-outfit flex items-center gap-1.5">
                                    <CheckCircle2 size={13} /> Expected Behavior
                                  </span>
                                  <p className="text-xs text-slate-800 dark:text-slate-200 leading-relaxed font-medium">
                                    {row.expected || 'Target element should comply with standard UX, boundary validation, and security guidelines.'}
                                  </p>
                                </div>
                                <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 space-y-1.5">
                                  <span className="text-[10px] font-bold uppercase tracking-wider text-red-700 dark:text-red-400 font-outfit flex items-center gap-1.5">
                                    <AlertTriangle size={13} /> Actual Observed
                                  </span>
                                  <p className="text-xs text-slate-800 dark:text-slate-200 leading-relaxed font-medium">
                                    {row.observed || row.issue || row.message || 'Non-standard runtime, layout shift, or boundary failure observed.'}
                                  </p>
                                </div>
                              </div>
                            )}

                            {/* Root Cause & Technical Impact */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              <div className="space-y-1.5">
                                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 font-outfit">Root Cause</p>
                                <p className="text-xs text-slate-800 dark:text-slate-200 font-medium leading-relaxed italic bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg border border-slate-200 dark:border-slate-700">"{remediation.cause}"</p>
                              </div>
                              <div className="space-y-1.5">
                                <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 font-outfit">Security / UX / Performance Impact</p>
                                <p className="text-xs text-slate-800 dark:text-slate-200 font-medium leading-relaxed italic bg-indigo-50/50 dark:bg-indigo-950/30 p-3 rounded-lg border border-indigo-100 dark:border-indigo-900">"{remediation.impact}"</p>
                              </div>
                            </div>

                            {/* Reproduction Steps */}
                            <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
                              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 font-outfit">Steps to Reproduce</p>
                              <div className="space-y-1.5 text-xs text-slate-800 dark:text-slate-200 font-mono">
                                <div className="flex items-center gap-2">
                                  <span className="size-4 rounded-full bg-slate-200 dark:bg-slate-700 text-[10px] flex items-center justify-center font-bold text-slate-700 dark:text-slate-200">1</span>
                                  <span>Navigate to: <code className="text-indigo-600 dark:text-indigo-400 font-bold">{row.page || 'target URL'}</code></span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="size-4 rounded-full bg-slate-200 dark:bg-slate-700 text-[10px] flex items-center justify-center font-bold text-slate-700 dark:text-slate-200">2</span>
                                  <span>Locate target: <code className="text-slate-900 dark:text-white font-bold">{row.selector || row.location || row.form || 'viewport'}</code></span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="size-4 rounded-full bg-slate-200 dark:bg-slate-700 text-[10px] flex items-center justify-center font-bold text-slate-700 dark:text-slate-200">3</span>
                                  <span>Observe trigger / payload: <code className="text-amber-700 dark:text-amber-400 font-bold">{row.payload || row.method || 'Default boundary condition'}</code></span>
                                </div>
                              </div>
                            </div>

                            {/* Remediation Intelligence */}
                            <div className="p-4 bg-indigo-50/60 dark:bg-indigo-950/40 rounded-xl border border-indigo-100 dark:border-indigo-900">
                              <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-400 mb-1.5 font-outfit">Remediation Intelligence</p>
                              <p className="text-xs text-slate-800 dark:text-slate-200 font-medium leading-relaxed">{remediation.guide}</p>
                            </div>

                            {row.htmlSnippet && row.htmlSnippet !== 'UNAVAILABLE' && (
                              <div className="p-4 bg-slate-900 rounded-xl border border-slate-800 space-y-2">
                                <div className="flex items-center gap-2">
                                  <Code size={12} className="text-indigo-400" />
                                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Target Code Fragment</p>
                                </div>
                                <pre className="text-xs font-mono text-indigo-300 bg-slate-950 p-3 rounded-lg border border-slate-800 overflow-x-auto whitespace-pre-wrap break-all">
                                  <code>{row.htmlSnippet}</code>
                                </pre>
                              </div>
                            )}
                          </div>

                          {/* Protocol Actions Column */}
                          <div className="w-full md:w-64 space-y-4 shrink-0">
                            <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700">
                              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-3 text-center">Senior QA Actions</p>
                              <div className="space-y-2">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const issueTitle = row.issue || row.message || 'Issue Detected';
                                    const testId = row.testCaseId ? `[${row.testCaseId}] ` : '';
                                    const jiraTicket = `### [BUG] ${testId}${issueTitle}\n- **Severity:** ${row.severity || 'Medium'}\n- **Test Case ID:** ${row.testCaseId || 'N/A'}\n- **URL:** ${row.page || 'N/A'}\n- **Selector/Element:** \`${row.selector || row.location || 'N/A'}\`\n- **Occurrences:** ${row._occurrences || 1}\n\n#### Steps to Reproduce:\n1. Open ${row.page || 'target URL'} in browser.\n2. Locate element \`${row.selector || row.location || 'target'}\`.\n3. Trigger condition / payload: \`${row.payload || 'Standard user flow'}\`.\n\n#### Expected Behavior:\n${row.expected || 'Element should comply with standard UX, boundary validation, and security guidelines.'}\n\n#### Actual Observed:\n${row.observed || row.issue || row.message}\n\n#### Root Cause:\n${remediation.cause}\n\n#### Impact:\n${remediation.impact}\n\n#### Recommended Fix:\n${remediation.guide}`;
                                    navigator.clipboard.writeText(jiraTicket);
                                    setCopiedTicketId(rowId);
                                    setTimeout(() => setCopiedTicketId(null), 2500);
                                  }}
                                  className="w-full py-2.5 bg-indigo-50 hover:bg-indigo-600 text-indigo-700 hover:text-white border border-indigo-200 dark:border-indigo-800 rounded-lg text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-sm"
                                >
                                  {copiedTicketId === rowId ? (
                                    <>
                                      <Check size={13} className="text-green-600 dark:text-green-400" /> Copied JIRA Ticket!
                                    </>
                                  ) : (
                                    <>
                                      <Copy size={13} /> Copy JIRA Bug Ticket
                                    </>
                                  )}
                                </button>
                                {row.suggestedFix && (
                                  <button
                                    onClick={() => setRemediationCode(row.suggestedFix)}
                                    className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold uppercase tracking-wider transition-all shadow-sm"
                                  >
                                    Apply Patch
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

const ReportDetail = ({ reportId, onBack, onRefresh, onReScan, onDeleted, confirm, prompt, setAlert, onAskAI }) => {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('summary');
  const [remediationCode, setRemediationCode] = useState(null);
  const [copied, setCopied] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [severityFilter, setSeverityFilter] = useState('all');

  const tabs = [
    { id: 'summary', label: 'Summary', icon: <Zap size={14} /> },
    { id: 'network', label: 'Network', icon: <Wifi size={14} />, count: report?.networkLogs?.length || 0 },
    { id: 'links', label: 'Links', icon: <ExternalLink size={14} />, count: report?.brokenLinks?.length || 0 },
    { id: 'console', label: 'Console', icon: <Terminal size={14} />, count: report?.consoleErrors?.length || 0 },
    { id: 'layout', label: 'UI/UX', icon: <Layout size={14} />, count: (report?.uiIssues?.length || 0) + (report?.responsiveIssues?.length || 0) },
    { id: 'accessibility', label: 'Accessibility', icon: <UserCheck size={14} />, count: report?.accessibilityIssues?.length || 0 },
    { id: 'security', label: 'Security', icon: <Shield size={14} className={report?.securityIssues?.length > 0 ? 'text-primary animate-pulse' : ''} />, count: report?.securityIssues?.length || 0 },
    { id: 'screenshots', label: 'Screens', icon: <Image size={14} />, count: report?.screenshots?.length || 0 },
    { id: 'forms', label: 'Forms', icon: <FormInput size={14} />, count: report?.formIssues?.length || 0 },
  ];

  // Auto-reset activeTab if current one is not in the tabs list (safety)
  useEffect(() => {
    const validIds = tabs.map(t => t.id);
    if (!validIds.includes(activeTab)) {
      setActiveTab('summary');
    }
  }, [activeTab]);

  const API_BASE = import.meta.env.VITE_API_URL || `${API_URL}`;

  useEffect(() => {
    let intervalId = null;

    const fetchReport = async () => {
      try {
        const response = await axios.get(`${API_BASE}/api/report/${reportId}`);
        const data = response.data;
        setReport(data);

        // If scan is done, stop polling and trigger parent refresh
        if (data.status === 'completed' || data.status === 'failed') {
          if (intervalId) clearInterval(intervalId);
          // NEW: Only trigger refresh once per completion state change
          if (onRefresh && report?.status === 'in-progress') onRefresh();
        }
      } catch (error) {
        console.error('Failed to fetch report', error);
        if (intervalId) clearInterval(intervalId);
      } finally {
        setLoading(false);
      }
    };

    // Initial fetch
    fetchReport();

    // Poll every 4 seconds (will auto-stop once status is 'completed' or 'failed')
    intervalId = setInterval(fetchReport, 4000);

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [reportId]);

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-32 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm">
      <Loader2 className="animate-spin text-indigo-600 dark:text-indigo-400 mb-4" size={36} />
      <p className="text-slate-700 dark:text-slate-300 font-bold uppercase tracking-wider text-xs">Loading diagnostic report...</p>
    </div>
  );

  if (!report) return (
    <div className="bg-white dark:bg-slate-900 p-16 text-center rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
      <AlertTriangle className="text-amber-500 mx-auto mb-4" size={40} />
      <h3 className="text-xl font-bold mb-2 text-slate-900 dark:text-white">Report Not Found</h3>
      <p className="text-slate-600 dark:text-slate-400 text-sm max-w-md mx-auto">The requested inspection log does not exist or has been removed from the database.</p>
      <button onClick={onBack} className="mt-6 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold uppercase tracking-wider flex items-center gap-2 mx-auto shadow-sm">
        <ChevronLeft size={16} /> Return to Dashboard
      </button>
    </div>
  );

  const calculateHealth = () => {
    if (!report) return 100;
    const weights = {
      network: 0.5,
      links: 10,
      console: 2,
      layout: 5,
      accessibility: 15,
      forms: 10,
      security: 10,
    };
    const deductions = tabs.reduce((acc, curr) => {
      const weight = weights[curr.id] || 0;
      // FIX: Ensure curr.count is numeric before multiplication to avoid NaN
      const count = curr.count || 0;
      return acc + (count * weight);
    }, 0);
    return Math.max(0, Math.round(100 - deductions));
  };

  const healthScore = calculateHealth();

  return (
    <div className="space-y-8 pb-16">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
        <div className="flex items-center gap-5">
          <button onClick={onBack} className="size-11 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 shadow-sm flex items-center justify-center transition-all group">
            <ChevronLeft size={20} className="group-hover:-translate-x-0.5 transition-transform" />
          </button>
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white font-outfit tracking-tight">
                {(() => {
                  try {
                    return new URL(report.url).hostname;
                  } catch (e) {
                    return report.url || 'Sentinel Target';
                  }
                })()}
              </h2>
              <span className="px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider border bg-indigo-50 border-indigo-200 text-indigo-700 dark:bg-indigo-950 dark:border-indigo-800 dark:text-indigo-300">
                {report.status}
              </span>
              {(report.securityIssues?.length > 0) && (
                <span className="px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider border bg-rose-50 border-rose-200 text-rose-700 dark:bg-rose-950 dark:border-rose-800 dark:text-rose-300">
                  SECURITY ALERT
                </span>
              )}
            </div>
            <div className="mt-2 flex flex-row items-center gap-4">
              <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                <Database size={12} className="text-indigo-600 dark:text-indigo-400" /> LOG_{report._id.toString().slice(-8).toUpperCase()}
              </div>
              <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                <span>//</span> {new Date(report.createdAt).toLocaleDateString('en-GB')}
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2.5 w-full lg:w-auto overflow-x-auto pb-1 lg:pb-0 no-scrollbar">
          {/* Action Hub */}
          <button
            onClick={async () => {
              const confirmed = await confirm({
                title: "Log Purge Protocol",
                message: "This action will permanently remove this diagnostic log from the neural index. This cannot be undone.",
                confirmText: "Purge Log",
                type: "danger"
              });
              if (confirmed) {
                try {
                  await axios.delete(`${API_BASE}/api/report/${reportId}`);
                  if (onDeleted) onDeleted();
                  else onBack();
                  setAlert({ type: 'success', message: 'Diagnostic log deleted successfully.' });
                }
                catch (e) { setAlert({ type: 'error', message: 'Delete failed. Server unreachable.' }); }
              }
            }}
            className="flex-none flex items-center justify-center gap-1.5 bg-rose-50 hover:bg-rose-100 border border-rose-200 dark:bg-rose-950/40 dark:border-rose-800 text-rose-700 dark:text-rose-300 px-3.5 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all"
          >
            <Trash2 size={12} /> Delete
          </button>

          <button
            onClick={async () => {
              try {
                const res = await axios.get(`${API_BASE}/api/report/${reportId}/export`);
                if (res.data.url) window.open(`${API_BASE}${res.data.url}`, '_blank');
              } catch (e) { setAlert({ type: 'error', message: 'PDF export protocol failed.' }); }
            }}
            className="flex-none flex items-center justify-center gap-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-200 dark:bg-slate-800 dark:border-slate-700 text-slate-800 dark:text-white px-3.5 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all"
          >
            <BarChart3 size={12} /> Export PDF
          </button>

          <button
            onClick={async () => {
              const confirmed = await confirm({
                title: "Rescan Protocol",
                message: "This will launch a fresh diagnostic trace using your current configuration. Previous data remains archived in comparison logs.",
                confirmText: "Execute Rescan",
                type: "info"
              });
              if (confirmed && onReScan) {
                onReScan(report.url, reportId);
              }
            }}
            className="flex-none flex items-center justify-center gap-1.5 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 dark:bg-indigo-950/60 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 px-3.5 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all"
          >
            <Zap size={12} /> Rescan
          </button>

          <a
            href={report.url} target="_blank" rel="noreferrer"
            className="flex-none flex items-center justify-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all text-white shadow-sm"
          >
            Open Target <ExternalLink size={12} />
          </a>
        </div>
      </div>

      {/* --- Premium Navigation Grid --- */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-4 px-6 md:px-0">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex flex-col items-center justify-center gap-3 p-5 rounded-[32px] transition-all duration-700 group relative w-full aspect-square border-0 overflow-hidden nav-card-premium ${activeTab === tab.id ? 'active scale-105 z-20' : 'hover:scale-102 z-10'
              }`}
          >
            {/* Background Accent Glow */}
            {activeTab === tab.id && (
              <div className="absolute inset-0 bg-gradient-to-br from-eu-accent/10 to-eu-accent-violet/10 opacity-50" />
            )}

            {/* Icon Container */}
            <div className={`size-11 rounded-xl flex items-center justify-center transition-all duration-300 relative z-10 ${activeTab === tab.id
                ? 'bg-indigo-600 text-white shadow-sm scale-105'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 group-hover:bg-slate-200/80 group-hover:text-slate-900'
              }`}>
              {tab.icon}
            </div>

            {/* Label & Status Hub */}
            <div className="text-center relative z-10 mt-1">
              <p className={`text-[10px] font-bold uppercase tracking-wider mb-2 transition-all ${activeTab === tab.id ? 'text-indigo-600 dark:text-indigo-400 font-extrabold' : 'text-slate-700 dark:text-slate-300 group-hover:text-slate-900'
                }`}>
                {tab.label}
              </p>

              {tab.count !== undefined && (
                <div className={`inline-flex items-center justify-center px-2 py-0.5 rounded-md text-xs font-bold border ${activeTab === tab.id ? 'bg-indigo-50 border-indigo-200 text-indigo-700 dark:bg-indigo-950 dark:border-indigo-800 dark:text-indigo-300' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'}`}>
                  <span>
                    {tab.count < 10 ? `0${tab.count}` : tab.count}
                  </span>
                </div>
              )}
            </div>

            {/* Selection indicator */}
            {activeTab === tab.id && (
              <motion.div
                layoutId="active-nav-glow"
                className="absolute inset-x-0 bottom-0 h-1 bg-indigo-600 shadow-sm"
              />
            )}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-12">
        <AnimatePresence mode="wait">
          {activeTab === 'summary' && (
            <motion.div key="summary" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }} className="space-y-16">

              {/* ── Scan In Progress Banner ── */}
              {report.status !== 'completed' && (
                <motion.div animate={{ opacity: [0.8, 1, 0.8] }} transition={{ duration: 2, repeat: Infinity }} className="flex items-center gap-5 p-6 rounded-2xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50/70 dark:bg-indigo-950/40 shadow-sm">
                  <Loader2 size={24} className="text-indigo-600 dark:text-indigo-400 animate-spin shrink-0" />
                  <div>
                    <p className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider font-outfit">Active Diagnostic Crawl</p>
                    <p className="text-xs text-slate-700 dark:text-slate-300 mt-0.5 font-medium">Sentinel AI is traversing the DOM tree and harvesting diagnostic signatures. Data streams in real-time.</p>
                  </div>
                  <div className="ml-auto px-3 py-1 rounded-lg bg-indigo-100 dark:bg-indigo-900/60 border border-indigo-200 dark:border-indigo-800 text-[10px] font-bold text-indigo-700 dark:text-indigo-300 uppercase tracking-wider font-outfit">Status: {report.status}</div>
                </motion.div>
              )}

              {/* ── Neural Analysis Hub (AI Insights) ── */}
              {report.aiInsights ? (
                <div className="relative group overflow-hidden rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm p-6 md:p-10">
                  <div className="flex flex-col md:flex-row gap-6 items-start md:items-center mb-8 pb-8 border-b border-slate-200 dark:border-slate-800">
                    <div className="relative shrink-0 p-5 bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 rounded-2xl text-indigo-600 dark:text-indigo-400">
                      <Cpu size={40} className="animate-pulse" />
                    </div>
                    <div className="flex-1 space-y-3">
                      <div className="flex flex-wrap items-center gap-3">
                        <div className="px-3 py-1 bg-indigo-600 text-[10px] font-bold uppercase tracking-wider rounded-lg text-white font-outfit">Autonomous QA Audit</div>
                        {report.aiInsights?.qaVerdict && (
                          <div className={`px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider font-outfit border ${
                            report.aiInsights.qaVerdict.includes('BLOCK') 
                              ? 'bg-rose-50 border-rose-200 text-rose-700 dark:bg-rose-950/50 dark:border-rose-800 dark:text-rose-300'
                              : report.aiInsights.qaVerdict.includes('CONDITIONAL')
                              ? 'bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-950/50 dark:border-amber-800 dark:text-amber-300'
                              : 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-950/50 dark:border-emerald-800 dark:text-emerald-300'
                          }`}>
                            {report.aiInsights.qaVerdict.includes('BLOCK') ? '🛑' : report.aiInsights.qaVerdict.includes('CONDITIONAL') ? '⚠️' : '✅'} Verdict: {report.aiInsights.qaVerdict}
                          </div>
                        )}
                        <div className="px-3 py-1 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[10px] font-bold uppercase tracking-wider rounded-lg text-slate-700 dark:text-slate-300 font-outfit">{report.url}</div>
                      </div>

                      {/* ── Autonomous QA Test Suite Coverage Matrix ── */}
                      <div className="flex flex-wrap items-center gap-2 pt-1 pb-1">
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 font-outfit">Coverage:</span>
                        <span className="px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-800 dark:text-slate-200">📱 Viewports (375px/768px/1280px)</span>
                        <span className="px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-800 dark:text-slate-200">🛡️ Fuzzing & Boundaries</span>
                        <span className="px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-800 dark:text-slate-200">⚡ Dead-Clicks & Crashes</span>
                        <span className="px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-800 dark:text-slate-200">🔐 Storage & Secret Sniffer</span>
                        <span className="px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-800 dark:text-slate-200">🚀 Asset & DOM Bloat</span>
                      </div>

                      <h3 className="text-2xl md:text-3xl font-black tracking-tight text-slate-900 dark:text-white leading-tight font-outfit">
                        {report.status === 'completed' ? 'Diagnostic Analysis Summary' : report.status === 'in-progress' ? 'Analysis in Progress' : report.aiInsights?.classification || 'Standard Execution State'}
                      </h3>
                      <p className="text-slate-700 dark:text-slate-300 text-base md:text-lg leading-relaxed font-normal">
                        "{report.aiInsights.summary || 'Scan data is being synthesized into narrative insights...'}"
                      </p>
                    </div>
                  </div>

                  <div className="space-y-6">
                    {/* Issue Cards */}
                    {report.aiInsights.issues?.length > 0 ? (
                      <div className="space-y-6">
                        <div className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2 pb-3 border-b border-slate-200 dark:border-slate-800 font-outfit">
                          <AlertTriangle size={15} className="text-amber-500" /> {report.aiInsights.issues.length} Critical Deviations Detected
                        </div>
                        <div className="grid grid-cols-1 gap-4">
                          {report.aiInsights.issues.map((issue, idx) => {
                            const isCrit = issue.severity === 'Critical';
                            const isHigh = issue.severity === 'High';
                            const isMed = issue.severity === 'Medium';
                            return (
                              <div key={idx} className="border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 rounded-xl p-5 md:p-6 space-y-4 hover:border-indigo-300 dark:hover:border-indigo-700 transition-all">
                                <div className="flex flex-wrap items-center justify-between gap-3">
                                  <div className="flex items-center gap-3">
                                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-md border ${
                                      isCrit ? 'bg-rose-50 border-rose-200 text-rose-700 dark:bg-rose-950/50 dark:border-rose-800 dark:text-rose-300' :
                                      isHigh ? 'bg-orange-50 border-orange-200 text-orange-700 dark:bg-orange-950/50 dark:border-orange-800 dark:text-orange-300' :
                                      isMed ? 'bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-950/50 dark:border-amber-800 dark:text-amber-300' :
                                      'bg-slate-100 border-slate-200 text-slate-700 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-300'
                                    }`}>
                                      {issue.severity}
                                    </span>
                                    <h4 className="text-base font-bold text-slate-900 dark:text-white font-outfit">{issue.title || issue.issue}</h4>
                                  </div>
                                  <span className="text-xs text-slate-600 dark:text-slate-400 font-medium">Source: {issue.source === 'local' ? 'Neural Cache' : 'AI Diagnostic'}</span>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  <div className="space-y-1">
                                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 font-outfit">Issue Signature</p>
                                    <p className="text-xs text-slate-800 dark:text-slate-200 leading-relaxed font-medium">{issue.issue}</p>
                                  </div>
                                  <div className="space-y-1">
                                    <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 font-outfit">Root Cause</p>
                                    <p className="text-xs text-slate-800 dark:text-slate-200 leading-relaxed font-medium">{issue.reason}</p>
                                  </div>
                                </div>

                                {issue.fix?.length > 0 && (
                                  <div className="p-4 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 space-y-2">
                                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 font-outfit flex items-center gap-1.5">
                                      <Terminal size={12} className="text-indigo-600 dark:text-indigo-400" /> Remediation Steps
                                    </p>
                                    <div className="space-y-1.5">
                                      {issue.fix.map((step, sIdx) => (
                                        <div key={sIdx} className="flex gap-2 items-start text-xs text-slate-800 dark:text-slate-200 font-medium">
                                          <span className="size-4 shrink-0 rounded bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-bold text-[10px] flex items-center justify-center mt-0.5">{sIdx + 1}</span>
                                          <span>{step}</span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
                                  {issue.remediationCode && (
                                    <button
                                      onClick={() => setRemediationCode(issue.remediationCode)}
                                      className="py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-sm font-outfit"
                                    >
                                      <Code size={14} /> View Patch Code
                                    </button>
                                  )}
                                  <button
                                    onClick={() => onAskAI(`Deep dive into this ${issue.severity} finding: ${issue.title || issue.issue}. Give me a detailed remediation plan.`, reportId)}
                                    className="py-2.5 px-4 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all font-outfit"
                                  >
                                    <Bot size={14} /> Ask AI Assistant
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-4 p-6 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800">
                        <CheckCircle2 size={24} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
                        <div>
                          <p className="text-base font-bold text-slate-900 dark:text-white font-outfit">Platform Integrity Confirmed</p>
                          <p className="text-xs text-slate-700 dark:text-slate-300 mt-0.5 font-medium">Sentinel AI has verified all nodes. No deviations from standard QA protocols were detected.</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* ── Autonomous Performance Booster Playbook ── */}
                  {report.aiInsights?.performancePlaybook?.length > 0 && (
                    <div className="mt-8 pt-6 border-t border-slate-200 dark:border-slate-800 space-y-3">
                      <div className="flex items-center gap-2.5">
                        <div className="p-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400">
                          <Zap size={14} />
                        </div>
                        <div>
                          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white font-outfit">
                            Performance Booster Playbook
                          </h4>
                          <p className="text-[11px] text-slate-600 dark:text-slate-400 font-medium">
                            Architectural roadmap to optimize Core Web Vitals (FCP, LCP, CLS) & throughput
                          </p>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {report.aiInsights.performancePlaybook.map((step, sIdx) => (
                          <div key={sIdx} className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-start gap-3">
                            <span className="size-5 rounded bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-300 text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                              {sIdx + 1}
                            </span>
                            <p className="text-xs text-slate-800 dark:text-slate-200 font-medium leading-relaxed">
                              {step}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex gap-8 pt-6 border-t border-slate-200 dark:border-slate-800 mt-8">
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider font-outfit">Analysis Engine</span>
                      <span className="text-xs font-bold text-indigo-700 dark:text-indigo-400 font-outfit">GPT-4.1 Diagnostic Engine</span>
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider font-outfit">Coverage Nodes</span>
                      <span className="text-xs font-bold text-slate-900 dark:text-white font-outfit">{report.pagesCrawled || 1} Pages Scanned</span>
                    </div>
                  </div>
                </div>
              ) : report.status === 'completed' ? (
                <div className="flex items-center gap-6 p-8 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
                  <div className="size-12 bg-slate-100 dark:bg-slate-800 rounded-xl flex items-center justify-center text-slate-500"><Cpu size={24} /></div>
                  <div>
                    <p className="text-base font-bold text-slate-900 dark:text-white font-outfit">AI Insights Offline</p>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5 font-medium">Cognitive analysis is currently unavailable. Ensure the neural key (API_KEY) is valid in the server config.</p>
                  </div>
                </div>
              ) : null}

              {/* ── Quick Stats Grid (Optimized) ── */}
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                <StatCard label="Neural Latency" value={`${report.performanceMetrics?.loadTime?.toFixed(0) || 0} ms`} color="text-indigo-600 dark:text-indigo-400" icon={<Zap size={22} />} />
                <StatCard label="Data Packets" value={report.performanceMetrics?.requestCount || 0} color="text-slate-900 dark:text-white" icon={<Wifi size={22} />} />
                <StatCard label="Crawl Depth" value={report.pagesCrawled || 0} color="text-indigo-600 dark:text-indigo-400" icon={<ExternalLink size={22} />} />
              </div>

              {/* ── Lighthouse Performance Matrix ── */}
              {report.lighthouseScores && (
                <div className="bg-white dark:bg-slate-900 p-8 md:p-10 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden">
                  <div className="flex flex-col md:flex-row items-center justify-between gap-8">
                    <div className="max-w-xs space-y-2">
                      <h3 className="text-2xl font-black uppercase tracking-tight text-slate-900 dark:text-white font-outfit">Lighthouse <span className="text-indigo-600 dark:text-indigo-400">Scores</span></h3>
                      <p className="text-slate-600 dark:text-slate-400 text-xs font-medium leading-relaxed">Chrome DevTools diagnostic scores synchronized via automated crawl protocols.</p>
                    </div>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 md:gap-14">
                      <LighthouseCircle label="Performance" score={report.lighthouseScores.performance} delta={report.comparison?.lighthouseDelta?.performance} />
                      <LighthouseCircle label="SEO" score={report.lighthouseScores.seo} delta={report.comparison?.lighthouseDelta?.seo} />
                      <LighthouseCircle label="Best Practices" score={report.lighthouseScores.bestPractices} delta={report.comparison?.lighthouseDelta?.bestPractices} />
                      <LighthouseCircle label="Accessibility" score={report.lighthouseScores.accessibility} delta={report.comparison?.lighthouseDelta?.accessibility} />
                    </div>
                  </div>
                </div>
              )}

              {/* ── Delta Comparison Panel ── */}
              {report.comparison?.previousReportId && (
                <div className="bg-white dark:bg-slate-900 p-8 md:p-10 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden">
                  <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2.5">
                        <div className="size-8 bg-indigo-50 dark:bg-indigo-950/60 rounded-lg flex items-center justify-center border border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400">
                          <Activity size={14} />
                        </div>
                        <h3 className="text-lg font-black uppercase tracking-tight text-slate-900 dark:text-white font-outfit">
                          Scan Comparison <span className="text-indigo-600 dark:text-indigo-400">Delta</span>
                        </h3>
                      </div>
                      <p className="text-slate-600 dark:text-slate-400 text-xs font-medium">Comparison against your previous scan of this target.</p>
                    </div>
                    <span className={`px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider border ${report.comparison.stats.impact === 'Improved'
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-950/50 dark:border-emerald-800 dark:text-emerald-300'
                        : report.comparison.stats.impact === 'Regressed'
                          ? 'bg-rose-50 border-rose-200 text-rose-700 dark:bg-rose-950/50 dark:border-rose-800 dark:text-rose-300'
                          : 'bg-slate-100 border-slate-200 text-slate-700 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300'
                      }`}>
                      {report.comparison.stats.impact === 'Improved' ? '↑' : report.comparison.stats.impact === 'Regressed' ? '↓' : '→'} {report.comparison.stats.impact}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-xl border border-slate-200 dark:border-slate-700 text-center space-y-1">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">Health Score</p>
                      <p className={`text-2xl font-black font-outfit ${report.comparison.scoreDelta >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {report.comparison.scoreDelta >= 0 ? '+' : ''}{report.comparison.scoreDelta}
                      </p>
                      <p className="text-[10px] text-slate-600 dark:text-slate-400 font-medium">pts</p>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-xl border border-rose-200 dark:border-rose-800 text-center space-y-1">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-rose-700 dark:text-rose-400">New Errors</p>
                      <p className="text-2xl font-black font-outfit text-rose-600">{report.comparison.stats.newErrors}</p>
                      <p className="text-[10px] text-slate-600 dark:text-slate-400 font-medium">introduced</p>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-xl border border-emerald-200 dark:border-emerald-800 text-center space-y-1">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">Fixed Errors</p>
                      <p className="text-2xl font-black font-outfit text-emerald-600">{report.comparison.stats.fixedErrors}</p>
                      <p className="text-[10px] text-slate-600 dark:text-slate-400 font-medium">resolved</p>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-xl border border-slate-200 dark:border-slate-700 text-center space-y-1">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">Performance</p>
                      <p className={`text-2xl font-black font-outfit ${(report.comparison.lighthouseDelta?.performance || 0) >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {(report.comparison.lighthouseDelta?.performance || 0) >= 0 ? '+' : ''}{report.comparison.lighthouseDelta?.performance || 0}
                      </p>
                      <p className="text-[10px] text-slate-600 dark:text-slate-400 font-medium">lighthouse pts</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3 mt-4">
                    {[
                      { label: 'SEO', val: report.comparison.lighthouseDelta?.seo || 0 },
                      { label: 'Accessibility', val: report.comparison.lighthouseDelta?.accessibility || 0 },
                      { label: 'Best Practices', val: report.comparison.lighthouseDelta?.bestPractices || 0 },
                    ].map(({ label, val }) => (
                      <div key={label} className="bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">{label}</p>
                        <p className={`text-base font-black font-outfit ${val >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {val >= 0 ? '+' : ''}{val}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </motion.div>
          )}

          {activeTab !== 'summary' && activeTab !== 'screenshots' && (
            <motion.div key="table" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm p-6 rounded-2xl overflow-hidden space-y-4">
              <SectionHeader
                title={tabs.find(t => t.id === activeTab)?.label || 'Diagnostic'}
                icon={tabs.find(t => t.id === activeTab)?.icon || <Activity size={14} />}
              />

              {/* Industry Telemetry Search & Triage Bar */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl">
                <div className="relative flex-1">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={`Search ${tabs.find(t => t.id === activeTab)?.label || 'findings'} by URL, status, or keyword...`}
                    className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg pl-9 pr-4 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-medium"
                  />
                  {searchQuery && (
                    <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-white text-xs">
                      <X size={12} />
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                  <span className="text-[10px] font-bold uppercase text-slate-600 dark:text-slate-400 mr-1 tracking-wider">Filter:</span>
                  {(() => {
                    const currentTabItems = getTabData(report, activeTab) || [];
                    const counts = {
                      all: currentTabItems.length,
                      critical: currentTabItems.filter(i => (i.severity || i.type || '').toString().toLowerCase().includes('crit')).length,
                      high: currentTabItems.filter(i => (i.severity || i.type || '').toString().toLowerCase().includes('high')).length,
                      medium: currentTabItems.filter(i => (i.severity || i.type || '').toString().toLowerCase().includes('med')).length,
                      low: currentTabItems.filter(i => (i.severity || i.type || '').toString().toLowerCase().includes('low') || (i.severity || i.type || '').toString().toLowerCase().includes('info')).length,
                    };

                    return ['all', 'critical', 'high', 'medium', 'low'].map(sev => {
                      const count = counts[sev] || 0;
                      return (
                        <button
                          key={sev}
                          onClick={() => setSeverityFilter(sev)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 ${
                            severityFilter === sev
                              ? 'bg-indigo-600 text-white shadow-sm'
                              : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-700'
                          }`}
                        >
                          <span>{sev}</span>
                          <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${severityFilter === sev ? 'bg-white/20 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300'}`}>
                            {count}
                          </span>
                        </button>
                      );
                    });
                  })()}
                </div>
              </div>

              <IssueTable
                data={(() => {
                  let raw = getTabData(report, activeTab) || [];
                  if (severityFilter !== 'all') {
                    raw = raw.filter(item => {
                      const sev = (item.severity || item.type || item.level || item.status || '').toString().toLowerCase();
                      return sev.includes(severityFilter.toLowerCase());
                    });
                  }
                  if (searchQuery && searchQuery.trim()) {
                    const q = searchQuery.toLowerCase().trim();
                    raw = raw.filter(item => JSON.stringify(item).toLowerCase().includes(q));
                  }
                  return raw;
                })()}
                columns={getTableColumns(activeTab)}
                setRemediationCode={setRemediationCode}
                onAskAI={onAskAI}
                reportId={reportId}
              />
            </motion.div>
          )}

          {activeTab === 'screenshots' && (
            <motion.div key="screenshots" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {(report.screenshots || []).map((s, i) => {
                const pageIssues = getAllIssuesForPage(report, s.page);
                return (
                  <div key={i} className="group bg-white dark:bg-slate-900 p-3 rounded-xl space-y-3 border border-slate-200 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-700 transition-all shadow-sm">
                    <div className="aspect-video overflow-hidden rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 relative cursor-pointer" onClick={() => setPreviewImage(s)}>
                      <img src={`${API_BASE}${s.path}`} alt={s.page} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-3">
                        <div className="flex gap-2 mb-1">
                          {pageIssues.length > 0 && <span className="px-2 py-0.5 rounded bg-rose-600 text-[10px] font-bold text-white">{pageIssues.length} ISSUES FOUND</span>}
                        </div>
                        <p className="text-xs font-bold text-white truncate">{s.page}</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between px-1">
                      <div className="space-y-0.5 min-w-0">
                        <p className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider font-outfit">{s.type}</p>
                        <p className="text-xs font-bold text-slate-900 dark:text-white truncate max-w-[150px] font-outfit">
                          {(() => {
                            try {
                              return new URL(s.page).pathname;
                            } catch (e) {
                              return s.page || 'Root';
                            }
                          })()}
                        </p>
                      </div>
                      <button
                        onClick={() => setPreviewImage(s)}
                        className="size-8 bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 rounded-lg flex items-center justify-center text-slate-700 hover:text-indigo-600 dark:text-slate-300 dark:hover:text-indigo-400 transition-all border border-slate-200 dark:border-slate-700"
                      >
                        <Sparkles size={13} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Image Preview Modal ── */}
      {previewImage && createPortal(
        <AnimatePresence>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[999] bg-slate-950/70 backdrop-blur-md flex items-center justify-center p-4 md:p-8"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              onClick={e => e.stopPropagation()}
              className="relative w-full max-w-6xl h-[85vh] bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col md:flex-row overflow-hidden"
            >
              {/* Left Side: Visual Context */}
              <div className="flex-[3] relative bg-slate-100 dark:bg-slate-950 border-r border-slate-200 dark:border-slate-800 overflow-hidden flex items-center justify-center group p-4">
                <img src={`${API_BASE}${previewImage.path}`} alt="Diagnostic Preview" className="max-w-full max-h-full object-contain rounded-lg shadow-md" />
                <div className="absolute top-4 left-4 flex items-center gap-2">
                  <div className="px-3 py-1 bg-indigo-600 text-white text-[11px] font-bold uppercase tracking-wider rounded-lg shadow-sm">Diagnostic Snapshot</div>
                  <div className="px-3 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold rounded-lg shadow-sm">{previewImage.page}</div>
                </div>
                <button onClick={() => setPreviewImage(null)} className="absolute top-4 right-4 size-9 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-lg flex items-center justify-center text-slate-700 dark:text-slate-200 shadow-sm transition-all">
                  <X size={18} />
                </button>
              </div>

              {/* Right Side: Tactical Error Feed */}
              <div className="flex-[2] flex flex-col h-full bg-slate-50 dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800">
                <div className="p-6 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                  <div className="flex items-center gap-2.5 mb-1">
                    <Activity size={16} className="text-indigo-600 dark:text-indigo-400" />
                    <h3 className="text-base font-bold text-slate-900 dark:text-white font-outfit">Visual Audit Findings</h3>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-400 font-medium">{getAllIssuesForPage(report, previewImage.page).length} issues aligned to this view</p>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {getAllIssuesForPage(report, previewImage.page).length > 0 ? (
                    getAllIssuesForPage(report, previewImage.page).map((issue, idx) => (
                      <div key={idx} className="p-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                            {issue._source}
                          </span>
                          {issue.severity && (
                            <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                              issue.severity === 'High' || issue.severity === 'Critical' ? 'bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950 dark:text-rose-300' : 'bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950 dark:text-amber-300'
                            }`}>
                              {issue.severity}
                            </span>
                          )}
                        </div>
                        <p className="text-xs font-bold text-slate-900 dark:text-white leading-relaxed">{issue.message || issue.issue || issue.status + ' ' + (issue.type || 'Error')}</p>
                        {issue.recommendation && (
                          <p className="text-xs text-slate-700 dark:text-slate-300 font-medium leading-relaxed">Fix: {issue.recommendation}</p>
                        )}
                        {issue.url && <p className="text-[10px] text-indigo-600 dark:text-indigo-400 font-mono truncate">{issue.url}</p>}
                      </div>
                    ))
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-500">
                      <CheckCircle2 size={36} className="mb-2 text-emerald-500" />
                      <p className="text-xs font-medium">No specific issues logged for this capture.</p>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        </AnimatePresence>,
        document.body
      )}

      {/* Remediation Modal */}
      {remediationCode && createPortal(
        <AnimatePresence>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[999] flex items-center justify-center p-4 sm:p-8 bg-slate-950/70 backdrop-blur-md"
            onClick={() => setRemediationCode(null)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}
              className="w-full max-w-3xl bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                <div className="flex items-center gap-3">
                  <div className="size-9 bg-indigo-50 dark:bg-indigo-950/60 rounded-lg flex items-center justify-center text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800"><Code size={18} /></div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white font-outfit">AI Recommended Patch</h3>
                    <p className="text-xs text-slate-600 dark:text-slate-400 font-medium">Automated resolution code snippet</p>
                  </div>
                </div>
                <button onClick={() => setRemediationCode(null)} className="size-8 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-white flex items-center justify-center transition-all">
                  <X size={18} />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300 font-outfit"><Terminal size={14} className="text-indigo-600 dark:text-indigo-400" /> Proposed Implementation</div>
                  <button
                    onClick={() => { navigator.clipboard.writeText(remediationCode); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
                    className="flex items-center gap-2 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold uppercase tracking-wider transition-all shadow-sm"
                  >
                    {copied ? <Check size={13} /> : <Copy size={13} />} {copied ? 'Copied!' : 'Copy Code'}
                  </button>
                </div>
                <div className="max-h-[400px] overflow-y-auto bg-slate-950 rounded-xl border border-slate-800 p-4 sm:p-5">
                  <pre className="text-xs sm:text-sm font-mono text-indigo-300 leading-relaxed whitespace-pre-wrap">{remediationCode}</pre>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
};

export default ReportDetail;
