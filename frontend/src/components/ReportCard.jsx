import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { 
  Trash2, 
  Clock, 
  Globe, 
  Shield, 
  Activity, 
  ArrowRight, 
  ChevronRight, 
  AlertCircle, 
  CheckCircle2, 
  Layout, 
  Database, 
  MoreVertical, 
  BarChart3, 
  Share2, 
  Pin,
  UserPlus,
  Edit2,
  Archive,
  Share,
  Plus
} from 'lucide-react';

const MenuButton = ({ icon, label, onClick, danger, active }) => (
  <button 
    onClick={(e) => { e.stopPropagation(); onClick(e); }}
    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-[11px] font-medium transition-all ${
      danger ? 'text-primary opacity-80 hover:bg-primary/10' : 
      'text-[var(--eu-text-main)]/60 hover:bg-[var(--eu-hover-bg)]'
    }`}
  >
    <span className={`transition-colors ${danger ? 'text-primary' : 'text-[var(--eu-text-main)]/40'}`}>{icon}</span>
    <span className="flex-1 text-left">{label}</span>
  </button>
);

const ReportCard = ({ report, onClick, onDelete, onPin, onShare, onRename, onArchive, onGroupChart, onOpenMenu, isMenuOpen, confirm, prompt, setAlert }) => {
  const [showMenu, setShowMenu] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return 'text-eu-status-pass';
      case 'failed': return 'text-eu-status-fail';
      case 'in-progress': return 'text-eu-status-warn';
      default: return 'text-eu-text-muted';
    }
  };

  const domain = (() => {
    try { return new URL(report.url).hostname; }
    catch (e) { return report.url; }
  })();

  const handleDelete = async (e) => {
    e.stopPropagation();
    const confirmed = await confirm({
        title: "Node Purge Protocol",
        message: `Permanently decommission diagnostic data for ${domain}? This sector will be wiped.`,
        confirmText: "Decommission",
        type: "danger"
    });
    if (confirmed) {
      onDelete(report._id);
      if (setAlert) setAlert({ type: 'success', message: `Uplink to ${domain} severed.` });
    }
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      whileHover={{ y: -4 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className="group relative cursor-pointer h-full"
      onClick={() => onClick && onClick(report._id)}
    >
      <div className="relative h-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 flex flex-col gap-5 overflow-hidden rounded-2xl shadow-sm hover:shadow-md hover:border-indigo-300 dark:hover:border-indigo-700 transition-all duration-300">
        {/* Card Header */}
        <div className="flex justify-between items-start gap-4">
          <div className="space-y-1 min-w-0">
             <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 group-hover:text-indigo-600 transition-colors">
                <Globe size={13} />
                <span>Inspection Target</span>
             </div>
             <h3 className="text-xl font-bold text-slate-900 dark:text-white group-hover:text-indigo-600 transition-colors truncate font-outfit">
               {domain}
             </h3>
          </div>
          <div className="flex items-center gap-2 relative">
            <div className="relative">
              <button 
                onClick={(e) => { 
                  e.stopPropagation(); 
                  const rect = e.currentTarget.getBoundingClientRect();
                  onOpenMenu(report._id, { top: rect.top, left: rect.right + 12 });
                }}
                className={`size-8 rounded-lg border transition-all flex items-center justify-center ${isMenuOpen ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-slate-900 hover:bg-slate-100'}`}
              >
                <MoreVertical size={15} />
              </button>
            </div>
            
            <button 
              onClick={(e) => { e.stopPropagation(); onPin(report._id); }}
              className={`size-8 rounded-lg border transition-all flex items-center justify-center ${report.isPinned ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-indigo-600 hover:border-indigo-300'}`}
              title={report.isPinned ? "Unpin intelligence" : "Pin intelligence"}
            >
               <Pin size={15} className={report.isPinned ? 'fill-current' : ''} />
            </button>

            <div className={`size-8 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 flex items-center justify-center ${getStatusColor(report.status)}`}>
               <Shield size={15} className={report.status === 'in-progress' ? 'animate-spin' : ''} />
            </div>
          </div>
        </div>

        {/* Neural Metrics */}
        <div className="grid grid-cols-2 gap-3">
           <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 group-hover:border-indigo-200 dark:group-hover:border-indigo-800 transition-colors">
              <div className="flex items-center gap-1.5 mb-1.5">
                 <AlertCircle size={13} className="text-amber-500" />
                 <p className="text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Defects</p>
              </div>
              <p className="text-2xl font-black tracking-tight text-slate-900 dark:text-white font-outfit">
                {(report.brokenLinks?.length || 0) + 
                 (report.consoleErrors?.length || 0) + 
                 (report.formIssues?.length || 0) + 
                 (report.uiIssues?.length || 0) + 
                 (report.accessibilityIssues?.length || 0)}
              </p>
           </div>
           <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 group-hover:border-indigo-200 dark:group-hover:border-indigo-800 transition-colors">
              <div className="flex items-center gap-1.5 mb-1.5">
                 <Database size={13} className="text-indigo-600 dark:text-indigo-400" />
                 <p className="text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Pages</p>
              </div>
              <p className="text-2xl font-black tracking-tight text-slate-900 dark:text-white font-outfit">{report.pagesCrawled || 0}</p>
           </div>
        </div>

        {/* Status bar */}
        <div className="mt-auto pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
           <div className="flex flex-col gap-0.5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Scan Timestamp</p>
              <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">{new Date(report.scanDate).toLocaleDateString('en-GB')}</p>
           </div>
           <div className="size-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 group-hover:bg-indigo-600 group-hover:text-white transition-all">
              <ChevronRight size={16} className="group-hover:translate-x-0.5 transition-transform" />
           </div>
        </div>
      </div>
    </motion.div>
  );
};

export default ReportCard;
