import React from 'react';
import { motion } from 'framer-motion';
import { 
  Shield, 
  Cpu, 
  Search, 
  Terminal, 
  Zap, 
  Calendar,
  Lock,
  Activity
} from 'lucide-react';

const CAPABILITIES = [
  {
    icon: <Search size={22} />,
    title: "100% Page Crawler",
    desc: "Hybrid crawler featuring SPA scroll hydration, dynamic route discovery, and JavaScript bundle endpoint mining for complete page coverage."
  },
  {
    icon: <Activity size={22} />,
    title: "Performance & Web Vitals",
    desc: "Automated Lighthouse audits tracking Core Web Vitals (LCP, CLS, FCP, TBT) alongside full WCAG 2.1 accessibility compliance."
  },
  {
    icon: <Shield size={22} />,
    title: "Security & Phishing Guard",
    desc: "Real-time threat detection identifying homoglyph brand mimicry, SSRF private IP attacks, dangerous binaries, and malware."
  },
  {
    icon: <Lock size={22} />,
    title: "Form Integrity Auditor",
    desc: "Detects unencrypted HTTP password submissions, input validation weaknesses, and missing CSRF anti-forgery token protection."
  },
  {
    icon: <Cpu size={22} />,
    title: "AI Root-Cause Diagnostics",
    desc: "Llama-3 powered diagnostic engine investigating boundary conditions, runtime exceptions, and security vulnerabilities with reproduction steps and triage intelligence."
  },
  {
    icon: <Calendar size={22} />,
    title: "Autonomous Scheduler",
    desc: "Automated CRON schedule sweeps for hands-off continuous regression monitoring and real-time delta alerts."
  }
];

const Capabilities = () => {
  return (
    <div className="max-w-7xl mx-auto px-6 py-20 sm:py-28">
      <div className="text-center mb-16 sm:mb-20">
        <span className="text-xs font-bold uppercase tracking-widest text-indigo-700 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-4 py-1.5 rounded-full border border-indigo-200 dark:border-indigo-800 inline-block mb-4">
          Core Capabilities
        </span>
        <h2 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-slate-900 dark:text-white tracking-tight leading-tight">
          Enterprise Security & Diagnostics
        </h2>
        <p className="text-slate-700 dark:text-slate-300 text-base sm:text-lg max-w-2xl mx-auto mt-4 leading-relaxed font-normal">
          Comprehensive automated auditing modules engineered for modern, high-availability web applications.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {CAPABILITIES.map((cap, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: index * 0.08, duration: 0.4 }}
            className="p-8 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-indigo-400 dark:hover:border-indigo-500/50 shadow-sm hover:shadow-md transition-all duration-300 group flex flex-col justify-between"
          >
            <div>
              <div className="size-12 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center text-indigo-600 dark:text-indigo-400 mb-6 group-hover:scale-110 transition-transform">
                {cap.icon}
              </div>

              <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white mb-3 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                {cap.title}
              </h3>

              <p className="text-slate-600 dark:text-slate-300 text-sm sm:text-base leading-relaxed font-normal">
                {cap.desc}
              </p>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default Capabilities;


