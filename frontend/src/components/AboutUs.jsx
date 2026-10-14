import React from 'react';
import { motion } from 'framer-motion';
import { ShieldCheck, Cpu, Terminal, Activity } from 'lucide-react';

const AboutUs = () => {
  return (
    <section className="w-full py-20 sm:py-28">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-16 sm:mb-20">
          <span className="text-xs font-bold uppercase tracking-widest text-indigo-400 bg-indigo-500/10 px-4 py-1.5 rounded-full border border-indigo-500/20 inline-block mb-4">
            System Architecture
          </span>
          <h2 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-slate-100 tracking-tight leading-tight">
            Technical Specifications
          </h2>
          <p className="text-slate-300 text-base sm:text-lg max-w-2xl mx-auto mt-4 leading-relaxed font-normal">
            Multi-threaded event pipeline powered by Playwright, Lighthouse, Node.js, and Llama-3 AI models.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="p-8 rounded-2xl bg-slate-900/80 border border-slate-800 flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center gap-3 mb-4 text-indigo-400">
                <Activity size={22} />
                <h3 className="text-lg font-bold text-slate-100">Diagnostic Pipeline</h3>
              </div>
              <p className="text-slate-300 text-sm sm:text-base leading-relaxed font-normal">
                Full DOM tree auditing, Newman API validation, dynamic scroll hydration, and JavaScript AST bundle analysis.
              </p>
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="p-8 rounded-2xl bg-slate-900/80 border border-slate-800 flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center gap-3 mb-4 text-indigo-400">
                <ShieldCheck size={22} />
                <h3 className="text-lg font-bold text-slate-100">Security & Privacy</h3>
              </div>
              <p className="text-slate-300 text-sm sm:text-base leading-relaxed font-normal">
                Isolated headless browser workers, BCrypt session hashing, JWT auth, and anti-homoglyph brand protection.
              </p>
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="p-8 rounded-2xl bg-slate-900/80 border border-slate-800 flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center gap-3 mb-4 text-indigo-400">
                <Cpu size={22} />
                <h3 className="text-lg font-bold text-slate-100">AI Substrate</h3>
              </div>
              <p className="text-slate-300 text-sm sm:text-base leading-relaxed font-normal">
                Llama-3 70B & 8B model cascading with 4-layer RAG context synthesis and verified line-level code patch generation.
              </p>
            </div>
          </motion.div>
        </div>

        {/* Terminal log snippet */}
        <div className="mt-12 p-6 rounded-2xl bg-slate-950 border border-slate-800 font-mono text-xs sm:text-sm text-slate-300 shadow-xl">
          <div className="flex items-center gap-2 mb-3 pb-3 border-b border-slate-800 text-xs text-slate-400 uppercase tracking-wider font-sans font-semibold">
            <Terminal size={16} className="text-indigo-400" />
            <span>System Initialization Log</span>
          </div>
          <p className="text-indigo-400/90 py-0.5">&gt; MOUNTING_CORE_WORKERS... [OK]</p>
          <p className="text-slate-300 py-0.5">&gt; INITIALIZING_HYBRID_CRAWLER... [OK]</p>
          <p className="text-slate-300 py-0.5">&gt; CONNECTING_AI_DEBUGGER_SUBSTRATE... [OK]</p>
          <p className="text-emerald-400 font-bold py-0.5">&gt; SENTINEL_V3_PLATFORM: OPERATIONAL</p>
        </div>
      </div>
    </section>
  );
};

export default AboutUs;


