import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Calendar, Clock, Trash2, Pause, Play, Globe, ExternalLink, 
  Activity, Zap, Plus, Filter, Loader2, ChevronDown, Check,
  Target, Shield, Search, RefreshCw, AlertCircle
} from 'lucide-react';
import axios from 'axios';
import { io } from 'socket.io-client';
import { API_URL } from '../config/api';
import AddJobModal from './AddJobModal';

const SchedulingDashboard = ({ setAlert, confirm }) => {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  const fetchJobs = async () => {
    try {
      const userId = localStorage.getItem('userId');
      if (!userId) {
        setLoading(false);
        return;
      }
      setLoading(true);
      const { data } = await axios.get(`${API_URL}/api/scheduling/jobs?userId=${userId}`);
      setJobs(Array.isArray(data) ? data : []);
    } catch (err) {
      if (setAlert) setAlert({ type: 'error', message: 'Failed to sync scheduled scans.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();
    const socket = io(`${API_URL}`);
    socket.on('job-sync', (update) => {
      setJobs(prevJobs => prevJobs.map(job => 
        job._id === update.jobId 
          ? { ...job, status: update.status, isActive: update.isActive ?? job.isActive, lastRun: update.lastRun ?? job.lastRun } 
          : job
      ));
    });
    return () => {
      socket.off('job-sync');
      socket.disconnect();
    };
  }, []);

  const handleToggleActive = async (job) => {
    try {
      const { data } = await axios.patch(`${API_URL}/api/scheduling/job/${job._id}`, {
        isActive: !job.isActive,
        status: !job.isActive ? 'pending' : 'paused'
      });
      setJobs(jobs.map(j => j._id === job._id ? data : j));
      if (setAlert) {
        setAlert({ 
          type: 'success', 
          message: `Schedule ${!job.isActive ? 'resumed' : 'paused'} successfully.` 
        });
      }
    } catch (err) {
      if (setAlert) setAlert({ type: 'error', message: 'Could not update schedule status.' });
    }
  };

  const handleDelete = async (jobId) => {
    const proceed = confirm ? await confirm({
      title: 'Delete Scheduled Audit?',
      message: 'This will permanently remove the recurring scan from your schedule.',
      type: 'danger',
      confirmText: 'Delete Schedule'
    }) : window.confirm('Permanently remove this scheduled scan?');

    if (proceed) {
      try {
        await axios.delete(`${API_URL}/api/scheduling/job/${jobId}`);
        setJobs(jobs.filter(j => j._id !== jobId));
        if (setAlert) setAlert({ type: 'success', message: 'Schedule deleted.' });
      } catch (err) {
        if (setAlert) setAlert({ type: 'error', message: 'Failed to delete schedule.' });
      }
    }
  };

  const handleManualRun = async (job) => {
    try {
      await axios.post(`${API_URL}/api/scheduling/job/${job._id}/run`);
      if (setAlert) setAlert({ type: 'success', message: 'Manual scan triggered! Generating audit report...' });
      setJobs(prev => prev.map(j => j._id === job._id ? { ...j, status: 'running' } : j));
    } catch (err) {
      if (setAlert) setAlert({ type: 'error', message: 'Failed to trigger scan run.' });
    }
  };

  const getNextRunTime = (job) => {
    try {
      const now = new Date();
      const [hours, minutes] = (job.time || '12:00').split(':').map(Number);
      let next = new Date();
      next.setHours(hours, minutes, 0, 0);

      if (job.mode === 'one-time') {
        next = new Date(`${job.date || now.toISOString().split('T')[0]}T${job.time || '12:00'}`);
      } else if (job.mode === 'daily') {
        if (next <= now) next.setDate(next.getDate() + 1);
      } else if (job.mode === 'weekly') {
        const targetDay = typeof job.dayOfWeek === 'number' ? job.dayOfWeek : 1;
        let daysUntil = (targetDay - now.getDay() + 7) % 7;
        if (daysUntil === 0 && next <= now) daysUntil = 7;
        next.setDate(now.getDate() + daysUntil);
      }
      return next.toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch (e) {
      return job.time || 'Scheduled';
    }
  };

  const filteredJobs = jobs.filter(j => {
    const matchesSearch = !searchQuery || (j.url || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = typeFilter === 'all' || j.scanType === typeFilter;
    const matchesStatus = statusFilter === 'all' 
      ? true 
      : statusFilter === 'active' 
        ? j.isActive 
        : !j.isActive;
    return matchesSearch && matchesType && matchesStatus;
  });

  const activeCount = jobs.filter(j => j.isActive).length;
  const pausedCount = jobs.length - activeCount;

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12 font-inter">
      {/* ── Top Header ── */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-start sm:items-center gap-4">
          <div className="size-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/80 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0 shadow-xs">
            <Calendar size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white font-outfit">
                Automated Audit Schedules
              </h1>
              <span className="px-2.5 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 text-xs font-bold font-mono">
                {jobs.length} Total
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
              Configure recurring QA pulses and full site crawls to catch regressions before production.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={fetchJobs}
            disabled={loading}
            className="p-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl transition-all shadow-xs"
            title="Refresh schedules"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-2 shadow-sm transition-all"
          >
            <Plus size={16} /> Create Schedule
          </button>
        </div>
      </div>

      {/* ── Search & Filter Controls ── */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Filter by target URL..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl pl-10 pr-4 py-2 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Scan Type Filter */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
            {[
              { id: 'all', label: 'All Scans' },
              { id: 'quick', label: 'Quick Pulse' },
              { id: 'full', label: 'Full Audit' },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setTypeFilter(t.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  typeFilter === t.id
                    ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Status Filter */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
            {[
              { id: 'all', label: 'All Status' },
              { id: 'active', label: `Active (${activeCount})` },
              { id: 'paused', label: `Paused (${pausedCount})` },
            ].map((s) => (
              <button
                key={s.id}
                onClick={() => setStatusFilter(s.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  statusFilter === s.id
                    ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Content Area ── */}
      {loading ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-16 text-center shadow-xs flex flex-col items-center justify-center gap-3">
          <Loader2 size={32} className="animate-spin text-indigo-600 dark:text-indigo-400" />
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Syncing scheduled protocols...</p>
        </div>
      ) : filteredJobs.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-16 text-center shadow-xs flex flex-col items-center justify-center max-w-lg mx-auto space-y-4">
          <div className="size-16 rounded-3xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400">
            <Calendar size={28} />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-slate-900 dark:text-white font-outfit">
              {jobs.length === 0 ? 'No Scheduled Audits Configured' : 'No Schedules Match Your Filters'}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm leading-relaxed">
              {jobs.length === 0
                ? 'Create recurring schedules to run automated Playwright tests, Lighthouse checks, and security audits automatically.'
                : 'Try adjusting your search query or switching filters to view your active schedules.'}
            </p>
          </div>
          {jobs.length === 0 && (
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="mt-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-2 shadow-sm transition-all"
            >
              <Plus size={16} /> Schedule Your First Scan
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {filteredJobs.map((job) => {
            const isRunning = job.status === 'running';
            const isActive = job.isActive;
            let hostname = job.url;
            try {
              hostname = new URL(job.url).hostname;
            } catch (e) {}

            return (
              <motion.div
                key={job._id}
                layout
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                className={`bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xs hover:border-indigo-300 dark:hover:border-indigo-700 transition-all flex flex-col justify-between gap-5 relative overflow-hidden ${
                  !isActive ? 'opacity-70 bg-slate-50/50 dark:bg-slate-900/50' : ''
                }`}
              >
                {/* Header */}
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex items-start gap-3">
                    <div className="size-10 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5">
                      <Globe size={18} />
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white truncate font-outfit" title={job.url}>
                        {hostname}
                      </h4>
                      <a
                        href={job.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-slate-500 hover:text-indigo-600 truncate block mt-0.5"
                      >
                        {job.url}
                      </a>
                    </div>
                  </div>

                  <span
                    className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider shrink-0 flex items-center gap-1.5 ${
                      isRunning
                        ? 'bg-indigo-50 border border-indigo-200 text-indigo-700 dark:bg-indigo-950 dark:border-indigo-800 dark:text-indigo-300 animate-pulse'
                        : isActive
                        ? 'bg-emerald-50 border border-emerald-200 text-emerald-700 dark:bg-emerald-950 dark:border-emerald-800 dark:text-emerald-300'
                        : 'bg-amber-50 border border-amber-200 text-amber-700 dark:bg-amber-950 dark:border-amber-800 dark:text-amber-300'
                    }`}
                  >
                    <span
                      className={`size-1.5 rounded-full ${
                        isRunning ? 'bg-indigo-600 animate-ping' : isActive ? 'bg-emerald-500' : 'bg-amber-500'
                      }`}
                    />
                    {isRunning ? 'Running' : isActive ? 'Active' : 'Paused'}
                  </span>
                </div>

                {/* Details Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 text-xs">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block font-outfit">
                      Scan Profile
                    </span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5 block capitalize">
                      {job.scanType === 'quick' ? 'Quick Pulse' : 'Full Deep Audit'}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block font-outfit">
                      Frequency
                    </span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5 block capitalize">
                      {job.mode || 'Daily'}
                    </span>
                  </div>

                  <div className="col-span-2 sm:col-span-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block font-outfit">
                      Next Run
                    </span>
                    <span className="font-semibold text-indigo-600 dark:text-indigo-400 mt-0.5 block truncate">
                      {isActive ? getNextRunTime(job) : 'Paused'}
                    </span>
                  </div>
                </div>

                {/* Actions Footer */}
                <div className="flex items-center justify-between pt-3 border-t border-slate-200 dark:border-slate-800 gap-3">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleToggleActive(job)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                        isActive
                          ? 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300'
                          : 'bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                      }`}
                      title={isActive ? 'Pause recurring schedule' : 'Resume schedule'}
                    >
                      {isActive ? <Pause size={13} /> : <Play size={13} />}
                      <span>{isActive ? 'Pause' : 'Resume'}</span>
                    </button>

                    <button
                      onClick={() => handleManualRun(job)}
                      disabled={isRunning}
                      className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all disabled:opacity-40"
                      title="Trigger audit immediately"
                    >
                      <Zap size={13} />
                      <span>Run Now</span>
                    </button>
                  </div>

                  <button
                    onClick={() => handleDelete(job._id)}
                    className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-lg transition-all"
                    title="Delete schedule"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* ── Add Job Modal ── */}
      <AnimatePresence>
        {isAddModalOpen && (
          <AddJobModal
            isOpen={isAddModalOpen}
            onClose={() => {
              setIsAddModalOpen(false);
              fetchJobs();
            }}
            setAlert={setAlert}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default SchedulingDashboard;
