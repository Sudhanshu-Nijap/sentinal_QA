import { API_URL, SOCKET_URL } from '../config/api';
import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MessageSquare, Plus, Activity, Globe, Pin, PinOff,
  Search, MoreVertical, Trash2, Edit2, LogOut, FileText,
  RefreshCw, Clock, ChevronRight, Calendar, Brain, Cpu, Terminal,
  Sun, Moon
} from 'lucide-react';


// ── Date grouping helper ───────────────────────────────────────────────────────
const getDateGroup = (dateStr) => {
  const d = new Date(dateStr);
  const now = new Date();
  const diff = Math.floor((now - d) / (1000 * 60 * 60 * 24));
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  if (diff < 7) return 'This Week';
  return 'Older';
};

const groupChatsByDate = (chats) => {
  const order = ['Today', 'Yesterday', 'This Week', 'Older'];
  const groups = {};
  chats.forEach(c => {
    const g = getDateGroup(c.lastMessageAt || c.createdAt);
    if (!groups[g]) groups[g] = [];
    groups[g].push(c);
  });
  return order.filter(k => groups[k]).map(k => ({ label: k, items: groups[k] }));
};

const ChatSidebar = ({
  onSelectChat,
  onViewReport,
  activeChatId,
  onNewSession,
  refreshKey,
  onToggleTheme,
  theme,
  onGroupChart,
  onScheduleClick,
  onDeleteChat,
  confirm,
  prompt: promptFn,
  setAlert,
  onViewChange
}) => {

  const [searchQuery, setSearchQuery] = useState('');
  const [chats, setChats] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeMenuId, setActiveMenuId] = useState(null);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  const [userData, setUserData] = useState(null);

  useEffect(() => {
    const raw = localStorage.getItem('userData');
    const userId = localStorage.getItem('userId');
    if (raw) {
      try { setUserData(JSON.parse(raw)); } catch { }
    } else if (userId) {
      import('axios').then(async a => {
        try {
          const { data } = await a.default.get(`${API_URL}/api/auth/profile/${userId}`);
          const d = { username: data.username, email: data.email };
          setUserData(d);
          localStorage.setItem('userData', JSON.stringify(d));
        } catch { }
      });
    }
  }, []);

  const loadChats = async () => {
    const userId = localStorage.getItem('userId');
    if (!userId) { setLoading(false); return; }
    setLoading(true);
    try {
      const { data } = await import('axios').then(a => a.default.get(`${API_URL}/api/chat/threads?userId=${userId}`));
      const sorted = data.sort((a, b) => {
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;
        return new Date(b.lastMessageAt || b.createdAt) - new Date(a.lastMessageAt || a.createdAt);
      });
      setChats(sorted);
    } catch (err) {
      console.error('Sidebar sync failure', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadChats(); }, [refreshKey]);

  const handleDelete = async (id) => {
    const ok = await confirm({
      title: 'Delete Chat Thread',
      message: 'This will permanently delete this chat thread and all its messages.',
      confirmText: 'Delete',
      type: 'danger'
    });
    if (!ok) return;
    try {
      await import('axios').then(a => a.default.delete(`${API_URL}/api/chat/thread/${id}`));
      setAlert({ type: 'success', message: 'Thread deleted.' });
      if (onDeleteChat) onDeleteChat(id);
      loadChats();
    } catch {
      setAlert({ type: 'error', message: 'Delete failed.' });
    }
  };

  const handlePin = async (id) => {
    try {
      await import('axios').then(a => a.default.patch(`${API_URL}/api/chat/thread/${id}/pin`));
      loadChats();
    } catch {
      setAlert({ type: 'error', message: 'Pin failed.' });
    }
  };

  const handleRename = async (id, currentName) => {
    const newName = await promptFn({ title: 'Rename Thread', message: 'New name:', confirmText: 'Rename' });
    if (!newName) return;
    try {
      await import('axios').then(a => a.default.patch(`${API_URL}/api/chat/thread/${id}/rename`, { name: newName }));
      loadChats();
    } catch {
      setAlert({ type: 'error', message: 'Rename failed.' });
    }
  };

  const handleReset = () => {
    ['token', 'userId', 'userData', 'sentinel_pending_progress', 'sentinel_chat_messages', 'sentinel_scan_params'].forEach(k => localStorage.removeItem(k));
    window.location.reload();
  };

  const filtered = chats.filter(c =>
    (c.customName || c.url || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Pin section + date grouped rest
  const pinned = filtered.filter(c => c.isPinned);
  const unpinned = filtered.filter(c => !c.isPinned);
  const dateGroups = groupChatsByDate(unpinned);

  const ChatItem = ({ chat }) => {
    const isActive = activeChatId === chat._id;
    const hostname = (() => { try { return new URL(chat.url).hostname; } catch { return chat.url; } })();
    const lastTime = chat.lastMessageAt
      ? new Date(chat.lastMessageAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : '';

    return (
      <div className="relative group">
        <motion.button
          whileHover={{ scale: 1.01, x: 2 }}
          onClick={() => onSelectChat(chat._id)}
          className={`w-full flex items-center gap-2 p-2 rounded-xl text-left transition-all ${isActive
            ? 'bg-[var(--eu-bg-card)] border border-eu-accent/30 shadow-neon'
            : 'hover:bg-[var(--eu-bg-void)]/10 border border-transparent'}`}
        >
          <div className={`size-8 shrink-0 rounded-xl flex items-center justify-center transition-all ${isActive
            ? 'bg-eu-accent/20 text-eu-accent shadow-neon'
            : 'bg-[var(--eu-bg-void)] text-[var(--eu-text-main)] opacity-40 group-hover:opacity-70'}`}>
            {chat.isPinned ? <Pin size={13} className="fill-current" /> : <Globe size={13} />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-1">
              <p className={`text-[10px] font-black truncate ${isActive ? 'text-[var(--eu-text-main)]' : 'text-[var(--eu-text-main)] opacity-50 group-hover:opacity-90'}`}>
                {chat.customName || hostname}
              </p>
              <span className="text-[8px] font-mono text-slate-600 shrink-0">{lastTime}</span>
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              {chat.scanCount > 0 && (
                <span className="text-[7px] font-black uppercase tracking-widest text-eu-accent/60">
                  {chat.scanCount} scan{chat.scanCount > 1 ? 's' : ''}
                </span>
              )}
              {chat.lastMessage && (
                <p className="text-[8px] text-slate-600 truncate">
                  {chat.lastMessage.type === 'report' ? 'Scan complete'
                    : chat.lastMessage.type === 'rescan' ? 'Rescan complete'
                      : chat.lastMessage.content?.slice(0, 30)}
                </p>
              )}
            </div>
          </div>
        </motion.button>

        {/* Action Buttons */}
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={(e) => { e.stopPropagation(); handlePin(chat._id); }}
            className={`p-1.5 rounded-lg transition-all hover:bg-white/10 ${chat.isPinned ? 'text-eu-accent' : 'text-[var(--eu-text-main)] opacity-40'}`}>
            <Pin size={11} className={chat.isPinned ? 'fill-current' : ''} />
          </button>
          <button onClick={(e) => {
            e.stopPropagation();
            const rect = e.currentTarget.getBoundingClientRect();
            setMenuPosition({ top: rect.top, left: rect.right + 8 });
            setActiveMenuId(activeMenuId === chat._id ? null : chat._id);
          }} className={`p-1.5 rounded-lg transition-all hover:bg-white/10 ${activeMenuId === chat._id ? 'bg-eu-accent/20 text-eu-accent' : 'text-slate-600'}`}>
            <MoreVertical size={13} />
          </button>
        </div>
      </div>
    );
  };

  const SectionLabel = ({ label }) => (
    <div className="flex items-center gap-2 px-2 py-1 mb-1">
      <Clock size={9} className="text-slate-600" />
      <span className="text-[8px] font-black uppercase tracking-[0.2em] text-slate-600">{label}</span>
    </div>
  );

  // return (
  return (
    <div className="w-full h-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm flex flex-col relative z-20">
      {/* Header */}
      <div className="p-4 space-y-3 border-b border-slate-100 dark:border-slate-800/80">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="size-7 bg-indigo-50 dark:bg-indigo-950/60 rounded-lg flex items-center justify-center border border-indigo-200 dark:border-indigo-800 shadow-sm">
              <MessageSquare className="text-indigo-600 dark:text-indigo-400 size-3.5" />
            </div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">QA Threads</h2>
          </div>
          <div className="flex items-center gap-1.5">
            <button onClick={onNewSession}
              className="size-7 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-lg flex items-center justify-center text-slate-700 dark:text-slate-300 transition-all shadow-sm"
              title="New Session"
            >
              <Plus size={14} />
            </button>
          </div>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 size-3.5" />
          <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search threads..."
            className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl py-2 pl-9 pr-3 text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all placeholder:text-slate-400" />
        </div>
      </div>

      {/* Thread List */}
      <div className="flex-1 overflow-y-auto px-2.5 py-3 custom-scrollbar">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="size-7 border-2 border-indigo-600 border-t-transparent animate-spin rounded-full mb-3" />
            <p className="text-xs font-bold uppercase tracking-wider text-indigo-600">Loading...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center px-4">
            <div className="size-11 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-3">
              <MessageSquare size={20} className="text-slate-500" />
            </div>
            <p className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">No threads yet</p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium mt-1">Enter a URL to start scanning</p>
          </div>
        ) : (
          <div className="space-y-1">
            {/* Pinned */}
            {pinned.length > 0 && (
              <div className="mb-3">
                <SectionLabel label="Pinned" />
                {pinned.map(c => <ChatItem key={`pinned-${c._id}`} chat={c} />)}
              </div>
            )}
            {/* Date Groups */}
            {dateGroups.map(({ label, items }) => (
              <div key={`group-${label}`} className="mb-3">
                <SectionLabel label={label} />
                {items.map(c => <ChatItem key={`chat-${label}-${c._id}`} chat={c} />)}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Profile Footer */}
      <div className="p-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/40 rounded-b-2xl">
        <div className="flex items-center gap-2.5 p-2 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="size-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center shrink-0">
            <span className="text-xs font-black text-indigo-600 dark:text-indigo-400">
              {userData?.username?.[0]?.toUpperCase() || userData?.email?.[0]?.toUpperCase() || 'U'}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
              {userData?.username || userData?.email?.split('@')[0] || 'User'}
            </p>
            <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400 truncate">{userData?.email || 'Offline'}</p>
          </div>
          <button
            onClick={onToggleTheme}
            title={theme === 'dark' ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
            className="size-8 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 rounded-lg flex items-center justify-center text-slate-700 dark:text-slate-300 transition-all border border-slate-200 dark:border-slate-600"
          >
            {theme === 'dark' ? <Sun size={13} className="text-amber-400" /> : <Moon size={13} className="text-indigo-600" />}
          </button>
          <button onClick={handleReset} title="Logout"
            className="size-8 bg-slate-100 hover:bg-rose-50 hover:text-rose-600 dark:bg-slate-700 dark:hover:bg-rose-950/40 rounded-lg flex items-center justify-center text-slate-600 dark:text-slate-400 transition-all border border-slate-200 dark:border-slate-600">
            <LogOut size={13} />
          </button>
        </div>
      </div>

      {/* Context Menu Portal */}
      {activeMenuId && createPortal(
        <>
          <div className="fixed inset-0 z-[999998]" onClick={() => setActiveMenuId(null)} />
          <motion.div initial={{ opacity: 0, scale: 0.95, y: -4 }} animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0 }} transition={{ duration: 0.12 }}
            className="fixed z-[999999] w-44 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-1.5 shadow-xl"
            style={{
              top: menuPosition.top,
              left: menuPosition.left
            }}>
            {[
              { icon: <Edit2 size={13} />, label: 'Rename', onClick: () => { handleRename(activeMenuId); setActiveMenuId(null); } },
              { icon: <Pin size={13} />, label: 'Pin / Unpin', onClick: () => { handlePin(activeMenuId); setActiveMenuId(null); } },
              { icon: <Trash2 size={13} />, label: 'Delete', danger: true, onClick: () => { handleDelete(activeMenuId); setActiveMenuId(null); } },
            ].map(({ icon, label, onClick, danger }) => (
              <button key={label} onClick={onClick}
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold rounded-lg mb-0.5 transition-colors
                  ${danger 
                    ? 'text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40' 
                    : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700'}`}>
                <span className={danger ? 'text-rose-500' : 'text-indigo-600 dark:text-indigo-400'}>{icon}</span>
                {label}
              </button>
            ))}
          </motion.div>
        </>,
        document.body
      )}
    </div>
  );
};

export default ChatSidebar;
