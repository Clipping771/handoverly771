'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Stethoscope, Send, X, Loader2, CheckCircle2, Trash2, Sparkles } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { supabase } from '@/lib/supabase';

export default function SmartSearch() {
  const { facility, user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [messages, setMessages] = useState<{ role: 'user' | 'ai'; content: string; actions?: any[] }[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [residents, setResidents] = useState<{ name: string; room_number: string }[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom of chat
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  useEffect(() => {
    if (user?.id) {
      const saved = localStorage.getItem(`handoverly_chat_${user.id}`);
      if (saved) {
        try {
          setMessages(JSON.parse(saved));
        } catch (e) {}
      }
    }
  }, [user?.id]);

  useEffect(() => {
    if (user?.id) {
      localStorage.setItem(`handoverly_chat_${user.id}`, JSON.stringify(messages));
    }
  }, [messages, user?.id]);

  // Fetch active residents to make suggestion chips dynamic and relevant
  useEffect(() => {
    if (!facility) return;
    const fetchActiveResidents = async () => {
      try {
        const { data, error } = await supabase
          .from('residents')
          .select('name, room_number')
          .eq('facility_id', facility.id)
          .eq('is_active', true)
          .limit(3);
        if (!error && data) {
          setResidents(data);
        }
      } catch (err) {
        console.error('Failed to fetch residents for suggestions:', err);
      }
    };
    fetchActiveResidents();
  }, [facility, isOpen]); // refresh when opened

  if (!facility || !user) return null;

  const clearChat = () => {
    if (window.confirm('Are you sure you want to clear the chat history?')) {
      setMessages([]);
      localStorage.removeItem(`handoverly_chat_${user.id}`);
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim() || !facility) return;

    const userQuery = query.trim();
    setMessages(prev => [...prev, { role: 'user', content: userQuery }]);
    setQuery('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          query: userQuery, 
          facilityId: facility.id,
          userRole: user.role,
          userId: user.id
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setMessages(prev => [...prev, { role: 'ai', content: data.answer, actions: data.executedActions }]);
    } catch (err: any) {
      setMessages(prev => [...prev, { role: 'ai', content: `Error: ${err.message}` }]);
    } finally {
      setIsLoading(false);
    }
  };

  // Generate dynamic, context-aware suggestions
  const getSuggestions = () => {
    if (residents.length === 0) {
      return [
        { 
          label: "How do I register a resident?", 
          text: "How do I register a new resident profile in this facility?" 
        },
        { 
          label: "Smart Clinical Assistant capabilities", 
          text: "What actions can the Smart Clinical Assistant execute on behalf of staff?" 
        },
        { 
          label: "What is Handoverly?", 
          text: "Explain what Handoverly does and how it facilitates clinical operations." 
        }
      ];
    }

    const firstRes = residents[0];
    const secondRes = residents[1] || firstRes;
    
    return [
      { 
        label: `Check ${firstRes.name}'s fall history`, 
        text: `Did ${firstRes.name} (Room ${firstRes.room_number}) have any falls in the last 14 days?` 
      },
      { 
        label: `Create RN task for ${secondRes.name}`, 
        text: `Create a medication task for ${secondRes.name} (Room ${secondRes.room_number}): Administer afternoon insulin` 
      },
      { 
        label: `Log incident for ${firstRes.name}`, 
        text: `Log clinical observation for ${firstRes.name} (Room ${firstRes.room_number}): Slipped in corridor, skin tear on left forearm dressed, vitals stable` 
      }
    ];
  };

  const suggestions = getSuggestions();

  const handleSuggestionClick = (text: string) => {
    setQuery(text);
  };

  return (
    <>
      {/* Premium Clinical Floating Button */}
      <button
        onClick={() => setIsOpen(true)}
        className={`fixed bottom-6 right-6 w-14 h-14 bg-gradient-to-tr from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-full shadow-lg shadow-blue-500/30 flex items-center justify-center transition-all duration-300 transform hover:scale-105 active:scale-95 z-40 ${isOpen ? 'scale-0 pointer-events-none' : 'scale-100'}`}
        title="Smart Clinical Assistant"
      >
        <Stethoscope className="w-6 h-6 text-white animate-pulse" />
      </button>

      {/* Premium Chat Window */}
      {isOpen && (
        <div className="fixed bottom-6 right-6 w-[410px] h-[580px] max-h-[85vh] bg-white dark:bg-[#0f0f12] border border-slate-200 dark:border-zinc-800/80 rounded-3xl shadow-2xl z-50 flex flex-col overflow-hidden animate-in slide-in-from-bottom-5 duration-300">
          
          {/* Header */}
          <div className="bg-gradient-to-r from-slate-900 to-slate-950 dark:from-zinc-900 dark:to-zinc-950 px-5 py-4 flex items-center justify-between text-white border-b border-slate-800 dark:border-zinc-850">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400">
                <Stethoscope className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm tracking-tight">Smart Clinical Assistant</span>
                  <span className="flex h-2 w-2 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 dark:text-zinc-500 font-medium">Secured Clinical AI Copilot</p>
              </div>
            </div>
            
            <div className="flex items-center gap-1.5">
              {messages.length > 0 && (
                <button 
                  onClick={clearChat} 
                  className="p-2 hover:bg-white/5 rounded-xl transition-colors text-slate-400 hover:text-white" 
                  title="Clear Chat History"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
              <button 
                onClick={() => setIsOpen(false)} 
                className="p-2 hover:bg-white/5 rounded-xl transition-colors text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-slate-50/50 dark:bg-[#09090b]">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-blue-500/10 dark:bg-blue-500/5 flex items-center justify-center text-blue-500 border border-blue-500/20 dark:border-blue-500/10 animate-bounce">
                  <Stethoscope className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800 dark:text-zinc-200">How can I assist you today?</h3>
                  <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1 max-w-[280px] leading-relaxed">
                    Ask questions about recent handovers, create clinical tasks, or log observations directly into the resident timeline.
                  </p>
                </div>
                
                {/* Suggestions List */}
                <div className="w-full pt-4 space-y-2">
                  <p className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider text-left pl-1">Suggested Prompts</p>
                  {suggestions.map((s, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSuggestionClick(s.text)}
                      className="w-full text-left p-3 text-xs bg-white dark:bg-[#121215] border border-slate-200 dark:border-zinc-800/80 rounded-2xl hover:border-blue-500/60 dark:hover:border-blue-500/40 text-slate-700 dark:text-zinc-350 hover:bg-blue-50/30 dark:hover:bg-blue-950/10 transition-all font-medium flex items-center gap-2 shadow-sm"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                      <span>{s.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((m, i) => (
                <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in duration-200`}>
                  <div className={`max-w-[90%] rounded-2xl px-4 py-3 text-sm ${
                    m.role === 'user' 
                      ? 'bg-blue-600 text-white rounded-br-none shadow-md shadow-blue-600/10' 
                      : 'bg-white dark:bg-[#121216] text-slate-800 dark:text-zinc-200 border border-slate-200 dark:border-zinc-800/80 rounded-bl-none shadow-sm'
                  }`}>
                    <div className="prose prose-sm dark:prose-invert max-w-none">
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={{
                          table: ({node, ...props}) => <div className="overflow-x-auto my-3"><table className="min-w-full text-left border-collapse" {...props} /></div>,
                          th: ({node, ...props}) => <th className="border-b border-slate-250 dark:border-zinc-700 px-3 py-2 text-xs font-bold text-slate-800 dark:text-zinc-200 bg-slate-50 dark:bg-zinc-800/50" {...props} />,
                          td: ({node, ...props}) => <td className="border-b border-slate-100 dark:border-zinc-800/40 px-3 py-2 text-xs" {...props} />,
                          p: ({node, ...props}) => <p className="mb-2 last:mb-0 leading-relaxed text-xs" {...props} />,
                          ul: ({node, ...props}) => <ul className="list-disc pl-5 mb-2 text-xs space-y-1" {...props} />,
                          ol: ({node, ...props}) => <ol className="list-decimal pl-5 mb-2 text-xs space-y-1" {...props} />,
                          li: ({node, ...props}) => <li className="leading-relaxed mb-0.5" {...props} />,
                          strong: ({node, ...props}) => <strong className="font-bold text-slate-900 dark:text-white" {...props} />,
                        }}
                      >
                        {m.content}
                      </ReactMarkdown>
                    </div>

                    {/* Executed Smart Actions Visual Cards */}
                    {m.actions && m.actions.length > 0 && (
                      <div className="mt-3 space-y-2 border-t border-slate-100 dark:border-zinc-800/60 pt-3">
                        {m.actions.map((act, idx) => (
                          <div key={idx} className="bg-emerald-50/50 dark:bg-emerald-950/10 border border-emerald-200/60 dark:border-emerald-900/30 rounded-xl p-3 flex items-start gap-2.5">
                            <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center text-white shrink-0 mt-0.5 shadow-sm">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                            </div>
                            <div className="min-w-0">
                              <span className="font-bold text-[11px] text-emerald-900 dark:text-emerald-450 uppercase tracking-wider block">
                                {act.type === 'CREATE_TASK' ? 'Task Created' : 'Observation Logged'}
                              </span>
                              <span className="font-semibold text-xs text-slate-800 dark:text-zinc-200 mt-0.5 block">
                                {act.title || act.action_type || 'Success'}
                              </span>
                              {act.description && (
                                <p className="text-[11px] text-slate-550 dark:text-zinc-400 mt-1 leading-relaxed">
                                  {act.description}
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-white dark:bg-[#121216] border border-slate-200 dark:border-zinc-800/80 rounded-2xl rounded-bl-none p-3 shadow-sm flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                  <span className="text-xs text-slate-400 dark:text-zinc-500 font-medium">Processing clinical data...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <form onSubmit={handleSend} className="p-4 bg-white dark:bg-[#0f0f12] border-t border-slate-200 dark:border-zinc-800/80">
            <div className="relative flex items-center">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Ask about a resident or log an observation..."
                className="w-full bg-slate-100 dark:bg-[#18181c] border border-transparent focus:border-slate-350 dark:focus:border-zinc-750 text-slate-900 dark:text-white text-xs rounded-full pl-4 pr-12 py-3.5 focus:outline-none transition-all placeholder-slate-400 dark:placeholder-zinc-650"
              />
              <button 
                type="submit" 
                disabled={!query.trim() || isLoading}
                className="absolute right-2 p-2 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:disabled:bg-zinc-800/50 text-white dark:text-zinc-300 rounded-full transition-all active:scale-95"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
