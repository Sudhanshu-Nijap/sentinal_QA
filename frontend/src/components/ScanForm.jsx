import { API_URL, SOCKET_URL } from '../config/api';
import React, { useState } from 'react';
import { motion, AnimatePresence, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { Globe, Sparkles, ArrowRight, Loader2, Target, Calendar } from 'lucide-react';
import axios from 'axios';

const ScanForm = ({ onScanStarted, scanProgress }) => {
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [scope, setScope] = useState('site'); // 'site' (crawls all pages) or 'single' (only target URL)
  const [chaosIntensity, setChaosIntensity] = useState('standard');
  const [showScheduling, setShowScheduling] = useState(false);
  const [schedule, setSchedule] = useState({
    scanType: 'quick',
    mode: 'one-time',
    date: new Date().toISOString().split('T')[0],
    time: '12:00',
    dayOfWeek: 1
  });

  const isScanningActive = loading || scanProgress?.status === 'in-progress';


  // Mouse tilt effect logic
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const mouseXSpring = useSpring(x);
  const mouseYSpring = useSpring(y);
  const rotateX = useTransform(mouseYSpring, [-0.5, 0.5], ["10deg", "-10deg"]);
  const rotateY = useTransform(mouseXSpring, [-0.5, 0.5], ["-10deg", "10deg"]);

  const handleMouseMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    x.set(mouseX / width - 0.5);
    y.set(mouseY / height - 0.5);
  };

  const handleMouseLeave = () => {
    x.set(0);
    y.set(0);
  };

  const normalizeUrl = (input) => {
    let trimmed = input.trim();
    if (!trimmed) return "";
    
    // Check if it already has a protocol
    if (!/^(https?:\/\/)/i.test(trimmed)) {
      trimmed = `https://${trimmed}`;
    }
    return trimmed;
  };

  const validateUrl = (urlToTest) => {
    try {
      // Basic format check before using URL constructor
      const pattern = /^(https?:\/\/)[^\s$.?#].[^\s]*$/i;
      if (!pattern.test(urlToTest)) return false;
      
      const parsed = new URL(urlToTest);
      return !!parsed.hostname && parsed.hostname.includes('.');
    } catch {
      return false;
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!url.trim()) {
      setError('Target URL is required');
      return;
    }

    const targetUrl = normalizeUrl(url);
    
    if (!validateUrl(targetUrl)) {
      setError('Invalid URL format. Please enter a valid domain.');
      return;
    }
    
    setLoading(true);
    try {
      const userId = localStorage.getItem('userId');
      
      if (showScheduling) {
        // Create a scheduled job
        await axios.post(`${API_URL}/api/scheduling/jobs`, {
          ...schedule,
          url: targetUrl,
          userId
        });
        setUrl('');
        setShowScheduling(false);
        // We might want a callback here to notify parent about new job
      } else {
        // Run immediate scan
        const response = await axios.post(`${API_URL}/api/scan`, { 
          url: targetUrl, 
          userId,
          chaosIntensity,
          scope
        });
        onScanStarted(response.data.reportId);
        setUrl('');
      }
    } catch (err) {

      console.error('Scan initiation failed', err);
      setError(err.response?.data?.error || 'System failed to initiate protocol');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div 
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className="w-full relative py-6"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.2, duration: 0.8 }}
        className="w-full max-w-3xl mx-auto relative z-20"
      >
        <form onSubmit={handleSubmit} className="relative group">
          <div className="absolute -inset-1 bg-transparent rounded-[32px] blur-2xl transition-opacity duration-700" />
          
          <div className={`relative bg-white dark:bg-slate-900 p-2 sm:p-3 transition-all duration-300 border ${error ? 'border-rose-400 shadow-md' : 'border-slate-200 dark:border-slate-800 shadow-lg group-focus-within:border-indigo-500 group-focus-within:ring-2 group-focus-within:ring-indigo-500/20'} rounded-[24px] sm:rounded-[28px]`}>
            <div className="flex flex-col md:flex-row items-center gap-2 sm:gap-4">
              <div className="flex-1 relative flex items-center w-full">
                <div className="absolute left-5 sm:left-6 text-slate-400 group-focus-within:text-indigo-600 transition-colors">
                  <Globe size={18} className="sm:size-[20px]" />
                </div>
                <input 
                  type="text"
                  value={url}
                  onChange={(e) => {
                    setUrl(e.target.value);
                    if (error) setError('');
                  }}
                  placeholder="Enter target URL (e.g. https://example.com)"
                  className="w-full h-14 sm:h-16 bg-transparent border-none pl-12 sm:pl-16 pr-4 sm:pr-6 text-base sm:text-lg font-semibold focus:outline-none text-slate-900 dark:text-white placeholder-slate-400"
                />
              </div>

              <button 
                type="submit"
                disabled={isScanningActive}
                className="bg-indigo-600 hover:bg-indigo-700 px-8 sm:px-10 h-14 sm:h-16 text-white rounded-xl sm:rounded-2xl transition-all active:scale-[0.98] font-bold tracking-wide text-sm disabled:opacity-80 w-full md:w-auto overflow-hidden group shadow-md shadow-indigo-600/20"
              >
                <div className="flex items-center justify-center gap-3 relative z-10">
                  {isScanningActive ? (
                    <div className="flex items-center gap-2">
                      <Loader2 size={18} className="animate-spin text-white" />
                      <span>{scanProgress?.percent ? `Crawling (${scanProgress.percent}%)` : 'Crawling Pages...'}</span>
                    </div>
                  ) : (
                    <>
                      <span>{showScheduling ? 'Confirm Schedule' : 'Start Autonomous Audit'}</span>
                      <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                    </>
                  )}
                </div>
              </button>
            </div>

            {/* Live Crawling & Diagnostic Progress Card in ScanForm */}
            <AnimatePresence>
              {scanProgress && scanProgress.status === 'in-progress' && (
                <motion.div
                  initial={{ opacity: 0, height: 0, marginTop: 0 }}
                  animate={{ opacity: 1, height: 'auto', marginTop: 16 }}
                  exit={{ opacity: 0, height: 0, marginTop: 0 }}
                  className="overflow-hidden border-t border-slate-100 dark:border-slate-800 pt-4"
                >
                  <div className="p-4 bg-indigo-50/70 dark:bg-slate-800/80 rounded-2xl border border-indigo-200/60 dark:border-indigo-800/60 flex flex-col gap-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="relative size-10 rounded-xl bg-indigo-600/10 dark:bg-indigo-400/10 border border-indigo-500/30 flex items-center justify-center shrink-0">
                          <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ duration: 2.5, repeat: Infinity, ease: 'linear' }}
                            className="absolute inset-0.5 rounded-lg border border-indigo-500 border-t-transparent"
                          />
                          <Globe size={16} className="text-indigo-600 dark:text-indigo-400" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-black uppercase tracking-wider text-indigo-700 dark:text-indigo-300 font-outfit">
                              Parallel Workers Crawling Active
                            </span>
                            <span className="text-xs font-black font-mono text-indigo-600 dark:text-indigo-400">
                              {scanProgress.percent || 15}%
                            </span>
                          </div>
                          <p className="text-xs font-bold text-slate-800 dark:text-slate-200 font-outfit truncate max-w-sm sm:max-w-md">
                            {scanProgress.stage || 'Crawling site pages and detecting issues...'}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 text-right">
                        <div>
                          <div className="text-xs font-black text-slate-900 dark:text-white font-mono">
                            {scanProgress.pagesCrawled || 1} Pages
                          </div>
                          <div className="text-[9px] font-bold text-amber-600 dark:text-amber-400 font-mono">
                            {scanProgress.issuesFound || 0} Issues
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                      <motion.div
                        className="h-full bg-gradient-to-r from-indigo-600 to-cyan-500 rounded-full"
                        animate={{ width: `${Math.max(15, scanProgress.percent || 15)}%` }}
                        transition={{ duration: 0.4 }}
                      />
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-center gap-3 sm:gap-4">
            {/* Audit Scope Toggle */}
            <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800/80 px-3.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
              <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">Scope:</span>
              <div className="flex gap-1 p-0.5 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setScope('site')}
                  className={`px-3 py-1 rounded-md text-[11px] font-bold transition-all flex items-center gap-1.5 ${
                    scope === 'site'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-700 dark:text-slate-300 hover:text-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                  title="Crawls all internal pages via sitemaps, navigation links, and JavaScript router endpoints"
                >
                  <Globe size={11} />
                  <span>Entire Website Crawl</span>
                </button>
                <button
                  type="button"
                  onClick={() => setScope('single')}
                  className={`px-3 py-1 rounded-md text-[11px] font-bold transition-all flex items-center gap-1.5 ${
                    scope === 'single'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-700 dark:text-slate-300 hover:text-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                  title="Audits only the single target URL entered"
                >
                  <Target size={11} />
                  <span>Single URL</span>
                </button>
              </div>
            </div>

            <div className="w-[1px] h-4 bg-slate-300 dark:bg-slate-700 hidden sm:block" />

            {/* Scan Depth Intensity */}
            <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800/80 px-3.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
              <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">Depth:</span>
              <div className="flex gap-1 p-0.5 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700">
                {['minimal', 'standard', 'maximum'].map((level) => (
                  <button
                    key={level}
                    type="button"
                    onClick={() => setChaosIntensity(level)}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-bold capitalize transition-all ${
                      chaosIntensity === level 
                        ? 'bg-indigo-600 text-white shadow-sm' 
                        : 'text-slate-700 dark:text-slate-300 hover:text-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    {level}
                  </button>
                ))}
              </div>
            </div>

            <div className="w-[1px] h-4 bg-slate-300 dark:bg-slate-700 hidden sm:block" />

            {/* Schedule Toggle */}
            <button
               type="button"
               onClick={() => setShowScheduling(!showScheduling)}
               className={`flex items-center gap-2 px-4 py-1.5 rounded-xl border text-[11px] font-bold tracking-wide transition-all shadow-sm ${
                 showScheduling 
                  ? 'bg-indigo-50 border-indigo-300 text-indigo-700 dark:bg-indigo-950/60 dark:border-indigo-700 dark:text-indigo-300' 
                  : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:text-slate-950 hover:bg-slate-50'
               }`}
            >
               <Calendar size={13} />
               <span>
                 {showScheduling ? 'Cancel Schedule' : 'Schedule Recurring'}
               </span>
            </button>
          </div>

          <AnimatePresence>
            {showScheduling && (
              <motion.div
                initial={{ opacity: 0, y: -20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -20, scale: 0.95 }}
                className="mt-6 p-6 glass-euphoria border border-[var(--eu-glass-border)] rounded-[32px] overflow-hidden relative shadow-2xl"
              >
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-eu-accent to-violet-500 opacity-30" />
                <div className="flex flex-col md:flex-row gap-8">
                  <div className="flex-1 space-y-6">
                    <div>
                      <h4 className="text-[10px] font-black uppercase tracking-widest text-muted mb-4 border-b border-white/5 pb-2">Diagnostic Profile</h4>
                      <div className="flex gap-4">
                        {['quick', 'full'].map(t => (
                          <button
                            key={t}
                            type="button"
                            onClick={() => setSchedule({...schedule, scanType: t})}
                            className={`flex-1 py-3 px-4 rounded-xl border transition-all ${
                              schedule.scanType === t 
                                ? 'bg-primary/20 border-primary/40 text-primary shadow-neon-small scale-[1.02]' 
                                : 'bg-black/20 border-white/5 text-muted hover:border-white/10'
                            }`}
                          >
                            <div className="text-[10px] font-black uppercase tracking-widest">{t === 'quick' ? 'Pulse' : 'Audit'}</div>
                            <div className="text-[8px] opacity-40 uppercase tracking-tighter mt-0.5">{t === 'quick' ? 'Basic Telemetry' : 'Deep Neural Forge'}</div>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <h4 className="text-[10px] font-black uppercase tracking-widest text-muted mb-4 border-b border-white/5 pb-2">Neural Cycle</h4>
                      <div className="flex gap-3">
                        {['one-time', 'daily', 'weekly'].map(m => (
                          <button
                            key={m}
                            type="button"
                            onClick={() => setSchedule({...schedule, mode: m})}
                            className={`px-4 py-2 rounded-xl border text-[9px] font-black uppercase tracking-widest transition-all ${
                              schedule.mode === m 
                                ? 'bg-eu-accent/20 border-eu-accent/40 text-eu-accent shadow-neon-small' 
                                : 'bg-black/20 border-white/5 text-muted'
                            }`}
                          >
                            {m}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="w-[1px] bg-white/5 hidden md:block" />

                  <div className="flex-1 space-y-6">
                    <div>
                      <h4 className="text-[10px] font-black uppercase tracking-widest text-muted mb-4 border-b border-white/5 pb-2">Tactical Window</h4>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                           <label className="text-[8px] font-black text-muted uppercase tracking-widest">Execution Time</label>
                           <input 
                             type="time" 
                             className="w-full bg-black/40 border border-white/5 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-eu-accent/50"
                             value={schedule.time}
                             onChange={(e) => setSchedule({...schedule, time: e.target.value})}
                           />
                        </div>

                        {schedule.mode === 'one-time' && (
                          <div className="space-y-2">
                             <label className="text-[8px] font-black text-muted uppercase tracking-widest">Target Date</label>
                             <input 
                               type="date" 
                               className="w-full bg-black/40 border border-white/5 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-eu-accent/50"
                               value={schedule.date}
                               onChange={(e) => setSchedule({...schedule, date: e.target.value})}
                             />
                          </div>
                        )}

                        {schedule.mode === 'weekly' && (
                          <div className="space-y-2">
                             <label className="text-[8px] font-black text-muted uppercase tracking-widest">Day of Epoch</label>
                             <select 
                               className="w-full bg-black/40 border border-white/5 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-eu-accent/50 appearance-none"
                               value={schedule.dayOfWeek}
                               onChange={(e) => setSchedule({...schedule, dayOfWeek: parseInt(e.target.value)})}
                             >
                               {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((d, i) => (
                                 <option key={d} value={i} className="bg-[#0a0a0c]">{d}</option>
                               ))}
                             </select>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="bg-white/5 p-4 rounded-2xl border border-dashed border-white/10">
                       <p className="text-[8px] font-medium text-muted leading-relaxed uppercase tracking-widest">
                         Note: Automated audits will be dispatched from the unified substrate. Ensure target infrastructure allows standard crawler headers.
                       </p>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          
          <AnimatePresence>
            {error && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.9, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 10 }}
                className="absolute -bottom-14 left-0 right-0 flex items-center justify-center pointer-events-none"
              >
                <div className="bg-primary/10 backdrop-blur-xl border border-primary/20 px-6 py-2.5 rounded-2xl flex items-center gap-3 shadow-[0_10px_30px_-10px_rgba(var(--eu-accent-rgb),0.3)]">
                  <div className="size-5 bg-primary/20 rounded-lg flex items-center justify-center text-primary">
                    <Sparkles size={10} className="animate-pulse" />
                  </div>
                  <span className="text-primary text-[10px] font-black uppercase tracking-[0.2em]">
                    System Failure: <span className="text-white/80">{error}</span>
                  </span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </form>

        <div className="mt-6 sm:mt-8 flex flex-wrap justify-center gap-4 sm:gap-8 opacity-40 text-[8px] sm:text-[10px] font-black uppercase tracking-[0.2em]">
           <div className="flex items-center gap-2">
              <div className="w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full bg-primary shadow-[0_0_8px_var(--eu-glow)]" />
              <span>Diagnostic Ready</span>
           </div>
           <div className="flex items-center gap-2">
              <div className="w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full bg-eu-accent-violet shadow-[0_0_8px_var(--eu-glow-violet)]" />
              <span>Nodes Synchronized</span>
           </div>
        </div>
      </motion.div>
    </div>
  );
};

export default ScanForm;
