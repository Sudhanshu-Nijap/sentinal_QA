import React from 'react';
import { Shield, Github, Twitter } from 'lucide-react';

const Footer = () => {
    const currentYear = new Date().getFullYear();

    return (
        <footer className="relative border-t border-slate-800/80 bg-slate-950 py-8">
            <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4 md:gap-0">
                {/* Brand */}
                <div className="flex items-center gap-2.5">
                    <div className="size-7 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                        <Shield size={16} />
                    </div>
                    <span className="text-base font-extrabold text-slate-100 tracking-tight">
                        Sentinel Platform
                    </span>
                </div>
                
                {/* Copyright */}
                <div className="text-xs font-normal text-slate-400 text-center">
                    Sentinel Security & Diagnostics © {currentYear} • Autonomous QA Intelligence Platform
                </div>

                {/* Socials */}
                <div className="flex gap-5">
                    <a href="https://github.com/Sudhanshu-Nijap" target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-slate-200 transition-colors p-1.5 hover:bg-slate-900 rounded-lg">
                        <Github size={18} />
                    </a>
                    <a href="#" className="text-slate-400 hover:text-slate-200 transition-colors p-1.5 hover:bg-slate-900 rounded-lg">
                        <Twitter size={18} />
                    </a>
                </div>
            </div>
        </footer>
    );
};

export default Footer;
