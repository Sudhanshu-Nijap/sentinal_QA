import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Send, Bot, User, Shield, Activity,
  RefreshCw, ChevronDown, Check, Loader2, ChevronUp, Lock,
  FormInput, Layout, ExternalLink, UserCheck, Wifi, Zap, Terminal
} from 'lucide-react';
import axios from 'axios';
import io from 'socket.io-client';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import ScanSummaryCard from './ScanSummaryCard';
import SchedulingDashboard from './SchedulingDashboard';
import GlobalIntelligence from './GlobalIntelligence';
import LearningHubPage from './LearningHub/LearningHubPage';
import { API_URL, SOCKET_URL } from '../config/api';

// ── Date Separator ─────────────────────────────────────────────────────────────
const DateSeparator = ({ date }) => (
  <div className="flex items-center gap-3 my-4">
    <div className="flex-1 h-px bg-slate-200 dark:bg-slate-800" />
    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 px-3 py-1 bg-white dark:bg-slate-800 rounded-full border border-slate-200 dark:border-slate-700 shadow-xs">
      {date}
    </span>
    <div className="flex-1 h-px bg-slate-200 dark:bg-slate-800" />
  </div>
);

// ── System Pill ────────────────────────────────────────────────────────────────
const SystemMessage = ({ content }) => (
  <div className="flex justify-center my-2">
    <div className="px-3 py-1 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full flex items-center gap-2 shadow-xs">
      <Activity size={10} className="text-indigo-600 dark:text-indigo-400" />
      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 font-outfit">{content}</span>
    </div>
  </div>
);

// ── Format date label ──────────────────────────────────────────────────────────
const getDateLabel = (dateStr) => {
  const d = new Date(dateStr);
  const now = new Date();
  const diff = Math.floor((now - d) / (1000 * 60 * 60 * 24));
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const groupMessagesByDate = (messages) => {
  const groups = [];
  let currentLabel = null;
  messages.forEach(msg => {
    const label = getDateLabel(msg.createdAt || msg.timestamp || new Date());
    if (label !== currentLabel) {
      currentLabel = label;
      groups.push({ type: 'separator', label });
    }
    groups.push(msg);
  });
  return groups;
};

// ── Previous Scans Dropdown ────────────────────────────────────────────────────
const PreviousScansDropdown = ({ chatId, onSelect }) => {
  const [open, setOpen] = useState(false);
  const [scans, setScans] = useState([]);

  useEffect(() => {
    if (!open || !chatId) return;
    axios.get(`${API_URL}/api/chat/thread/${chatId}/scans`)
      .then(r => setScans(r.data))
      .catch(() => { });
  }, [open, chatId]);

  if (!chatId) return null;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200 transition-all shadow-xs"
      >
        <Activity size={12} className="text-indigo-600 dark:text-indigo-400" />
        History
        <ChevronDown size={11} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.95 }}
              className="absolute right-0 top-full mt-2 z-50 w-64 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xl"
            >
              <div className="p-3 border-b border-slate-200 dark:border-slate-800">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 font-outfit">Previous Scans</p>
              </div>
              {scans.length === 0 ? (
                <div className="p-4 text-center text-xs text-slate-500 font-medium">No previous scans recorded</div>
              ) : (
                <div className="max-h-60 overflow-y-auto">
                  {scans.map((s, i) => (
                    <button
                      key={s._id}
                      onClick={() => { onSelect(s.scanReportId); setOpen(false); }}
                      className="w-full flex items-center gap-3 p-3 hover:bg-slate-50 dark:hover:bg-slate-800/80 transition-all text-left border-b border-slate-100 dark:border-slate-800/60 last:border-0"
                    >
                      <div className={`size-2 rounded-full shrink-0 ${s.type === 'rescan' ? 'bg-indigo-600' : 'bg-emerald-500'}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-slate-900 dark:text-white truncate font-outfit">
                          {s.type === 'rescan' ? 'Rescan' : 'Initial Scan'} #{scans.length - i}
                        </p>
                        <p className="text-[10px] text-slate-500 font-mono">
                          {new Date(s.createdAt).toLocaleString('en-US', {
                            month: 'short', day: 'numeric',
                            hour: '2-digit', minute: '2-digit'
                          })}
                        </p>
                      </div>
                      {s.reportSummary?.healthScore !== undefined && (
                        <span className="text-xs font-bold font-mono text-indigo-600 dark:text-indigo-400">
                          {s.reportSummary.healthScore}%
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

// ── Main Component ─────────────────────────────────────────────────────────────
const ChatInterface = ({
  activeChatId,
  onScanStarted,
  onViewFullReport,
  onRefresh,
  onResetTarget,
  globalScanProgress,
  pendingMessage,
  pendingReportId,
  onMessageConsumed,
  onChatActivated,
  activeView = 'chat',
  onViewChange,
  reports = [],
  setAlert,
  confirm
}) => {
  const isScheduleView = activeView === 'schedule';

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [chatMeta, setChatMeta] = useState(null); // { url, _id }
  const [latestReport, setLatestReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [scanParams, setScanParams] = useState({
    scope: 'single',
    mode: 'specific',
    tests: ['console', 'network', 'forms', 'ui', 'security', 'lighthouse', 'accessibility', 'links']
  });
  const [showSensors, setShowSensors] = useState(false);
  const messagesEndRef = useRef(null);
  const socketRef = useRef(null);
  const hasDispatchedRef = useRef(false);
  const isSendingRef = useRef(false);

  // Active Report & Sensor Finding Metrics
  const activeReport = latestReport || reports?.find(r => r.url === chatMeta?.url) || reports?.[0] || null;

  const getSensorCount = (testKey) => {
    if (!activeReport) return null;
    switch (testKey) {
      case 'ui':
        return (activeReport.uiIssues?.length || 0) + (activeReport.responsiveIssues?.length || 0);
      case 'forms':
        return activeReport.formIssues?.length || 0;
      case 'security':
        return activeReport.securityIssues?.length || 0;
      case 'console':
        return activeReport.consoleErrors?.length || 0;
      case 'links':
        return activeReport.brokenLinks?.length || 0;
      case 'network':
        return Array.isArray(activeReport.networkLogs) ? activeReport.networkLogs.filter(n => n.status >= 400).length : (activeReport.networkLogs?.length || 0);
      case 'accessibility':
        return activeReport.accessibilityIssues?.length || 0;
      case 'lighthouse':
        return activeReport.lighthouseScores ? `${Math.round(activeReport.lighthouseScores.performance || 0)}%` : null;
      default:
        return null;
    }
  };

  const totalDiscoveredAcrossSensors = activeReport ? (
    (activeReport.formIssues?.length || 0) +
    (activeReport.uiIssues?.length || 0) +
    (activeReport.responsiveIssues?.length || 0) +
    (activeReport.securityIssues?.length || 0) +
    (activeReport.consoleErrors?.length || 0) +
    (activeReport.brokenLinks?.length || 0) +
    (activeReport.accessibilityIssues?.length || 0) +
    (Array.isArray(activeReport.networkLogs) ? activeReport.networkLogs.filter(n => n.status >= 400).length : 0)
  ) : 0;

  // ── Socket Infrastructure ────────────────────────────────────────────────────
  useEffect(() => {
    const socket = io(SOCKET_URL);
    socketRef.current = socket;

    socket.on('connect', () => {
      if (activeChatId) {
        socket.emit('join-chat', activeChatId);
      }
    });

    socket.on('new-message', (msg) => {
      setMessages(prev => {
        // Prevent duplicate messages if optimistic UI already added it
        if (prev.some(m => m._id === msg._id)) return prev;
        return [...prev, msg];
      });
      
      // Update Sticky Banner if it's a report/rescan
      if (msg.type === 'report' || msg.type === 'rescan') {
        setIsTyping(false);
        if (msg.reportSummary) {
          // Construct a compatible latestReport object from the summary
          const normalized = {
            _id: msg.scanReportId,
            url: msg.reportSummary.url,
            healthScore: msg.reportSummary.healthScore,
            brokenLinks: { length: msg.reportSummary.stats?.brokenLinks || 0 },
            consoleErrors: { length: msg.reportSummary.stats?.consoleErrors || 0 },
            accessibilityIssues: { length: msg.reportSummary.stats?.accessibilityIssues || 0 },
            uiIssues: { length: msg.reportSummary.stats?.uiIssues || 0 },
            formIssues: { length: msg.reportSummary.stats?.formIssues || 0 },
            securityIssues: { length: msg.reportSummary.stats?.securityIssues || 0 },
            networkLogs: { length: msg.reportSummary.stats?.networkErrors || 0 },
            lighthouseScores: msg.reportSummary.lighthouseScores || null,
            responsiveIssues: { length: 0 }
          };
          setLatestReport(normalized);
        } else {
          // Fallback to full fetch if no summary provided
          axios.get(`${API_URL}/api/reports/${msg.scanReportId}`).then(r => setLatestReport(r.data));
        }
      }

      if (msg.type === 'ai') {
        setIsTyping(false);
      }
    });

    return () => {
      socket.off('connect');
      socket.off('new-message');
      socket.off('scan-progress');
      socket.disconnect();
    };
  }, [activeChatId]);

  useEffect(() => {
    if (pendingMessage && (activeChatId || pendingReportId)) {
       // Prevent double-dispatch during component sync / re-mount
       if (hasDispatchedRef.current === pendingMessage) return;
       hasDispatchedRef.current = pendingMessage;
       
       handleSend(null, pendingMessage, pendingReportId);
       if (onMessageConsumed) onMessageConsumed();
    }
    
    // Reset guard if pending message is cleared
    if (!pendingMessage) {
      hasDispatchedRef.current = false;
    }
  }, [pendingMessage, activeChatId, pendingReportId]);

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  // Track in-progress scan via Socket
  useEffect(() => {
    if (!globalScanProgress) {
      setIsScanning(false);
      return;
    }
    const { status, percent } = globalScanProgress;

    if (status === 'in-progress' || (percent > 0 && percent < 100)) {
      setIsScanning(true);
    }
    if (status === 'completed' || percent === 100) {
      setIsScanning(false);
      // Removed redundant onRefresh() - handled globally in App.jsx listener
    }
    if (status === 'failed') {
      setIsScanning(false);
    }
  }, [globalScanProgress]);

  const loadMessages = useCallback(async (chatId) => {
    try {
      const { data } = await axios.get(`${API_URL}/api/chat/thread/${chatId}/messages`);
      setMessages(data);
      scrollToBottom();
    } catch (err) {
      console.error('Failed to load messages', err);
    }
  }, []);

  // Load messages and latest report when activeChatId changes
  useEffect(() => {
    if (activeChatId) {
      setLoading(true);
      // Get Chat Metadata
      axios.get(`${API_URL}/api/chat/threads?userId=${localStorage.getItem('userId')}`)
        .then(r => {
          const chat = r.data.find(c => c._id === activeChatId);
          setChatMeta(chat || null);
          
          // Fetch the latest report directly from DB for this URL
          if (chat?.url) {
            axios.get(`${API_URL}/api/reports?userId=${localStorage.getItem('userId')}`)
              .then(resp => {
                const latest = resp.data
                  .filter(rep => rep.url === chat.url && rep.status === 'completed')
                  .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];
                setLatestReport(latest || null);
              });
          }
        }).catch(() => {});
      loadMessages(activeChatId).finally(() => setLoading(false));
    } else {
      setMessages([]);
      setChatMeta(null);
      setLatestReport(null);
    }
  }, [activeChatId, loadMessages]);

  const normalizeUrl = (raw) => {
    let t = (raw || '').trim();
    if (!t) return '';
    if (!/^https?:\/\//i.test(t)) t = `https://${t}`;
    return t;
  };

  const validateUrl = (u) => {
    try {
      const p = new URL(u);
      return !!p.hostname && (p.hostname.includes('.') || p.hostname === 'localhost' || p.hostname === '127.0.0.1');
    } catch { return false; }
  };

  const toggleTest = (test) => {
    setScanParams(prev => ({
      ...prev,
      tests: prev.tests.includes(test) ? prev.tests.filter(t => t !== test) : [...prev.tests, test]
    }));
  };

  const handleSend = async (e, manualInput = null, manualReportId = null) => {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();
    
    // Robust input resolution: check manualInput, React state, or DOM input element
    const domVal = e?.target?.tagName === 'INPUT'
      ? e.target.value
      : (e?.target?.querySelector?.('input')?.value || document.querySelector('form input[type="text"]')?.value || '');
    const finalInput = (manualInput || input || domVal).trim();
    if (!finalInput || isTyping || isSendingRef.current) return;
    
    // Activate the Neural Lock
    isSendingRef.current = true;
    setInput('');

    let userId = localStorage.getItem('userId');
    if (!userId) {
      try {
        const u = JSON.parse(localStorage.getItem('userData') || '{}');
        userId = u.id || u._id || u.userId;
      } catch (err) {}
    }
    if (!userId) {
      userId = 'user-' + Math.random().toString(36).substring(2, 9);
      localStorage.setItem('userId', userId);
    }

    let currentChatId = activeChatId;

    // ── Pre-flight: Resolve thread context if redirected from a report ──
    if (!currentChatId && manualReportId) {
      setIsTyping(true);
      try {
        const { data: report } = await axios.get(`${API_URL}/api/reports/${manualReportId}`);
        const { data: { chatId } } = await axios.post(`${API_URL}/api/chat/thread/start`, { 
           url: report.url, 
           userId 
        });
        currentChatId = chatId;
        if (onChatActivated) onChatActivated(chatId);
        await loadMessages(chatId);
      } catch (err) {
        console.error('[AI Redirect]: Thread resolution failed', err);
      } finally {
        setIsTyping(false);
      }
    }

    const isRescanCmd = /^(rescan|re-scan|re-test|retest)$/i.test(finalInput);
    const isCleanUrl = !finalInput.includes(' ') && validateUrl(normalizeUrl(finalInput));
    const normalizedInputUrl = isCleanUrl ? normalizeUrl(finalInput) : null;
    const isNewUrl = isCleanUrl && normalizedInputUrl && (!chatMeta?.url || normalizedInputUrl !== normalizeUrl(chatMeta.url));

    // ── Case 1: Starting a new scan (no active chat OR a new URL was entered) ──
    if (!currentChatId || isNewUrl) {
      const targetUrl = normalizedInputUrl || normalizeUrl(finalInput);
      if (!validateUrl(targetUrl)) {
        setMessages(prev => [...prev, {
          _id: 'err-' + Date.now(), type: 'system',
          content: 'Invalid URL. Please provide a valid domain (e.g. example.com or https://example.com)',
          createdAt: new Date()
        }]);
        isSendingRef.current = false;
        return;
      }

      setIsTyping(true);
      try {
        const { data: { chatId } } = await axios.post(`${API_URL}/api/chat/thread/start`, { url: targetUrl, userId });
        await axios.post(`${API_URL}/api/chat/thread/${chatId}/message`, { type: 'user', content: targetUrl });
        await axios.post(`${API_URL}/api/chat/thread/${chatId}/message`, { type: 'system', content: 'Diagnostic Scan Initiated' });
        const { data: scanData } = await axios.post(`${API_URL}/api/scan`, {
          url: targetUrl, userId, force: true, chatId,
          scope: scanParams.scope, mode: scanParams.mode, tests: scanParams.tests
        });
        
        setIsScanning(true);
        if (onChatActivated) onChatActivated(chatId);
        if (scanData.reportId) onScanStarted(scanData.reportId, chatId);
      } catch (err) {
        const errMsg = err.response?.data?.error || err.message;
        
        if (errMsg.includes('Security Block')) {
          const highLevel = errMsg.split(' - ')[0] || "Security Block Detected";
          setMessages(prev => [...prev, {
            _id: 'err-' + Date.now(), type: 'system',
            content: highLevel.toUpperCase(),
            createdAt: new Date()
          }]);
        } else {
          setMessages(prev => [...prev, {
            _id: 'err-' + Date.now(), type: 'system',
            content: 'Scan launch failed: ' + errMsg,
            createdAt: new Date()
          }]);
        }
      } finally {
        setIsTyping(false);
        isSendingRef.current = false;
      }
      return;
    }

    // ── Case 2: Rescan — only if explicitly typed "rescan" or current URL is re-entered ──
    if (isRescanCmd || (isCleanUrl && normalizedInputUrl && chatMeta?.url && normalizedInputUrl === normalizeUrl(chatMeta.url))) {
      setIsTyping(true);
      try {
        let targetUrl = chatMeta?.url;
        if (!targetUrl) {
          const { data: chatData } = await axios.get(`${API_URL}/api/chat/threads?userId=${userId}`);
          const found = chatData.find(c => c._id === activeChatId);
          targetUrl = found?.url;
          if (found) setChatMeta(found);
        }
        if (!targetUrl) { 
          setIsTyping(false); 
          isSendingRef.current = false;
          return; 
        }

        await axios.post(`${API_URL}/api/chat/thread/${currentChatId}/message`, { type: 'user', content: finalInput });
        await axios.post(`${API_URL}/api/chat/thread/${currentChatId}/message`, { type: 'system', content: 'Rescan Initiated' });
        const { data: scanData } = await axios.post(`${API_URL}/api/scan`, {
          url: targetUrl, userId, force: true, chatId: currentChatId,
          scope: scanParams.scope, mode: scanParams.mode, tests: scanParams.tests
        });
        setIsScanning(true);
        if (scanData.reportId) onScanStarted(scanData.reportId, currentChatId);
        await loadMessages(currentChatId);
      } catch (err) {
        if (err.response?.status === 403) {
           console.log('[SecurityGate]: Blocked rescan redirection due to threat.');
           return;
        }
        console.error('[Rescan Error]:', err.message);
      } finally {
        setIsTyping(false);
        isSendingRef.current = false;
      }
      return;
    }

    // ── Case 3: AI Q&A — everything else goes here ──
    const userBubble = { _id: 'tmp-user-' + Date.now(), type: 'user', content: finalInput, createdAt: new Date() };
    setMessages(prev => [...prev, userBubble]);
    setIsTyping(true);

    try {
      const latestReport = [...messages].reverse().find(m => m.type === 'report' || m.type === 'rescan');
      await axios.post(`${API_URL}/api/chat/thread/${currentChatId}/ask`, {
        message: finalInput,
        scanReportId: manualReportId || latestReport?.scanReportId || null
      });
    } catch (err) {
      const errMsg = err.response?.data?.error || err.message || 'Neural uplink failure.';
      console.error('[Ask AI Error]:', errMsg);
      setMessages(prev => [...prev, {
        _id: 'err-ai-' + Date.now(), type: 'ai',
        content: `Could not get AI response: ${errMsg}`,
        createdAt: new Date()
      }]);
    } finally {
      setIsTyping(false);
      isSendingRef.current = false;
    }
  };

  const handleRescan = async () => {
    if (!chatMeta?.url || isScanning) return;
    await handleSend(null, 'rescan');
  };

  // ── Grouped messages for rendering ────────────────────────────────────────
  const grouped = groupMessagesByDate(messages);

  const WelcomeHero = () => (
    <div className="flex flex-col items-center justify-center h-full min-h-[420px] max-w-xl mx-auto text-center space-y-6">
      <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        className="size-16 bg-indigo-50 dark:bg-indigo-950/60 rounded-2xl flex items-center justify-center border border-indigo-200 dark:border-indigo-800 shadow-sm relative overflow-hidden">
        <Shield className="text-indigo-600 dark:text-indigo-400 size-8 z-10" />
      </motion.div>
      <div>
        <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Autonomous Senior QA Engine</h1>
        <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 mt-2 max-w-md mx-auto leading-relaxed">
          Autonomous end-to-end testing replacing manual QA. Executes boundary fuzzing, mobile viewport stress, Core Web Vitals, and token security scans.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3.5 w-full text-left">
        {[
          ['Edge-Case Fuzzing', 'SQLi, XSS, Boundary Value Matrix', 'TC-FUZZ'],
          ['Responsive Matrix', 'Mobile Viewport Stress (375x667)', 'TC-RESP'],
          ['Core Web Vitals', 'DOM, CLS, LCP Optimization', 'TC-PERF'],
          ['Enterprise Secret Sniffer', '35+ Signatures & Entropy Check', 'TC-SEC']
        ].map(([t, s, tag]) => (
          <div key={t} className="p-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm hover:border-indigo-400 hover:shadow-md transition-all group">
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">{t}</p>
              <span className="text-[9px] font-mono font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950 px-2 py-0.5 rounded border border-indigo-200 dark:border-indigo-800">{tag}</span>
            </div>
            <p className="text-[11px] text-slate-600 dark:text-slate-300 font-medium">{s}</p>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm relative font-inter overflow-hidden">
      {/* ── Header ── */}
      {!isScheduleView && (
        <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center gap-3 bg-slate-50/70 dark:bg-slate-900/70 z-10">
          <div className="p-2 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 flex items-center justify-center shadow-sm">
            <Bot size={18} className="text-indigo-600 dark:text-indigo-400" />
          </div>
          <div className="flex-1 min-w-0">
            {chatMeta ? (
              <>
                <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                  {chatMeta.customName || (() => {
                    try { return new URL(chatMeta.url).hostname; }
                    catch (e) { return chatMeta.url; }
                  })()}
                </p>
                <p className="hidden md:block text-[10px] text-slate-500 font-mono truncate">{chatMeta.url}</p>
              </>
            ) : (
              <p className="text-xs font-bold text-slate-800 dark:text-slate-200">New QA Testing Session</p>
            )}
          </div>

          <div className="flex items-center gap-2">
            {activeChatId && activeView === 'qa' && (
              <>
                <PreviousScansDropdown chatId={activeChatId} onSelect={onViewFullReport} />
                <button
                  onClick={handleRescan}
                  disabled={isScanning}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/60 border border-indigo-200 dark:border-indigo-800 rounded-lg text-xs font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-300 transition-all disabled:opacity-40 shadow-xs"
                >
                  <RefreshCw size={11} className={isScanning ? 'animate-spin' : ''} />
                  Rescan
                </button>
              </>
            )}
            {activeView === 'qa' && (
              <button onClick={onResetTarget}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 transition-all shadow-xs">
                Reset
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Scan Progress Bar ── */}
      <AnimatePresence>
        {isScanning && globalScanProgress && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            className="px-4 py-2 bg-eu-accent/5 border-b border-eu-accent/20 flex items-center gap-3">
            <Loader2 size={12} className="text-eu-accent animate-spin shrink-0" />
            <div className="flex-1">
              <div className="flex justify-between mb-1">
                <span className="text-[8px] font-black uppercase tracking-widest text-eu-accent">{globalScanProgress.stage || 'Scanning...'}</span>
                <span className="text-[8px] font-mono text-eu-accent">{globalScanProgress.percent || 0}%</span>
              </div>
              <div className="h-1 bg-white/5 rounded-full overflow-hidden border border-white/5">
                <motion.div className="h-full bg-gradient-to-r from-eu-accent to-cyan-400 rounded-full relative"
                  animate={{ width: `${globalScanProgress.percent || 0}%` }} transition={{ duration: 0.5 }}>
                  <motion.div
                    animate={{ x: ['-100%', '200%'] }}
                    transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
                    className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent w-full h-full"
                  />
                </motion.div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>



      {/* ── Messages / Dashboard Views ── */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6 space-y-4 custom-scrollbar bg-slate-50/50 dark:bg-slate-950">
        {activeView === 'schedule' ? (
          <SchedulingDashboard setAlert={setAlert} confirm={confirm} />
        ) : activeView === 'analyze' ? (
          <div className="pt-10">
            <GlobalIntelligence reports={reports} />
          </div>
        ) : activeView === 'learn' ? (
          <div className="pt-10 h-full">
            <LearningHubPage />
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="animate-spin text-indigo-600 dark:text-indigo-400" size={24} />
          </div>
        ) : messages.length === 0 && !activeChatId ? (
          <WelcomeHero />
        ) : (
          <AnimatePresence initial={false}>
            {grouped.map((item, i) => {
              if (item.type === 'separator') {
                return <DateSeparator key={`sep-${item.label}`} date={item.label} />;
              }

              const msg = item;
              const time = new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

              if (msg.type === 'system') {
                return <SystemMessage key={msg._id || i} content={msg.content} />;
              }

              if (msg.type === 'report' || msg.type === 'rescan') {
                return (
                  <motion.div key={msg._id || i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                    className="flex justify-start my-3">
                    <div className="flex flex-col gap-1.5 max-w-md w-full">
                      <div className="flex items-center gap-2 px-1">
                        <Bot size={13} className="text-indigo-600 dark:text-indigo-400" />
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 font-outfit">Sentinel QA Assistant</span>
                        <span className="text-[10px] text-slate-400 font-mono">{time}</span>
                      </div>
                      <ScanSummaryCard
                        message={msg}
                        onViewReport={onViewFullReport}
                        isRescan={msg.type === 'rescan'}
                      />
                    </div>
                  </motion.div>
                );
              }

              const isUser = msg.type === 'user';
              const isHazard = msg.content?.includes('SECURITY HAZARD') || msg.content?.includes('🚨');

              return (
                <motion.div key={msg._id || i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                  className={`flex ${isUser ? 'justify-end' : 'justify-start'} my-2`}>
                  <div className={`flex flex-col gap-1 max-w-[85%] ${isUser ? 'items-end' : 'items-start'}`}>
                    <div className="flex items-center gap-1.5 px-1">
                      {!isUser && (
                        isHazard
                          ? <Shield size={12} className="text-rose-600 animate-pulse" />
                          : <Bot size={12} className="text-indigo-600 dark:text-indigo-400" />
                      )}
                      <span className={`text-[10px] font-bold uppercase tracking-wider font-outfit ${
                        isHazard ? 'text-rose-600 dark:text-rose-400' : 'text-slate-500'
                      }`}>
                        {isUser ? 'You' : 'Sentinel QA'}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">{time}</span>
                      {isUser && <User size={12} className="text-slate-400" />}
                    </div>

                    <div className={`px-4 py-3 rounded-2xl text-xs leading-relaxed transition-all shadow-sm ${
                      isUser
                        ? 'bg-indigo-600 text-white rounded-tr-sm font-medium'
                        : isHazard
                          ? 'bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-slate-900 dark:text-white rounded-tl-sm'
                          : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-tl-sm'
                    }`}>
                      {msg.type === 'ai' ? (
                        <div className="prose prose-slate dark:prose-invert max-w-none text-xs leading-relaxed">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                        </div>
                      ) : (
                        <p className="font-medium whitespace-pre-wrap">{msg.content}</p>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}

        {/* ── Live Crawling & Auditing Progress Card ── */}
        {isScanning && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-2xl bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-800 rounded-2xl p-5 md:p-6 shadow-md space-y-4 my-2"
          >
            <div className="flex items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-3">
                <div className="size-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/80 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
                  <Loader2 size={18} className="animate-spin" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 text-[10px] font-bold uppercase tracking-wider animate-pulse font-outfit">
                      Autonomous Crawl Active
                    </span>
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200 font-mono">
                      {globalScanProgress?.percent || 25}%
                    </span>
                  </div>
                  <p className="text-sm font-bold text-slate-900 dark:text-white font-outfit mt-0.5">
                    {globalScanProgress?.stage || 'Deep Crawling & Sensory Execution'}
                  </p>
                </div>
              </div>
              <div className="px-3 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950 border border-indigo-200 dark:border-indigo-800 text-[10px] font-mono font-bold text-indigo-700 dark:text-indigo-300 uppercase tracking-wider">
                Status: IN_PROGRESS
              </div>
            </div>

            {/* Dynamic Progress Bar */}
            <div className="space-y-1.5">
              <div className="w-full h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden relative">
                <motion.div
                  className="h-full bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-500 rounded-full"
                  initial={{ width: '15%' }}
                  animate={{ width: `${Math.max(15, globalScanProgress?.percent || 25)}%` }}
                  transition={{ duration: 0.5 }}
                />
              </div>
              <div className="flex items-center justify-between text-[11px] text-slate-600 dark:text-slate-400 font-medium">
                <span>Traversing DOM tree, internal links & API endpoints</span>
                <span>Target: {chatMeta?.url ? (() => { try { return new URL(chatMeta.url).hostname; } catch(e) { return chatMeta.url; } })() : 'Autonomous Target'}</span>
              </div>
            </div>

            {/* Active Sensors Status Badges */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
              {[
                { label: 'Universal Crawler', icon: <ExternalLink size={11} /> },
                { label: 'Form Fuzzer', icon: <FormInput size={11} /> },
                { label: 'Secret Sniffer', icon: <Shield size={11} /> },
                { label: 'Spatial Layout', icon: <Layout size={11} /> },
                { label: 'Console Traps', icon: <Terminal size={11} /> },
                { label: 'Silent API Net', icon: <Wifi size={11} /> },
                { label: 'WCAG 2.1 A11y', icon: <UserCheck size={11} /> },
                { label: 'Core Web Vitals', icon: <Zap size={11} /> }
              ].map((s, idx) => (
                <div key={idx} className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-center justify-between gap-1">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-indigo-600 dark:text-indigo-400 shrink-0">{s.icon}</span>
                    <span className="text-[10px] font-bold text-slate-800 dark:text-slate-200 truncate">{s.label}</span>
                  </div>
                  <span className="size-1.5 rounded-full bg-indigo-600 animate-ping shrink-0" />
                </div>
              ))}
            </div>

            <p className="text-[11px] text-slate-500 dark:text-slate-400 italic">
              Discovered issues will automatically populate into your report dashboard and audit sensor badges.
            </p>
          </motion.div>
        )}

        {/* AI Typing Indicator (when AI is synthesizing response) */}
        {!isScanning && isTyping && (
          <div className="flex justify-start my-2">
            <div className="flex items-center gap-3 p-3.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <Bot size={16} className="text-indigo-600 dark:text-indigo-400 animate-bounce" />
              <div className="flex gap-1.5">
                {[0, 1, 2].map(i => (
                  <motion.div key={i}
                    animate={{ scale: [1, 1.3, 1], opacity: [0.3, 1, 0.3] }}
                    transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15 }}
                    className="size-1.5 bg-indigo-600 dark:bg-indigo-400 rounded-full" />
                ))}
              </div>
              <span className="text-xs text-slate-600 dark:text-slate-400 font-medium font-outfit">Senior QA Agent analyzing...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* ── Footer / Input ── */}
      {(activeView === 'qa' || activeView === 'chat') && (
        <div className="p-4 bg-slate-50/90 dark:bg-slate-900/90 z-10 border-t border-slate-200 dark:border-slate-800">
          {/* Scan params (always visible to allow reconfiguring for rescans) */}
          <div className="max-w-5xl mx-auto mb-3 space-y-2.5">
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="flex items-center gap-1 bg-white dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                {['single', 'site'].map(s => (
                  <button key={s} onClick={() => setScanParams(p => ({ ...p, scope: s }))}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${scanParams.scope === s ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-700 dark:text-slate-300 hover:text-slate-900 hover:bg-slate-100 dark:hover:bg-slate-700'}`}>
                    {s === 'single' ? 'Single URL' : 'Entire Website Crawl'}
                  </button>
                ))}
              </div>
              <button onClick={() => setShowSensors(o => !o)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow-sm ${
                  showSensors ? 'bg-indigo-600 border border-indigo-600 text-white' : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}>
                <span>Audit Sensors ({scanParams.tests.length} Active)</span>
                {totalDiscoveredAcrossSensors > 0 && (
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${showSensors ? 'bg-white text-indigo-700' : 'bg-rose-50 border border-rose-200 text-rose-700 dark:bg-rose-950 dark:border-rose-800 dark:text-rose-300'}`}>
                    {totalDiscoveredAcrossSensors} Issues
                  </span>
                )}
                <ChevronUp size={13} className={`transition-transform ${showSensors ? 'rotate-180' : ''}`} />
              </button>
            </div>
            <AnimatePresence>
              {showSensors && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                  className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-2">
                  {[
                    { id: 'ui', label: 'UI/UX Layout', desc: 'Dead clicks & touch' },
                    { id: 'forms', label: 'Form Fuzzer', desc: 'Boundary stress' },
                    { id: 'security', label: 'Secret Sniffer', desc: 'API key & tokens' },
                    { id: 'console', label: 'Console Traps', desc: 'JS exceptions' },
                    { id: 'links', label: 'Broken Links', desc: '404 dead hrefs' },
                    { id: 'network', label: 'Network/API', desc: 'Failed endpoints' },
                    { id: 'accessibility', label: 'WCAG A11y', desc: 'ARIA & contrast' },
                    { id: 'lighthouse', label: 'Web Vitals', desc: 'LCP & performance' },
                  ].map(test => {
                    const on = scanParams.tests.includes(test.id);
                    const count = getSensorCount(test.id);
                    const hasCount = count !== null && count !== undefined;
                    const countNum = typeof count === 'number' ? count : parseInt(count, 10);
                    const isPositive = !isNaN(countNum) && countNum > 0;

                    return (
                      <button
                        key={test.id}
                        type="button"
                        onClick={() => toggleTest(test.id)}
                        className={`p-2.5 rounded-xl transition-all border text-xs font-bold flex flex-col justify-between gap-1.5 text-left ${
                          on
                            ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border-indigo-300 dark:border-indigo-700'
                            : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-center justify-between w-full">
                          <span className="font-outfit truncate">{test.label}</span>
                          <div className={`size-3.5 rounded-full border flex items-center justify-center shrink-0 ml-1 ${on ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-400'}`}>
                            {on && <Check size={8} strokeWidth={4} />}
                          </div>
                        </div>
                        <div className="flex items-center justify-between w-full text-[10px]">
                          <span className="text-slate-500 dark:text-slate-400 font-normal truncate">{test.desc}</span>
                          {hasCount && (
                            <span className={`px-1.5 py-0.2 rounded-md font-mono font-bold shrink-0 ml-1 ${
                              isPositive
                                ? 'bg-rose-100 text-rose-800 dark:bg-rose-900/60 dark:text-rose-300 border border-rose-300 dark:border-rose-700'
                                : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700'
                            }`}>
                              {count}
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <form onSubmit={handleSend} className="relative max-w-5xl mx-auto">
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend(e);
                }
              }}
              placeholder={activeChatId ? 'Ask Senior QA a question about this scan... (e.g. "what are the critical security bugs?")' : 'Enter a website URL to start autonomous QA audit (e.g. https://example.com)...'}
              className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl py-3 px-5 pr-14 text-sm font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-sm transition-all placeholder:text-slate-400"
            />
            <button type="submit" disabled={isTyping}
              className={`absolute right-2.5 top-1/2 -translate-y-1/2 p-2 rounded-lg transition-all ${input.trim() && !isTyping ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm' : 'bg-slate-100 dark:bg-slate-700 text-slate-400 dark:text-slate-500'}`}>
              <Send size={15} />
            </button>
          </form>
        </div>
      )}
    </div>
  );
};

export default ChatInterface;
