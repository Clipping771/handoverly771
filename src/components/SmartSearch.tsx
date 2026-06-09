'use client';

import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Bot, Send, X, Loader2, CheckCircle2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export default function SmartSearch() {
  const { facility, user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [messages, setMessages] = useState<{ role: 'user' | 'ai'; content: string; actions?: any[] }[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  if (!facility || !user) return null;

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

  return (
    <>
      {/* Floating Button */}
      <button
        onClick={() => setIsOpen(true)}
        className={`fixed bottom-6 right-6 w-14 h-14 bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white rounded-full shadow-lg shadow-slate-500/30 flex items-center justify-center transition-all z-40 ${isOpen ? 'scale-0' : 'scale-100'}`}
      >
        <Bot className="w-6 h-6 text-white" />
      </button>

      {/* Chat Window */}
      {isOpen && (
        <div className="fixed bottom-6 right-6 w-[380px] h-[500px] max-h-[80vh] bg-white dark:bg-[#121214] border border-[#e3e3e3] dark:border-[#202024] rounded-[24px] shadow-2xl z-50 flex flex-col overflow-hidden animate-in slide-in-from-bottom-5">
          {/* Header */}
          <div className="bg-slate-900 dark:bg-slate-800 p-4 flex items-center justify-between text-white">
            <div className="flex items-center gap-2">
              <Bot className="w-5 h-5" />
              <span className="font-semibold text-sm tracking-wide">Smart Clinical Assistant</span>
            </div>
            <button onClick={() => setIsOpen(false)} className="p-1 hover:bg-white/20 rounded-full transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50 dark:bg-[#0b0b0d]">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center opacity-50 space-y-2">
                <div className="w-6 h-6 rounded-lg bg-slate-900 dark:bg-slate-800 flex items-center justify-center shrink-0">
                  <Bot className="w-5 h-5 text-slate-800 dark:text-slate-200" />
                </div>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  Ask me anything about past handovers.<br/>e.g., "Did Bob fall recently?"
                </p>
              </div>
            ) : (
              messages.map((m, i) => (
                <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] rounded-2xl p-3 text-sm ${
                    m.role === 'user' 
                      ? 'bg-slate-800 dark:bg-slate-700 text-white rounded-br-none' 
                      : 'bg-white dark:bg-[#1c1c21] text-slate-800 dark:text-slate-200 border border-slate-100 dark:border-[#202024] rounded-bl-none shadow-sm'
                  }`}>
                    <div className="prose prose-sm dark:prose-invert max-w-none">
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={{
                          table: ({node, ...props}) => <div className="overflow-x-auto my-3"><table className="min-w-full text-left border-collapse" {...props} /></div>,
                          th: ({node, ...props}) => <th className="border-b border-slate-200 dark:border-slate-700 px-3 py-2 text-xs font-semibold text-slate-800 dark:text-slate-200 bg-slate-50 dark:bg-[#202024]" {...props} />,
                          td: ({node, ...props}) => <td className="border-b border-slate-100 dark:border-slate-800 px-3 py-2 text-xs" {...props} />,
                          p: ({node, ...props}) => <p className="mb-2 last:mb-0 leading-relaxed" {...props} />,
                          strong: ({node, ...props}) => <strong className="font-bold text-slate-900 dark:text-white" {...props} />,
                        }}
                      >
                        {m.content}
                      </ReactMarkdown>
                    </div>
                    {m.actions && m.actions.length > 0 && (
                      <div className="mt-3 space-y-2">
                        {m.actions.map((act, idx) => (
                          <div key={idx} className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/50 rounded-lg p-3">
                            <div className="flex items-center gap-2 mb-1">
                              <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center text-white shrink-0">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                              </div>
                              <span className="font-semibold text-xs text-blue-900 dark:text-blue-100">
                                {act.title || 'Action Executed'}
                              </span>
                            </div>
                            {act.description && (
                              <p className="text-xs text-blue-800 dark:text-blue-200 opacity-90 pl-7 leading-relaxed">
                                {act.description}
                              </p>
                            )}
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
                <div className="bg-white dark:bg-[#1c1c21] border border-slate-100 dark:border-[#202024] rounded-2xl rounded-bl-none p-3 shadow-sm">
                  <Loader2 className="w-4 h-4 animate-spin text-slate-500" />
                </div>
              </div>
            )}
          </div>

          {/* Input Area */}
          <form onSubmit={handleSend} className="p-3 bg-white dark:bg-[#121214] border-t border-[#e3e3e3] dark:border-[#202024]">
            <div className="relative flex items-center">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Ask about a resident..."
                className="w-full bg-slate-100 dark:bg-[#1c1c21] text-slate-900 dark:text-white text-sm rounded-full pl-4 pr-12 py-3 focus:outline-none focus:ring-1 focus:ring-slate-500 transition-all"
              />
              <button 
                type="submit" 
                disabled={!query.trim() || isLoading}
                className="absolute right-2 p-2 bg-slate-800 hover:bg-slate-900 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white rounded-full transition-colors"
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
