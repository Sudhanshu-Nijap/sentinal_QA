import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { X, Calendar, Clock, Zap, Globe, Loader2, ShieldCheck, Check } from 'lucide-react';
import axios from 'axios';
import { API_URL } from '../config/api';

const AddJobModal = ({ isOpen, onClose, initialUrl = '', setAlert }) => {
  const [url, setUrl] = useState(initialUrl);
  const [loading, setLoading] = useState(false);
  const [schedule, setSchedule] = useState({
    scanType: 'quick',
    mode: 'one-time',
    date: new Date().toISOString().split('T')[0],
    time: '12:00',
    dayOfWeek: 1
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!url.trim()) return;

    // Auto-normalize URL (Add protocol if missing)
    let normalizedUrl = url.trim();
    if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
      normalizedUrl = `https://${normalizedUrl}`;
    }

    setLoading(true);
    try {
      const userId = localStorage.getItem('userId');
      await axios.post(`${API_URL}/api/scheduling/jobs`, {
        ...schedule,
        url: normalizedUrl,
        userId
      });
      if (setAlert) setAlert({ type: 'success', message: 'Automated audit schedule created!' });
      onClose();
    } catch (err) {
      if (setAlert) setAlert({ type: 'error', message: 'Failed to create schedule. Please check the target URL.' });
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-900/60 dark:bg-black/80 backdrop-blur-xs font-inter">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        className="w-full max-w-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden p-6 sm:p-8 space-y-6"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-3.5">
            <div className="size-11 rounded-2xl bg-indigo-50 dark:bg-indigo-950/80 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
              <Calendar size={20} />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white font-outfit">
                Schedule Automated Audit
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Set up recurring automated scans and regression checks
              </p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-all"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* URL Input */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 font-outfit flex items-center gap-1.5">
              <Globe size={13} className="text-indigo-600 dark:text-indigo-400" /> Target Website URL
            </label>
            <input 
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com"
              className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-xs sm:text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
              required
              autoFocus
            />
          </div>

          {/* Diagnostic Profile */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 font-outfit">
              Audit Strategy
            </label>
            <div className="grid grid-cols-2 gap-3">
              {[
                { id: 'quick', title: 'Quick Pulse', desc: 'Core Web Vitals & critical links (~15s)' },
                { id: 'full', title: 'Full Deep Audit', desc: 'All 8 sensors + multi-page crawler' },
              ].map(t => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setSchedule({ ...schedule, scanType: t.id })}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    schedule.scanType === t.id 
                      ? 'bg-indigo-50/70 border-indigo-500 dark:bg-indigo-950/60 dark:border-indigo-600 shadow-xs' 
                      : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900 dark:text-white">{t.title}</span>
                    {schedule.scanType === t.id && (
                      <span className="size-4 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px]">
                        <Check size={10} strokeWidth={3} />
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 block leading-tight">
                    {t.desc}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Frequency & Windows */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Frequency */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 font-outfit">
                Frequency
              </label>
              <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
                {[
                  { id: 'one-time', label: 'Once' },
                  { id: 'daily', label: 'Daily' },
                  { id: 'weekly', label: 'Weekly' },
                ].map(m => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setSchedule({ ...schedule, mode: m.id })}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      schedule.mode === m.id 
                        ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-xs' 
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Time Picker */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 font-outfit flex items-center gap-1.5">
                <Clock size={12} className="text-indigo-600 dark:text-indigo-400" /> Execution Time
              </label>
              <input 
                type="time" 
                className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/50"
                value={schedule.time}
                onChange={(e) => setSchedule({ ...schedule, time: e.target.value })}
              />
            </div>
          </div>

          {/* Conditional Date or Day of Week */}
          {schedule.mode === 'one-time' && (
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 font-outfit flex items-center gap-1.5">
                <Calendar size={12} className="text-indigo-600 dark:text-indigo-400" /> Execution Date
              </label>
              <input 
                type="date" 
                className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/50"
                value={schedule.date}
                min={new Date().toISOString().split('T')[0]}
                onChange={(e) => setSchedule({ ...schedule, date: e.target.value })}
              />
            </div>
          )}

          {schedule.mode === 'weekly' && (
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 font-outfit">
                Day of Week
              </label>
              <div className="grid grid-cols-7 gap-1.5">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d, idx) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setSchedule({ ...schedule, dayOfWeek: idx })}
                    className={`py-2 rounded-xl text-xs font-bold transition-all ${
                      schedule.dayOfWeek === idx 
                        ? 'bg-indigo-600 text-white shadow-xs' 
                        : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !url.trim()}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-2 shadow-sm transition-all disabled:opacity-40"
            >
              {loading ? <Loader2 size={15} className="animate-spin" /> : <Calendar size={15} />}
              <span>{loading ? 'Registering...' : 'Schedule Audit'}</span>
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

export default AddJobModal;
