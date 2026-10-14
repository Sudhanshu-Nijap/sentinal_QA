import { API_URL, SOCKET_URL } from '../../config/api';
import React, { useState, useMemo } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Book, Search, Star, CheckCircle, ChevronRight, X, 
  Code, Lightbulb, Terminal, Zap, MessageSquare, 
  AlertTriangle, Filter, LayoutGrid, Activity
} from 'lucide-react';
import data from '../../data/learningHubData.json';

const categories = [
  "All Issues",
  "Debugging Basics", 
  "Common Errors", 
  "Best Practices", 
  "Testing Fundamentals", 
  "Pro Debugging Tips",
  "API Error",
  "CSS Bug",
  "Async/Await Mistakes",
  "HTTP Protocol"
];

const LearningHubPage = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState("All Issues");
  const [selectedTopic, setSelectedTopic] = useState(null);
  const [bookmarks, setBookmarks] = useState(() => JSON.parse(localStorage.getItem('sentinel_hub_bookmarks') || '[]'));
  const [completed, setCompleted] = useState(() => JSON.parse(localStorage.getItem('sentinel_hub_completed') || '[]'));
  const [aiInput, setAiInput] = useState('');
  const [aiResponse, setAiResponse] = useState(null);
  const [isAiLoading, setIsAiLoading] = useState(false);

  const toggleBookmark = (id) => {
    const next = bookmarks.includes(id) ? bookmarks.filter(i => i !== id) : [...bookmarks, id];
    setBookmarks(next);
    localStorage.setItem('sentinel_hub_bookmarks', JSON.stringify(next));
  };

  const toggleComplete = (id) => {
    const next = completed.includes(id) ? completed.filter(i => i !== id) : [...completed, id];
    setCompleted(next);
    localStorage.setItem('sentinel_hub_completed', JSON.stringify(next));
  };

  const filteredTopics = useMemo(() => {
    return data.filter(t => {
      const matchSearch = t.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          t.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          t.category.toLowerCase().includes(searchQuery.toLowerCase());
      const matchCategory = activeCategory === "All Issues" || t.category === activeCategory;
      return matchSearch && matchCategory;
    });
  }, [searchQuery, activeCategory]);

  const handleAiAsk = async () => {
    if (!aiInput.trim()) return;
    setIsAiLoading(true);
    setAiResponse(null);
    try {
      const { data } = await axios.post(`${API_URL}/api/learning/ask`, { question: aiInput });
      setAiResponse(data);
      setAiInput('');
    } catch (e) {
      console.error('Neural consult failed', e);
      setAiResponse({
        explanation: "Neural substrate is currently offline. Please verify your backend uplink.",
        example: "// FALLBACK_DIAGNOSTIC\nconsole.error('Link Lost');",
        fix: "Check your local server status."
      });
    } finally {
      setIsAiLoading(false);
    }
  };

  const progress = Math.round((completed.length / data.length) * 100);

  return (
    <div className="h-full flex flex-col font-outfit">
      {/* Header Section */}
      <div className="flex-none mb-8">
        <div className="flex items-center justify-between gap-6 flex-wrap">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className="size-10 rounded-xl bg-eu-accent/10 border border-eu-accent/20 flex items-center justify-center shadow-neon">
                <Book className="text-eu-accent" size={20} />
              </div>
              <div>
                <h1 className="text-2xl font-black uppercase tracking-tight-mega premium-gradient-text">Learning Hub</h1>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 opacity-60">Neural Learning & Debugging Matrix</p>
              </div>
            </div>
          </div>
          
          <div className="flex-1 max-w-md relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 opacity-40" size={16} />
            <input 
              type="text" 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search neural topics..."
              className="w-full bg-[var(--eu-bg-void)] border border-[var(--eu-glass-border)] rounded-2xl py-3 pl-12 pr-6 text-xs uppercase font-black tracking-widest text-white outline-none focus:border-eu-accent/30 transition-all placeholder:opacity-30"
            />
          </div>

          <div className="min-w-[140px] text-right">
            <div className="text-2xl font-black text-eu-accent leading-none">{progress}%</div>
            <div className="text-[8px] font-black uppercase tracking-widest text-slate-600 mt-1">Matrix Mastery</div>
            <div className="w-full h-1 bg-white/5 rounded-full mt-2 overflow-hidden border border-white/5">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                className="h-full bg-eu-accent shadow-neon" 
              />
            </div>
          </div>
        </div>
      </div>

      {/* Topics Grid */}
      <div className="flex-1 flex gap-8 overflow-hidden min-h-0">
        {/* Left Sidebar categories */}
        <div className="w-64 h-full flex flex-col gap-2 overflow-y-auto custom-scrollbar pr-2 flex-none">
          <p className="text-[9px] font-black uppercase tracking-widest text-slate-600 mb-2 px-4 flex items-center gap-2">
            <Filter size={10} /> Protocols
          </p>
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`text-left px-5 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border ${
                activeCategory === cat 
                ? 'bg-eu-accent/10 border-eu-accent/30 text-eu-accent shadow-neon' 
                : 'border-transparent text-slate-500 hover:bg-white/5'
              }`}
            >
              {cat}
            </button>
          ))}

          {/* End Protocols */}
        </div>

        {/* Content Area */}
        <div className="flex-1 h-full overflow-y-auto custom-scrollbar pb-12">
          <AnimatePresence mode="popLayout">
            {aiResponse && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: -20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="mb-8 p-6 glass-euphoria border border-eu-accent/30 rounded-3xl relative"
              >
                <button 
                  onClick={() => setAiResponse(null)}
                  className="absolute top-4 right-4 text-slate-500 hover:text-white"
                >
                   <X size={14} />
                </button>
                <div className="flex items-center gap-3 mb-4">
                  <div className="size-8 rounded-lg bg-eu-accent flex items-center justify-center text-white">
                    <Zap size={16} />
                  </div>
                  <h3 className="text-xs font-black uppercase tracking-widest">Neural Insight</h3>
                </div>
                <p className="text-[11px] text-slate-300 leading-relaxed mb-4">{aiResponse.explanation}</p>
                <div className="bg-black/60 rounded-2xl p-4 mb-4 border border-white/5 font-mono text-[10px]">
                  <pre className="text-eu-accent">{aiResponse.example}</pre>
                </div>
                <div className="flex items-center gap-2 p-3 bg-eu-accent/10 border border-eu-accent/20 rounded-xl mb-4">
                  <Lightbulb size={12} className="text-eu-accent" />
                  <p className="text-[9px] font-bold text-white uppercase tracking-wider">Fix: {aiResponse.fix}</p>
                </div>
                {aiResponse.steps && (
                  <div className="space-y-2">
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-2">Tactical Steps:</p>
                    {aiResponse.steps.map((step, idx) => (
                      <div key={idx} className="flex gap-3 text-[10px] text-slate-300 bg-white/5 p-2 rounded-lg border border-white/5">
                        <span className="text-eu-accent font-black">0{idx + 1}</span>
                        {step}
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {filteredTopics.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center opacity-20 text-center">
              <Zap size={60} className="mb-4" />
              <h3 className="text-xl font-black uppercase tracking-widest">No protocols found</h3>
              <p className="text-xs uppercase tracking-widest mt-2">Adjust your neural filters.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredTopics.map(topic => (
                <TopicCard 
                  key={topic.id} 
                  topic={topic}
                  isBookmarked={bookmarks.includes(topic.id)}
                  isCompleted={completed.includes(topic.id)}
                  onToggleBookmark={() => toggleBookmark(topic.id)}
                  onToggleComplete={() => toggleComplete(topic.id)}
                  onClick={() => setSelectedTopic(topic)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      <AnimatePresence>
        {selectedTopic && (
          <TopicModal 
            topic={selectedTopic} 
            onClose={() => setSelectedTopic(null)}
            isBookmarked={bookmarks.includes(selectedTopic.id)}
            isCompleted={completed.includes(selectedTopic.id)}
            onToggleBookmark={() => toggleBookmark(selectedTopic.id)}
            onToggleComplete={() => toggleComplete(selectedTopic.id)}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

const TopicCard = ({ topic, isBookmarked, isCompleted, onToggleBookmark, onToggleComplete, onClick }) => (
  <motion.div
    layout
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    whileHover={{ y: -5 }}
    className={`group p-6 bg-[var(--eu-bg-card)] border border-[var(--eu-glass-border)] rounded-[32px] flex flex-col h-[280px] shadow-sm hover:shadow-2xl hover:border-eu-accent/30 transition-all relative ${isCompleted ? 'ring-2 ring-eu-accent shadow-neon transition-all-slow' : ''}`}
  >
    {isCompleted && (
       <div className="absolute top-4 right-12 text-eu-accent scale-125">
         <CheckCircle size={16} fill="currentColor" stroke="none" />
       </div>
    )}
    
    <div className="flex-none mb-4 flex items-center justify-between">
      <span className="px-3 py-1 bg-white/5 border border-white/10 rounded-full text-[7px] font-black uppercase tracking-widest text-slate-500">
        {topic.category}
      </span>
      <button 
        onClick={(e) => { e.stopPropagation(); onToggleBookmark(); }}
        className={`p-2 rounded-xl transition-all ${isBookmarked ? 'bg-eu-accent/20 text-eu-accent shadow-neon' : 'hover:bg-white/5 text-slate-600'}`}
      >
        <Star size={14} fill={isBookmarked ? "currentColor" : "none"} />
      </button>
    </div>

    <div className="flex-1 min-w-0" onClick={onClick}>
      <h3 className="text-sm font-black text-white uppercase tracking-tight mb-2 group-hover:text-eu-accent transition-colors truncate">
        {topic.title}
      </h3>
      <p className="text-[10px] text-slate-400 leading-relaxed overflow-hidden line-clamp-3 opacity-70">
        {topic.description}
      </p>
    </div>

    <div className="flexitems-center justify-between gap-4 pt-4 mt-auto border-t border-white/5">
      <button 
        onClick={onClick}
        className="text-[9px] font-black uppercase tracking-widest text-eu-accent hover:opacity-80 transition-all flex items-center gap-1"
      >
        Read More <ChevronRight size={12} />
      </button>
      
      <button 
        onClick={(e) => { e.stopPropagation(); onToggleComplete(); }}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-[8px] font-black uppercase tracking-widest transition-all ${isCompleted ? 'bg-eu-accent text-white shadow-neon' : 'bg-white/5 text-slate-500 hover:text-white'}`}
      >
        {isCompleted ? 'Completed' : 'Complete'}
      </button>
    </div>
  </motion.div>
);

const TopicModal = ({ topic, onClose, isBookmarked, isCompleted, onToggleBookmark, onToggleComplete }) => (
  <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
    <motion.div 
      initial={{ opacity: 0 }} 
      animate={{ opacity: 1 }} 
      exit={{ opacity: 0 }}
      onClick={onClose}
      className="absolute inset-0 bg-black/80 backdrop-blur-xl"
    />
    <motion.div
      initial={{ opacity: 0, scale: 0.9, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9, y: 20 }}
      className="relative w-full max-w-2xl bg-[var(--eu-bg-void)] border border-[var(--eu-glass-border)] rounded-[40px] shadow-neon-strong p-8 md:p-12 overflow-y-auto max-h-[90vh] custom-scrollbar"
    >
      <div className="flex items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-3">
          <span className="px-4 py-1.5 bg-eu-accent/10 border border-eu-accent/20 rounded-full text-[9px] font-black uppercase tracking-widest text-eu-accent">
            {topic.category}
          </span>
          {isCompleted && (
            <div className="flex items-center gap-2 px-4 py-1.5 bg-green-500/10 border border-green-500/20 rounded-full text-[9px] font-black uppercase tracking-widest text-green-500">
               <CheckCircle size={12} /> Mastered
            </div>
          )}
        </div>
        <button onClick={onClose} className="p-3 bg-white/5 hover:bg-white/10 rounded-full transition-all">
          <X size={20} className="text-slate-500" />
        </button>
      </div>

      <h2 className="text-3xl md:text-4xl font-black uppercase tracking-tight-mega mb-6 leading-tight">
        {topic.title}
      </h2>

      <div className="prose prose-invert max-w-none">
        <p className="text-base text-slate-300 leading-relaxed mb-8">
          {topic.description}
        </p>

        <div className="space-y-6">
          <section>
            <div className="flex items-center gap-2 mb-3 text-eu-accent">
              <Code size={16} /> 
              <span className="text-[10px] font-black uppercase tracking-[0.2em]">Neural Sequence</span>
            </div>
            <div className="bg-black/80 rounded-3xl p-6 border border-white/5 font-mono text-sm leading-relaxed overflow-x-auto">
              <pre className="text-indigo-400">{topic.example}</pre>
            </div>
          </section>

          <section>
            <div className="flex items-center gap-2 mb-3 text-eu-accent">
              <Activity size={16} /> 
              <span className="text-[10px] font-black uppercase tracking-[0.2em]">Repair Protocol</span>
            </div>
            <div className="p-6 bg-white/5 rounded-3xl border border-white/5">
              <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-line">
                {topic.solution}
              </p>
            </div>
          </section>

          <div className="p-6 bg-eu-accent/10 border border-eu-accent/30 rounded-3xl flex gap-4">
            <div className="size-10 bg-eu-accent text-white rounded-2xl flex items-center justify-center shrink-0 shadow-neon">
              <Lightbulb size={20} />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-eu-accent mb-1">Tactical Tip</p>
              <p className="text-xs font-bold text-white leading-relaxed">{topic.tip}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4 mt-12 pt-8 border-t border-white/5">
         <button 
           onClick={onToggleComplete}
           className={`flex-1 flex items-center justify-center gap-3 py-4 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all shadow-neon ${isCompleted ? 'bg-green-600 text-white' : 'bg-eu-accent text-white'}`}
         >
           {isCompleted ? <CheckCircle size={18} /> : <Zap size={18} />}
           {isCompleted ? 'Training Complete' : 'Mark as Mastered'}
         </button>
         <button 
           onClick={onToggleBookmark}
           className={`size-14 rounded-2xl flex items-center justify-center transition-all border ${isBookmarked ? 'bg-eu-accent/10 border-eu-accent/30 text-eu-accent' : 'bg-white/5 border-white/10 text-slate-500'}`}
         >
           <Star size={20} fill={isBookmarked ? "currentColor" : "none"} />
         </button>
      </div>
    </motion.div>
  </div>
);

export default LearningHubPage;
