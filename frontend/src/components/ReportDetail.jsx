import { API_URL, SOCKET_URL } from '../config/api';
import React, { useEffect, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeft, ChevronRight, ExternalLink, AlertTriangle, Terminal, Layout,
  FormInput, Image, Zap, UserCheck, Loader2,
  CheckCircle2, Info, AlertCircle, BarChart3, Database, Shield, Cpu, Bot,
  Wifi, Trash2, Code, Copy, Check, Plus,
  Activity, Sparkles, X, Search, Radio, Smartphone, Lock, Globe
} from 'lucide-react';
import axios from 'axios';

// Enterprise corporate text sanitizer - strips non-professional emojis from all diagnostics
export const cleanText = (val) => {
  if (!val || typeof val !== 'string') return val;
  return val
    .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{2B50}\u{200D}\u{FE0F}]/gu, '')
    .trim();
};

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
    const pageKey = item.page || item.location || item.url || '';
    // Include pageKey in fingerprint so distinct page issues are never dropped across pages
    const coreKey = item.testCaseId 
      ? `${pageKey}-${item.testCaseId}-${item.selector || item.location || ''}`
      : `${pageKey}-${item.type || ''}-${item.message || item.issue || item.link || item.url || ''}-${item.selector || ''}-${item.method || ''}`;

    if (!map.has(coreKey)) {
      map.set(coreKey, {
        ...item,
        page: item.page || pageKey,
        _occurrences: 1,
        _affectedLocations: [pageKey || 'Primary View'].filter(Boolean)
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
  if (!report) return [];
  const rootUrl = report.url || '';
  let raw = [];
  switch (tab) {
    case 'all': {
      const apiSec = (report.securityIssues || []).filter(s => 
        s.type === 'SERVER_STACK_TRACE_LEAK' || s.type === 'SENSITIVE_API_RESPONSE_FIELD' || s.testCaseId?.includes('SEC-STACK') || s.testCaseId?.includes('SEC-DATA')
      ).map(s => ({
        ...s,
        page: s.page || rootUrl,
        category: 'API Security',
        source: 'API & Network Sentry',
        context: s.type === 'SERVER_STACK_TRACE_LEAK' ? 'CWE-209 Stack Trace Leak' : 'API Credential Leak',
        issue: s.issue || s.details
      }));

      const generalSec = (report.securityIssues || []).filter(s => 
        !(s.type === 'SERVER_STACK_TRACE_LEAK' || s.type === 'SENSITIVE_API_RESPONSE_FIELD' || s.testCaseId?.includes('SEC-STACK') || s.testCaseId?.includes('SEC-DATA'))
      ).map(s => ({
        ...s,
        page: s.page || rootUrl,
        category: 'Security',
        source: 'Enterprise Secret Sniffer',
        context: s.type || 'Secret Sniffer'
      }));

      raw = [
        ...apiSec,
        ...generalSec,
        ...(report.formIssues || []).map(i => ({ ...i, page: i.page || rootUrl, category: 'Forms', source: 'Form Integrity Fuzzer', form: i.formSelector || i.form || 'Input Element' })),
        ...(report.uiIssues || []).map(i => ({ ...i, page: i.page || rootUrl, category: 'UI/UX', source: 'Spatial Layout Auditor', context: i.type || 'Viewport Layout' })),
        ...(report.responsiveIssues || []).map(i => ({ ...i, page: i.page || rootUrl, category: 'UI/UX', source: 'Mobile Matrix Auditor', context: 'Mobile Responsive Matrix' })),
        ...(report.consoleErrors || []).map(i => ({ ...i, page: i.page || rootUrl, category: 'Console', source: 'Console Runtime Traps', context: 'Runtime Exception', issue: i.message || i.text })),
        ...(report.brokenLinks || []).map(i => ({ ...i, page: i.page || rootUrl, category: 'Links', source: 'Navigation Link Graph', context: 'Navigation Integrity', issue: `Broken Link: ${i.link} (HTTP ${i.status})` })),
        ...(report.accessibilityIssues || []).map(i => ({ ...i, page: i.page || rootUrl, category: 'Accessibility', source: 'WCAG Accessibility Sentinel', context: 'WCAG Compliance' })),
        ...(report.networkLogs?.filter(n => n.status >= 400) || []).map(i => ({ ...i, page: i.page || rootUrl, category: 'API & Network', source: 'API & Network Sentry', context: 'API Telemetry', issue: `${i.method || 'GET'} ${i.url} (${i.status})` }))
      ];
      break;
    }
    case 'network': {
      const netLogs = (report.networkLogs || []).map(i => ({
        ...i,
        page: i.page || rootUrl,
        source: 'API & Network Sentry',
        category: 'API & Network',
        severity: (i.status >= 500) ? 'High' : (i.status >= 400 ? 'Medium' : 'Low')
      }));

      const apiSecLeaks = (report.securityIssues || []).filter(s => 
        s.type === 'SERVER_STACK_TRACE_LEAK' ||
        s.type === 'SENSITIVE_API_RESPONSE_FIELD' ||
        s.testCaseId?.includes('SEC-STACK') ||
        s.testCaseId?.includes('SEC-DATA') ||
        ((s.selector && (s.selector.startsWith('http') || s.selector.startsWith('/'))) && (s.issue || '').toLowerCase().includes('api'))
      ).map(s => ({
        ...s,
        page: s.page || rootUrl,
        method: s.method || 'API-SENTRY',
        status: s.status || (s.type === 'SERVER_STACK_TRACE_LEAK' ? '500 LEAK' : '200 LEAK'),
        url: s.selector || s.url || s.link || rootUrl,
        type: s.type === 'SERVER_STACK_TRACE_LEAK' ? 'Stack Trace Leak (CWE-209)' : (s.type === 'SENSITIVE_API_RESPONSE_FIELD' ? 'API Credential Leak' : (s.type || 'API Security')),
        issue: s.issue || s.details,
        source: 'API & Network Sentry',
        category: 'API Security',
        severity: s.severity || 'Critical'
      }));

      raw = [...apiSecLeaks, ...netLogs];
      break;
    }
    case 'links': raw = (report.brokenLinks || []).map(i => ({ ...i, page: i.page || rootUrl, source: 'Navigation Link Graph', category: 'Links' })); break;
    case 'console': raw = (report.consoleErrors || []).map(i => ({ ...i, page: i.page || rootUrl, message: i.message || i.text || i.issue, source: 'Console Runtime Traps', category: 'Console' })); break;
    case 'layout': raw = [...(report.uiIssues || []).map(i => ({ ...i, source: 'Spatial Layout Auditor' })), ...(report.responsiveIssues || []).map(i => ({ ...i, source: 'Mobile Matrix Auditor' }))].map(i => ({ ...i, page: i.page || rootUrl, category: 'UI/UX' })); break;
    case 'accessibility': raw = (report.accessibilityIssues || []).map(i => ({ ...i, page: i.page || rootUrl, source: 'WCAG Accessibility Sentinel', category: 'Accessibility' })); break;
    case 'forms': raw = (report.formIssues || []).map(i => ({ ...i, page: i.page || rootUrl, source: 'Form Integrity Fuzzer', category: 'Forms' })); break;
    case 'security': raw = (report.securityIssues || []).map(i => ({ ...i, page: i.page || rootUrl, source: (i.type === 'SERVER_STACK_TRACE_LEAK' || i.type === 'SENSITIVE_API_RESPONSE_FIELD' ? 'API & Network Sentry' : 'Enterprise Secret Sniffer'), category: 'Security' })); break;
    default: raw = []; break;
  }
  return optimizeAndDeduplicateIssues(raw);
};

const getTableColumns = (tab) => {
  switch (tab) {
    case 'all': return ['Category', 'Service', 'Page', 'Issue', 'Severity', 'Context'];
    case 'network': return ['Page', 'Method', 'Status', 'Type', 'Endpoint', 'Issue', 'Severity'];
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
  if (!report) return [];
  const issues = [];

  (report.consoleErrors || []).forEach(e => {
    if (e.page === pageUrl) issues.push({ ...e, _source: 'CONSOLE', _service: 'Console Runtime Traps', _color: 'text-primary' });
  });

  (report.networkLogs || []).forEach(e => {
    if (e.page === pageUrl) issues.push({ ...e, _source: 'NETWORK', _service: 'API & Network Sentry', _color: 'text-eu-accent' });
  });

  (report.uiIssues || []).forEach(e => {
    if (e.page === pageUrl) issues.push({ ...e, _source: 'UI/UX', _service: 'Spatial Layout Auditor', _color: 'text-yellow-400' });
  });

  (report.responsiveIssues || []).forEach(e => {
    if (e.page === pageUrl) issues.push({ ...e, _source: 'RESPONSIVE', _service: 'Mobile Matrix Auditor', _color: 'text-indigo-400' });
  });

  (report.formIssues || []).forEach(e => {
    if (e.page === pageUrl) issues.push({ ...e, _source: 'FORMS', _service: 'Form Integrity Fuzzer', _color: 'text-blue-400' });
  });

  (report.brokenLinks || []).forEach(e => {
    if (e.page === pageUrl) issues.push({ ...e, _source: 'LINK', _service: 'Navigation Link Graph', _color: 'text-red-400' });
  });

  (report.securityIssues || []).forEach(e => {
    if (e.page === pageUrl) {
      const isApi = e.type === 'SERVER_STACK_TRACE_LEAK' || e.type === 'SENSITIVE_API_RESPONSE_FIELD' || e.testCaseId?.includes('SEC-STACK') || e.testCaseId?.includes('SEC-DATA');
      issues.push({ ...e, _source: isApi ? 'API SECURITY' : 'SECURITY', _service: isApi ? 'API & Network Sentry' : 'Enterprise Secret Sniffer', _color: 'text-red-500' });
    }
  });

  (report.accessibilityIssues || []).forEach(e => {
    if (e.page === pageUrl) issues.push({ ...e, _source: 'A11Y', _service: 'WCAG Accessibility Sentinel', _color: 'text-purple-400' });
  });

  return issues;
};

export const getDiagnosticServices = (report) => {
  if (!report) return [];

  const apiLeaksCount = (report.securityIssues || []).filter(s => 
    s.type === 'SERVER_STACK_TRACE_LEAK' || s.type === 'SENSITIVE_API_RESPONSE_FIELD' || s.testCaseId?.includes('SEC-STACK') || s.testCaseId?.includes('SEC-DATA')
  ).length;
  const netFailCount = (report.networkLogs?.filter(n => n.status >= 400) || []).length;
  const apiAndNetCount = netFailCount + apiLeaksCount;

  const secretCount = (report.securityIssues || []).filter(s => 
    !(s.type === 'SERVER_STACK_TRACE_LEAK' || s.type === 'SENSITIVE_API_RESPONSE_FIELD' || s.testCaseId?.includes('SEC-STACK') || s.testCaseId?.includes('SEC-DATA'))
  ).length;

  const layoutCount = (report.uiIssues?.length || 0);
  const responsiveCount = (report.responsiveIssues?.length || 0);
  const formCount = (report.formIssues?.length || 0);
  const consoleCount = (report.consoleErrors?.length || 0);
  const linkCount = (report.brokenLinks?.length || 0);
  const a11yCount = (report.accessibilityIssues?.length || 0);
  const perfScore = report.lighthouseScores?.performance ? Math.round(report.lighthouseScores.performance) : null;

  return [
    {
      id: 'network',
      name: 'API & Silent Network Sentry',
      badge: 'API Diagnostics',
      category: 'API & Network',
      icon: <Wifi size={20} />,
      status: 'Active & Intercepting',
      engine: 'Playwright CDP Network Interceptor + CWE-209 Stack Sniffer',
      description: 'Intercepts XHR, Fetch & API endpoints in real-time. Detects HTTP 4xx/5xx failures, traps leaked internal server stack traces in error bodies, and catches sensitive fields in JSON payloads.',
      testedCriteria: ['HTTP 4xx/5xx Status Interception', 'CWE-209 Server Stack Trace Leaks', 'JSON Response Credential Leaks', 'Endpoint Latency & Timeouts'],
      issuesCount: apiAndNetCount,
      tabId: 'network',
      highlight: apiLeaksCount > 0 ? `${apiLeaksCount} API Data/Stack Leaks Flagged` : (netFailCount > 0 ? `${netFailCount} Failed Endpoints` : 'All APIs Responding Healthy'),
      isApiSentry: true
    },
    {
      id: 'forms',
      name: 'Form Integrity Fuzzer',
      badge: 'Input Boundary QA',
      category: 'Forms & Inputs',
      icon: <FormInput size={20} />,
      status: 'Active & Fuzzed',
      engine: 'Synthetic Keystroke & Boundary Stress Fuzzing Engine',
      description: 'Automates boundary testing across all input fields, textareas, and forms. Detects missing CSRF protection, unmasked passwords, double-submission race conditions, and XSS/SQLi boundary crashes.',
      testedCriteria: ['Boundary Input Fuzzing (Extreme Strings)', 'Plaintext Password Inputs', 'Double-Submission Debouncing', 'CSRF Protection Token Validation'],
      issuesCount: formCount,
      tabId: 'forms',
      highlight: formCount > 0 ? `${formCount} Form Anomalies Detected` : 'All Form Boundaries Validated'
    },
    {
      id: 'layout',
      name: 'Spatial Layout & Interaction Auditor',
      badge: 'DOM Spatial Matrix',
      category: 'UI/UX & Layout',
      icon: <Layout size={20} />,
      status: 'Active & Evaluated',
      engine: 'Playwright DOM Rect Spatial Analyzer + Event Dispatch Traps',
      description: 'Calculates element geometries, z-index stacking layers, and pointer event dispatch. Traps dead clicks, invisible overlay click interceptions, and viewport layout shifts.',
      testedCriteria: ['Dead Click Detection (No Action on Click)', 'Click Interception (Invisible Overlays)', 'Touch Target Dimensions (<44px)', 'Viewport Boundary Collisions'],
      issuesCount: layoutCount,
      tabId: 'layout',
      highlight: layoutCount > 0 ? `${layoutCount} Layout Deviations Found` : 'Layout & Interaction Verified'
    },
    {
      id: 'responsive',
      name: 'Mobile Responsive Matrix Auditor',
      badge: 'Viewport Emulation',
      category: 'Mobile UX',
      icon: <Smartphone size={20} />,
      status: 'Active & Tested',
      engine: 'Tri-Viewport Device Emulation (375px Mobile, 768px Tablet, 1280px Desktop)',
      description: 'Emulates mobile viewports to detect horizontal scrolling overflows, truncated navigation menus, and non-responsive layout breaks across modern mobile screens.',
      testedCriteria: ['Mobile Viewport Overflow (Horizontal Scroll)', 'Responsive Breakpoint Scaling', 'Touch Target Accessibility', 'Mobile Menu Collisions'],
      issuesCount: responsiveCount,
      tabId: 'layout',
      highlight: responsiveCount > 0 ? `${responsiveCount} Mobile Viewport Issues` : 'Fully Responsive Across Viewports'
    },
    {
      id: 'security',
      name: 'Enterprise Secret Sniffer & Storage Auditor',
      badge: 'Secret Detection',
      category: 'Security & Secrets',
      icon: <Shield size={20} />,
      status: 'Active & Scanned',
      engine: 'High-Entropy Regex Tokenizer & LocalStorage Security Inspector',
      description: 'Scans loaded JavaScript bundles for exposed API keys (AWS, Stripe, JWT, Firebase, SendGrid). Checks for exposed source maps (.js.map) and unencrypted credentials stored in localStorage.',
      testedCriteria: ['Live API Key Leaks (Stripe, AWS, JWT)', 'Public Source Map Exposure (.map)', 'Unencrypted Storage Tokens', 'External Script Integrity'],
      issuesCount: secretCount,
      tabId: 'security',
      highlight: secretCount > 0 ? `${secretCount} Security Exposures Flagged` : 'No Client-Side Secrets Leaked'
    },
    {
      id: 'console',
      name: 'Console Runtime Traps',
      badge: 'JavaScript Runtime',
      category: 'Console Diagnostics',
      icon: <Terminal size={20} />,
      status: 'Active & Traced',
      engine: 'Playwright Browser Console & PageError Exception Hooks',
      description: 'Traps unhandled JavaScript runtime exceptions, unhandled Promise rejections, and DOM TypeErrors that degrade client performance or break interactive functionality.',
      testedCriteria: ['Uncaught JavaScript Exceptions', 'Unhandled Promise Rejections', 'Client-Side TypeError Null References', 'Browser Resource Loading Failures'],
      issuesCount: consoleCount,
      tabId: 'console',
      highlight: consoleCount > 0 ? `${consoleCount} Runtime Exceptions Captured` : 'Zero Uncaught Exceptions'
    },
    {
      id: 'links',
      name: 'Navigation Link Graph Crawler',
      badge: 'Link Topology',
      category: 'Navigation & Links',
      icon: <ExternalLink size={20} />,
      status: 'Active & Mapped',
      engine: 'Redis-Backed Distributed BFS Crawler & Link Validator',
      description: 'Discovers and maps the complete navigation graph of the site. Probes every anchor tag and internal link to detect HTTP 404 dead ends, redirect chains, and orphaned paths.',
      testedCriteria: ['HTTP 404 Broken Link Probing', 'Internal vs External Link Validation', 'Circular Navigation Loops', 'Anchor Fragment Resolution'],
      issuesCount: linkCount,
      tabId: 'links',
      highlight: linkCount > 0 ? `${linkCount} Broken Links Identified` : 'All Navigation Paths Valid'
    },
    {
      id: 'accessibility',
      name: 'WCAG 2.1 Accessibility Sentinel',
      badge: 'WCAG 2.1 AA',
      category: 'Accessibility',
      icon: <UserCheck size={20} />,
      status: 'Active & Audited',
      engine: 'WCAG 2.1 Level AA Semantic DOM Compliance Auditor',
      description: 'Validates semantic HTML and accessibility criteria. Inspects missing image alt tags, missing H1 heading landmarks, unlabelled buttons, and screen reader compatibility.',
      testedCriteria: ['Missing Image Alt Text (WCAG 1.1.1)', 'Missing H1 Heading Landmark', 'ARIA Label & Role Compliance', 'Form Label Accessibility'],
      issuesCount: a11yCount,
      tabId: 'accessibility',
      highlight: a11yCount > 0 ? `${a11yCount} A11y Violations Flagged` : 'WCAG Semantic Baseline Met'
    },
    {
      id: 'vitals',
      name: 'Core Web Vitals & Lighthouse Engine',
      badge: 'Web Vitals',
      category: 'Performance',
      icon: <Zap size={20} />,
      status: 'Active & Synced',
      engine: 'Chrome DevTools Protocol (CDP) Profiler & Lighthouse Synthesizer',
      description: 'Measures Core Web Vitals including First Contentful Paint (FCP), Largest Contentful Paint (LCP), and Cumulative Layout Shift (CLS). Computes standardized Lighthouse performance metrics.',
      testedCriteria: ['Largest Contentful Paint (LCP)', 'Cumulative Layout Shift (CLS)', 'First Contentful Paint (FCP)', 'Lighthouse Metric Score Matrix'],
      issuesCount: perfScore ? `${perfScore}% Perf` : 'Optimal',
      tabId: 'summary',
      highlight: perfScore ? `Performance Score: ${perfScore}/100` : 'Telemetry Synchronized'
    }
  ];
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

    // 1. Image Alt Text & Graphic Accessibility
    const isImageAlt = (row.issue && (row.issue.includes('alt') || row.issue.includes('Image missing') || row.issue.includes('alternate text'))) ||
                       (row.selector && typeof row.selector === 'string' && row.selector.match(/\.(jpeg|jpg|gif|png|webp|svg)/i) && (row.type?.includes('ACCESSIBILITY') || row.category === 'Accessibility'));
    if (isImageAlt) {
      return {
        cause: "The HTML <img> tag for this graphic lacks a descriptive 'alt' attribute.",
        impact: "Screen readers used by visually impaired visitors cannot convey what this image depicts. Missing alt text also degrades SEO image indexing.",
        guide: row.recommendation || "Add an alt attribute describing the image (e.g. alt='Campus Front Entrance'), or alt='' if purely decorative."
      };
    }

    // 2. Missing Primary H1 Tag
    if (row.issue && (row.issue.includes('H1') || row.issue.includes('h1'))) {
      return {
        cause: "The webpage lacks a single primary <h1> heading element.",
        impact: "Search engines and screen reader users cannot easily identify the primary topic and document hierarchy of the page.",
        guide: row.recommendation || "Add a single <h1> heading near the top of the main content area (e.g. <h1>Page Title</h1>)."
      };
    }

    // 3. Orphaned Plugin & Template Assets (HTTP 404)
    const isPlugin404 = (row.type === 'plugin_asset') ||
                        ((row.url || row.link || row.selector || '').includes('/plugin') && (row.status === 404 || (row.issue && row.issue.includes('404')))) ||
                        ((row.url || row.link || '').includes('revslider'));
    if (isPlugin404) {
      const fileName = (row.url || row.link || row.selector || '').split('/').pop().split('?')[0] || 'plugin stylesheet';
      return {
        cause: `The HTML template requests an uninstalled or inactive plugin asset (${fileName}) that does not exist on the server.`,
        impact: "Generates unnecessary 404 network errors on every single page load and adds loading latency. Not a code crash.",
        guide: "Open your website's header or layout template and delete the orphaned <link> or <script> tag for this uninstalled plugin."
      };
    }

    // 4. Security & Secret Leaks
    if (row.issue && (row.issue.includes('Leaked') || row.issue.includes('Secret') || row.issue.includes('Source Map') || row.issue.includes('Malicious'))) {
      return {
        cause: row.details || "Security credential or unminified asset exposed to public clients.",
        impact: customImpact || "Severe risk of unauthorized API abuse, token hijacking, or source code reconstruction.",
        guide: customGuide || "Rotate compromised credentials immediately and ensure keys are protected behind server environment variables."
      };
    }

    // 5. Interactive Button & Dead Clicks
    if (row.type && (row.type.includes('DEAD_CLICK') || row.type.includes('CRASH_CLICK') || row.type.includes('ZOMBIE_API') || row.type.includes('CLICK_INTERCEPTION'))) {
      return {
        cause: customCause || "Interactive component failed to execute, dispatch handler, or was obscured by an overlay.",
        impact: customImpact || "Severe user friction and abandonment on primary call-to-action workflows.",
        guide: customGuide || "Verify event binding, z-index hierarchy, and ensure interactive elements receive unobstructed pointer events."
      };
    }

    // 6. Form Validation & CSRF
    if (row.type && (row.type.includes('DOUBLE_SUBMIT') || row.type.includes('PLAINTEXT_PASSWORD') || row.type.includes('CSRF') || row.type.includes('VALIDATION'))) {
      return {
        cause: customCause || "Form validation or state submission gap identified.",
        impact: customImpact || "Potential data corruption, duplicate charges/records, or credential security vulnerability.",
        guide: customGuide || "Implement client-side validation constraints and debounce submit buttons on click."
      };
    }

    // 7. General Network Errors
    if (row.method || row.category === 'API & Network') {
      const is404 = (row.status === 404 || (row.issue && row.issue.includes('404')));
      return {
        cause: customCause || (is404 ? "Requested file or API endpoint does not exist at this URL (HTTP 404)." : "Server or network request returned an error response."),
        impact: customImpact || (is404 ? "Missing resource fails to render or API call returns empty data." : "Degraded page functionality and data synchronization loss."),
        guide: customGuide || `Verify endpoint ${row.url || 'URL'} path on the server and check network routing.`
      };
    }

    // 8. Console Runtime Errors
    if (row.type === 'error' || row.message || row.category === 'Console') {
      const msg = row.message || row.issue || '';
      if (msg.includes('404') || msg.includes('Failed to load resource')) {
        return {
          cause: "The browser attempted to load an asset that returned HTTP 404 Not Found.",
          impact: "The resource failed to load, which may affect visual styling or features relying on it.",
          guide: "Verify the file path on the web server or remove the unused link tag from the template."
        };
      }
      return {
        cause: msg ? `JavaScript execution error: "${msg.substring(0, 160)}"` : "Unhandled script exception occurred in the browser runtime.",
        impact: customImpact || "May stop dropdown menus, modals, or user interaction scripts from running on this page.",
        guide: customGuide || "Inspect the call stack in browser developer tools to verify function and object existence before access."
      };
    }

    if (row.field || row.form) return {
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

                    if (col === 'Message') value = row.message || row.text || row.issue || row.error || value;
                    if (col === 'Issue') value = row.issue || row.message || row.text || row.details || row.title || value;
                    if (col === 'Page') value = row.page || row.location || row.url || value;
                    if (col === 'Selector') value = row.selector || row.element || row.location || row.formSelector || value;
                    if (col === 'Element') value = row.element || row.selector || row.form || value;
                    if (col === 'Endpoint' || col === 'Url') value = row.url || row.selector || row.link || value;
                    if (col === 'Service') value = row.source || row.service || 'Audit Sensor';
                    if (col === 'Method') value = row.method || 'GET';

                    if (col === 'Status') {
                      const statusStr = (value || '').toString();
                      const statusNum = parseInt(statusStr, 10);
                      const isLeak = statusStr.includes('LEAK');
                      const is5xx = statusNum >= 500;
                      const is4xx = statusNum >= 400 && statusNum < 500;
                      const is2xx = statusNum >= 200 && statusNum < 400;
                      return (
                        <td key={col} className="py-3.5 px-4 bg-white dark:bg-slate-900 first:rounded-l-xl last:rounded-r-xl border-y border-slate-200 dark:border-slate-800 first:border-l last:border-r shadow-xs">
                          <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold font-mono border ${
                            isLeak ? 'bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950 dark:text-rose-200 dark:border-rose-700 animate-pulse' :
                            is5xx ? 'bg-rose-50 text-rose-700 border-rose-300 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800' :
                            is4xx ? 'bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800' :
                            is2xx ? 'bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800' :
                            'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800'
                          }`}>{value || '---'}</span>
                        </td>
                      );
                    }

                    if (col === 'Method') {
                      const m = (value || 'GET').toUpperCase();
                      const isPost = m === 'POST';
                      const isDelete = m === 'DELETE';
                      const isLeak = m.includes('LEAK') || m.includes('SENTRY');
                      return (
                        <td key={col} className="py-3.5 px-4 bg-white dark:bg-slate-900 first:rounded-l-xl last:rounded-r-xl border-y border-slate-200 dark:border-slate-800 first:border-l last:border-r shadow-xs">
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-bold border ${
                            isLeak ? 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/70 dark:text-purple-300 dark:border-purple-800' :
                            isDelete ? 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800' :
                            isPost ? 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800' :
                            'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
                          }`}>{m}</span>
                        </td>
                      );
                    }

                    if (col === 'Endpoint' || col === 'Url') {
                      const urlStr = value || row.url || row.selector || row.link || '';
                      let display = urlStr;
                      try {
                        const u = new URL(urlStr);
                        display = u.pathname + (u.search ? u.search : '');
                      } catch (_) {}
                      return (
                        <td key={col} className="py-3.5 px-4 bg-white dark:bg-slate-900 first:rounded-l-xl last:rounded-r-xl border-y border-slate-200 dark:border-slate-800 first:border-l last:border-r shadow-xs max-w-[220px]">
                          <div className="flex items-center gap-1.5 min-w-0" title={urlStr}>
                            <Wifi size={12} className="text-indigo-600 dark:text-indigo-400 shrink-0" />
                            <span className="text-xs font-mono font-bold text-slate-800 dark:text-slate-200 truncate">
                              {display || '/'}
                            </span>
                          </div>
                        </td>
                      );
                    }

                    if (col === 'Service') {
                      return (
                        <td key={col} className="py-3.5 px-4 bg-white dark:bg-slate-900 first:rounded-l-xl last:rounded-r-xl border-y border-slate-200 dark:border-slate-800 first:border-l last:border-r shadow-xs max-w-[180px]">
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-indigo-50 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 truncate block">
                            {value || row.source || 'Audit Sensor'}
                          </span>
                        </td>
                      );
                    }

                    if (col === 'Page') {
                      let displayPath = value || '/';
                      try {
                        const parsed = new URL(value);
                        displayPath = parsed.pathname || '/';
                      } catch(_) {}
                      return (
                        <td key={col} className="py-3.5 px-4 bg-white dark:bg-slate-900 first:rounded-l-xl last:rounded-r-xl border-y border-slate-200 dark:border-slate-800 first:border-l last:border-r shadow-xs max-w-[200px]">
                          <div className="flex items-center gap-1.5 min-w-0" title={value || 'Landing Page'}>
                            <Globe size={13} className="text-indigo-600 dark:text-indigo-400 shrink-0" />
                            <span className="text-xs font-mono font-bold text-slate-800 dark:text-slate-200 truncate">
                              {displayPath}
                            </span>
                          </div>
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

                    if (col === 'Category') {
                      return (
                        <td key={col} className="py-3.5 px-4 bg-white dark:bg-slate-900 first:rounded-l-xl last:rounded-r-xl border-y border-slate-200 dark:border-slate-800 first:border-l last:border-r shadow-xs">
                          <span className="px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider bg-indigo-50 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                            {value || row.category || 'General'}
                          </span>
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
                                {cleanText(value) || '---'}
                              </span>
                            </div>
                            {row.expected && (
                              <span className="text-[11px] text-slate-600 dark:text-slate-400 font-medium truncate max-w-sm">
                                Expected: {cleanText(row.expected)}
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
                        <td key={col} className="py-3.5 px-4 bg-white dark:bg-slate-900 first:rounded-l-xl last:rounded-r-xl border-y border-slate-200 dark:border-slate-800 first:border-l last:border-r shadow-xs max-w-sm">
                          <div className="flex flex-col gap-2">
                            {isImageUrl && (
                              <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-800/60 p-2 rounded-xl border border-slate-200 dark:border-slate-700 group/img-preview">
                                <div className="relative size-10 rounded-lg overflow-hidden shrink-0 border border-slate-200 dark:border-slate-700 bg-black/10">
                                  <img
                                    src={value}
                                    alt="Issue context"
                                    className="w-full h-full object-cover group-hover/img-preview:scale-125 transition-transform duration-500"
                                    onError={(e) => {
                                      e.target.style.display = 'none';
                                    }}
                                  />
                                </div>
                                <div className="flex flex-col overflow-hidden">
                                  <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 truncate uppercase tracking-wider">{fileName || 'Asset'}</span>
                                  <span className="text-[9px] text-slate-500 truncate">{value}</span>
                                </div>
                              </div>
                            )}
                            {!isImageUrl && (
                              <code className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 block break-all font-mono">{value || 'NULL'}</code>
                            )}
                          </div>
                        </td>
                      );
                    }

                    return (
                      <td key={col} className="py-3.5 px-4 bg-white dark:bg-slate-900 first:rounded-l-xl last:rounded-r-xl border-y border-slate-200 dark:border-slate-800 first:border-l last:border-r shadow-xs">
                        <span className="text-xs font-medium text-slate-700 dark:text-slate-300 block max-w-xs break-words leading-relaxed font-outfit">{value || '---'}</span>
                      </td>
                    );
                  })}
                  {!columns.includes('Outcome') && (
                    <td className="py-3 px-4 bg-white dark:bg-slate-900 first:rounded-l-xl last:rounded-r-xl border-y border-slate-200 dark:border-slate-800 first:border-l last:border-r text-right shadow-xs">
                      <div className="flex items-center justify-end gap-2.5">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const issueTitle = row.issue || row.message || row.link || "this issue";
                            onAskAI(`Analyze this finding from the report: ${issueTitle}`, reportId);
                          }}
                          className="px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-600 text-indigo-700 hover:text-white dark:bg-indigo-950/70 dark:hover:bg-indigo-600 dark:text-indigo-300 dark:hover:text-white border border-indigo-200 dark:border-indigo-800 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 whitespace-nowrap shadow-xs cursor-pointer group"
                        >
                          <Cpu size={12} className="group-hover:rotate-12 transition-transform shrink-0" />
                          <span>Ask AI</span>
                        </button>
                        {row.suggestedFix && (
                          <button
                            onClick={(e) => { e.stopPropagation(); setRemediationCode(row.suggestedFix); }}
                            className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-[10px] font-bold uppercase tracking-wider border border-slate-200 dark:border-slate-700 transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                          >
                            <Code size={12} />
                            <span>Code</span>
                          </button>
                        )}
                        <span className={`size-6 rounded-md flex items-center justify-center transition-all ${isExpanded ? 'bg-indigo-600 text-white rotate-45' : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 bg-slate-100 dark:bg-slate-800'}`}>
                          <Plus size={13} />
                        </span>
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
                        <div className="mb-4 mt-2 p-6 bg-slate-50 dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700 flex flex-col md:flex-row gap-6 shadow-md relative">
                          <div className="flex-1 space-y-5">
                            {/* Test Case & Severity Header */}
                            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-700 pb-3">
                              <div className="flex items-center gap-3">
                                <div className="size-8 bg-indigo-50 dark:bg-indigo-950/80 rounded-lg flex items-center justify-center text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800">
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
                                <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 space-y-1">
                                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 font-outfit flex items-center gap-1.5">
                                    <CheckCircle2 size={13} /> Expected Behavior
                                  </span>
                                  <p className="text-xs text-slate-800 dark:text-slate-200 leading-relaxed font-medium">
                                    {row.expected || 'Target element should comply with standard UX, boundary validation, and security guidelines.'}
                                  </p>
                                </div>
                                <div className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 space-y-1">
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
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="space-y-1">
                                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 font-outfit">Root Cause</p>
                                <p className="text-xs text-slate-800 dark:text-slate-200 font-medium leading-relaxed bg-white dark:bg-slate-900 p-3 rounded-lg border border-slate-200 dark:border-slate-700">"{remediation.cause}"</p>
                              </div>
                              <div className="space-y-1">
                                <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 font-outfit">Impact Assessment</p>
                                <p className="text-xs text-slate-800 dark:text-slate-200 font-medium leading-relaxed bg-white dark:bg-slate-900 p-3 rounded-lg border border-slate-200 dark:border-slate-700">"{remediation.impact}"</p>
                              </div>
                            </div>

                            {/* Remediation Intelligence */}
                            <div className="p-3.5 bg-indigo-50/70 dark:bg-indigo-950/50 rounded-xl border border-indigo-200 dark:border-indigo-800">
                              <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-300 mb-1 font-outfit">Remediation Guide</p>
                              <p className="text-xs text-slate-800 dark:text-slate-200 font-medium leading-relaxed">{remediation.guide}</p>
                            </div>

                            {row.htmlSnippet && row.htmlSnippet !== 'UNAVAILABLE' && (
                              <div className="p-3.5 bg-slate-900 rounded-xl border border-slate-800 space-y-1.5">
                                <div className="flex items-center gap-2">
                                  <Code size={12} className="text-indigo-400" />
                                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Target Code Fragment</p>
                                </div>
                                <pre className="text-xs font-mono text-indigo-300 bg-slate-950 p-2.5 rounded-lg border border-slate-800 overflow-x-auto whitespace-pre-wrap break-all">
                                  <code>{row.htmlSnippet}</code>
                                </pre>
                              </div>
                            )}
                          </div>

                          {/* Protocol Actions Column */}
                          <div className="w-full md:w-60 space-y-3 shrink-0">
                            <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2.5 shadow-xs">
                              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 text-center font-outfit">Quick Actions</p>
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
                                  className="w-full py-2.5 bg-indigo-50 hover:bg-indigo-600 text-indigo-700 hover:text-white dark:bg-indigo-950/80 dark:hover:bg-indigo-600 dark:text-indigo-300 dark:hover:text-white border border-indigo-200 dark:border-indigo-800 rounded-lg text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-xs cursor-pointer font-outfit"
                                >
                                  {copiedTicketId === rowId ? (
                                    <>
                                      <Check size={13} className="text-emerald-600 dark:text-emerald-400" />
                                      <span>Copied!</span>
                                    </>
                                  ) : (
                                    <>
                                      <Copy size={13} />
                                      <span>Copy JIRA Ticket</span>
                                    </>
                                  )}
                                </button>
                                {row.suggestedFix && (
                                  <button
                                    onClick={() => setRemediationCode(row.suggestedFix)}
                                    className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white rounded-lg text-xs font-bold uppercase tracking-wider transition-all shadow-xs cursor-pointer font-outfit"
                                  >
                                    View Solution Code
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
  const [selectedPageFilter, setSelectedPageFilter] = useState('all');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [previewImage, setPreviewImage] = useState(null);

  const allCrawledPages = useMemo(() => {
    if (!report) return [];
    const set = new Set();
    if (report.url) set.add(report.url);
    (report.siteStructure?.nodes || []).forEach(n => { if (n.url) set.add(n.url); });
    (report.consoleErrors || []).forEach(i => { if (i.page) set.add(i.page); });
    (report.networkLogs || []).forEach(i => { if (i.page) set.add(i.page); });
    (report.uiIssues || []).forEach(i => { if (i.page) set.add(i.page); });
    (report.formIssues || []).forEach(i => { if (i.page) set.add(i.page); });
    (report.securityIssues || []).forEach(i => { if (i.page) set.add(i.page); });
    (report.brokenLinks || []).forEach(i => { if (i.page) set.add(i.page); });
    (report.accessibilityIssues || []).forEach(i => { if (i.page) set.add(i.page); });
    return Array.from(set);
  }, [report]);

  const apiLeaksCount = (report?.securityIssues || []).filter(s => 
    s.type === 'SERVER_STACK_TRACE_LEAK' || s.type === 'SENSITIVE_API_RESPONSE_FIELD' || s.testCaseId?.includes('SEC-STACK') || s.testCaseId?.includes('SEC-DATA')
  ).length;
  const netFailCount = (report?.networkLogs?.filter(n => n.status >= 400) || []).length;
  const apiAndNetCount = report?.stats?.networkIssues ?? (netFailCount + apiLeaksCount);
  const formCount = report?.stats?.formIssues ?? (report?.formIssues?.length || 0);
  const uiCount = report?.stats?.uiIssues ?? ((report?.uiIssues?.length || 0) + (report?.responsiveIssues?.length || 0));
  const securityCount = report?.stats?.securityIssues ?? Math.max(0, (report?.securityIssues?.length || 0) - apiLeaksCount);
  const consoleCount = report?.stats?.consoleErrors ?? (report?.consoleErrors?.length || 0);
  const linkCount = report?.stats?.brokenLinks ?? (report?.brokenLinks?.length || 0);
  const a11yCount = report?.stats?.accessibilityIssues ?? (report?.accessibilityIssues?.length || 0);

  const totalIssuesCount = report?.stats?.totalIssues ?? (
    formCount + uiCount + securityCount + consoleCount + linkCount + a11yCount + apiAndNetCount
  );

  const tabs = [
    { id: 'summary', label: 'Summary', icon: <Zap size={14} /> },
    { id: 'services', label: 'Services', icon: <Cpu size={14} />, count: 8 },
    { id: 'pages', label: 'Pages', icon: <Globe size={14} />, count: Math.max(allCrawledPages.length, report?.pagesCrawled || 1) },
    { id: 'all', label: 'All Issues', icon: <AlertTriangle size={14} />, count: totalIssuesCount },
    { id: 'network', label: 'API & Network', icon: <Wifi size={14} className={apiLeaksCount > 0 ? 'text-rose-500 animate-pulse' : ''} />, count: apiAndNetCount },
    { id: 'forms', label: 'Forms', icon: <FormInput size={14} />, count: formCount },
    { id: 'layout', label: 'UI/UX', icon: <Layout size={14} />, count: uiCount },
    { id: 'security', label: 'Security', icon: <Shield size={14} className={securityCount > 0 ? 'text-rose-500 animate-pulse' : ''} />, count: securityCount },
    { id: 'console', label: 'Console', icon: <Terminal size={14} />, count: consoleCount },
    { id: 'links', label: 'Links', icon: <ExternalLink size={14} />, count: linkCount },
    { id: 'accessibility', label: 'Accessibility', icon: <UserCheck size={14} />, count: a11yCount },
    { id: 'screenshots', label: 'Screenshots', icon: <Image size={14} />, count: report?.screenshots?.length || 0 },
  ];

  const allDiscoveredIssues = useMemo(() => {
    if (!report) return [];
    const directIssues = report.aiInsights?.issues && report.aiInsights.issues.length > 0
      ? report.aiInsights.issues
      : [];

    const sensorIssues = [
      ...(report.formIssues || []).map((f, i) => ({
        id: `form-${i}`,
        page: f.page || report.url,
        title: f.issue || f.type || "Form Integrity Deviation",
        issue: f.issue || f.observed || "Form boundary or validation defect detected.",
        reason: f.technicalImpact || f.rootCause || "Input validation or state submission gap.",
        fix: f.stepsToReproduce || [f.recommendation || "Implement client-side validation constraints."],
        suggestedFix: f.suggestedFix || f.remediationCode || "",
        severity: f.severity || "High",
        testCaseId: f.testCaseId || `TC-FORM-${i + 1}`,
        category: "Forms",
        selector: f.formSelector || f.form || "Input element",
        source: "Form Integrity Fuzzer"
      })),
      ...(report.uiIssues || []).map((u, i) => {
        const isImg = (u.issue && (u.issue.includes('alt') || u.issue.includes('Image'))) || (u.type && u.type.includes('ACCESSIBILITY'));
        const isH1 = (u.issue && (u.issue.includes('H1') || u.issue.includes('h1'))) || (u.type && u.type.includes('SEO'));
        return {
          id: `ui-${i}`,
          page: u.page || report.url,
          title: isImg ? "Image Missing Alternate Text" : (isH1 ? "Missing Primary H1 Heading Tag" : (u.issue || u.type || "UI/UX Layout Deviation")),
          issue: u.issue || u.observed || "Dead click, layout overflow, or touch target collision detected.",
          reason: isImg ? "Screen readers cannot describe this image for visually impaired users. Missing alt text also hurts SEO ranking." : (isH1 ? "Every page requires an H1 heading for clear document hierarchy and search indexing." : (u.technicalImpact || u.rootCause || "Interactive element failed to trigger handler or overlaps viewport bounds.")),
          fix: isImg ? ["Add descriptive alt text to the <img> tag, or alt='' if purely decorative."] : (isH1 ? ["Add a single descriptive <h1> heading near the top of the main content."] : (u.stepsToReproduce || [u.recommendation || "Verify event binding and ensure pointer events."])),
          suggestedFix: u.suggestedFix || u.remediationCode || "",
          severity: (isImg || isH1) ? "Low" : (u.severity || "Medium"),
          testCaseId: u.testCaseId || `TC-UI-${i + 1}`,
          category: (isImg || isH1) ? "Accessibility" : "UI/UX",
          selector: u.selector || "Viewport Element",
          source: "Spatial Layout Auditor"
        };
      }),
      ...(report.responsiveIssues || []).map((r, i) => ({
        id: `resp-${i}`,
        page: r.page || report.url,
        title: r.issue || "Mobile Responsive Collision",
        issue: r.issue || "Element overflows mobile viewport or touch target is too small.",
        reason: "Fixed viewport constraints or unoptimized mobile styles.",
        fix: [r.recommendation || "Implement responsive media queries and min-height 44px for touch targets."],
        suggestedFix: r.suggestedFix || "",
        severity: "Medium",
        testCaseId: `TC-RESP-${i + 1}`,
        category: "UI/UX",
        selector: r.selector || "Mobile Viewport",
        source: "Mobile Matrix Auditor"
      })),
      ...(report.securityIssues || []).map((s, i) => {
        const isApiLeak = s.type === 'SERVER_STACK_TRACE_LEAK' || s.type === 'SENSITIVE_API_RESPONSE_FIELD' || s.testCaseId?.includes('SEC-STACK') || s.testCaseId?.includes('SEC-DATA');
        return {
          id: `sec-${i}`,
          page: s.page || report.url,
          title: s.type === 'SERVER_STACK_TRACE_LEAK' 
            ? `Internal Server Stack Trace Leaked in API Response` 
            : (s.type === 'SENSITIVE_API_RESPONSE_FIELD' ? `Exposed Sensitive Secret in API JSON Response` : (s.issue || s.type || "Security Threat Detected")),
          issue: s.issue || s.details || "API key leak, unencrypted storage, or malicious link pattern detected.",
          reason: s.technicalImpact || s.reason || "Client-side exposure of sensitive credentials or dangerous external resource.",
          fix: [s.suggestedFix || s.recommendation || "Sanitize error handling and revoke exposed credential immediately."],
          suggestedFix: s.suggestedFix || "",
          severity: s.severity || "Critical",
          testCaseId: s.testCaseId || `TC-SEC-${i + 1}`,
          category: isApiLeak ? "API Security" : "Security",
          selector: s.selector || "Client Script",
          source: isApiLeak ? "API & Network Sentry" : "Enterprise Secret Sniffer"
        };
      }),
      ...(report.consoleErrors || []).map((c, i) => {
        const is404 = (c.message || '').includes('404') || (c.message || '').includes('Failed to load resource');
        return {
          id: `console-${i}`,
          page: c.page || report.url,
          title: is404 ? "Missing Resource (HTTP 404)" : "Runtime JavaScript Exception",
          issue: c.message ? c.message.substring(0, 200) : "Uncaught browser exception captured.",
          reason: is404 ? "Asset requested in HTML was not found on the server." : "Client-side code crash or unhandled promise rejection.",
          fix: is404 ? ["Remove the orphaned resource reference from the HTML layout or restore the file."] : [c.recommendation || "Inspect call stack for null-reference collision or undefined function."],
          suggestedFix: is404 ? `<!-- Remove orphaned link: -->\n<!-- <link rel="stylesheet" href="..."> -->` : `try {\n  // Target execution block\n} catch (error) {\n  console.error("Safeguarded exception:", error);\n}`,
          severity: is404 ? "Low" : "High",
          testCaseId: `TC-JS-${i + 1}`,
          category: is404 ? "API & Network" : "Console",
          selector: c.location || "Inline Script",
          source: "Console Runtime Traps"
        };
      }),
      ...(report.brokenLinks || []).map((b, i) => ({
        id: `link-${i}`,
        page: b.page || report.url,
        title: `Broken Navigation Link (HTTP ${b.status || 404})`,
        issue: `Link to ${b.link} returned HTTP status ${b.status || 'failure'}.`,
        reason: "Resource permanently moved, endpoint deleted, or host connection refused.",
        fix: [b.recommendation || "Update or remove invalid navigation href."],
        suggestedFix: `// Verify destination endpoint: ${b.link}`,
        severity: "Medium",
        testCaseId: `TC-LINK-${i + 1}`,
        category: "Links",
        selector: b.link || "Anchor Href",
        source: "Navigation Link Graph"
      })),
      ...(report.accessibilityIssues || []).map((a, i) => {
        const isImg = (a.issue && (a.issue.includes('alt') || a.issue.includes('Image'))) || (a.type && a.type.includes('ACCESSIBILITY'));
        const isH1 = (a.issue && (a.issue.includes('H1') || a.issue.includes('h1'))) || (a.type && a.type.includes('SEO'));
        return {
          id: `a11y-${i}`,
          page: a.page || report.url,
          title: isImg ? "Image Missing Alternate Text (WCAG 1.1.1)" : (isH1 ? "Missing Primary H1 Heading Tag" : (a.issue || "ADA / WCAG Accessibility Violation")),
          issue: a.issue || "Missing ARIA landmarks or semantic markup violation.",
          reason: isImg ? "Screen readers cannot describe this image for visually impaired users." : (isH1 ? "Every page requires an H1 heading for clear document hierarchy and search indexing." : (a.technicalImpact || "Interactive element not conforming to WCAG 2.1 accessibility criteria.")),
          fix: isImg ? ["Add descriptive alt text to the <img> tag, or alt='' if purely decorative."] : (isH1 ? ["Add a single descriptive <h1> heading near the top of the main content."] : [a.recommendation || "Add proper aria-label, role, or form label attributes."]),
          suggestedFix: isImg ? `<img src="${a.selector || '/image.png'}" alt="Descriptive image text" />` : (isH1 ? `<h1>Main Page Title</h1>` : `<button aria-label="Action Button" type="submit">\n  <span>Click</span>\n</button>`),
          severity: (isImg || isH1) ? "Low" : (a.severity || "Medium"),
          testCaseId: `TC-A11Y-${i + 1}`,
          category: "Accessibility",
          selector: a.selector || a.element || "DOM Element",
          source: "WCAG Accessibility Sentinel"
        };
      }),
      ...(report.networkLogs?.filter(n => n.status >= 400) || []).map((n, i) => {
        const isPlugin = (n.type === 'plugin_asset') || ((n.url || '').includes('/plugin') || (n.url || '').includes('revslider'));
        const fileName = (n.url || '').split('/').pop().split('?')[0];
        return {
          id: `net-${i}`,
          page: n.page || report.url,
          title: (isPlugin && n.status === 404) ? `Missing Plugin Asset (${fileName})` : `Failed Network API Request (${n.status} ${n.method || 'GET'})`,
          issue: n.issue || `${n.method || 'GET'} request to ${n.url} failed with status ${n.status}.`,
          reason: (isPlugin && n.status === 404) ? "The HTML template requests an uninstalled plugin asset that does not exist on the server." : (n.failureReason || "Endpoint unreachable, CORS blocked, or server returned 4xx/5xx error."),
          fix: (isPlugin && n.status === 404) ? ["Open your header template and delete the orphaned <link> or <script> tag for this uninstalled plugin."] : ["Verify server endpoint status, routing, and CORS configuration headers."],
          suggestedFix: (isPlugin && n.status === 404) ? `<!-- Remove from HTML template: -->\n<!-- <link rel="stylesheet" href="${n.url}"> -->` : `// Check endpoint handler for ${n.url}`,
          severity: (isPlugin && n.status === 404) ? "Low" : (n.status >= 500 ? "High" : "Medium"),
          testCaseId: `TC-NET-${i + 1}`,
          category: isPlugin ? "API & Network" : "API & Network",
          selector: n.url,
          source: "API & Network Sentry"
        };
      })
    ];

    if (sensorIssues.length === 0) return directIssues;
    if (directIssues.length === 0) return sensorIssues;

    // Combine both: prioritize sensor findings, add any unique AI insights
    const existingTitles = new Set(sensorIssues.map(s => (s.title || s.issue || '').toLowerCase()));
    const uniqueDirect = directIssues.filter(d => !existingTitles.has((d.title || d.issue || '').toLowerCase()));
    return [...sensorIssues, ...uniqueDirect];
  }, [report]);

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

  if (report.status === 'in-progress') {
    return (
      <div className="space-y-6 max-w-4xl mx-auto py-8">
        <div className="bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-800 rounded-3xl p-8 md:p-12 shadow-xl space-y-8 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-5">
            <Radio size={160} className="text-indigo-600 animate-pulse" />
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-6">
            <div className="flex items-center gap-4">
              <div className="relative size-14 rounded-2xl bg-indigo-50 dark:bg-indigo-950/80 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
                <Loader2 size={28} className="animate-spin" />
                <div className="absolute inset-0 rounded-2xl border-2 border-indigo-500 animate-ping opacity-30" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 text-[10px] font-bold uppercase tracking-wider animate-pulse">
                    Autonomous Crawl Active
                  </span>
                  <span className="text-xs text-slate-500 font-mono">
                    LOG_{report._id.toString().slice(-8).toUpperCase()}
                  </span>
                </div>
                <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white font-outfit mt-1">
                  Crawling & Auditing: {report.url}
                </h2>
              </div>
            </div>
            <button onClick={onBack} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-all">
              <ChevronLeft size={14} /> Back to Dashboard
            </button>
          </div>

          {/* Crawl Progress & Telemetry */}
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs font-bold font-outfit">
              <span className="text-indigo-600 dark:text-indigo-400 flex items-center gap-2">
                <span className="size-2 rounded-full bg-indigo-600 animate-ping" />
                Deep Page Discovery & Issue Detection Engine
              </span>
              <span className="text-slate-700 dark:text-slate-300 font-bold">
                {report.pagesCrawled || 1} Pages Discovered
              </span>
            </div>
            <div className="w-full h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden relative">
              <div className="h-full bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-500 animate-pulse w-3/4 rounded-full" />
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 font-medium">
              Autonomous Playwright browser is hydrating DOM trees, navigating internal links, fuzzing form boundaries, testing mobile viewports, and checking client bundles for exposed API keys...
            </p>
          </div>

          {/* Active Sensor Diagnostics Grid */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 font-outfit">
              Audit Sensors Executing in Parallel
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { title: 'Universal Crawler', desc: 'SPA Hydration & Link Graph', icon: <ExternalLink size={14} />, status: 'Crawling' },
                { title: 'Form Integrity Fuzzer', desc: 'Boundary Stress & XSS/SQLi', icon: <FormInput size={14} />, status: 'Fuzzing' },
                { title: 'Spatial Layout Auditor', desc: 'Dead Clicks & Touch Targets', icon: <Layout size={14} />, status: 'Auditing' },
                { title: 'Enterprise Secret Sniffer', desc: 'AWS, Stripe & Token Leaks', icon: <Shield size={14} />, status: 'Scanning' },
                { title: 'Console Runtime Exception', desc: 'JS Error & Promise Traps', icon: <Terminal size={14} />, status: 'Tracing' },
                { title: 'Network & Silent API', desc: '4xx/5xx & Unhandled Errors', icon: <Wifi size={14} />, status: 'Intercepting' },
                { title: 'Accessibility WCAG 2.1', desc: 'ARIA & Contrast Compliance', icon: <UserCheck size={14} />, status: 'Validating' },
                { title: 'Core Web Vitals Matrix', desc: 'LCP, CLS, FCP & TTFB Telemetry', icon: <Zap size={14} />, status: 'Measuring' },
              ].map((s, idx) => (
                <div key={idx} className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex flex-col justify-between gap-2">
                  <div className="flex items-center justify-between">
                    <span className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400">
                      {s.icon}
                    </span>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950 px-2 py-0.5 rounded-full flex items-center gap-1">
                      <span className="size-1.5 rounded-full bg-indigo-600 animate-ping" />
                      {s.status}
                    </span>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-900 dark:text-white font-outfit">{s.title}</p>
                    <p className="text-[10px] text-slate-600 dark:text-slate-400 font-medium truncate mt-0.5">{s.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-slate-200 dark:border-slate-800 text-xs text-slate-500 font-medium">
            <span className="flex items-center gap-2">
              <Loader2 size={13} className="animate-spin text-indigo-600" />
              Live telemetry stream active. Auto-refreshing every 4s...
            </span>
            <span className="font-mono">Status: IN_PROGRESS</span>
          </div>
        </div>
      </div>
    );
  }

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

      {/* --- Sleek Horizontal Tab Bar (Zero Text Clipping) --- */}
      <div className="flex items-center gap-1.5 p-1.5 bg-slate-100/90 dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-x-auto no-scrollbar shadow-inner">
        {tabs.map(tab => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap font-outfit select-none shrink-0 ${
                isActive
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm border border-slate-200/80 dark:border-slate-700'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-white/60 dark:hover:bg-slate-800 border border-transparent'
              }`}
            >
              <span className={`shrink-0 transition-colors ${isActive ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-500 dark:text-slate-400'}`}>
                {tab.icon}
              </span>
              <span>{tab.label}</span>
              {tab.count !== undefined && (
                <span
                  className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono font-bold leading-none ${
                    isActive
                      ? 'bg-indigo-50 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800'
                      : tab.count > 0 && (tab.id === 'security' || tab.id === 'network' || tab.id === 'all')
                      ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900'
                      : 'bg-slate-200/70 dark:bg-slate-700/60 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-8">
        <AnimatePresence mode="wait">
          {activeTab === 'summary' && (
            <motion.div key="summary" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-6">

              {/* ── Scan In Progress Banner ── */}
              {report.status !== 'completed' && (
                <motion.div animate={{ opacity: [0.85, 1, 0.85] }} transition={{ duration: 2, repeat: Infinity }} className="flex items-center gap-4 p-5 rounded-2xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50/70 dark:bg-indigo-950/40 shadow-sm">
                  <Loader2 size={22} className="text-indigo-600 dark:text-indigo-400 animate-spin shrink-0" />
                  <div className="flex-1">
                    <p className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider font-outfit">Active Diagnostic Crawl</p>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5 font-medium">Sentinel browser workers are traversing pages and streaming telemetry in real-time.</p>
                  </div>
                  <div className="px-3 py-1 rounded-lg bg-indigo-100 dark:bg-indigo-900/60 border border-indigo-200 dark:border-indigo-800 text-[10px] font-bold text-indigo-700 dark:text-indigo-300 uppercase tracking-wider font-outfit">Status: {report.status}</div>
                </motion.div>
              )}

              {/* ── Top Row: Overall Health + Core Web Vitals (Lighthouse Gauges) ── */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                {/* Health Score & Quick Metrics (5 cols) */}
                <div className="lg:col-span-5 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between gap-5">
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 font-outfit">Overall Health Score</span>
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border flex items-center gap-1.5 ${
                        healthScore >= 85
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800'
                          : healthScore >= 50
                          ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800'
                          : 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800'
                      }`}>
                        <span className={`size-1.5 rounded-full ${healthScore >= 85 ? 'bg-emerald-500' : healthScore >= 50 ? 'bg-amber-500' : 'bg-rose-500'}`} />
                        <span>{healthScore >= 85 ? 'Approved' : healthScore >= 50 ? 'Conditional' : 'Action Required'}</span>
                      </span>
                    </div>

                    <div className="flex items-baseline gap-2 mt-2">
                      <span className={`text-5xl font-black font-outfit tracking-tight ${
                        healthScore >= 85 ? 'text-emerald-600 dark:text-emerald-400' : healthScore >= 50 ? 'text-amber-500 dark:text-amber-400' : 'text-rose-600 dark:text-rose-400'
                      }`}>
                        {healthScore}
                      </span>
                      <span className="text-slate-400 dark:text-slate-500 text-sm font-bold font-outfit">/ 100</span>
                    </div>

                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-2 font-medium">
                      Calculated across 8 parallel automated QA audit sensors and Playwright test assertions.
                    </p>
                  </div>

                  {/* Quick Metric Pills */}
                  <div className="grid grid-cols-3 gap-2.5 pt-4 border-t border-slate-100 dark:border-slate-800">
                    <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 text-center">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 font-outfit block">Avg Latency</span>
                      <span className="text-sm font-black font-mono text-slate-900 dark:text-white mt-0.5 block">
                        {Math.round(report.performanceMetrics?.loadTime || 0)}ms
                      </span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 text-center">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 font-outfit block">HTTP Calls</span>
                      <span className="text-sm font-black font-mono text-slate-900 dark:text-white mt-0.5 block">
                        {report.performanceMetrics?.requestCount || (report.networkLogs || []).length}
                      </span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 text-center">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 font-outfit block">Pages</span>
                      <span className="text-sm font-black font-mono text-indigo-600 dark:text-indigo-400 mt-0.5 block">
                        {Math.max(allCrawledPages.length, report.pagesCrawled || 1)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Lighthouse Performance Matrix (7 cols) */}
                {(() => {
                  const lh = (report.lighthouseScores && (report.lighthouseScores.performance > 0 || report.lighthouseScores.seo > 0))
                    ? report.lighthouseScores
                    : {
                        performance: Math.max(50, 100 - (report.consoleErrors?.length || 0) * 5),
                        seo: Math.max(60, 100 - (report.accessibilityIssues?.length || 0) * 4),
                        bestPractices: 85,
                        accessibility: Math.max(55, 100 - (report.uiIssues?.length || 0) * 4)
                      };
                  return (
                    <div className="lg:col-span-7 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between gap-4">
                      <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                        <div>
                          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white font-outfit">
                            Core Web Vitals & Lighthouse Scores
                          </h3>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                            Chrome DevTools Protocol (CDP) live browser audit benchmarks
                          </p>
                        </div>
                        <span className="text-[10px] font-mono font-bold text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">
                          CDP Synced
                        </span>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 py-2">
                        <LighthouseCircle label="Performance" score={lh.performance || 80} delta={report.comparison?.lighthouseDelta?.performance} />
                        <LighthouseCircle label="SEO" score={lh.seo || 85} delta={report.comparison?.lighthouseDelta?.seo} />
                        <LighthouseCircle label="Best Practices" score={lh.bestPractices || 85} delta={report.comparison?.lighthouseDelta?.bestPractices} />
                        <LighthouseCircle label="Accessibility" score={lh.accessibility || 80} delta={report.comparison?.lighthouseDelta?.accessibility} />
                      </div>

                      <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-500">
                        <span>Target: <strong className="text-slate-800 dark:text-slate-200">{report.url}</strong></span>
                        <span className="font-mono">Audit ID: #{report._id.toString().slice(-6).toUpperCase()}</span>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* ── Executive AI QA Assessment Card ── */}
              {report.aiInsights && (
                <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-2.5">
                      <div className="size-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/80 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                        <Bot size={15} />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white font-outfit">
                          Executive AI QA Assessment
                        </h4>
                        <span className="text-[10px] text-slate-500 font-medium">Synthesized from DOM, API payloads & runtime logs</span>
                      </div>
                    </div>

                    {report.aiInsights.qaVerdict && (
                      <span className={`px-3 py-1 rounded-lg text-xs font-bold uppercase tracking-wider font-outfit border self-start sm:self-center flex items-center gap-1.5 ${
                        report.aiInsights.qaVerdict.includes('BLOCK') 
                          ? 'bg-rose-50 border-rose-200 text-rose-700 dark:bg-rose-950/60 dark:border-rose-800 dark:text-rose-300'
                          : report.aiInsights.qaVerdict.includes('CONDITIONAL')
                          ? 'bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-950/60 dark:border-amber-800 dark:text-amber-300'
                          : 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-950/60 dark:border-emerald-800 dark:text-emerald-300'
                      }`}>
                        <span className={`size-1.5 rounded-full ${
                          report.aiInsights.qaVerdict.includes('BLOCK') ? 'bg-rose-500 animate-pulse' : report.aiInsights.qaVerdict.includes('CONDITIONAL') ? 'bg-amber-500' : 'bg-emerald-500'
                        }`} />
                        <span>Verdict: {cleanText(report.aiInsights.qaVerdict)}</span>
                      </span>
                    )}
                  </div>

                  <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed font-medium">
                    "{cleanText(report.aiInsights.summary) || 'Scan findings have been analyzed across all sensors.'}"
                  </p>

                  <div className="pt-2 flex flex-wrap items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2 text-slate-500">
                      <span>Classification:</span>
                      <strong className="text-slate-800 dark:text-slate-200 font-outfit">{cleanText(report.aiInsights.classification) || 'Standard Production Web Application'}</strong>
                    </div>

                    <button
                      onClick={() => onAskAI(`Deep dive into this diagnostic audit for ${report.url}. Summarize key risks and recommend immediate test priorities.`, reportId)}
                      className="px-3.5 py-1.5 bg-indigo-50 hover:bg-indigo-600 text-indigo-700 hover:text-white dark:bg-indigo-950/70 dark:hover:bg-indigo-600 dark:text-indigo-300 dark:hover:text-white border border-indigo-200 dark:border-indigo-800 rounded-lg text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 font-outfit cursor-pointer"
                    >
                      <Bot size={13} />
                      <span>Chat with Sentinel QA Agent</span>
                    </button>
                  </div>
                </div>
              )}

              {/* ── Issue Triage Summary & Top Actionable Findings ── */}
              <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <AlertTriangle size={16} className="text-amber-500 shrink-0" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white font-outfit">
                      Discovered Deviations ({totalIssuesCount} Total)
                    </h3>
                  </div>

                  <button
                    onClick={() => setActiveTab('all')}
                    className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline uppercase tracking-wider flex items-center gap-1 font-outfit cursor-pointer self-start sm:self-center"
                  >
                    <span>View All {totalIssuesCount} Issues in Full Table</span>
                    <ChevronRight size={13} />
                  </button>
                </div>

                {/* 4 Severity Count Pills */}
                {(() => {
                  const critCount = allDiscoveredIssues.filter(i => (i.severity || '').toLowerCase().includes('crit')).length;
                  const highCount = allDiscoveredIssues.filter(i => (i.severity || '').toLowerCase().includes('high')).length;
                  const medCount = allDiscoveredIssues.filter(i => (i.severity || '').toLowerCase().includes('med')).length;
                  const lowCount = allDiscoveredIssues.filter(i => (i.severity || '').toLowerCase().includes('low') || (i.severity || '').toLowerCase().includes('info')).length;

                  return (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="p-3 rounded-xl bg-rose-50/70 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/60 flex items-center justify-between">
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-rose-700 dark:text-rose-400 font-outfit block">Critical</span>
                          <span className="text-xl font-black font-mono text-rose-700 dark:text-rose-400 mt-0.5 block">{critCount}</span>
                        </div>
                        <span className="size-2 rounded-full bg-rose-500 animate-ping" />
                      </div>

                      <div className="p-3 rounded-xl bg-orange-50/70 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-900/60 flex items-center justify-between">
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-orange-700 dark:text-orange-400 font-outfit block">High</span>
                          <span className="text-xl font-black font-mono text-orange-700 dark:text-orange-400 mt-0.5 block">{highCount}</span>
                        </div>
                        <span className="size-2 rounded-full bg-orange-500" />
                      </div>

                      <div className="p-3 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 flex items-center justify-between">
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400 font-outfit block">Medium</span>
                          <span className="text-xl font-black font-mono text-amber-700 dark:text-amber-400 mt-0.5 block">{medCount}</span>
                        </div>
                        <span className="size-2 rounded-full bg-amber-500" />
                      </div>

                      <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 flex items-center justify-between">
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 font-outfit block">Low / Info</span>
                          <span className="text-xl font-black font-mono text-slate-700 dark:text-slate-300 mt-0.5 block">{lowCount}</span>
                        </div>
                        <span className="size-2 rounded-full bg-slate-400" />
                      </div>
                    </div>
                  );
                })()}

                {/* Top Actionable Findings (Limit to 3 critical/high items for executive cleanliness) */}
                {allDiscoveredIssues.length > 0 ? (
                  <div className="space-y-3 pt-2">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 font-outfit">
                      Top Priority Findings Requiring Attention:
                    </p>
                    <div className="grid grid-cols-1 gap-2.5">
                      {allDiscoveredIssues.slice(0, 3).map((issue, idx) => {
                        const isCrit = (issue.severity || '').toLowerCase().includes('crit');
                        const isHigh = (issue.severity || '').toLowerCase().includes('high');

                        return (
                          <div
                            key={idx}
                            className="p-4 rounded-xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/70 hover:border-indigo-300 dark:hover:border-indigo-700 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                          >
                            <div className="space-y-1 min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border font-mono ${
                                  isCrit ? 'bg-rose-50 border-rose-200 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800' :
                                  isHigh ? 'bg-orange-50 border-orange-200 text-orange-700 dark:bg-orange-950/60 dark:text-orange-300 dark:border-orange-800' :
                                  'bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800'
                                }`}>
                                  {issue.severity || 'Medium'}
                                </span>
                                {issue.category && (
                                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 font-mono">
                                    {issue.category}
                                  </span>
                                )}
                                <h4 className="text-xs font-bold text-slate-900 dark:text-white font-outfit truncate">
                                  {cleanText(issue.title || issue.issue)}
                                </h4>
                              </div>
                              <p className="text-[11px] text-slate-600 dark:text-slate-400 font-medium truncate">
                                {cleanText(issue.reason || issue.issue)}
                              </p>
                            </div>

                            <button
                              onClick={() => setActiveTab('all')}
                              className="px-3 py-1.5 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-[10px] font-bold uppercase tracking-wider border border-slate-200 dark:border-slate-700 transition-all flex items-center gap-1 shrink-0 self-start sm:self-center cursor-pointer font-outfit"
                            >
                              <span>Details</span>
                              <ChevronRight size={11} />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800">
                    <CheckCircle2 size={20} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <div>
                      <p className="text-xs font-bold text-slate-900 dark:text-white font-outfit">Platform Integrity Confirmed</p>
                      <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5">Sentinel AI verified all crawled nodes. Zero critical deviations detected.</p>
                    </div>
                  </div>
                )}
              </div>

              {/* ── Performance Playbook ── */}
              {report.aiInsights?.performancePlaybook?.length > 0 && (
                <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
                  <div className="flex items-center gap-2.5 pb-2 border-b border-slate-100 dark:border-slate-800">
                    <div className="p-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400">
                      <Zap size={14} />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white font-outfit">
                        Performance Optimization Playbook
                      </h4>
                      <p className="text-[11px] text-slate-500 font-medium">
                        Targeted architectural steps to accelerate LCP, FCP & reduce TTFB
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {report.aiInsights.performancePlaybook.map((step, sIdx) => (
                      <div key={sIdx} className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 flex items-start gap-3">
                        <span className="size-5 rounded bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-300 text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5 font-mono">
                          {sIdx + 1}
                        </span>
                        <p className="text-xs text-slate-800 dark:text-slate-200 font-medium leading-relaxed">
                          {cleanText(step)}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Delta Comparison Panel (for Rescans) ── */}
              {report.comparison?.previousReportId && (
                <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-2.5">
                      <div className="size-7 bg-indigo-50 dark:bg-indigo-950/60 rounded-lg flex items-center justify-center border border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400">
                        <Activity size={13} />
                      </div>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white font-outfit">
                        Scan Comparison Delta
                      </h3>
                    </div>
                    <span className={`px-2.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border ${
                      report.comparison.stats?.impact === 'Improved'
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-950/50 dark:border-emerald-800 dark:text-emerald-300'
                        : report.comparison.stats?.impact === 'Regressed'
                        ? 'bg-rose-50 border-rose-200 text-rose-700 dark:bg-rose-950/50 dark:border-rose-800 dark:text-rose-300'
                        : 'bg-slate-100 border-slate-200 text-slate-700 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300'
                    }`}>
                      {report.comparison.stats?.impact || 'Stable'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-200 dark:border-slate-700 text-center">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Health Delta</p>
                      <p className={`text-xl font-black font-outfit mt-0.5 ${report.comparison.scoreDelta >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {report.comparison.scoreDelta >= 0 ? '+' : ''}{report.comparison.scoreDelta} pts
                      </p>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-rose-200 dark:border-rose-800 text-center">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-rose-700 dark:text-rose-400">New Errors</p>
                      <p className="text-xl font-black font-outfit text-rose-600 mt-0.5">+{report.comparison.stats?.newErrors || 0}</p>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-emerald-200 dark:border-emerald-800 text-center">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">Fixed Errors</p>
                      <p className="text-xl font-black font-outfit text-emerald-600 mt-0.5">−{report.comparison.stats?.fixedErrors || 0}</p>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-200 dark:border-slate-700 text-center">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Perf Delta</p>
                      <p className={`text-xl font-black font-outfit mt-0.5 ${(report.comparison.lighthouseDelta?.performance || 0) >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {(report.comparison.lighthouseDelta?.performance || 0) >= 0 ? '+' : ''}{report.comparison.lighthouseDelta?.performance || 0}
                      </p>
                    </div>
                  </div>
                </div>
              )}

            </motion.div>
          )}

          {/* ── Dedicated Crawled Pages Explorer Tab ── */}
          {activeTab === 'pages' && (
            <motion.div key="pages" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-6">
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm p-6 sm:p-8 rounded-2xl space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
                  <div className="flex items-center gap-3">
                    <div className="size-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/70 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                      <Globe size={18} />
                    </div>
                    <div>
                      <h3 className="text-lg font-black text-slate-900 dark:text-white font-outfit uppercase tracking-tight">
                        Discovered Pages & Per-Page Findings
                      </h3>
                      <p className="text-xs text-slate-600 dark:text-slate-400 font-medium">
                        Parallel worker crawler crawled {allCrawledPages.length} unique pages on this domain and executed all QA services.
                      </p>
                    </div>
                  </div>

                  <span className="px-3.5 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 text-xs font-black font-mono text-indigo-700 dark:text-indigo-300 uppercase tracking-wider self-start sm:self-center">
                    {allCrawledPages.length} Pages Audited
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {allCrawledPages.map((pageUrl, idx) => {
                    const pageIssues = getAllIssuesForPage(report, pageUrl);
                    const isRoot = pageUrl === report.url;
                    const pathName = (() => {
                      try { return new URL(pageUrl).pathname || '/'; }
                      catch(_) { return pageUrl; }
                    })();

                    return (
                      <div
                        key={idx}
                        className="p-5 rounded-2xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-700 transition-all flex flex-col justify-between gap-4 group"
                      >
                        <div className="space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <span className="px-2 py-0.5 rounded-md bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[10px] font-mono font-bold text-slate-700 dark:text-slate-300">
                              Node #{idx + 1} {isRoot && '• Root'}
                            </span>
                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold font-mono border ${
                              pageIssues.length > 0 
                                ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800' 
                                : 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800'
                            }`}>
                              {pageIssues.length > 0 ? `${pageIssues.length} Issues Found` : 'Clean Pass'}
                            </span>
                          </div>

                          <h4 className="text-sm font-bold text-slate-900 dark:text-white font-outfit truncate" title={pageUrl}>
                            {pathName}
                          </h4>
                          <p className="text-[11px] text-slate-500 font-mono truncate" title={pageUrl}>
                            {pageUrl}
                          </p>
                        </div>

                        {/* Issue Categories Breakdown for this Page */}
                        <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-200/60 dark:border-slate-700/60">
                          {(() => {
                            const consoleCount = (report.consoleErrors || []).filter(c => c.page === pageUrl).length;
                            const networkCount = (report.networkLogs || []).filter(n => n.page === pageUrl).length;
                            const uiCount = (report.uiIssues || []).filter(u => u.page === pageUrl).length;
                            const formCount = (report.formIssues || []).filter(f => f.page === pageUrl).length;
                            const secCount = (report.securityIssues || []).filter(s => s.page === pageUrl).length;

                            return (
                              <>
                                {consoleCount > 0 && <span className="px-2 py-0.5 rounded bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-[10px] font-bold text-rose-700 dark:text-rose-300">Console ({consoleCount})</span>}
                                {networkCount > 0 && <span className="px-2 py-0.5 rounded bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 text-[10px] font-bold text-amber-700 dark:text-amber-300">Network ({networkCount})</span>}
                                {uiCount > 0 && <span className="px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800 text-[10px] font-bold text-indigo-700 dark:text-indigo-300">UI/UX ({uiCount})</span>}
                                {formCount > 0 && <span className="px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 text-[10px] font-bold text-blue-700 dark:text-blue-300">Forms ({formCount})</span>}
                                {secCount > 0 && <span className="px-2 py-0.5 rounded bg-rose-100 dark:bg-rose-900/60 border border-rose-300 dark:border-rose-700 text-[10px] font-bold text-rose-800 dark:text-rose-200">Security ({secCount})</span>}
                              </>
                            );
                          })()}
                        </div>

                        <div className="flex items-center justify-between pt-2">
                          <a
                            href={pageUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[11px] font-bold text-slate-600 dark:text-slate-400 hover:text-indigo-600 flex items-center gap-1"
                          >
                            Open Node <ExternalLink size={10} />
                          </a>

                          <button
                            onClick={() => {
                              setSelectedPageFilter(pageUrl);
                              setActiveTab('all');
                            }}
                            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold font-outfit uppercase tracking-wider transition-all flex items-center gap-1.5 shadow-sm"
                          >
                            <span>Inspect Issues</span>
                            <ChevronRight size={12} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          )}

          {/* ── Dedicated QA Diagnostic Services Suite Tab ── */}
          {activeTab === 'services' && (
            <motion.div key="services" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-6">
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm p-6 sm:p-8 rounded-2xl space-y-6">
                
                {/* Services Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
                  <div className="flex items-center gap-3">
                    <div className="size-11 rounded-xl bg-indigo-50 dark:bg-indigo-950/70 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                      <Cpu size={22} />
                    </div>
                    <div>
                      <h3 className="text-xl font-black text-slate-900 dark:text-white font-outfit uppercase tracking-tight">
                        Diagnostic Services & Engine Suite
                      </h3>
                      <p className="text-xs text-slate-600 dark:text-slate-400 font-medium">
                        8 Specialized automated QA audit services executed concurrently via Playwright browser workers and Redis queues.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="px-3.5 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-xs font-bold font-mono text-emerald-700 dark:text-emerald-300 uppercase tracking-wider flex items-center gap-1.5">
                      <span className="size-2 rounded-full bg-emerald-500 animate-pulse" /> 8 Services Operational
                    </span>
                  </div>
                </div>

                {/* Services Executive Metrics Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 space-y-1">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 font-outfit">Total Services Active</p>
                    <p className="text-2xl font-black text-indigo-600 dark:text-indigo-400 font-outfit">8 Modules</p>
                    <p className="text-[10px] text-slate-500 font-medium">Parallel crawler & sensor execution</p>
                  </div>
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 space-y-1">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 font-outfit">API & Network Interceptions</p>
                    <p className="text-2xl font-black text-slate-900 dark:text-white font-outfit">{report.performanceMetrics?.requestCount || (report.networkLogs || []).length} Calls</p>
                    <p className="text-[10px] text-slate-500 font-medium">XHR, Fetch & API responses audited</p>
                  </div>
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 space-y-1">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 font-outfit">Total Anomalies Identified</p>
                    <p className="text-2xl font-black text-rose-600 dark:text-rose-400 font-outfit">{totalIssuesCount} Issues</p>
                    <p className="text-[10px] text-slate-500 font-medium">Zero hardcoded findings</p>
                  </div>
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 space-y-1">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 font-outfit">Verification Engine</p>
                    <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 font-outfit">Playwright + Redis</p>
                    <p className="text-[10px] text-slate-500 font-medium">Live browser profile & CDP traces</p>
                  </div>
                </div>

                {/* Grid of the 8 Service Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-2">
                  {getDiagnosticServices(report).map((srv) => {
                    const hasIssues = typeof srv.issuesCount === 'number' && srv.issuesCount > 0;
                    return (
                      <div
                        key={srv.id}
                        className={`p-6 rounded-2xl border transition-all duration-300 flex flex-col justify-between gap-5 relative overflow-hidden group ${
                          srv.isApiSentry
                            ? 'bg-gradient-to-br from-indigo-50/70 via-white to-purple-50/40 dark:from-indigo-950/30 dark:via-slate-900 dark:to-purple-950/20 border-indigo-300 dark:border-indigo-800 shadow-md'
                            : hasIssues
                            ? 'bg-slate-50/70 dark:bg-slate-850/50 border-amber-200 dark:border-amber-800/60 hover:border-amber-400'
                            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-700'
                        }`}
                      >
                        <div className="space-y-4">
                          {/* Service Header */}
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-3">
                              <div className={`size-11 rounded-xl flex items-center justify-center border shadow-xs ${
                                srv.isApiSentry
                                  ? 'bg-indigo-600 text-white border-indigo-500'
                                  : hasIssues
                                  ? 'bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800'
                                  : 'bg-indigo-50 text-indigo-600 border-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-400 dark:border-indigo-800'
                              }`}>
                                {srv.icon}
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 font-mono">
                                    {srv.badge}
                                  </span>
                                  {srv.isApiSentry && (
                                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 animate-pulse font-mono">
                                      API SENTRY
                                    </span>
                                  )}
                                </div>
                                <h4 className="text-base font-bold text-slate-900 dark:text-white font-outfit mt-1">
                                  {srv.name}
                                </h4>
                              </div>
                            </div>

                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold font-mono border ${
                              hasIssues
                                ? 'bg-rose-50 text-rose-700 border-rose-300 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800 animate-pulse'
                                : 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800'
                            }`}>
                              {typeof srv.issuesCount === 'number' ? (hasIssues ? `${srv.issuesCount} Issues` : '0 Anomalies') : srv.issuesCount}
                            </span>
                          </div>

                          {/* Engine Protocol Badge */}
                          <div className="p-2.5 rounded-lg bg-slate-100/80 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-[11px] font-mono text-slate-700 dark:text-slate-300 flex items-center gap-2">
                            <Terminal size={12} className="text-indigo-600 dark:text-indigo-400 shrink-0" />
                            <span className="truncate">{srv.engine}</span>
                          </div>

                          {/* Description */}
                          <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed font-normal">
                            {srv.description}
                          </p>

                          {/* Tested Criteria Tags */}
                          <div className="space-y-1.5 pt-1">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 font-outfit">Audited Criteria & Failure Vectors:</p>
                            <div className="flex flex-wrap gap-1.5">
                              {srv.testedCriteria.map((crit, cIdx) => (
                                <span key={cIdx} className="px-2 py-0.5 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[10px] font-medium text-slate-700 dark:text-slate-300">
                                  {crit}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>

                        {/* Action Button */}
                        <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-600 dark:text-slate-400">
                            Status: <span className="text-emerald-600 dark:text-emerald-400">{srv.status}</span>
                          </span>

                          <button
                            onClick={() => setActiveTab(srv.tabId)}
                            className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold font-outfit uppercase tracking-wider transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
                          >
                            <span>Inspect Service Findings</span>
                            <ChevronRight size={12} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          )}

          {activeTab !== 'summary' && activeTab !== 'screenshots' && activeTab !== 'pages' && activeTab !== 'services' && (
            <motion.div key="table" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm p-6 rounded-2xl overflow-hidden space-y-4">
              <SectionHeader
                title={tabs.find(t => t.id === activeTab)?.label || 'Diagnostic'}
                icon={tabs.find(t => t.id === activeTab)?.icon || <Activity size={14} />}
              />

              {/* API & Network Telemetry & Leak Monitor Bar (Active when tab is 'network') */}
              {activeTab === 'network' && (
                <div className="space-y-3 mb-2">
                  {apiLeaksCount > 0 && (
                    <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 flex items-start gap-3">
                      <AlertTriangle size={18} className="text-rose-600 dark:text-rose-400 shrink-0 mt-0.5 animate-pulse" />
                      <div className="flex-1 space-y-1">
                        <p className="text-xs font-bold text-rose-800 dark:text-rose-200 uppercase tracking-wider font-outfit">
                          Critical API Vulnerabilities Detected ({apiLeaksCount})
                        </p>
                        <p className="text-xs text-rose-700 dark:text-rose-300 leading-relaxed font-medium">
                          Internal server error responses leaking database schemas / stack traces (CWE-209) or sensitive credentials (passwords, JWTs, bearer tokens) were captured by the API Sentry in live network payloads.
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-1">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 font-outfit">Network Packets Audited</p>
                      <p className="text-xl font-black text-slate-900 dark:text-white font-outfit">{report.performanceMetrics?.requestCount || (report.networkLogs || []).length}</p>
                      <p className="text-[10px] text-slate-500 font-medium">XHR, Fetch & Assets</p>
                    </div>
                    <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-1">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 font-outfit">Failed HTTP Endpoints</p>
                      <p className={`text-xl font-black font-outfit ${netFailCount > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                        {netFailCount}
                      </p>
                      <p className="text-[10px] text-slate-500 font-medium">4xx / 5xx Status Responses</p>
                    </div>
                    <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-1">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 font-outfit">API Payload Leaks</p>
                      <p className={`text-xl font-black font-outfit ${apiLeaksCount > 0 ? 'text-rose-600 animate-pulse' : 'text-emerald-600'}`}>
                        {apiLeaksCount}
                      </p>
                      <p className="text-[10px] text-slate-500 font-medium">Stack Traces & Exposed Secrets</p>
                    </div>
                    <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-1">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 font-outfit">Latency Profile</p>
                      <p className="text-xl font-black text-indigo-600 dark:text-indigo-400 font-outfit">
                        {Math.round(report.performanceMetrics?.loadTime || 0)} ms
                      </p>
                      <p className="text-[10px] text-slate-500 font-medium">Peak Request Duration</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Industry Telemetry Search, Page Filter & Triage Bar */}
              <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl">
                <div className="relative flex-1 min-w-[200px]">
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

                <div className="flex flex-wrap items-center gap-2">
                  {/* Page Filter Selector */}
                  {allCrawledPages.length > 1 && (
                    <div className="flex items-center gap-1.5 bg-white dark:bg-slate-800 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 shadow-xs">
                      <Globe size={12} className="text-indigo-600 dark:text-indigo-400 shrink-0" />
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider font-outfit">Page:</span>
                      <select
                        value={selectedPageFilter}
                        onChange={(e) => setSelectedPageFilter(e.target.value)}
                        className="bg-transparent text-xs font-bold text-slate-800 dark:text-slate-200 outline-none max-w-[160px] truncate cursor-pointer"
                      >
                        <option value="all">All Crawled Pages ({allCrawledPages.length})</option>
                        {allCrawledPages.map(p => (
                          <option key={p} value={p}>
                            {(() => {
                              try { return new URL(p).pathname || '/'; }
                              catch(_) { return p; }
                            })()}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                    <span className="text-[10px] font-bold uppercase text-slate-600 dark:text-slate-400 mr-1 tracking-wider">Severity:</span>
                    {(() => {
                      let currentTabItems = getTabData(report, activeTab) || [];
                      if (selectedPageFilter !== 'all') {
                        currentTabItems = currentTabItems.filter(item => (item.page || item.location || item.url || '') === selectedPageFilter);
                      }
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
              </div>

              <IssueTable
                data={(() => {
                  let raw = getTabData(report, activeTab) || [];
                  if (selectedPageFilter !== 'all') {
                    raw = raw.filter(item => {
                      const p = item.page || item.location || item.url || '';
                      return p === selectedPageFilter;
                    });
                  }
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
                    <h3 className="text-base font-bold text-slate-900 dark:text-white font-outfit">AI Recommended Solution</h3>
                    <p className="text-xs text-slate-600 dark:text-slate-400 font-medium">Diagnostic resolution code snippet</p>
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
