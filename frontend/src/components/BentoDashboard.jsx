import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Shield, 
  Activity, 
  Zap, 
  Database, 
  Terminal as TerminalIcon, 
  Cpu, 
  Globe, 
  Target, 
  AlertCircle,
  Wifi,
  BarChart3,
  Search
} from 'lucide-react';
import ScanForm from './ScanForm';
import ReportDashboard from './ReportDashboard';
import ChatInterface from './ChatInterface';

const BentoDashboard = ({ onScanStarted, onSelectReport, refreshKey, theme }) => {
  return (
    <div className="w-full max-w-7xl mx-auto py-10 px-4 sm:px-0">
      <div className="flex flex-col gap-12">
        
        {/* --- Primary GPT Interface (Hero) --- */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="w-full min-h-[600px] sm:min-h-[700px] flex flex-col"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="h-0.5 w-8 bg-indigo-600 dark:bg-indigo-400 rounded-full" />
            <span className="text-xs font-bold tracking-wider text-indigo-600 dark:text-indigo-400 uppercase">Command Console</span>
          </div>
          
          <div className="flex-1">
             <ChatInterface onScanStarted={onScanStarted} />
          </div>
        </motion.div>

        {/* --- Diagnostic Logs / Archives --- */}
        <motion.div 
           initial={{ opacity: 0, y: 20 }}
           animate={{ opacity: 1, y: 0 }}
           transition={{ delay: 0.1, duration: 0.5 }}
           className="bg-white dark:bg-slate-900 rounded-2xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col min-h-[500px]"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="h-0.5 w-8 bg-indigo-600/60 dark:bg-indigo-400/60 rounded-full" />
            <span className="text-xs font-bold tracking-wider text-slate-700 dark:text-slate-300 uppercase">Diagnostic Archives</span>
          </div>
          
          <ReportDashboard 
            onSelectReport={onSelectReport} 
            refreshKey={refreshKey}
            isBentoView={true}
            theme={theme}
          />
        </motion.div>

      </div>
    </div>
  );
};

export default BentoDashboard;
