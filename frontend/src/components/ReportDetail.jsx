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
  <div className="glass-euphoria p-4 rounded-2xl border-[var(--eu-glass-border)] relative overflow-hidden group">
    <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-20 transition-all duration-700 group-hover:scale-110">{icon}</div>
    <p className="text-[9px] text-[var(--eu-text-main)] opacity-40 font-black uppercase tracking-[0.2em] mb-2">{label}</p>
    <p className={`text-2xl font-black ${color} tracking-tight font-outfit`}>{value}</p>
  </div>
);

const SectionHeader = ({ title, icon }) => (
  <div className="flex items-center gap-4 mb-6">
    <div className="size-10 bg-eu-accent/20 rounded-xl flex items-center justify-center border border-eu-accent/20 shadow-neon text-eu-accent">{icon}</div>
    <h3 className="text-xl font-black uppercase tracking-tight font-outfit text-[var(--eu-text-main)]">{title} <span className="text-eu-accent italic">Analysis</span></h3>
  </div>
);

const RecommendationCard = ({ title, status, icon, description, statusColor }) => (
  <div className="glass-euphoria p-5 rounded-2xl border-[var(--eu-glass-border)] group hover:border-eu-accent/30 transition-all duration-700 hover:translate-y-[-4px]">
    <div className="flex items-start justify-between mb-6">
      <div className="size-12 bg-[var(--eu-bg-void)]/80 rounded-xl flex items-center justify-center text-[var(--eu-text-main)] opacity-40 group-hover:bg-eu-accent/20 group-hover:text-eu-accent transition-all duration-700 shadow-inner group-hover:shadow-neon text-right">{icon}</div>
      <span className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border ${statusColor} shadow-neon`}>{status}</span>
    </div>
    <h4 className="text-lg font-black text-[var(--eu-text-main)] mb-2 uppercase tracking-tight font-outfit">{title}</h4>
    <p className="text-[var(--eu-text-main)] opacity-40 text-xs leading-relaxed font-medium">{description}</p>
  </div>
);

const LighthouseCircle = ({ label, score, delta }) => {
  const getScoreColor = (s) => {
    if (s >= 90) return 'text-green-500 stroke-green-500';
    if (s >= 50) return 'text-yellow-500 stroke-yellow-500';
    return 'text-primary stroke-primary';
  };
  const radius = 32;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (score / 100) * circumference;
  return (
    <div className="flex flex-col items-center gap-4 group">
      <div className="relative w-20 h-20">
        <svg className="w-full h-full transform -rotate-90 filter drop-shadow-[0_0_10px_rgba(var(--eu-accent-rgb),0.3)]">
          <circle cx="50%" cy="50%" r={radius} fill="transparent" stroke="currentColor" strokeWidth="4" className="text-white/5" />
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
        <span className="text-[9px] font-black uppercase tracking-[0.2em] text-[var(--eu-text-main)] opacity-40 group-hover:opacity-100 transition-opacity">{label}</span>
      </div>
      {/* Comparison Delta */}
      {delta !== undefined && delta !== 0 && (
        <div className={`mt-2 flex items-center justify-center gap-1 font-black text-[10px] uppercase shadow-neon-soft px-3 py-1 rounded-lg border ${delta > 0 ? 'text-green-500 border-green-500/20 bg-green-500/5' : 'text-primary border-primary/20 bg-primary/5'
          }`}>
          {delta > 0 ? <Plus size={10} strokeWidth={4} /> : <div className="w-2 h-[2px] bg-primary rounded-full shrink-0" />}
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
            {columns.map(col => <th key={col} className="pb-3 px-4 text-[8px] font-black text-[var(--eu-text-main)] opacity-40 uppercase tracking-widest">{col}</th>)}
            {!columns.includes('Outcome') && <th className="pb-3 px-4 text-[8px] font-black text-[var(--eu-text-main)] opacity-40 uppercase tracking-widest text-right">Action</th>}
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
                  className={`group cursor-pointer transition-all duration-500 ${isExpanded ? 'bg-eu-accent/5 translate-x-1' : 'hover:translate-x-2'}`}
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
                        <td key={col} className="py-3 px-4 glass-euphoria first:rounded-l-xl last:rounded-r-xl border-y border-[var(--eu-glass-border)] first:border-l last:border-r">
                          <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black font-mono shadow-neon border ${
                            is5xx ? 'bg-red-500/20 text-red-400 border-red-500/40 animate-pulse' :
                            is4xx ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' :
                            is2xx ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40' :
                            'bg-primary/10 text-primary border-primary/20'
                          }`}>{value || '---'}</span>
                        </td>
                      );
                    }

                    if (col === 'Context') {
                      return (
                        <td key={col} className="py-3 px-4 glass-euphoria first:rounded-l-xl last:rounded-r-xl border-y border-[var(--eu-glass-border)] first:border-l last:border-r">
                          <div className="flex items-center gap-2">
                            <div className="size-1.5 rounded-full bg-eu-accent animate-pulse" />
                            <span className="text-[10px] font-black uppercase text-white/90 tracking-widest">{value || 'Main Layout'}</span>
                          </div>
                        </td>
                      );
                    }

                    if (col === 'RiskLevel' || col === 'Outcome') {
                      const isSecure = value === 'Secure' || value === 'System Resilience';
                      return (
                        <td key={col} className="py-3 px-4 glass-euphoria first:rounded-l-xl last:rounded-r-xl border-y border-[var(--eu-glass-border)] first:border-l last:border-r">
                          <span className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase shadow-neon bg-primary/10 text-primary border border-primary/20`}>{value}</span>
                        </td>
                      );
                    }

                    if (col === 'Severity') {
                      const sevStr = (value || row.severity || '').toString().toLowerCase();
                      const isCrit = sevStr.includes('crit');
                      const isHigh = sevStr.includes('high');
                      const isMed = sevStr.includes('med');
                      return (
                        <td key={col} className="py-3 px-4 glass-euphoria first:rounded-l-xl last:rounded-r-xl border-y border-[var(--eu-glass-border)] first:border-l last:border-r">
                          <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase shadow-neon border tracking-wider font-outfit ${
                            isCrit ? 'bg-red-500/20 text-red-400 border-red-500/40 shadow-[0_0_12px_rgba(239,68,68,0.35)] animate-pulse' :
                            isHigh ? 'bg-orange-500/20 text-orange-400 border-orange-500/40 shadow-[0_0_10px_rgba(249,115,22,0.3)]' :
                            isMed ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' :
                            'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                          }`}>{value || row.severity || 'Medium'}</span>
                        </td>
                      );
                    }

                    if (col === 'Issue' || col === 'Message' || col === 'Link') {
                      return (
                        <td key={col} className="py-3 px-4 glass-euphoria first:rounded-l-xl last:rounded-r-xl border-y border-white/5 first:border-l last:border-r max-w-md">
                          <div className="flex flex-col gap-1">
                            <div className="flex flex-wrap items-center gap-1.5">
                              {row.testCaseId && (
                                <span className="px-1.5 py-0.5 rounded bg-eu-accent/15 text-eu-accent text-[8px] font-black uppercase tracking-wider border border-eu-accent/30 font-mono shrink-0">
                                  {row.testCaseId}
                                </span>
                              )}
                              {row._occurrences > 1 && (
                                <span className="px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[8px] font-black uppercase tracking-wider border border-amber-500/40 shrink-0">
                                  x{row._occurrences}
                                </span>
                              )}
                              <span className="text-[11px] font-bold text-[var(--eu-text-main)] opacity-90 break-words leading-snug font-outfit">
                                {value || '---'}
                              </span>
                            </div>
                            {row.expected && (
                              <span className="text-[9px] text-slate-400 font-medium truncate max-w-sm">
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
                            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/5 pb-4">
                              <div className="flex items-center gap-3">
                                <div className="size-8 bg-eu-accent/20 rounded-lg flex items-center justify-center text-eu-accent border border-eu-accent/20">
                                  <Shield size={14} />
                                </div>
                                <div>
                                  <div className="flex items-center gap-2">
                                    {row.testCaseId && (
                                      <span className="px-2 py-0.5 rounded bg-eu-accent/20 text-eu-accent text-[10px] font-mono font-black border border-eu-accent/30 tracking-wider">
                                        {row.testCaseId}
                                      </span>
                                    )}
                                    <h4 className="text-sm font-black uppercase tracking-widest text-[var(--eu-text-main)] font-outfit">
                                      {row.type || 'Diagnostic Dossier'}
                                    </h4>
                                  </div>
                                  <p className="text-[10px] text-slate-400 font-medium mt-0.5">
                                    {row.issue || row.message || 'System diagnostic finding'}
                                  </p>
                                </div>
                              </div>
                              {row._occurrences > 1 && (
                                <span className="px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[10px] font-black uppercase tracking-widest">
                                  Occurrences: {row._occurrences}x ({row._affectedLocations?.length || 1} locations)
                                </span>
                              )}
                            </div>

                            {/* Expected vs Observed Behavior */}
                            {(row.expected || row.observed) && (
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="p-4 rounded-2xl bg-emerald-500/[0.04] border border-emerald-500/20 space-y-1.5">
                                  <span className="text-[9px] font-black uppercase tracking-widest text-emerald-400 font-outfit flex items-center gap-1.5">
                                    <CheckCircle2 size={12} /> Expected Behavior
                                  </span>
                                  <p className="text-xs text-slate-300 leading-relaxed font-medium">
                                    {row.expected || 'Target element should comply with standard UX, boundary validation, and security guidelines.'}
                                  </p>
                                </div>
                                <div className="p-4 rounded-2xl bg-red-500/[0.04] border border-red-500/20 space-y-1.5">
                                  <span className="text-[9px] font-black uppercase tracking-widest text-red-400 font-outfit flex items-center gap-1.5">
                                    <AlertTriangle size={12} /> Actual Observed
                                  </span>
                                  <p className="text-xs text-slate-300 leading-relaxed font-medium">
                                    {row.observed || row.issue || row.message || 'Non-standard runtime, layout shift, or boundary failure observed.'}
                                  </p>
                                </div>
                              </div>
                            )}

                            {/* Root Cause & Technical Impact */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                              <div className="space-y-2">
                                <p className="text-[9px] font-black uppercase tracking-widest text-[var(--eu-text-main)] opacity-40 font-outfit">Root Cause</p>
                                <p className="text-xs text-[var(--eu-text-main)] opacity-80 font-medium leading-relaxed italic">"{remediation.cause}"</p>
                              </div>
                              <div className="space-y-2">
                                <p className="text-[9px] font-black uppercase tracking-widest text-primary font-outfit">Security / UX / Performance Impact</p>
                                <p className="text-xs text-[var(--eu-text-main)] opacity-80 font-medium leading-relaxed italic">"{remediation.impact}"</p>
                              </div>
                            </div>

                            {/* Reproduction Steps */}
                            <div className="p-4 bg-white/[0.02] rounded-2xl border border-white/5 space-y-2">
                              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 font-outfit">Steps to Reproduce</p>
                              <div className="space-y-1.5 text-xs text-slate-300 font-mono">
                                <div className="flex items-center gap-2">
                                  <span className="size-4 rounded-full bg-white/10 text-[9px] flex items-center justify-center font-bold">1</span>
                                  <span>Navigate to: <code className="text-eu-accent">{row.page || 'target URL'}</code></span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="size-4 rounded-full bg-white/10 text-[9px] flex items-center justify-center font-bold">2</span>
                                  <span>Locate target: <code className="text-white/80">{row.selector || row.location || row.form || 'viewport'}</code></span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="size-4 rounded-full bg-white/10 text-[9px] flex items-center justify-center font-bold">3</span>
                                  <span>Observe trigger / payload: <code className="text-amber-300">{row.payload || row.method || 'Default boundary condition'}</code></span>
                                </div>
                              </div>
                            </div>

                            {/* Remediation Intelligence */}
                            <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                              <p className="text-[9px] font-black uppercase tracking-widest text-eu-accent mb-2 font-outfit">Remediation Intelligence</p>
                              <p className="text-xs text-[var(--eu-text-main)] opacity-80 font-medium leading-relaxed">{remediation.guide}</p>
                            </div>

                            {row.htmlSnippet && row.htmlSnippet !== 'UNAVAILABLE' && (
                              <div className="p-4 bg-black/40 rounded-2xl border border-white/5 space-y-2">
                                <div className="flex items-center gap-2">
                                  <Code size={12} className="text-eu-accent" />
                                  <p className="text-[9px] font-black uppercase tracking-widest text-white/40">Target Code Fragment</p>
                                </div>
                                <pre className="text-[10px] font-mono text-eu-accent/80 bg-black/20 p-3 rounded-lg border border-white/5 overflow-x-auto whitespace-pre-wrap break-all">
                                  <code>{row.htmlSnippet}</code>
                                </pre>
                              </div>
                            )}
                          </div>

                          {/* Protocol Actions Column */}
                          <div className="w-full md:w-64 space-y-4 shrink-0">
                            <div className="p-4 bg-[var(--eu-bg-void)]/40 rounded-2xl border border-white/5">
                              <p className="text-[8px] font-black uppercase tracking-widest text-slate-600 mb-3 text-center">Senior QA Actions</p>
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
                                  className="w-full py-2.5 bg-indigo-600/20 hover:bg-indigo-600 text-indigo-300 hover:text-white border border-indigo-500/30 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-neon font-bold"
                                >
                                  {copiedTicketId === rowId ? (
                                    <>
                                      <Check size={12} className="text-green-400" /> Copied JIRA Ticket!
                                    </>
                                  ) : (
                                    <>
                                      <Copy size={12} /> Copy JIRA Bug Ticket
                                    </>
                                  )}
                                </button>
                                {row.suggestedFix && (
                                  <button
                                    onClick={() => setRemediationCode(row.suggestedFix)}
                                    className="w-full py-2.5 bg-eu-accent/20 hover:bg-eu-accent text-white border border-eu-accent/30 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all shadow-neon"
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
    <div className="flex flex-col items-center justify-center py-40 bg-white/[0.02] border border-dashed border-white/10 rounded-[32px]">
      <Loader2 className="animate-spin text-primary mb-6" size={48} />
      <p className="text-text-muted font-bold tracking-widest uppercase text-xs">Decrypting scan protocols...</p>
    </div>
  );

  if (!report) return (
    <div className="glass p-20 text-center rounded-[32px]">
      <AlertTriangle className="text-red-400 mx-auto mb-6" size={48} />
      <h3 className="text-2xl font-bold mb-2 text-[var(--eu-text-main)]">Protocol Failure</h3>
      <p className="text-muted opacity-60">The requested inspection log does not exist or has been purged from the index.</p>
      <button onClick={onBack} className="mt-8 text-primary font-bold flex items-center gap-2 mx-auto">
        <ChevronLeft size={18} /> Return to Dashboard
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
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-8">
        <div className="flex items-center gap-8">
          <button onClick={onBack} className="size-16 glass-euphoria rounded-3xl hover:border-eu-accent/50 transition-all text-muted hover:text-[var(--eu-text-main)] group shadow-neon flex items-center justify-center">
            <ChevronLeft size={28} className="group-hover:-translate-x-1 transition-transform" />
          </button>
          <div>
            <div className="flex flex-wrap items-center gap-4 sm:gap-6">
              <h2 className="text-base sm:text-lg md:text-xl font-black premium-gradient-text tracking-[0.2em] uppercase leading-none break-all font-outfit">
                {(() => {
                  try {
                    return new URL(report.url).hostname;
                  } catch (e) {
                    return report.url || 'Sentinel Target';
                  }
                })()}
              </h2>
              <span className={`px-5 py-2 rounded-2xl text-[10px] sm:text-[12px] font-black uppercase tracking-[0.3em] border bg-primary/10 border-primary/30 text-primary shadow-neon`}>
                {report.status}
              </span>
              {(report.securityIssues?.length > 0) && (
                <span className="px-5 py-2 rounded-2xl text-[10px] sm:text-[12px] font-black uppercase tracking-[0.3em] border bg-red-500/10 border-red-500/30 text-red-500 shadow-[0_0_15px_rgba(239,68,68,0.4)] animate-pulse">
                  SECURITY_CRITICAL
                </span>
              )}
            </div>
            <div className="mt-4 flex flex-row items-center gap-4 opacity-50">
              <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">
                <Database size={10} className="text-eu-accent" /> LOG_{report._id.toString().slice(-8).toUpperCase()}
              </div>
              <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">
                <span className="opacity-30">//</span> SYNC_{new Date(report.createdAt).toLocaleDateString('en-GB')}
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 w-full lg:w-auto overflow-x-auto pb-2 lg:pb-0 no-scrollbar px-1">
          {/* Action Hub (Single Line) */}
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
                  setAlert({ type: 'success', message: 'Neural trace purged successfully.' });
                }
                catch (e) { setAlert({ type: 'error', message: 'Purge failed. Uplink blocked.' }); }
              }
            }}
            className="flex-none flex items-center justify-center gap-2 bg-primary/10 hover:bg-primary/20 border border-primary/20 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest text-primary transition-all shadow-neon"
          >
            Delete <Trash2 size={10} />
          </button>

          <button
            onClick={async () => {
              try {
                const res = await axios.get(`${API_BASE}/api/report/${reportId}/export`);
                if (res.data.url) window.open(`${API_BASE}${res.data.url}`, '_blank');
              } catch (e) { setAlert({ type: 'error', message: 'PDF export protocol failed.' }); }
            }}
            className="flex-none flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all shadow-neon text-white"
          >
            PDF <BarChart3 size={10} />
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
            className="flex-none flex items-center justify-center gap-2 bg-eu-accent-violet/20 hover:bg-eu-accent-violet/40 border border-eu-accent-violet/30 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest text-[#a78bfa] transition-all shadow-neon"
          >
            Rescan <Zap size={10} />
          </button>



          <a
            href={report.url} target="_blank" rel="noreferrer"
            className="flex-none flex items-center justify-center gap-2 bg-eu-accent hover:scale-[1.05] active:scale-[0.98] px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all shadow-neon text-white"
          >
            Access <ExternalLink size={10} />
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
            <div className={`size-12 rounded-2xl flex items-center justify-center transition-all duration-700 relative z-10 ${activeTab === tab.id
                ? 'bg-white/10 text-white shadow-neon border border-white/20 scale-110'
                : 'bg-white/5 text-[var(--eu-text-main)] opacity-30 group-hover:opacity-100 group-hover:bg-white/10'
              }`}>
              {tab.icon}
            </div>

            {/* Label & Status Hub */}
            <div className="text-center relative z-10 mt-1">
              <p className={`text-[9px] font-black uppercase tracking-[0.2em] mb-3 transition-all duration-500 neon-text-glow ${activeTab === tab.id ? 'text-white' : 'text-[var(--eu-text-main)] opacity-40'
                }`}>
                {tab.label}
              </p>

              {tab.count !== undefined && (
                <div className={`inline-flex items-center justify-center count-badge-premium ${tab.count > 0 ? 'text-eu-accent' : 'text-slate-600'}`}>
                  <span className="text-[14px] leading-none pt-0.5">
                    {tab.count < 10 ? `0${tab.count}` : tab.count}
                  </span>
                </div>
              )}
            </div>

            {/* Selection indicator */}
            {activeTab === tab.id && (
              <motion.div
                layoutId="active-nav-glow"
                className="absolute inset-x-0 bottom-0 h-1 bg-eu-accent shadow-neon-strong"
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
                <motion.div animate={{ opacity: [0.7, 1, 0.7] }} transition={{ duration: 2, repeat: Infinity }} className="flex items-center gap-6 p-8 rounded-[32px] border border-eu-accent/30 bg-eu-accent/5 shadow-neon">
                  <Loader2 size={28} className="text-eu-accent animate-spin shrink-0" />
                  <div>
                    <p className="text-sm font-black text-white uppercase tracking-[0.2em] font-outfit">Active Neural Crawl</p>
                    <p className="text-xs text-[var(--eu-text-muted)] mt-1 font-medium">Sentinel AI is navigating the DOM tree and harvesting diagnostic signatures. Data will stream in real-time.</p>
                  </div>
                  <div className="ml-auto px-4 py-1.5 rounded-xl bg-eu-accent/20 border border-eu-accent/20 text-[10px] font-black text-eu-accent uppercase tracking-widest animate-pulse font-outfit">Status: {report.status}</div>
                </motion.div>
              )}

              {/* ── Neural Analysis Hub (AI Insights) ── */}
              {report.aiInsights ? (
                <div className="relative group overflow-hidden rounded-[40px]">
                  <div className="absolute inset-0 bg-gradient-to-br from-eu-accent/20 via-transparent to-transparent opacity-50" />
                  <div className="relative glass-euphoria p-8 md:p-14 rounded-[40px] border-white/10">
                    <div className="flex flex-col md:flex-row gap-8 items-start md:items-center mb-10">
                      <div className="relative shrink-0 p-10 bg-[var(--eu-bg-void)] border border-eu-accent/30 rounded-[40px] shadow-neon">
                        <Cpu size={72} className="text-eu-accent animate-pulse" />
                      </div>
                      <div className="flex-1 space-y-5">
                        <div className="flex flex-wrap items-center gap-4">
                          <div className="px-3 py-1.5 bg-eu-accent text-[10px] font-black uppercase tracking-[0.3em] rounded-xl shadow-neon text-white font-outfit">Autonomous QA Audit</div>
                          {report.aiInsights?.qaVerdict && (
                            <div className={`px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-[0.25em] font-outfit border shadow-neon ${
                              report.aiInsights.qaVerdict.includes('BLOCK') 
                                ? 'bg-red-500/20 border-red-500/50 text-red-400 animate-pulse'
                                : report.aiInsights.qaVerdict.includes('CONDITIONAL')
                                ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                                : 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400'
                            }`}>
                              {report.aiInsights.qaVerdict.includes('BLOCK') ? '🛑' : report.aiInsights.qaVerdict.includes('CONDITIONAL') ? '⚠️' : '✅'} Verdict: {report.aiInsights.qaVerdict}
                            </div>
                          )}
                          <div className="px-3 py-1.5 bg-white/5 border border-white/5 text-[10px] font-black uppercase tracking-[0.3em] rounded-xl text-slate-500 font-outfit">{report.url}</div>
                        </div>

                        {/* ── Autonomous QA Test Suite Coverage Matrix ── */}
                        <div className="flex flex-wrap items-center gap-2 pt-1 pb-2">
                          <span className="text-[9px] font-black uppercase tracking-widest text-slate-500 font-outfit">Suite Matrix:</span>
                          <span className="px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-[9px] font-bold text-slate-300">📱 Viewports (375px/768px/1280px)</span>
                          <span className="px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-[9px] font-bold text-slate-300">🛡️ Fuzzing & Boundaries</span>
                          <span className="px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-[9px] font-bold text-slate-300">⚡ Dead-Clicks & Crashes</span>
                          <span className="px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-[9px] font-bold text-slate-300">🔐 Storage & Secret Sniffer</span>
                          <span className="px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-[9px] font-bold text-slate-300">🚀 Asset & DOM Bloat</span>
                        </div>
                        {report.comparison && report.comparison.previousReportId && (
                          <div className="flex flex-wrap items-center gap-3 mb-6">
                            <div className="px-4 py-2 bg-eu-accent/10 border border-eu-accent/30 rounded-2xl flex items-center gap-3 shadow-neon">
                              <Activity size={14} className="text-eu-accent" />
                              <div className="flex flex-col">
                                <span className="text-[8px] font-black uppercase tracking-widest text-slate-500">Neural Progression</span>
                                <div className="flex items-center gap-2">
                                  <span className={`text-sm font-black uppercase ${report.comparison.scoreDelta >= 0 ? 'text-green-500' : 'text-primary'}`}>
                                    {report.comparison.scoreDelta >= 0 ? '+' : ''}{report.comparison.scoreDelta} HP
                                  </span>
                                  <span className="text-[10px] font-bold text-slate-400 opacity-60 italic">vs. Baseline Matrix</span>
                                </div>
                              </div>
                            </div>

                            {report.comparison.stats && (
                              <div className="flex items-center gap-3 px-4 py-2 bg-white/5 border border-white/10 rounded-2xl">
                                <div className="flex flex-col border-r border-white/10 pr-4">
                                  <span className="text-[8px] font-black uppercase tracking-widest text-slate-500">Neutralized</span>
                                  <span className="text-sm font-black text-green-500">{report.comparison.stats.fixedErrors}</span>
                                </div>
                                <div className="flex flex-col pl-1">
                                  <span className="text-[8px] font-black uppercase tracking-widest text-slate-500">Invasive</span>
                                  <span className="text-sm font-black text-primary">{report.comparison.stats.newErrors}</span>
                                </div>
                              </div>
                            )}

                            <div className={`px-4 py-2 rounded-2xl border flex items-center gap-2 ${report.comparison.stats?.impact === 'Improved' ? 'bg-green-500/10 border-green-500/30 text-green-500 shadow-neon' :
                                report.comparison.stats?.impact === 'Regressed' ? 'bg-primary/10 border-primary/30 text-primary shadow-neon' :
                                  'bg-white/5 border-white/10 text-slate-500'
                              }`}>
                              <p className="text-[10px] font-black uppercase tracking-widest">{report.comparison.stats?.impact || 'Stable State'}</p>
                            </div>
                          </div>
                        )}
                        <h3 className="text-2xl md:text-4xl font-black uppercase tracking-tight text-[var(--eu-text-main)] leading-[1.1] font-outfit">
                          {report.status === 'completed' ? 'Analysis Completed' : report.status === 'in-progress' ? 'Analysis in Progress' : report.aiInsights?.classification || 'Neutral State Detected'}
                        </h3>
                        <p className="text-slate-300 text-xl md:text-2xl leading-relaxed font-medium font-outfit opacity-90 italic">
                          "{report.aiInsights.summary || 'Scan data is being synthesized into narrative insights...'}"
                        </p>
                      </div>
                    </div>

                    <div className="space-y-8">
                      {/* Issue Cards */}
                      {report.aiInsights.issues?.length > 0 ? (
                        <div className="space-y-8">
                          <div className="text-[12px] font-black text-eu-accent uppercase tracking-[0.4em] flex items-center gap-4 pb-4 border-b border-white/5 font-outfit">
                            <AlertTriangle size={16} /> {report.aiInsights.issues.length} Critical Deviations Found
                          </div>
                          <div className="grid grid-cols-1 gap-5">
                            {report.aiInsights.issues.map((issue, idx) => {
                              const sc = issue.severity === 'Critical' 
                                ? 'border-red-500/40 bg-red-500/5 shadow-[0_0_20px_rgba(239,68,68,0.15)]' 
                                : issue.severity === 'High' 
                                ? 'border-orange-500/40 bg-orange-500/5 shadow-[0_0_15px_rgba(249,115,22,0.1)]' 
                                : issue.severity === 'Medium' 
                                ? 'border-amber-500/30 bg-amber-500/5' 
                                : 'border-cyan-500/30 bg-cyan-500/5';

                              const sb = issue.severity === 'Critical' 
                                ? 'bg-red-500 text-white shadow-[0_0_15px_rgba(239,68,68,0.5)] animate-pulse' 
                                : issue.severity === 'High' 
                                ? 'bg-orange-500 text-white shadow-[0_0_12px_rgba(249,115,22,0.4)]' 
                                : issue.severity === 'Medium' 
                                ? 'bg-amber-400 text-black shadow-[0_0_10px_rgba(245,158,11,0.3)]' 
                                : 'bg-cyan-500 text-black shadow-[0_0_10px_rgba(6,182,212,0.3)]';
                              return (
                                <div key={idx} className={`border rounded-[28px] p-6 md:p-8 space-y-6 transition-all hover:translate-x-2 duration-500 ${sc} relative overflow-hidden`}>
                                  <div className="absolute top-0 right-0 p-4 opacity-5">
                                    {issue.source === 'local' ? <Database size={48} /> : <Cpu size={48} />}
                                  </div>
                                  <div className="flex flex-wrap items-center gap-4">
                                    <span className={`text-[10px] font-black uppercase tracking-[0.2em] px-3 py-1.5 rounded-xl ${sb} shadow-neon`}>{issue.severity}</span>
                                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10">
                                      {issue.source === 'local' ? <Database size={10} className="text-primary" /> : <Cpu size={10} className="text-eu-accent" />}
                                      <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--eu-text-muted)] font-outfit">Source: {issue.source === 'local' ? 'Neural Cache' : 'AI Diagnostic'}</span>
                                    </div>
                                    <h4 className="text-xl md:text-2xl font-black text-[var(--eu-text-main)] font-outfit tracking-tight">{issue.title || issue.issue}</h4>
                                  </div>

                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <div className="space-y-3">
                                      <p className="text-[11px] font-black uppercase tracking-[0.3em] text-eu-accent font-outfit">Issue Signature</p>
                                      <p className="text-base text-slate-300 leading-relaxed font-medium">{issue.issue}</p>
                                    </div>
                                    <div className="space-y-3">
                                      <p className="text-[11px] font-black uppercase tracking-[0.3em] text-primary font-outfit">Neural Root Cause</p>
                                      <p className="text-base text-slate-300 leading-relaxed font-medium">{issue.reason}</p>
                                    </div>
                                  </div>

                                  <div className="p-6 bg-white/5 rounded-2xl border border-white/5 space-y-4">
                                    <div className="flex items-center gap-3 mb-2">
                                      <Terminal size={14} className="text-primary" />
                                      <p className="text-[11px] font-black uppercase tracking-[0.3em] text-primary font-outfit">Tactical Remediation Steps</p>
                                    </div>
                                    <div className="space-y-3">
                                      {issue.fix?.map((step, sIdx) => (
                                        <div key={sIdx} className="flex gap-4 items-start">
                                          <div className="size-5 shrink-0 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-[10px] font-black text-primary">{sIdx + 1}</div>
                                          <p className="text-sm text-slate-300 font-medium leading-relaxed opacity-80">{step}</p>
                                        </div>
                                      ))}
                                    </div>
                                  </div>

                                  <div className="flex flex-col sm:flex-row gap-3">
                                    {issue.remediationCode && (
                                      <button
                                        onClick={() => setRemediationCode(issue.remediationCode)}
                                        className="flex-1 py-5 bg-eu-accent/20 hover:bg-eu-accent text-white border border-eu-accent/40 rounded-2xl text-[11px] font-black uppercase tracking-[0.3em] flex items-center justify-center gap-4 transition-all shadow-neon group font-outfit"
                                      >
                                        <Code size={18} className="group-hover:rotate-12 transition-transform" />
                                        Deploy Automated Patch Protocol
                                      </button>
                                    )}
                                    <button
                                      onClick={() => onAskAI(`Deep dive into this ${issue.severity} finding: ${issue.title || issue.issue}. Give me a detailed remediation plan.`, reportId)}
                                      className="flex-1 py-5 bg-primary/20 hover:bg-primary text-white border border-primary/40 rounded-2xl text-[11px] font-black uppercase tracking-[0.3em] flex items-center justify-center gap-4 transition-all shadow-neon group font-outfit"
                                    >
                                      <Bot size={18} className="group-hover:scale-110 transition-transform" />
                                      Ask Sentinel GPT
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-6 p-10 rounded-[32px] bg-primary/5 border border-primary/20 shadow-neon">
                          <CheckCircle2 size={32} className="text-primary shrink-0" />
                          <div>
                            <p className="text-xl font-black text-primary font-outfit uppercase tracking-widest">Architectural Integrity Confirmed</p>
                            <p className="text-sm text-[var(--eu-text-muted)] mt-1 font-medium italic">Sentinal AI has verified all nodes. No deviations from standard protocols were detected.</p>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* ── Autonomous Performance Booster Playbook ── */}
                    {report.aiInsights?.performancePlaybook?.length > 0 && (
                      <div className="mt-10 pt-8 border-t border-white/5 space-y-4">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
                            <Zap size={16} />
                          </div>
                          <div>
                            <h4 className="text-sm font-black uppercase tracking-widest text-white font-outfit">
                              Autonomous Performance Booster Playbook
                            </h4>
                            <p className="text-[11px] text-slate-400 font-medium">
                              Principal QA architectural roadmap to optimize Core Web Vitals (FCP, LCP, CLS) & throughput
                            </p>
                          </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {report.aiInsights.performancePlaybook.map((step, sIdx) => (
                            <div key={sIdx} className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-amber-500/30 transition-all flex items-start gap-3.5 group">
                              <span className="size-6 rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-black flex items-center justify-center shrink-0 mt-0.5 font-outfit">
                                {sIdx + 1}
                              </span>
                              <p className="text-xs text-slate-300 font-medium leading-relaxed group-hover:text-white transition-colors">
                                {step}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="flex gap-12 pt-10 border-t border-white/5 mt-12">
                      <div className="flex flex-col gap-2">
                        <span className="text-[11px] font-black text-slate-600 uppercase tracking-[0.3em] font-outfit">Analysis Engine</span>
                        <span className="text-sm font-bold text-eu-accent uppercase tracking-widest font-outfit">GPT-4.1 Euphoria Cortex</span>
                      </div>
                      <div className="flex flex-col gap-2">
                        <span className="text-[11px] font-black text-slate-600 uppercase tracking-[0.3em] font-outfit">Processing Threads</span>
                        <span className="text-sm font-bold text-white uppercase tracking-widest font-outfit">{report.pagesCrawled || 1} Nodes Scanned</span>
                      </div>
                    </div>
                  </div>
                </div>
              ) : report.status === 'completed' ? (
                <div className="flex items-center gap-8 p-12 rounded-[40px] border-[var(--eu-glass-border)] bg-[var(--eu-bg-card)] glass-euphoria">
                  <div className="size-16 bg-white/5 rounded-2xl flex items-center justify-center border border-white/10 text-slate-500 shadow-inner"><Cpu size={32} /></div>
                  <div>
                    <p className="text-xl font-black text-slate-300 font-outfit uppercase tracking-widest">Neural Uplink Silenced</p>
                    <p className="text-sm text-slate-500 mt-1 font-medium">Cognitive analysis is currently unavailable. Ensure the neural key (API_KEY) is valid in the server config.</p>
                  </div>
                </div>
              ) : null}

              {/* ── Quick Stats Grid (Optimized) ── */}
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
                <StatCard label="Neural Latency" value={`${report.performanceMetrics?.loadTime?.toFixed(0) || 0} ms`} color="text-eu-accent" icon={<Zap size={24} />} />
                <StatCard label="Data Packets" value={report.performanceMetrics?.requestCount || 0} color="text-white" icon={<Wifi size={24} />} />
                <StatCard label="Crawl Depth" value={report.pagesCrawled || 0} color="text-primary" icon={<ExternalLink size={24} />} />
              </div>

              {/* ── Lighthouse Performance Matrix ── */}
              {report.lighthouseScores && (
                <div className="glass-euphoria p-8 md:p-12 rounded-[40px] border-white/5 shadow-2xl relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-1 h-full bg-eu-accent/40" />
                  <div className="flex flex-col md:flex-row items-center justify-between gap-12">
                    <div className="max-w-xs space-y-4">
                      <h3 className="text-3xl font-black uppercase tracking-tight-mega text-white font-outfit">Lighthouse <span className="text-eu-accent italic">Sync</span></h3>
                      <p className="text-slate-500 text-sm font-medium leading-relaxed">Chrome DevTools diagnostic scores synchronized via automated crawl protocols.</p>
                    </div>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-12 md:gap-20">
                      <LighthouseCircle label="Performance" score={report.lighthouseScores.performance} delta={report.comparison?.lighthouseDelta?.performance} />
                      <LighthouseCircle label="Neural SEO" score={report.lighthouseScores.seo} delta={report.comparison?.lighthouseDelta?.seo} />
                      <LighthouseCircle label="Protocols" score={report.lighthouseScores.bestPractices} delta={report.comparison?.lighthouseDelta?.bestPractices} />
                      <LighthouseCircle label="Inclusion" score={report.lighthouseScores.accessibility} delta={report.comparison?.lighthouseDelta?.accessibility} />
                    </div>
                  </div>
                </div>
              )}

              {/* ── Delta Comparison Panel ── */}
              {report.comparison?.previousReportId && (
                <div className="glass-euphoria p-8 md:p-12 rounded-[40px] border-white/5 shadow-2xl relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-8 opacity-5"><Activity size={80} /></div>
                  <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 mb-8">
                    <div className="space-y-2">
                      <div className="flex items-center gap-3">
                        <div className="size-10 bg-eu-accent/20 rounded-xl flex items-center justify-center border border-eu-accent/30 shadow-neon text-eu-accent">
                          <Activity size={16} />
                        </div>
                        <h3 className="text-xl font-black uppercase tracking-tight text-white font-outfit">
                          Scan <span className="text-eu-accent italic">Delta</span>
                        </h3>
                      </div>
                      <p className="text-slate-500 text-xs font-medium ml-14">Comparison against your previous scan of this target.</p>
                    </div>
                    <span className={`px-5 py-2 rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] border shadow-neon ${report.comparison.stats.impact === 'Improved'
                        ? 'bg-green-500/10 border-green-500/30 text-green-400'
                        : report.comparison.stats.impact === 'Regressed'
                          ? 'bg-red-500/10 border-red-500/30 text-red-400'
                          : 'bg-white/5 border-white/10 text-slate-400'
                      }`}>
                      {report.comparison.stats.impact === 'Improved' ? '↑' : report.comparison.stats.impact === 'Regressed' ? '↓' : '→'} {report.comparison.stats.impact}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="glass-euphoria p-5 rounded-2xl border border-white/5 text-center space-y-2">
                      <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-500">Health Score</p>
                      <p className={`text-3xl font-black font-outfit ${report.comparison.scoreDelta >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {report.comparison.scoreDelta >= 0 ? '+' : ''}{report.comparison.scoreDelta}
                      </p>
                      <p className="text-[9px] text-slate-600 uppercase tracking-widest">pts</p>
                    </div>
                    <div className="glass-euphoria p-5 rounded-2xl border border-red-500/20 text-center space-y-2">
                      <p className="text-[9px] font-black uppercase tracking-[0.2em] text-red-400">New Errors</p>
                      <p className="text-3xl font-black font-outfit text-red-400">{report.comparison.stats.newErrors}</p>
                      <p className="text-[9px] text-slate-600 uppercase tracking-widest">introduced</p>
                    </div>
                    <div className="glass-euphoria p-5 rounded-2xl border border-green-500/20 text-center space-y-2">
                      <p className="text-[9px] font-black uppercase tracking-[0.2em] text-green-400">Fixed Errors</p>
                      <p className="text-3xl font-black font-outfit text-green-400">{report.comparison.stats.fixedErrors}</p>
                      <p className="text-[9px] text-slate-600 uppercase tracking-widest">resolved</p>
                    </div>
                    <div className="glass-euphoria p-5 rounded-2xl border border-white/5 text-center space-y-2">
                      <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-500">Performance</p>
                      <p className={`text-3xl font-black font-outfit ${(report.comparison.lighthouseDelta?.performance || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {(report.comparison.lighthouseDelta?.performance || 0) >= 0 ? '+' : ''}{report.comparison.lighthouseDelta?.performance || 0}
                      </p>
                      <p className="text-[9px] text-slate-600 uppercase tracking-widest">lighthouse pts</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4 mt-4">
                    {[
                      { label: 'SEO', val: report.comparison.lighthouseDelta?.seo || 0 },
                      { label: 'Accessibility', val: report.comparison.lighthouseDelta?.accessibility || 0 },
                      { label: 'Best Practices', val: report.comparison.lighthouseDelta?.bestPractices || 0 },
                    ].map(({ label, val }) => (
                      <div key={label} className="glass-euphoria p-4 rounded-2xl border border-white/5 flex items-center justify-between">
                        <p className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-500">{label}</p>
                        <p className={`text-lg font-black font-outfit ${val >= 0 ? 'text-green-400' : 'text-red-400'}`}>
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
            <motion.div key="table" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="glass p-6 rounded-2xl overflow-hidden space-y-4">
              <SectionHeader
                title={tabs.find(t => t.id === activeTab)?.label || 'Diagnostic'}
                icon={tabs.find(t => t.id === activeTab)?.icon || <Activity size={14} />}
              />

              {/* Industry Telemetry Search & Triage Bar */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 bg-[var(--eu-bg-card)] border border-[var(--eu-glass-border)] rounded-xl">
                <div className="relative flex-1">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 opacity-60" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={`Search ${tabs.find(t => t.id === activeTab)?.label || 'findings'} by URL, status, or keyword...`}
                    className="w-full bg-[var(--eu-bg-void)] border border-[var(--eu-glass-border)] rounded-lg pl-9 pr-4 py-2 text-xs text-[var(--eu-text-main)] placeholder-slate-500 focus:outline-none focus:border-[var(--eu-accent)] font-medium"
                  />
                  {searchQuery && (
                    <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white text-xs">
                      <X size={12} />
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                  <span className="text-[9px] font-black uppercase text-slate-500 mr-1 tracking-widest">Filter:</span>
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
                          className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all flex items-center gap-1.5 ${
                            severityFilter === sev
                              ? 'bg-[var(--eu-accent)] text-white shadow-neon'
                              : 'bg-[var(--eu-bg-void)] text-slate-400 border border-[var(--eu-glass-border)] hover:text-white'
                          }`}
                        >
                          <span>{sev}</span>
                          <span className={`text-[8px] px-1 py-0.2 rounded-full ${severityFilter === sev ? 'bg-white/20 text-white' : 'bg-white/5 text-slate-500'}`}>
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
                  <div key={i} className="group glass-euphoria p-3 rounded-2xl space-y-3 border border-white/5 hover:border-eu-accent/30 transition-all duration-700 hover:-translate-y-1 shadow-xl">
                    <div className="aspect-video overflow-hidden rounded-xl bg-[var(--eu-bg-void)]/60 border border-white/5 shadow-inner relative cursor-pointer" onClick={() => setPreviewImage(s)}>
                      <img src={`${API_BASE}${s.path}`} alt={s.page} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000 grayscale group-hover:grayscale-0" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 flex flex-col justify-end p-3">
                        <div className="flex gap-2 mb-2">
                          {pageIssues.length > 0 && <span className="px-2 py-0.5 rounded-md bg-primary text-[7px] font-black text-white shadow-neon">{pageIssues.length} ISSUES FOUND</span>}
                        </div>
                        <p className="text-[10px] font-black text-white uppercase tracking-widest truncate">{s.page}</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between px-1">
                      <div className="space-y-0.5 min-w-0">
                        <p className="text-[8px] font-black text-eu-accent uppercase tracking-[0.2em] font-outfit">{s.type}</p>
                        <p className="text-[11px] font-black text-white truncate max-w-[150px] font-outfit">
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
                        className="size-10 bg-white/5 rounded-xl flex items-center justify-center text-eu-accent hover:bg-eu-accent/20 transition-all border border-white/10 shadow-inner group-hover:shadow-neon"
                      >
                        <Sparkles size={14} className="animate-pulse" />
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
            className="fixed inset-0 z-[999] bg-black/95 backdrop-blur-3xl flex items-center justify-center p-4 md:p-10"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 30 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 30 }}
              onClick={e => e.stopPropagation()}
              className="relative w-full max-w-7xl h-[90vh] glass-euphoria rounded-[40px] border border-white/10 shadow-[0_0_120px_rgba(var(--eu-accent-rgb),0.25)] flex flex-col md:flex-row overflow-hidden"
            >
              {/* Left Side: Visual Context */}
              <div className="flex-[3] relative bg-[var(--eu-bg-void)] border-r border-white/5 overflow-hidden flex items-center justify-center group">
                <img src={`${API_BASE}${previewImage.path}`} alt="Neural Preview" className="max-w-full max-h-full object-contain shadow-2xl transition-transform duration-500 group-hover:scale-105" />
                <div className="absolute top-6 left-6 flex items-center gap-3">
                  <div className="px-5 py-2 bg-eu-accent text-white text-[10px] font-black uppercase tracking-widest rounded-xl shadow-neon">Tactical Snapshot</div>
                  <div className="px-5 py-2 bg-white/5 border border-white/10 text-white/50 text-[10px] font-black uppercase tracking-widest rounded-xl backdrop-blur-md">{previewImage.page}</div>
                </div>
                <button onClick={() => setPreviewImage(null)} className="absolute top-6 right-6 size-12 hover:bg-white/5 rounded-2xl flex items-center justify-center text-white/40 hover:text-white transition-all">
                  <X size={24} />
                </button>
              </div>

              {/* Right Side: Tactical Error Feed */}
              <div className="flex-[2] flex flex-col h-full bg-black/40 backdrop-blur-md border-l border-white/10">
                <div className="p-8 border-b border-white/5">
                  <div className="flex items-center gap-3 mb-2">
                    <Activity size={18} className="text-eu-accent" />
                    <h3 className="text-xl font-black uppercase tracking-widest text-white">Visual Audit Lab</h3>
                  </div>
                  <p className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em]">{getAllIssuesForPage(report, previewImage.page).length} Neural Failures Aligned to URL</p>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-4">
                  {getAllIssuesForPage(report, previewImage.page).length > 0 ? (
                    getAllIssuesForPage(report, previewImage.page).map((issue, idx) => (
                      <div key={idx} className="p-5 bg-white/5 border border-white/5 rounded-[24px] hover:border-eu-accent/30 transition-all group">
                        <div className="flex items-center gap-3 mb-3">
                          <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-1 rounded-md bg-black/40 border border-white/10 ${issue._color}`}>
                            {issue._source}
                          </span>
                          {issue.severity && (
                            <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-1 rounded-md bg-black/40 border border-white/10 ${issue.severity === 'High' || issue.severity === 'Critical' ? 'text-primary' : 'text-yellow-400'}`}>
                              {issue.severity}
                            </span>
                          )}
                        </div>
                        <p className="text-xs font-black text-white/90 mb-2 leading-relaxed">{issue.message || issue.issue || issue.status + ' ' + (issue.type || 'Error')}</p>
                        {issue.recommendation && (
                          <p className="text-[10px] text-white/40 font-medium leading-relaxed group-hover:text-white/60 transition-colors uppercase tracking-tight italic">Fix: {issue.recommendation}</p>
                        )}
                        {issue.url && <p className="text-[8px] text-eu-accent/40 font-mono mt-3 truncate">{issue.url}</p>}
                      </div>
                    ))
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center opacity-20 text-center -mt-10">
                      <Zap size={48} className="mb-4" />
                      <p className="text-[10px] font-black uppercase tracking-widest px-10">No specific failures synchronized for this visual capture.</p>
                    </div>
                  )}
                </div>

                <div className="p-8 bg-eu-accent/5 border-t border-white/5">
                  <p className="text-[9px] font-black text-eu-accent uppercase tracking-widest mb-1">Diagnostic Context</p>
                  <p className="text-[11px] font-black text-white/60 uppercase">
                    Manual remediation required for neural path: {(() => {
                      try {
                        return new URL(previewImage.page).pathname;
                      } catch (e) {
                        return previewImage.page || 'Root';
                      }
                    })()}
                  </p>
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
            className="fixed inset-0 z-[999] flex items-center justify-center p-4 sm:p-10 bg-[var(--eu-bg-overlay-modal)] backdrop-blur-xl"
            onClick={() => setRemediationCode(null)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 40 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 40 }}
              className="w-full max-w-4xl glass-euphoria rounded-[48px] overflow-hidden shadow-neon"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between p-6 sm:p-8 border-b border-[var(--eu-glass-border)] bg-[var(--eu-bg-void)]/40">
                <div className="flex items-center gap-4">
                  <div className="size-12 bg-eu-accent/20 rounded-xl flex items-center justify-center border border-eu-accent/20 text-eu-accent shadow-neon"><Code size={20} /></div>
                  <div>
                    <h3 className="text-xl sm:text-2xl font-black uppercase tracking-tight text-[var(--eu-text-main)] font-outfit">AI <span className="premium-gradient-text">Remediation</span></h3>
                    <p className="text-[9px] font-black text-[var(--eu-text-main)] opacity-40 uppercase tracking-[0.2em] mt-1">Authenticated Logic Patch v4.2</p>
                  </div>
                </div>
                <button onClick={() => setRemediationCode(null)} className="size-12 hover:bg-[var(--eu-bg-void)]/40 rounded-2xl text-[var(--eu-text-main)] opacity-40 flex items-center justify-center transition-all group">
                  <AlertCircle size={28} className="rotate-45 group-hover:scale-110" />
                </button>
              </div>
              <div className="p-8 sm:p-12 space-y-10">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 text-[11px] font-black uppercase tracking-industrial text-[var(--eu-text-main)] opacity-40"><Terminal size={16} /> Recommended Syntax_Construct</div>
                  <button
                    onClick={() => { navigator.clipboard.writeText(remediationCode); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
                    className="flex items-center gap-3 px-6 py-2.5 bg-[var(--eu-bg-void)]/60 hover:bg-eu-accent/20 rounded-xl text-[10px] font-black uppercase tracking-widest text-[var(--eu-text-main)] transition-all border border-[var(--eu-glass-border)] shadow-inner"
                  >
                    {copied ? <Check size={14} className="text-primary" /> : <Copy size={14} />} {copied ? 'Copied to Clipboard' : 'Copy Logic'}
                  </button>
                </div>
                <div className="max-h-[450px] overflow-y-auto custom-scrollbar bg-black/60 rounded-[32px] border border-[var(--eu-glass-border)] p-8 md:p-12 shadow-inner">
                  <pre className="text-sm sm:text-base font-mono text-eu-accent/90 leading-relaxed whitespace-pre-wrap">{remediationCode}</pre>
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
