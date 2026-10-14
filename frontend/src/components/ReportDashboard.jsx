import { API_URL, SOCKET_URL } from '../config/api';
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import ReportCard from './ReportCard';
import { 
  Loader2, 
  RefreshCcw, 
  Search, 
  BarChart3, 
  Database, 
  History, 
  Trash2, 
  Zap,
  Share,
  UserPlus,
  Edit2,
  Pin,
  Archive,
  MoreVertical,
  Calendar
} from 'lucide-react';


const MenuButton = ({ icon, label, onClick, danger, isDark }) => {
  const [hovered, setHovered] = React.useState(false);
  const baseStyle = {
    width: '100%', display: 'flex', alignItems: 'center', gap: '10px',
    padding: '9px 12px', borderRadius: '10px', border: 'none', cursor: 'pointer',
    fontSize: '13px', fontWeight: 500, textAlign: 'left', transition: 'all 0.18s ease',
    background: hovered
      ? danger
        ? isDark ? 'rgba(var(--eu-accent-rgb), 0.15)' : 'rgba(var(--eu-accent-rgb), 0.1)'
        : isDark ? 'rgba(var(--eu-accent-rgb), 0.1)' : 'var(--eu-hover-bg)'
      : 'transparent',
    color: danger
      ? hovered ? (isDark ? 'var(--eu-accent)' : 'var(--eu-accent)') : (isDark ? 'var(--eu-accent)' : 'var(--eu-accent)')
      : isDark ? 'var(--eu-text-main)' : 'var(--eu-text-main)',
  };
  const iconStyle = {
    color: danger
      ? hovered ? (isDark ? 'var(--eu-accent)' : 'var(--eu-accent)') : 'var(--eu-accent)'
      : hovered ? 'var(--eu-accent)' : 'var(--eu-text-muted)',
    filter: hovered && isDark && !danger ? 'drop-shadow(0 0 5px rgba(var(--eu-accent-rgb), 0.8))' : 'none',
    transition: 'all 0.18s ease',
    flexShrink: 0,
  };
  return (
    <button
      style={baseStyle}
      onClick={(e) => { e.stopPropagation(); onClick(e); }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <span style={iconStyle}>{icon}</span>
      <span style={{ flex: 1 }}>{label}</span>
    </button>
  );
};

const ReportDashboard = ({ onSelectReport, isBentoView, refreshKey, theme, onDeleteReport, onScheduleReport, confirm, prompt, setAlert }) => {

  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeMenuId, setActiveMenuId] = useState(null);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });

  const fetchReports = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const userId = localStorage.getItem('userId');
      const response = await axios.get(`${API_URL}/api/reports?userId=${userId}`);
      setReports(response.data);
    } catch (error) {
      console.error('Failed to fetch reports', error);
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await axios.delete(`${API_URL}/api/report/${id}`);
      setReports(reports.filter(r => r._id !== id));
      if (onDeleteReport) onDeleteReport(id);
    } catch (error) {
      console.error('Failed to purge report', error);
      alert('Failed to purge report. Link integrity check may be failing.');
    }
  };

  const handlePin = async (id) => {
    try {
      const { data } = await axios.patch(`${API_URL}/api/report/${id}/pin`);
      setReports(reports.map(r => r._id === id ? data : r));
    } catch (error) {
      console.error('Failed to toggle pin', error);
    }
  };

  const handleShare = async (id) => {
    try {
      const { data } = await axios.patch(`${API_URL}/api/report/${id}/share`);
      if (data.url) {
        navigator.clipboard.writeText(data.url);
        alert(`Classroom Uplink Established! Invite codes copied to tactical clipboard.\n\nURL: ${data.url}`);
      }
    } catch (error) {
      console.error('Failed to initialize classroom', error);
      alert('Classroom Uplink Initialization Failed.');
    }
  };

  const handleRename = async (id, currentName) => {
    const newName = await prompt({
        title: "Rename Session",
        message: `Current identification: ${currentName}`,
        confirmText: "Update Name"
    });
    if (!newName || newName === currentName) return;
    try {
      const { data } = await axios.patch(`${API_URL}/api/report/${id}/rename`, { name: newName });
      setReports(reports.map(r => r._id === id ? data : r));
    } catch (err) {
      console.error("Rename failed", err);
    }
  };

  const handleArchive = async (id) => {
    try {
      const { data } = await axios.patch(`${API_URL}/api/report/${id}/archive`);
      setReports(reports.map(r => r._id === id ? data : r));
    } catch (err) {
      console.error("Archive failed", err);
    }
  };

  // Initial fetch and manual refresh
  useEffect(() => {
    fetchReports();
  }, [refreshKey]);

  // Polling for in-progress scans
  useEffect(() => {
    const hasInProgress = reports.some(r => r.status === 'in-progress');
    let interval;
    
    if (hasInProgress) {
      interval = setInterval(() => {
        fetchReports(false); // Fetch without showing global loading spinner
      }, 5000);
    }

    return () => clearInterval(interval);
  }, [reports]);

  const filteredReports = reports.filter(r => {
    try {
      const hostname = new URL(r.url).hostname.toLowerCase();
      return !r.isArchived && hostname.includes(searchQuery.toLowerCase());
    } catch (e) {
      return !r.isArchived && r.url.toLowerCase().includes(searchQuery.toLowerCase());
    }
  });

  const sortedReports = [...filteredReports].sort((a, b) => {
    if (a.isPinned && !b.isPinned) return -1;
    if (!a.isPinned && b.isPinned) return 1;
    return new Date(b.scanDate) - new Date(a.scanDate);
  });

  const [selectedReports, setSelectedReports] = useState([]);
  const [comparisonResults, setComparisonResults] = useState(null);
  const [comparing, setComparing] = useState(false);

  const toggleSelect = (id) => {
    setSelectedReports(prev => 
      prev.includes(id) ? prev.filter(rid => rid !== id) : 
      prev.length < 2 ? [...prev, id] : [prev[1], id]
    );
  };

  const runShadowScan = async () => {
    if (selectedReports.length !== 2) return;
    setComparing(true);
    try {
      const { data } = await axios.post(`${API_URL}/api/vision/compare`, {
        reportId1: selectedReports[0],
        reportId2: selectedReports[1]
      });
      setComparisonResults(data);
    } catch (err) {
      alert("Shadow scan failed. Ensure both reports have valid screenshots.");
    } finally {
      setComparing(false);
    }
  };

  return (
    <div className={`w-full ${isBentoView ? 'h-full flex flex-col' : ''}`}>
      {!isBentoView && (
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-10 px-4 sm:px-0">
        <div className="flex flex-col gap-1 w-full sm:w-auto">
           <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">Audit Records</span>
           </div>
           <div className="flex items-center gap-4">
              <h2 className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white font-outfit tracking-tight">Audit Archive</h2>
              <div className="flex gap-2">
                <span className="flex items-center justify-center text-xs font-bold px-2.5 h-6 rounded-md bg-indigo-50 border border-indigo-200 text-indigo-700 dark:bg-indigo-950 dark:border-indigo-800 dark:text-indigo-300">
                    {reports.length}
                </span>
                {selectedReports.length > 0 && (
                    <button 
                      onClick={() => setSelectedReports([])}
                      className="px-2.5 h-6 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700 text-[10px] font-bold uppercase"
                    >
                      Clear Selection ({selectedReports.length})
                    </button>
                )}
              </div>
           </div>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          {selectedReports.length > 0 && (
            <div className="flex items-center gap-2.5">
              {selectedReports.length === 2 && (
                <button 
                  onClick={runShadowScan}
                  disabled={comparing}
                  className="h-10 px-5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider shadow-sm transition-all flex items-center gap-2 disabled:opacity-50"
                >
                  {comparing ? <Loader2 className="animate-spin" size={14} /> : <Zap size={14} />}
                  Compare Scans
                </button>
              )}
              <button 
                onClick={async () => {
                  const confirmed = await confirm({
                    title: "Batch Purge Protocol",
                    message: `Initiate permanent deletion of ${selectedReports.length} selected records? This action cannot be reversed.`,
                    confirmText: "Purge All",
                    type: "danger"
                  });
                  if (confirmed) {
                    for (const id of selectedReports) {
                      await handleDelete(id);
                    }
                    setSelectedReports([]);
                    setAlert({ type: 'success', message: `${selectedReports.length} logs purged successfully.` });
                  }
                }}
                className="h-10 px-4 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:border-rose-800 dark:text-rose-300 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2"
              >
                <Trash2 size={14} />
                Delete Selected
              </button>
            </div>
          )}

          <div className="relative flex-1 md:w-72">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 size-4" />
            <input 
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search reports..."
              className="w-full h-10 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-9 pr-4 text-xs font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-sm transition-all"
            />
          </div>
          
          <button 
            onClick={() => fetchReports()}
            className="size-10 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl flex items-center justify-center hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-all shadow-sm"
            title="Refresh reports"
          >
            <RefreshCcw size={15} className={loading ? 'animate-spin text-indigo-600' : ''} />
          </button>
        </div>
      </div>
      )}
      
      {/* Dashboard Grid */}
      <div className="relative min-h-[300px] sm:min-h-[400px]">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 sm:py-32 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl mx-4 sm:mx-0 shadow-sm">
            <Loader2 className="animate-spin text-indigo-600 mb-4" size={36} />
            <p className="text-slate-600 dark:text-slate-400 font-bold tracking-wider uppercase text-xs">Loading Inspection Archive...</p>
          </div>
        ) : filteredReports.length === 0 ? (
          <motion.div 
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="p-12 sm:p-20 text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl mx-4 sm:mx-0 shadow-sm"
          >
            <div className="w-14 h-14 bg-indigo-50 dark:bg-indigo-950/60 rounded-xl flex items-center justify-center mx-auto mb-4 border border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400">
              <Database size={24} />
            </div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2 font-outfit">No Reports Found</h3>
            <p className="text-slate-600 dark:text-slate-400 text-xs sm:text-sm max-w-sm mx-auto font-normal leading-relaxed">
              No diagnostic test reports have been indexed yet. Launch a new scan from the console to generate audit telemetry.
            </p>
          </motion.div>
        ) : (
          <motion.div 
            layout
            className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-6 sm:gap-8 px-4 sm:px-0"
          >
            <AnimatePresence mode="popLayout">
              {sortedReports.map((report) => (
                <div key={report._id} className="relative group">
                  <ReportCard 
                    report={report} 
                    onClick={selectedReports.length > 0 ? toggleSelect : onSelectReport} 
                    onDelete={handleDelete}
                    onPin={handlePin}
                    onShare={handleShare}
                    onRename={handleRename}
                    onArchive={handleArchive}
                    onGroupChart={toggleSelect}
                    confirm={confirm}
                    prompt={prompt}
                    setAlert={setAlert}
                    onOpenMenu={(id, pos) => {
                      setMenuPosition({
                        top: pos.top,
                        left: pos.left
                      });
                      setActiveMenuId(id);
                    }}
                    isMenuOpen={activeMenuId === report._id}
                  />
                  {/* Select Trigger Overlay */}
                  <button 
                    onClick={(e) => { e.stopPropagation(); toggleSelect(report._id); }}
                    className={`absolute top-4 left-4 size-6 rounded-lg border flex items-center justify-center transition-all ${
                        selectedReports.includes(report._id) 
                        ? 'bg-primary border-primary text-white scale-110 shadow-neon' 
                        : 'bg-black/40 border-white/20 text-transparent opacity-0 group-hover:opacity-100 hover:border-primary/50'
                    }`}
                  >
                    <div className="size-2 rounded-full bg-current" />
                  </button>
                </div>
              ))}
            </AnimatePresence>
          </motion.div>
        )}
      </div>

      {/* Shadow Scan Results Modal */}
      <AnimatePresence>
        {comparisonResults && (
           <motion.div 
             initial={{ opacity: 0 }} 
             animate={{ opacity: 1 }} 
             exit={{ opacity: 0 }}
             className="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-12 bg-[var(--eu-bg-overlay)] backdrop-blur-xl"
             onClick={() => setComparisonResults(null)}
           >
             <motion.div 
               initial={{ scale: 0.9, y: 20 }}
               animate={{ scale: 1, y: 0 }}
               className="w-full max-w-4xl glass-euphoria border border-primary/20 rounded-[40px] overflow-hidden shadow-2xl overflow-y-auto max-h-[90vh]"
               onClick={e => e.stopPropagation()}
             >
               <div className="p-8 sm:p-12 space-y-10">
                 <div className="flex items-center justify-between">
                   <div className="flex items-center gap-6">
                      <div className="size-16 bg-primary/20 rounded-[28px] flex items-center justify-center border border-primary/30">
                        <History className="text-primary size-8" />
                      </div>
                      <div>
                        <h2 className="text-3xl sm:text-4xl font-black italic uppercase tracking-tight text-[var(--eu-text-main)]">Shadow <span className="premium-gradient-text">Scan Analysis</span></h2>
                        <p className="text-[10px] font-black text-[var(--eu-text-main)] opacity-40 uppercase tracking-widest mt-1">Cross-Environment UI Regression Index</p>
                      </div>
                   </div>
                   <div className="text-right">
                      <span className="text-[10px] font-black text-[var(--eu-text-main)] opacity-40 uppercase tracking-widest block mb-1">Visual Integrity Score</span>
                      <span className={`text-4xl font-black italic tracking-tighter text-primary shadow-neon`}>{comparisonResults.score}%</span>
                   </div>
                 </div>

                  <div className="p-8 bg-[var(--eu-bg-card)] border border-[var(--eu-glass-border)] rounded-[32px]">
                    <p className="text-[10px] font-black text-primary uppercase tracking-widest mb-4">Neural Overview</p>
                    <p className="text-lg text-[var(--eu-text-main)] opacity-80 font-medium italic leading-relaxed">"{comparisonResults.summary}"</p>
                  </div>

                 <div className="space-y-6">
                    <p className="text-[10px] font-black text-primary uppercase tracking-widest border-b border-primary/20 pb-4">Identified Regressions ({comparisonResults.differences?.length || 0})</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {comparisonResults.differences?.map((diff, i) => (
                        <div key={i} className="p-6 bg-[var(--eu-bg-void)]/40 border border-white/5 rounded-2xl space-y-3">
                          <div className="flex items-center gap-3">
                            <span className="px-2 py-0.5 bg-primary/10 text-primary border border-primary/20 rounded text-[8px] font-black uppercase">{diff.severity}</span>
                            <h4 className="text-sm font-black text-white uppercase tracking-tight">{diff.issue}</h4>
                          </div>
                          <p className="text-xs text-[var(--eu-text-muted)] leading-relaxed">{diff.details}</p>
                        </div>
                      ))}
                    </div>
                 </div>

                  <button 
                    onClick={() => setComparisonResults(null)}
                    className="w-full py-6 bg-[var(--eu-bg-void)]/60 border border-[var(--eu-glass-border)] rounded-3xl text-[10px] font-black uppercase tracking-widest text-[var(--eu-text-main)] opacity-40 hover:opacity-100 transition-all font-outfit"
                  >
                    Deactivate Shadow Interface
                  </button>
               </div>
             </motion.div>
           </motion.div>
        )}
      </AnimatePresence>

      {/* Decorative Grid Stats Overlay */}
      {!isBentoView && (
        <div className="mt-12 sm:mt-20 grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-8 opacity-30 px-4 sm:px-0">
           <StatsPanel label="Cluster Peak" value="98.4%" />
           <StatsPanel label="Neural Load" value="Critical" primary />
           <StatsPanel label="Active Nodes" value="1,024" />
           <StatsPanel label="Uptime" value="100.00.00" />
        </div>
      )}
      {/* Euphoria Action Menu Portal */}
      {activeMenuId && createPortal(
        (() => {
          const isDark = theme === 'dark';
          const panelStyle = isDark ? {
            position: 'fixed', top: menuPosition.top, left: menuPosition.left, zIndex: 999999,
            width: '14rem',
            background: 'var(--eu-bg-card-glass)',
            backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
            border: '1px solid rgba(var(--eu-accent-rgb), 0.2)',
            borderRadius: '16px', padding: '6px',
            boxShadow: '0 8px 40px rgba(0,0,0,0.6), 0 0 0 1px rgba(var(--eu-accent-rgb), 0.15), 0 24px 60px rgba(var(--eu-accent-rgb),0.15)',
            overflow: 'hidden',
          } : {
            position: 'fixed', top: menuPosition.top, left: menuPosition.left, zIndex: 999999,
            width: '14rem',
            background: 'rgba(255,255,255,0.97)',
            backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
            border: '1px solid rgba(226,232,240,1)',
            borderRadius: '16px', padding: '6px',
            boxShadow: '0 4px 24px rgba(0,0,0,0.08), 0 1px 4px rgba(0,0,0,0.05)',
            overflow: 'hidden',
          };
          const headerStyle = {
            padding: '6px 12px 8px',
            borderBottom: isDark ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(226,232,240,0.8)',
            marginBottom: '4px',
          };
          const headerTextStyle = {
            fontSize: '9px', fontWeight: 900, textTransform: 'uppercase',
            letterSpacing: '0.18em',
            color: isDark ? 'rgba(148,163,184,0.45)' : 'rgba(148,163,184,1)',
          };
          const dividerStyle = {
            height: '1px',
            background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(226,232,240,0.8)',
            margin: '4px 8px',
          };
          return (
            <>
              <div className="fixed inset-0" style={{ zIndex: 999998 }} onClick={(e) => { e.stopPropagation(); setActiveMenuId(null); }} />
              <motion.div
                initial={{ opacity: 0, scale: 0.92, y: -8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.92, y: -8 }}
                transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                style={panelStyle}
              >
                <div style={headerStyle}><span style={headerTextStyle}>Options</span></div>
                <MenuButton isDark={isDark} icon={<UserPlus size={14} />} label="Start a group chat" onClick={() => { handleShare(activeMenuId); setActiveMenuId(null); }} />
                <MenuButton isDark={isDark} icon={<Calendar size={14} />} label="Schedule Protocol" onClick={() => { const report = reports.find(r => r._id === activeMenuId); onScheduleReport(report.url); setActiveMenuId(null); }} />
                <MenuButton isDark={isDark} icon={<Edit2 size={14} />} label="Rename" onClick={() => { 
                  const report = reports.find(r => r._id === activeMenuId); 
                  const fallbackName = (() => {
                    try { return new URL(report?.url).hostname; }
                    catch(e) { return report?.url; }
                  })();
                  handleRename(activeMenuId, report?.customName || fallbackName); 
                  setActiveMenuId(null); 
                }} />
                <div style={dividerStyle} />
                <MenuButton isDark={isDark} icon={<Pin size={14} />} label="Pin chat" onClick={() => { handlePin(activeMenuId); setActiveMenuId(null); }} />
                <div style={dividerStyle} />
                <MenuButton isDark={isDark} icon={<Trash2 size={14} />} label="Delete" onClick={() => { handleDelete(activeMenuId); setActiveMenuId(null); }} danger />
              </motion.div>
            </>
          );
        })()
      , document.body)}
    </div>
  );
};

const StatsPanel = ({ label, value, primary }) => (
  <div className={`p-8 glass-euphoria flex flex-col items-center gap-2 rounded-[32px] ${primary ? 'border-eu-accent/30 bg-eu-accent/5 shadow-neon' : ''}`}>
    <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[var(--eu-text-muted)] opacity-60">{label}</p>
    <p className={`text-2xl font-black font-outfit ${primary ? 'text-primary' : 'text-[var(--eu-text-main)]'}`}>{value}</p>
  </div>
);

export default ReportDashboard;
