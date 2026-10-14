import React from 'react';
import { motion } from 'framer-motion';
import { Globe, Zap, Cpu, Terminal } from 'lucide-react';

const HowItWorks = () => {
  const steps = [
    {
      step: "01",
      icon: <Globe size={22} />,
      title: "Crawl & Discover",
      desc: "4-layer hybrid crawler extracts all pages, dynamic routes, interactive forms, and JavaScript bundle endpoints automatically."
    },
    {
      step: "02",
      icon: <Zap size={22} />,
      title: "Parallel Audit",
      desc: "Lighthouse and Newman engines evaluate Web Vitals, accessibility, broken navigation links, and HTTP network failures in real time."
    },
    {
      step: "03",
      icon: <Cpu size={22} />,
      title: "AI Synthesis",
      desc: "Llama-3 reasoning engine correlates cross-tool telemetry to produce risk-stratified diagnostic reports and actionable remediation patches."
    },
    {
      step: "04",
      icon: <Terminal size={22} />,
      title: "Auto Remediation",
      desc: "Deploy verified line-level code patches with 1-click execution or review diffs directly inside the built-in IDE environment."
    }
  ];

  return (
    <section className="w-full py-20 sm:py-28">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-16 sm:mb-20">
          <span className="text-xs font-bold uppercase tracking-widest text-indigo-400 bg-indigo-500/10 px-4 py-1.5 rounded-full border border-indigo-500/20 inline-block mb-4">
            Execution Workflow
          </span>
          <h2 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-slate-100 tracking-tight leading-tight">
            How Sentinel Works
          </h2>
          <p className="text-slate-300 text-base sm:text-lg max-w-2xl mx-auto mt-4 leading-relaxed font-normal">
            Four automated steps from URL submission to production patch deployment.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {steps.map((step, index) => (
            <motion.div 
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: index * 0.08 }}
              className="p-8 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-indigo-500/50 hover:bg-slate-900 transition-all duration-300 group flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-6">
                  <div className="size-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 group-hover:scale-110 transition-transform">
                    {step.icon}
                  </div>
                  <span className="text-sm font-mono font-bold text-slate-500 group-hover:text-indigo-400 transition-colors">
                    {step.step}
                  </span>
                </div>

                <h3 className="text-lg sm:text-xl font-bold text-slate-100 mb-3 group-hover:text-indigo-400 transition-colors">
                  {step.title}
                </h3>

                <p className="text-slate-300 text-sm sm:text-base leading-relaxed font-normal">
                  {step.desc}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;


