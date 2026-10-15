import React, { useState, useMemo } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  BookOpen, Search, Star, CheckCircle, ChevronRight, X, 
  Code, Lightbulb, Terminal, Zap, MessageSquare, 
  AlertTriangle, Filter, LayoutGrid, Activity, Sparkles,
  Send, Loader2, Copy, Check
} from 'lucide-react';
import { API_URL } from '../../config/api';
import data from '../../data/learningHubData.json';

const categories = [
  "All Topics",
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
  const [activeCategory, setActiveCategory] = useState("All Topics");
  const [selectedTopic, setSelectedTopic] = useState(null);
  const [bookmarks, setBookmarks] = useState(() => {
    try { return JSON.parse(localStorage.getItem('sentinel_hub_bookmarks') || '[]'); }
    catch(e) { return []; }
  });
  const [completed, setCompleted] = useState(() => {
    try { return JSON.parse(localStorage.getItem('sentinel_hub_completed') || '[]'); }
    catch(e) { return []; }
  });
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
      const matchSearch = !searchQuery || 
        (t.title || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
        (t.description || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (t.category || '').toLowerCase().includes(searchQuery.toLowerCase());
      const matchCategory = activeCategory === "All Topics" || t.category === activeCategory;
      return matchSearch && matchCategory;
    });
  }, [searchQuery, activeCategory]);

  const handleAiAsk = async (e) => {
    if (e) e.preventDefault();
    if (!aiInput.trim() || isAiLoading) return;

    setIsAiLoading(true);
    setAiResponse(null);
    try {
      const { data } = await axios.post(`${API_URL}/api/learning/ask`, { question: aiInput });
      setAiResponse(data);
      setAiInput('');
    } catch (e) {
      setAiResponse({
        explanation: "Could not connect to the AI diagnostic assistant. Please verify your backend server connection.",
        example: "// Error: Connection failed\nconsole.error('Diagnostic endpoint unreachable');",
        fix: "Check that your backend server is running on port 5005."
      });
    } finally {
      setIsAiLoading(false);
    }
  };

  const progressPercent = data.length > 0 ? Math.round((completed.length / data.length) * 100) : 0;

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12 font-inter">
      {/* ── Header Card ── */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-start sm:items-center gap-4">
          <div className="size-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/80 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0 shadow-xs">
            <BookOpen size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white font-outfit">
                QA Knowledge & Debugging Hub
              </h1>
              <span className="px-2.5 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 text-xs font-bold font-mono">
                {data.length} Topics
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
              Curated guides, error diagnostics, and practical remediation patterns for web developers.
            </p>
          </div>
        </div>

        {/* Progress Tracker */}
        <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 rounded-2xl p-4 min-w-[200px] shrink-0">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300 font-outfit">
              Progress
            </span>
            <span className="text-xs font-black font-mono text-indigo-600 dark:text-indigo-400">
              {completed.length} of {data.length} ({progressPercent}%)
            </span>
          </div>
          <div className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${progressPercent}%` }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
              className="h-full bg-gradient-to-r from-indigo-600 to-cyan-500 rounded-full"
            />
          </div>
        </div>
      </div>

      {/* ── Ask AI Consult Bar ── */}
      <form onSubmit={handleAiAsk} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3 sm:p-4 shadow-xs flex items-center gap-3">
        <div className="size-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/80 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
          <Sparkles size={18} />
        </div>
        <input 
          type="text"
          value={aiInput}
          onChange={e => setAiInput(e.target.value)}
          placeholder="Ask AI: 'How do I fix a CORS issue?' or 'Explain 403 Forbidden'..."
          className="flex-1 bg-transparent text-xs sm:text-sm text-slate-900 dark:text-white placeholder:text-slate-400 outline-none"
        />
        <button
          type="submit"
          disabled={!aiInput.trim() || isAiLoading}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 shadow-sm transition-all disabled:opacity-40 shrink-0"
        >
          {isAiLoading ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
          <span>Ask AI</span>
        </button>
      </form>

      {/* ── AI Response Card ── */}
      <AnimatePresence>
        {aiResponse && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/80 rounded-2xl p-5 sm:p-6 space-y-4 relative shadow-xs"
          >
            <button 
              onClick={() => setAiResponse(null)}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-white/50 dark:hover:bg-slate-800 transition-all"
            >
              <X size={16} />
            </button>
            <div className="flex items-center gap-2 text-indigo-700 dark:text-indigo-300">
              <Sparkles size={16} />
              <h3 className="text-xs font-bold uppercase tracking-wider font-outfit">AI QA Insight</h3>
            </div>
            <p className="text-xs sm:text-sm text-slate-800 dark:text-slate-200 leading-relaxed">
              {aiResponse.explanation}
            </p>
            {aiResponse.example && (
              <div className="bg-slate-950 text-indigo-300 rounded-xl p-4 font-mono text-xs overflow-x-auto border border-slate-800">
                <pre>{aiResponse.example}</pre>
              </div>
            )}
            {aiResponse.fix && (
              <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs text-emerald-900 dark:text-emerald-200 font-medium">
                <strong>Recommended Fix:</strong> {aiResponse.fix}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Search & Categories Filter ── */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs space-y-3">
        {/* Search Input */}
        <div className="relative">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search guides, errors, or troubleshooting patterns..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl pl-10 pr-4 py-2 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
          />
          {searchQuery && (
            <button 
              onClick={() => setSearchQuery('')}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 custom-scrollbar">
          {categories.map((cat) => {
            const isSelected = activeCategory === cat;
            const count = cat === "All Topics" 
              ? data.length 
              : data.filter(d => d.category === cat).length;

            return (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 shrink-0 ${
                  isSelected
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <span>{cat}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${isSelected ? 'bg-indigo-500 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Topics Grid ── */}
      {filteredTopics.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-16 text-center shadow-xs flex flex-col items-center justify-center max-w-md mx-auto space-y-3">
          <div className="size-14 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400">
            <Search size={24} />
          </div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white font-outfit">No Guides Found</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            Try adjusting your search query or switching to another category.
          </p>
          <button
            onClick={() => { setSearchQuery(''); setActiveCategory('All Topics'); }}
            className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold"
          >
            Reset Filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredTopics.map((topic) => {
            const isBookmarked = bookmarks.includes(topic.id);
            const isCompleted = completed.includes(topic.id);

            return (
              <motion.div
                key={topic.id}
                layout
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                className={`bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs hover:border-indigo-300 dark:hover:border-indigo-700 transition-all flex flex-col justify-between h-[250px] relative group cursor-pointer ${
                  isCompleted ? 'border-emerald-300 dark:border-emerald-800/80 bg-emerald-50/20 dark:bg-emerald-950/10' : ''
                }`}
                onClick={() => setSelectedTopic(topic)}
              >
                {/* Top Row: Category + Star */}
                <div className="flex items-center justify-between gap-2" onClick={(e) => e.stopPropagation()}>
                  <span className="px-2.5 py-1 rounded-md bg-indigo-50 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 text-[10px] font-bold font-mono uppercase tracking-wider">
                    {topic.category}
                  </span>
                  <div className="flex items-center gap-1.5">
                    {isCompleted && (
                      <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider font-outfit">
                        <CheckCircle size={13} fill="currentColor" className="text-white dark:text-slate-900" /> Mastered
                      </span>
                    )}
                    <button
                      onClick={() => toggleBookmark(topic.id)}
                      className={`p-1.5 rounded-lg transition-all ${
                        isBookmarked ? 'text-amber-500 bg-amber-50 dark:bg-amber-950/50' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                      title={isBookmarked ? 'Remove bookmark' : 'Bookmark topic'}
                    >
                      <Star size={14} fill={isBookmarked ? 'currentColor' : 'none'} />
                    </button>
                  </div>
                </div>

                {/* Content */}
                <div className="my-2 min-w-0">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white line-clamp-2 font-outfit group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                    {topic.title}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-3 leading-relaxed mt-1.5">
                    {topic.description}
                  </p>
                </div>

                {/* Bottom Row: Read More & Mark Completed */}
                <div 
                  className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800 text-xs" 
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    onClick={() => setSelectedTopic(topic)}
                    className="font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-1 hover:underline"
                  >
                    Read Guide <ChevronRight size={13} />
                  </button>

                  <button
                    onClick={() => toggleComplete(topic.id)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                      isCompleted 
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' 
                        : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {isCompleted ? <Check size={12} strokeWidth={3} /> : null}
                    <span>{isCompleted ? 'Completed' : 'Complete'}</span>
                  </button>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* ── Topic Detail Modal ── */}
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

const TopicModal = ({ topic, onClose, isBookmarked, isCompleted, onToggleBookmark, onToggleComplete }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (topic.example) {
      navigator.clipboard.writeText(topic.example);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-900/60 dark:bg-black/80 backdrop-blur-xs font-inter">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        className="w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl p-6 sm:p-8 space-y-6 max-h-[85vh] overflow-y-auto custom-scrollbar"
      >
        {/* Modal Header */}
        <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 text-xs font-bold font-mono">
                {topic.category}
              </span>
              {isCompleted && (
                <span className="px-2.5 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 text-xs font-bold flex items-center gap-1">
                  <CheckCircle size={12} /> Mastered
                </span>
              )}
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white font-outfit pt-1">
              {topic.title}
            </h2>
          </div>
          <button 
            onClick={onClose} 
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-all shrink-0"
          >
            <X size={18} />
          </button>
        </div>

        {/* Description */}
        <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
          {topic.description}
        </p>

        {/* Code Example */}
        {topic.example && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300 font-outfit">
              <span className="flex items-center gap-1.5">
                <Code size={13} className="text-indigo-600 dark:text-indigo-400" /> Code Example
              </span>
              <button
                onClick={handleCopy}
                className="flex items-center gap-1 text-[11px] text-slate-500 hover:text-indigo-600 transition-colors"
              >
                {copied ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
            <div className="bg-slate-950 text-indigo-200 rounded-2xl p-4 font-mono text-xs overflow-x-auto border border-slate-800 leading-relaxed">
              <pre>{topic.example}</pre>
            </div>
          </div>
        )}

        {/* Solution */}
        {topic.solution && (
          <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/80 space-y-1.5">
            <div className="flex items-center gap-1.5 text-emerald-800 dark:text-emerald-300 text-xs font-bold uppercase tracking-wider font-outfit">
              <CheckCircle size={14} /> Recommended Fix
            </div>
            <p className="text-xs sm:text-sm text-emerald-900 dark:text-emerald-200 leading-relaxed whitespace-pre-line font-medium">
              {topic.solution}
            </p>
          </div>
        )}

        {/* Tip */}
        {topic.tip && (
          <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/80 flex items-start gap-3">
            <Lightbulb size={18} className="text-amber-500 shrink-0 mt-0.5" />
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300 font-outfit block">
                Pro Tip
              </span>
              <p className="text-xs text-amber-900 dark:text-amber-200 leading-relaxed mt-0.5 font-medium">
                {topic.tip}
              </p>
            </div>
          </div>
        )}

        {/* Footer actions */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-200 dark:border-slate-800 gap-3">
          <button
            onClick={onToggleBookmark}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
              isBookmarked 
                ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300' 
                : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
            }`}
          >
            <Star size={14} fill={isBookmarked ? 'currentColor' : 'none'} />
            <span>{isBookmarked ? 'Bookmarked' : 'Bookmark'}</span>
          </button>

          <button
            onClick={() => {
              onToggleComplete();
              onClose();
            }}
            className={`px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-2 shadow-sm transition-all ${
              isCompleted 
                ? 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200 hover:bg-slate-200' 
                : 'bg-indigo-600 hover:bg-indigo-700 text-white'
            }`}
          >
            <CheckCircle size={15} />
            <span>{isCompleted ? 'Mark as Incomplete' : 'Mark as Mastered'}</span>
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default LearningHubPage;
