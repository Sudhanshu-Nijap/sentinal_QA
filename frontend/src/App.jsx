import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldCheck, Shield, Bug, Activity, Command, Cpu, Zap, Skull, X, Calendar, Bot, Sun, Moon } from 'lucide-react';
import axios from 'axios';

import ScanForm from './components/ScanForm';
import ReportDashboard from './components/ReportDashboard';
import BentoDashboard from './components/BentoDashboard';
import ReportDetail from './components/ReportDetail';
import GlobalIntelligence from './components/GlobalIntelligence';
import AuthModal from './components/AuthModal';
import HowItWorks from './components/HowItWorks';
import AboutUs from './components/AboutUs';
import Capabilities from './components/Capabilities';
import LiveFuzzingConsole from './components/LiveFuzzingConsole';
import ChatSidebar from './components/ChatSidebar';
import ChatInterface from './components/ChatInterface';
import LoadingScreen from './components/LoadingScreen';
import Footer from './components/Footer';
import LearningHubPage from './components/LearningHub/LearningHubPage';
import FloatingAIWidget from './components/FloatingAIWidget';
import SchedulingDashboard from './components/SchedulingDashboard';
import AddJobModal from './components/AddJobModal';
import { API_URL, SOCKET_URL } from './config/api';

function App() {


  const [activeReportId, setActiveReportId] = useState(() => localStorage.getItem('sentinel_active_report') || null);
  const [activeChatId, setActiveChatId] = useState(() => localStorage.getItem('sentinel_active_chat') || null);

  useEffect(() => {
    if (activeChatId) localStorage.setItem('sentinel_active_chat', activeChatId);
    else localStorage.removeItem('sentinel_active_chat');
  }, [activeChatId]);
  const [viewingReportId, setViewingReportId] = useState(null);
  const [liveReportId, setLiveReportId] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(!!localStorage.getItem('token'));
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('sentinel_white_theme_preference');
    return saved ? saved : 'light';
  });
  const [activeView, setActiveView] = useState('qa');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [reports, setReports] = useState([]);
  const [scanProgress, setScanProgress] = useState(null);
  const [alert, setAlert] = useState(null);
  const [confirmModal, setConfirmModal] = useState(null);
  const [pendingChat, setPendingChat] = useState(null);
  const [scheduleTargetUrl, setScheduleTargetUrl] = useState(null);



  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 2500);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('sentinel_white_theme_preference', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    const handleStorageChange = () => {
      setIsLoggedIn(!!localStorage.getItem('token'));
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const fetchReports = async () => {
    try {
      const userId = localStorage.getItem('userId');
      if (!userId) return;
      const { data } = await axios.get(`${API_URL}/api/reports?userId=${userId}`);
      setReports(data);
    } catch (err) {
      console.error("Failed to sync reports for global intelligence", err);
    }
  };

  const fetchActiveScan = async () => {
    try {
      const userId = localStorage.getItem('userId');
      if (!userId) return;
      const { data } = await axios.get(`${API_URL}/api/scan/active/${userId}`);
      if (data && data._id) {
        setActiveReportId(data._id);
        // REMOVED: setRefreshKey - this caused the infinite loop
      }
    } catch (err) {
      // No active scan, silent skip
    }
  };

  useEffect(() => {
    if (isLoggedIn) {
      fetchReports();
      fetchActiveScan();
    }
  }, [isLoggedIn, refreshKey]);

  const toggleTheme = () => setTheme(prev => prev === 'dark' ? 'light' : 'dark');

  const handleScanStarted = (reportId, chatId) => {
    // Immediate HUD engagement to prevent latency gap
    setScanProgress({ percent: 0, stage: 'Initializing autonomous sequence...', status: 'in-progress' });
    setLiveReportId(reportId);
    if (chatId) setActiveChatId(chatId);
    setRefreshKey(prev => prev + 1);
  };

  // Initial load of scan progress from cache
  useEffect(() => {
    const cached = localStorage.getItem('sentinel_pending_progress');
    if (cached) {
      try {
        setScanProgress(JSON.parse(cached));
      } catch (e) {
        localStorage.removeItem('sentinel_pending_progress');
      }
    }
  }, []);

  const socketRef = useRef(null);

  // 1. Persistent Socket Initialization
  useEffect(() => {
    if (!socketRef.current) {
      socketRef.current = io(SOCKET_URL, {
        reconnectionAttempts: 10
      });

      const socket = socketRef.current;

      socket.on('connect', () => {
        console.log('[Socket]: Tactical uplink established.');

        // Join specialized rooms
        const userId = localStorage.getItem('userId');
        if (userId) {
          socket.emit('join-user', userId);
          console.log(`[Socket]: Subscribed to global user stream: user_${userId}`);
        }

        const currentLiveId = localStorage.getItem('sentinel_live_report_id');
        if (currentLiveId) {
          socket.emit('join-room', currentLiveId);
        }
      });

      // Global State Synchronizers
      socket.on('report-update', (data) => {
        console.log('[Socket]: Global report update detected:', data);
        setRefreshKey(prev => prev + 1);
      });

      socket.on('thread-update', (data) => {
        console.log('[Socket]: Neural thread update detected:', data);
        setRefreshKey(prev => prev + 1);
      });

      socket.on('scan-progress', (data) => {
        setScanProgress(data);
        localStorage.setItem('sentinel_pending_progress', JSON.stringify(data));

        if (data.status === 'completed' || data.status === 'failed') {
          localStorage.removeItem('sentinel_pending_progress');
          localStorage.removeItem('sentinel_live_report_id');
          
          if (data.status === 'completed' && data.finalReportId) {
            console.log('[App]: Scan complete. Delaying dashboard engagement for chat card visibility...');
            setTimeout(() => {
              setViewingReportId(data.finalReportId);
            }, 2500); // 2.5s window for chat card to render
          }
          
          setRefreshKey(prev => prev + 1);
          setTimeout(() => setScanProgress(null), 5000);
        }
      });

      socket.on('job-sync', (data) => {
        console.log('[Socket]: Job synchronization pulse:', data);
        if (data.status === 'running' && data.reportId) {
          console.log('[Socket]: Autonomous scan detected. Engaging Live HUD for:', data.reportId);
          handleScanStarted(data.reportId);
        }
        
        // Broad Refresh: Ensure all data (Lattice, History, Schedule List) are in sync
        setRefreshKey(prev => prev + 1);
      });
    }

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, []);

  // 2. Room Switching Logic
  useEffect(() => {
    if (liveReportId && socketRef.current) {
      localStorage.setItem('sentinel_live_report_id', liveReportId);
      socketRef.current.emit('join-room', liveReportId);
      console.log('[Socket]: Joined active scan room:', liveReportId);
    }
  }, [liveReportId]);

  const handleLogin = () => {
    setIsLoggedIn(true);
    setIsAuthOpen(false);
    setRefreshKey(prev => prev + 1);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('userId');
    setIsLoggedIn(false);
    setRefreshKey(prev => prev + 1);
  };

  const handleReScan = async (url, reportId = null) => {
    try {
      const userId = localStorage.getItem('userId');
      const API_ENDPOINT = `${API_URL}/api`;
      
      let response;
      if (reportId) {
        // Use stateful rescan protocol (preserves modules, scope, etc.)
        response = await axios.post(`${API_ENDPOINT}/report/${reportId}/rescan`);
      } else {
        // Fallback to simple URL rescan
        response = await axios.post(`${API_URL}/scan`, {
          url,
          userId,
          force: true
        });
      }

      if (response.data.reportId) {
        handleScanStarted(response.data.reportId);
        setViewingReportId(null);
        setAlert({ type: 'info', message: 'Re-scan initiated. Monitoring neural downlink...' });
      }
    } catch (error) {
      if (error.response?.status === 403) {
        console.warn('[SecurityGate]: Re-scan blocked by neural security audit.');
        setAlert({ type: 'error', message: 'CRITICAL: Targeted domain matches phishing patterns. Scan aborted.' });
        return;
      }
      console.error('Re-scan failed', error);
      setAlert({ type: 'error', message: 'Target acquisition failed. Check backend uplink.' });
    }
  };

  useEffect(() => {
    if (alert) {
      const timer = setTimeout(() => setAlert(null), 6000);
      return () => clearTimeout(timer);
    }
  }, [alert]);

  const confirm = (options) => {
    return new Promise((resolve) => {
      setConfirmModal({
        ...options,
        onConfirm: () => {
          setConfirmModal(null);
          resolve(true);
        },
        onCancel: () => {
          setConfirmModal(null);
          resolve(false);
        }
      });
    });
  };

  const prompt = (options) => {
    return new Promise((resolve) => {
      setConfirmModal({
        ...options,
        showInput: true,
        onConfirm: (val) => {
          setConfirmModal(null);
          resolve(val);
        },
        onCancel: () => {
          setConfirmModal(null);
          resolve(null);
        }
      });
    });
  };

  return (
    <div className="relative min-h-screen selection:bg-primary/30 overflow-x-hidden transition-colors duration-700">
      <AnimatePresence mode="wait">
        {isLoading && <LoadingScreen key="loader" />}
      </AnimatePresence>


      <AnimatePresence>
        {alert && (
          <motion.div
            initial={{ x: 300, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 300, opacity: 0 }}
            className="fixed top-24 right-6 z-[9999] p-1 rounded-2xl overflow-hidden shadow-2xl backdrop-blur-xl border border-[var(--eu-glass-border)]"
          >
            <div className="flex items-center gap-4 px-6 py-4 bg-[var(--eu-bg-void)] relative backdrop-blur-3xl">
              <div className={`size-10 rounded-xl flex items-center justify-center border ${alert.type === 'error' ? 'bg-primary/10 border-primary/30 text-primary' :
                alert.type === 'success' ? 'bg-primary/10 border-primary/30 text-primary' :
                  'bg-primary/10 border-primary/30 text-primary'
                }`}>
                {alert.type === 'error' ? <Bug size={18} /> :
                  alert.type === 'success' ? <ShieldCheck size={18} /> :
                    <Activity size={18} className="animate-pulse" />}
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-muted font-outfit">Status Uplink</p>
                <p className="text-xs font-bold text-white max-w-[240px] leading-tight mt-0.5">{alert.message}</p>
              </div>
              <button onClick={() => setAlert(null)} className="ml-4 p-1 hover:bg-[var(--eu-bg-void)]/40 rounded-lg text-muted">
                <Command size={14} className="rotate-45" />
              </button>

              <motion.div
                className={`absolute bottom-0 left-0 h-[2px] ${alert.type === 'error' ? 'bg-primary' :
                  alert.type === 'success' ? 'bg-primary' :
                    'bg-primary'
                  }`}
                initial={{ width: '100%' }}
                animate={{ width: '0%' }}
                transition={{ duration: 6 }}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* <div className="dreamy-blob top-[-10%] left-[-10%] animate-dreamy opacity-20" />
      <div className="dreamy-blob bottom-[-10%] right-[-10%] animate-dreamy opacity-10 [animation-delay:4s]" /> */}
      <div className="noise-overlay" />

      {/* Header */}
      <AnimatePresence>
        <motion.header
          initial={{ y: -100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -100, opacity: 0 }}
          className={`fixed z-50 transition-all duration-700 ${isLoggedIn
            ? "top-0 left-0 w-full px-4 py-2 sm:px-6 sm:py-3 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 shadow-sm"
            : "top-4 left-1/2 -translate-x-1/2 w-[95%] max-w-7xl px-4 py-3 md:px-8 md:py-4 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200/90 dark:border-slate-800/90 shadow-md rounded-[20px]"
            } flex items-center justify-between`}
        >
          <div className="flex items-center gap-2 sm:gap-4">
            {isLoggedIn && (
              <button
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                className="lg:hidden p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
                title="Toggle Sidebar"
              >
                <Command size={18} className="text-primary" />
              </button>
            )}
            <div className={`size-7 sm:size-8 bg-indigo-50 dark:bg-indigo-950/50 rounded-lg flex items-center justify-center border border-indigo-200 dark:border-indigo-800 ${!isLoggedIn && 'shadow-sm'}`}>
              <Shield className="text-indigo-600 dark:text-indigo-400 size-3 sm:size-4" />
            </div>
            <a href="#home" className="font-outfit font-black text-base sm:text-xl tracking-tight uppercase text-slate-900 dark:text-white hover:opacity-80 transition-opacity">Sentinel</a>
          </div>

          {!isLoggedIn && (
            <nav className="hidden lg:flex items-center gap-8 absolute left-1/2 -translate-x-1/2">
              {[
                { name: 'Home', href: '#home' },
                { name: 'Capabilities', href: '#capabilities' },
                { name: 'Workflow', href: '#how-it-works' },
                { name: 'Architecture', href: '#about-us' }
              ].map((link) => (
                <a
                  key={link.name}
                  href={link.href}
                  className="text-xs font-semibold text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors relative group py-1"
                >
                  {link.name}
                  <span className="absolute bottom-0 left-0 w-0 h-[2px] bg-indigo-600 transition-all group-hover:w-full" />
                </a>
              ))}
            </nav>
          )}

          {isLoggedIn && (
            <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-1.5 md:gap-2">
              {[
                { id: 'qa', label: 'Chat', icon: <Bot size={15} />, title: 'AI Assistant' },
                { id: 'analyze', label: 'Analyze', icon: <Activity size={15} />, title: 'Intelligence Dashboard' },
                { id: 'learn', label: 'Learn', icon: <Cpu size={15} />, title: 'Knowledge Base' },
                { id: 'schedule', label: 'Schedule', icon: <Calendar size={15} />, title: 'Automated Audits' },
              ].map(v => (
                <button
                  key={v.id}
                  onClick={() => {
                    setActiveView(v.id);
                    setViewingReportId(null);
                  }}
                  className={`px-4 py-2 rounded-xl transition-all border flex items-center gap-2 font-semibold text-xs ${activeView === v.id
                      ? 'bg-indigo-600 border-indigo-500 text-white shadow-sm'
                      : 'bg-slate-100 hover:bg-slate-200/80 border-slate-200 text-slate-800 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200 hover:text-slate-950'
                    }`}
                  title={v.title}
                >
                  <div>{v.icon}</div>
                  <span className="hidden sm:inline">{v.label}</span>
                </button>
              ))}
            </div>
          )}

          <div className="flex items-center gap-3">
            <button
              onClick={toggleTheme}
              className="p-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-xl transition-all border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200"
              title={theme === 'dark' ? "Switch to White Theme" : "Switch to Dark Theme"}
            >
              {theme === 'dark' ? <Sun size={16} className="text-amber-400" /> : <Moon size={16} className="text-slate-700" />}
            </button>

            {!isLoggedIn && (
              <button
                onClick={() => setIsAuthOpen(true)}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-xl transition-all shadow-sm active:scale-95"
              >
                Sign In
              </button>
            )}
          </div>
        </motion.header>
      </AnimatePresence>

      <main className="relative z-10 pt-4 md:pt-8 h-full">
        <AnimatePresence mode="wait">
          {!isLoggedIn ? (
            <motion.div
              key="landing-page"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col gap-0"
            >
              {/* Hero Section */}
              <section id="home" className="relative min-h-[90vh] flex items-center justify-center px-4 overflow-hidden pt-24 pb-16">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[450px] bg-indigo-500/5 rounded-full blur-[140px] -z-10" />

                <div className="text-center z-10 max-w-5xl w-full mx-auto px-6">
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6 }}
                  >
                    <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs sm:text-sm font-semibold tracking-wide mb-8">
                      <Shield size={16} className="text-indigo-600" />
                      Autonomous QA & Security Platform
                    </span>

                    <h1 className="text-4xl sm:text-6xl md:text-7xl font-extrabold tracking-tight text-slate-900 dark:text-white mb-8 leading-[1.15]">
                      Automated Web Security <br className="hidden sm:block" />
                      & Performance Intelligence
                    </h1>

                    <p className="text-slate-700 dark:text-slate-300 text-base sm:text-lg md:text-xl max-w-3xl mx-auto leading-relaxed mb-10 font-normal">
                      Continuous page discovery, Core Web Vitals auditing, security threat detection, and Senior QA diagnostic intelligence in a unified workspace.
                    </p>

                    <div className="flex flex-wrap items-center justify-center gap-5 mb-14">
                      <button
                        onClick={() => setIsAuthOpen(true)}
                        className="px-8 py-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm tracking-wide transition-all shadow-md shadow-indigo-600/20 active:scale-95 flex items-center gap-2.5"
                      >
                        <Zap size={18} />
                        Get Started Free
                      </button>

                      <button
                        onClick={() => setIsAuthOpen(true)}
                        className="px-8 py-4 rounded-xl bg-white hover:bg-slate-50 border border-slate-300 text-slate-900 font-bold text-sm tracking-wide transition-all active:scale-95 shadow-sm"
                      >
                        Sign In
                      </button>
                    </div>

                    <div className="pt-10 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-center gap-10 text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-300">
                      <div className="flex items-center gap-2.5">
                        <span className="size-2 rounded-full bg-indigo-600" />
                        100% Page Crawling Accuracy
                      </div>
                      <div className="flex items-center gap-2.5">
                        <span className="size-2 rounded-full bg-emerald-600" />
                        Lighthouse Core Web Vitals
                      </div>
                      <div className="flex items-center gap-2.5">
                        <span className="size-2 rounded-full bg-violet-600" />
                        AI Root-Cause Diagnostics
                      </div>
                    </div>
                  </motion.div>
                </div>
              </section>

              <section id="capabilities" className="py-6 sm:py-8 scroll-mt-32">
                <Capabilities />
              </section>

              <section id="how-it-works" className="flex items-center justify-center py-6 sm:py-8 scroll-mt-32">
                <HowItWorks />
              </section>




              <div id="about-us" className="relative flex items-center justify-center py-6 sm:py-8 px-4 sm:px-10 scroll-mt-32">
                <AboutUs />
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="dashboard"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 pt-16 md:pt-20 flex overflow-hidden bg-transparent"
            >
              <div
                className={`fixed inset-0 z-[60] bg-black/80 transition-opacity duration-500 lg:hidden ${isSidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
                onClick={() => setIsSidebarOpen(false)}
              />

              <div className={`fixed inset-y-0 left-0 z-[70] transition-transform duration-500 transform lg:relative lg:translate-x-0 lg:p-4 lg:md:p-6 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
                <ChatSidebar
                  onSelectChat={(chatId) => {
                    setActiveChatId(chatId);
                    setActiveView('qa');
                    setViewingReportId(null);
                    setIsSidebarOpen(false);
                  }}
                  onViewReport={(id) => {
                    setViewingReportId(id);
                    setIsSidebarOpen(false);
                  }}
                  activeChatId={activeChatId}
                  onNewSession={() => {
                    setActiveChatId(null);
                    setActiveView('qa');
                    setViewingReportId(null);
                    setIsSidebarOpen(false);
                  }}
                  refreshKey={refreshKey}
                  onToggleTheme={toggleTheme}
                  theme={theme}
                  onGroupChart={() => {
                    setActiveView('analyze');
                    setViewingReportId(null);
                    setIsSidebarOpen(false);
                  }}
                  onScheduleClick={() => {
                    setActiveView('schedule');
                    setViewingReportId(null);
                    setIsSidebarOpen(false);
                  }}
                  onDeleteChat={(id) => {
                    if (activeChatId === id) {
                      setActiveChatId(null);
                      setViewingReportId(null);
                    }
                    if (scanProgress && (scanProgress.chatId === id)) {
                      setScanProgress(null);
                      localStorage.removeItem('sentinel_pending_progress');
                    }
                    setRefreshKey(prev => prev + 1);
                  }}
                  confirm={confirm}
                  prompt={prompt}
                  setAlert={setAlert}
                />
              </div>

              <div className="flex-1 h-full relative p-4 md:p-6 overflow-hidden">
                <AnimatePresence mode="wait">
                  {viewingReportId ? (
                    <motion.div
                      key="report-view"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      className="h-full overflow-y-auto custom-scrollbar"
                    >
                      <ReportDetail
                        reportId={viewingReportId}
                        onBack={() => setViewingReportId(null)}
                        onRefresh={() => setRefreshKey(prev => prev + 1)}
                        onReScan={handleReScan}
                        onDeleted={() => {
                          if (activeReportId === viewingReportId) setActiveReportId(null);
                          setRefreshKey(prev => prev + 1);
                          setViewingReportId(null);
                        }}
                        onAskAI={(msg, rId) => {
                          setPendingChat({ message: msg, reportId: rId });
                          setViewingReportId(null);
                          setActiveView('qa');
                        }}
                        confirm={confirm}
                        prompt={prompt}
                        setAlert={setAlert}
                      />
                    </motion.div>
                  ) : (
                    <motion.div
                      key="chat-interface-wrapper"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="h-full"
                    >
                      <ChatInterface
                        key={activeChatId || 'new'}
                        activeChatId={activeChatId}
                        activeView={activeView}
                        onViewChange={setActiveView}
                        onScanStarted={handleScanStarted}
                        onViewFullReport={setViewingReportId}
                        onRefresh={() => setRefreshKey(prev => prev + 1)}
                        onResetTarget={() => { setActiveChatId(null); setActiveView('qa'); }}
                        globalScanProgress={scanProgress}
                        pendingMessage={pendingChat?.message}
                        pendingReportId={pendingChat?.reportId}
                        onMessageConsumed={() => setPendingChat(null)}
                        onChatActivated={(chatId) => setActiveChatId(chatId)}
                        reports={reports}
                        setAlert={setAlert}
                        confirm={confirm}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Global Progress Bar (Sticky) */}
      <AnimatePresence>
        {isLoggedIn && scanProgress && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[90%] max-w-2xl z-[100] p-[1px] bg-gradient-to-r from-eu-accent/50 via-white/10 to-transparent rounded-[20px] shadow-[0_30px_60px_-15px_rgba(0,0,0,0.5)]"
          >
            <div className="bg-[var(--eu-bg-card)] p-5 rounded-[19px] border border-[var(--eu-glass-border)]">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-4">
                  <div className="size-11 bg-eu-accent/10 rounded-xl flex items-center justify-center border border-eu-accent/20 relative group">
                    <div className="absolute inset-0 bg-eu-accent/20 blur-lg rounded-full animate-pulse group-hover:bg-eu-accent/40 transition-all" />
                    <Activity size={18} className="text-eu-accent animate-[pulse_2s_infinite] relative" />
                  </div>
                  <div>
                    <h4 className="text-[11px] font-black uppercase tracking-[0.2em] text-white/90 font-outfit">Neural Substrate Scan</h4>
                    <p className="text-[10px] font-bold text-eu-accent/80 uppercase tracking-tighter mt-1 flex items-center gap-2">
                      <span className="inline-block size-1 bg-eu-accent rounded-full animate-ping" />
                      {scanProgress.stage}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <div className="text-lg font-black font-mono text-white tracking-tighter leading-none">{scanProgress.percent}%</div>
                    <div className="text-[8px] font-black text-slate-500 uppercase tracking-widest mt-1">Completion</div>
                  </div>

                  <button
                    onClick={() => {
                      setScanProgress(null);
                      localStorage.removeItem('sentinel_pending_progress');
                      window.location.reload();
                    }}
                    className="size-8 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl flex items-center justify-center text-white/40 hover:text-white transition-all shadow-sm"
                    title="Dismiss Progress Monitor"
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>

              <div className="relative w-full h-2.5 bg-black/40 rounded-full overflow-hidden p-[1px] border border-white/10 shadow-inner">
                <motion.div
                  className="h-full rounded-full bg-gradient-to-r from-eu-accent via-violet-500 to-cyan-400 relative"
                  initial={{ width: '0%' }}
                  animate={{ width: `${scanProgress.percent}%` }}
                  transition={{ duration: 0.8, ease: "circOut" }}
                >
                  {/* Premium Shimmer Effect */}
                  <motion.div
                    animate={{ x: ['-100%', '200%'] }}
                    transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                    className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent w-full h-full"
                  />
                  {/* Subtle Glow */}
                  <div className="absolute inset-0 shadow-[0_0_15px_rgba(var(--eu-accent-rgb),0.5)]" />
                </motion.div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {!isLoggedIn && <Footer />}

      {/* Global Confirm/Prompt Modal - Refined to 'Popup' style */}
      <AnimatePresence>
        {confirmModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[10000] flex items-center justify-center p-4 glass-overlay"
          >
            <motion.div
              initial={{ scale: 0.8, y: -20, opacity: 0, rotateX: 10 }}
              animate={{ scale: 1, y: 0, opacity: 1, rotateX: 0 }}
              exit={{ scale: 0.8, y: -20, opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="w-full max-w-[380px] glass-modal p-6 rounded-[28px] relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 p-6 opacity-[0.03]">
                <Command size={80} className="text-eu-accent" />
              </div>

              <div className="flex items-center gap-4 mb-5">
                <div className={`size-11 rounded-xl flex items-center justify-center border shadow-neon ${confirmModal.type === 'danger' ? 'bg-rose-500/10 border-rose-500/20 text-rose-500' : 'bg-eu-accent/10 border-eu-accent/20 text-eu-accent'
                  }`}>
                  {confirmModal.type === 'danger' ? <Skull size={20} /> : <Zap size={20} />}
                </div>
                <div>
                  <h3 className="text-lg font-black uppercase tracking-tight text-[var(--eu-text-main)] font-outfit leading-none">{confirmModal.title || 'Uplink Request'}</h3>
                  <p className="text-[8px] font-black text-[var(--eu-text-main)] opacity-40 uppercase tracking-widest font-outfit mt-1">Status: Restricted Access</p>
                </div>
              </div>

              <p className="text-slate-400 text-[13px] leading-relaxed font-medium mb-6">
                {confirmModal.message}
              </p>

              {confirmModal.showInput && (
                <div className="mb-8">
                  <input
                    id="modal-pixel-input"
                    type="text"
                    autoFocus
                    placeholder="Enter uplink parameters..."
                    className="w-full bg-[var(--eu-bg-void)] border border-[var(--eu-glass-border)] rounded-xl px-4 py-3 text-[var(--eu-text-main)] text-sm outline-none focus:border-eu-accent/50 transition-all font-mono"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') confirmModal.onConfirm(e.currentTarget.value);
                    }}
                  />
                </div>
              )}

              <div className="flex gap-3 mt-2">
                <button
                  onClick={confirmModal.onCancel}
                  className="flex-1 py-3 bg-[var(--eu-bg-void)]/40 hover:bg-[var(--eu-bg-void)]/60 border border-[var(--eu-glass-border)] rounded-xl text-[9px] font-black uppercase tracking-widest text-[var(--eu-text-main)] opacity-40 transition-all font-outfit"
                >
                  Abort
                </button>
                <button
                  onClick={() => {
                    const input = document.getElementById('modal-pixel-input');
                    confirmModal.onConfirm(input ? input.value : true);
                  }}
                  className={`flex-1 py-3 text-white rounded-xl text-[9px] font-black uppercase tracking-widest transition-all shadow-neon font-outfit ${confirmModal.type === 'danger' ? 'bg-primary hover:bg-primary/80' : 'bg-eu-accent hover:bg-eu-accent/80'
                    }`}
                >
                  {confirmModal.confirmText || 'Authorize'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {liveReportId && createPortal(
        <AnimatePresence>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[999] flex items-center justify-center p-4 md:p-12 bg-[var(--eu-bg-overlay-modal)] backdrop-blur-md"
          >
            <div className="w-full max-w-4xl h-[80vh] relative">
              <LiveFuzzingConsole reportId={liveReportId} />
              <button
                onClick={() => setLiveReportId(null)}
                className="absolute -top-12 right-0 px-6 py-2 bg-[var(--eu-bg-void)]/60 hover:bg-[var(--eu-bg-void)]/80 border border-[var(--eu-glass-border)] rounded-full text-[10px] font-black uppercase tracking-widest text-[var(--eu-text-main)] opacity-80 transition-all"
              >
                Close Live Console
              </button>
            </div>
          </motion.div>
        </AnimatePresence>,
        document.body
      )}

      <AnimatePresence>
        {isAuthOpen && (
          <AuthModal
            isOpen={isAuthOpen}
            onClose={() => setIsAuthOpen(false)}
            onLogin={handleLogin}
            onAuthSuccess={handleLogin}
          />
        )}
      </AnimatePresence>
      {isLoggedIn && activeView === 'learn' && <FloatingAIWidget />}

      <AnimatePresence>
        {scheduleTargetUrl && (
          <AddJobModal
            isOpen={!!scheduleTargetUrl}
            onClose={() => setScheduleTargetUrl(null)}
            initialUrl={scheduleTargetUrl}
            setAlert={setAlert}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

export default App;
