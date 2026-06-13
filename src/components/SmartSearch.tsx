'use client';

import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { Send, X, Loader2, CheckCircle2, Trash2, Stethoscope } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import toast from 'react-hot-toast';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import mermaid from 'mermaid';

// Custom Mermaid renderer component
const MermaidChart = ({ chart }: { chart: string }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const { theme } = useTheme();
  
  useEffect(() => {
    if (ref.current && chart) {
      setErrorText(null);
      // Sanitize AI hallucinations (Claude/Llama sometimes generates fancy unicode arrows)
      let sanitizedChart = chart
        // Replace various unicode long arrows or dash-arrows with standard mermaid arrows
        .replace(/[─—–]+>/g, '-->')
        .replace(/⟶/g, '-->')
        .replace(/→/g, '-->')
        // Remove weird triangles that AI appends to labels
        .replace(/\|▷/g, '|')
        .replace(/\|>/g, '|')
        .replace(/▷/g, '')
        // Catch the pattern -->|label|> B and change to -->|label| B
        .replace(/(\|[^|]+\|)\s*[>▷]/g, '$1 ');
        
      try {
        mermaid.initialize({
          startOnLoad: false,
          theme: theme === 'dark' ? 'dark' : 'default',
          themeVariables: {
            fontFamily: 'inherit',
            primaryColor: theme === 'dark' ? '#0d9488' : '#2dd4bf', // Teal matching Handoverly brand
            primaryTextColor: theme === 'dark' ? '#f8fafc' : '#0f172a',
            primaryBorderColor: theme === 'dark' ? '#115e59' : '#99f6e4',
            lineColor: theme === 'dark' ? '#475569' : '#94a3b8',
            secondaryColor: theme === 'dark' ? '#4f46e5' : '#6366f1',
            tertiaryColor: theme === 'dark' ? '#1e293b' : '#f8fafc',
            background: 'transparent',
            // Specifically for xychart-beta (bar charts)
            titleColor: theme === 'dark' ? '#f8fafc' : '#0f172a',
            xAxisLabelColor: theme === 'dark' ? '#cbd5e1' : '#475569',
            xAxisTitleColor: theme === 'dark' ? '#cbd5e1' : '#475569',
            yAxisLabelColor: theme === 'dark' ? '#cbd5e1' : '#475569',
            yAxisTitleColor: theme === 'dark' ? '#cbd5e1' : '#475569',
            plotColorPalette: theme === 'dark' ? '#2dd4bf,#6366f1,#ec4899' : '#0d9488,#4f46e5,#db2777'
          }
        });
        const id = `mermaid-${Math.random().toString(36).substring(2, 9)}`;
        
        // mermaid.render can throw synchronously sometimes or return a rejected promise
        mermaid.render(id, sanitizedChart).then((result) => {
          if (ref.current) {
            ref.current.innerHTML = result.svg;
          }
        }).catch(err => {
          console.error('Mermaid async render error:', err);
          setErrorText(sanitizedChart);
        });
      } catch (err) {
        console.error('Mermaid sync render error:', err);
        setErrorText(sanitizedChart);
      }
    }
  }, [chart]);

  if (errorText) {
    return (
      <div className="w-full my-4 p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl overflow-x-auto">
        <p className="text-xs text-rose-500 font-bold mb-2">Notice: Failed to render diagram, displaying raw data instead:</p>
        <pre className="text-[10px] text-text-primary whitespace-pre-wrap font-mono">{errorText}</pre>
      </div>
    );
  }

  return (
    <>
      <div 
        ref={ref} 
        onClick={() => !errorText && setIsExpanded(true)}
        title="Click to expand graph"
        className="w-full flex justify-center my-4 overflow-x-auto bg-white dark:bg-slate-900/80 p-6 rounded-2xl border border-slate-200 dark:border-white/10 cursor-pointer hover:border-primary/50 transition-all hover:shadow-[0_8px_30px_rgba(0,0,0,0.04)] dark:hover:shadow-[0_8px_30px_rgba(255,255,255,0.02)] relative group"
      >
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-primary/10 text-primary text-[10px] font-semibold px-2 py-1 rounded-md backdrop-blur-sm">
          Click to expand
        </div>
      </div>

      {isExpanded && !errorText && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setIsExpanded(false)}>
          <div className="relative bg-surface p-8 rounded-2xl w-[95vw] max-w-6xl max-h-[90vh] flex flex-col shadow-2xl border border-border animate-in fade-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            <button 
              onClick={() => setIsExpanded(false)} 
              className="absolute top-4 right-4 p-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-full transition-colors z-10"
            >
              <X className="w-5 h-5 text-text-secondary" />
            </button>
            <div className="w-full h-full overflow-auto flex items-center justify-center p-4">
              <div 
                className="w-full flex justify-center [&>svg]:w-full [&>svg]:max-w-4xl [&>svg]:h-auto"
                dangerouslySetInnerHTML={ref.current ? { __html: ref.current.innerHTML } : undefined}
              />
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
};


// Custom Premium Nurse Icon (Sleek minimalist clinical glyph matching user reference)
const NurseIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    {/* Cap (Solid black/current color) */}
    <path d="M8 7c0-2 1.5-3 4-3s4 1 4 3H8z" fill="currentColor" />
    {/* Cross on Cap */}
    <path d="M12 4.5v2M11 5.5h2" stroke="var(--surface-solid)" strokeWidth="1.2" />

    {/* Head Outline (White face inside, black boundary) */}
    <circle cx="12" cy="11.5" r="3.2" fill="var(--surface-solid)" stroke="currentColor" strokeWidth="1.8" />

    {/* Shoulders (Solid black/current color) */}
    <path d="M4.5 20c0-2.8 2.2-4.5 5-4.5h5c2.8 0 5 1.7 5 4.5v1h-15v-1z" fill="currentColor" />

    {/* V-neck (White cutout) */}
    <path d="M10 15.5l2 2.5 2-2.5z" fill="var(--surface-solid)" stroke="none" />

    {/* Stethoscope */}
    <path d="M8.5 15.5c0 1.5 1.5 2.5 3.5 2.5s3.5-1 3.5-2.5" stroke="var(--surface-solid)" strokeWidth="1.2" />
    <circle cx="8" cy="15.2" r="0.6" fill="var(--surface-solid)" stroke="none" />
    <circle cx="16" cy="15.2" r="0.6" fill="var(--surface-solid)" stroke="none" />

    {/* ID Badge on chest */}
    <rect x="14.5" y="17.8" width="2.5" height="1.8" rx="0.3" fill="var(--surface-solid)" stroke="none" />
    <line x1="15" y1="17.2" x2="16.5" y2="17.2" stroke="var(--surface-solid)" strokeWidth="0.8" />
  </svg>
);

export default function SmartSearch() {
  const { facility, user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [messages, setMessages] = useState<{ role: 'user' | 'ai'; content: string; actions?: any[]; pendingAction?: any; requiresConfig?: boolean }[]>([]);
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
      const userKeys = {
        anthropicKey: localStorage.getItem('user_anthropic_key') || '',
        openrouterKey: localStorage.getItem('user_openrouter_key') || '',
        openrouterModel: localStorage.getItem('user_openrouter_model') || 'anthropic/claude-3.5-sonnet',
        groqKey: localStorage.getItem('user_groq_key') || '',
        groqModel: localStorage.getItem('user_groq_model') || 'llama-3.3-70b-versatile',
        ollamaUrl: localStorage.getItem('user_ollama_url') || 'http://127.0.0.1:11434',
        ollamaModel: localStorage.getItem('user_ollama_model') || 'llama3'
      };

      // Extract last 6 messages for context
      const chatHistory = messages
        .filter(m => !m.content.startsWith('[System:'))
        .slice(-6)
        .map(m => ({ role: m.role === 'ai' ? 'assistant' : 'user', content: m.content }));

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          query: userQuery, 
          facilityId: facility.id,
          userRole: user.role,
          userId: user.id,
          userKeys: userKeys,
          chatHistory: chatHistory
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      // Process client-side executed actions immediately
      if (data.executedActions && data.executedActions.length > 0) {
        data.executedActions.forEach((act: any) => {
          if (act.type === 'CHANGE_THEME') {
            if (act.theme !== theme) {
              toggleTheme();
            }
          } else if (act.type === 'NAVIGATE_TO' && act.url) {
            router.push(act.url);
            setIsOpen(false);
          } else if (act.type === 'UPDATE_API_KEY' && act.provider && act.key) {
            localStorage.setItem(`user_${act.provider}_key`, act.key.trim());
            toast.success(`${act.provider} key updated successfully via Chat!`);
          }
        });
      }

      let requiresConfig = false;
      if (data.answer && data.answer.includes('Mock Engine:')) {
        toast.error('AI Engine Error: Please check your API keys.');
        requiresConfig = true;
      }

      setMessages(prev => [...prev, { role: 'ai', content: data.answer, actions: data.executedActions, pendingAction: data.pendingAction, requiresConfig }]);
    } catch (err: any) {
      toast.error(`Smart Assistant Error: ${err.message}`);
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

  const sendAutoMessage = async (text: string) => {
    if (!facility) return;
    const isDirectExecution = text.trim().startsWith('<execute_action>');
    const displayMessage = isDirectExecution ? '[System: Executing confirmed action...]' : text;
    
    setMessages(prev => [...prev, { role: 'user', content: displayMessage }]);
    setIsLoading(true);

    try {
      const userKeys = {
        anthropicKey: localStorage.getItem('user_anthropic_key') || '',
        openrouterKey: localStorage.getItem('user_openrouter_key') || '',
        openrouterModel: localStorage.getItem('user_openrouter_model') || 'anthropic/claude-3.5-sonnet',
        groqKey: localStorage.getItem('user_groq_key') || '',
        groqModel: localStorage.getItem('user_groq_model') || 'llama-3.3-70b-versatile',
        ollamaUrl: localStorage.getItem('user_ollama_url') || 'http://127.0.0.1:11434',
        ollamaModel: localStorage.getItem('user_ollama_model') || 'llama3'
      };

      // Extract last 6 messages for context
      const chatHistory = messages
        .filter(m => !m.content.startsWith('[System:'))
        .slice(-6)
        .map(m => ({ role: m.role === 'ai' ? 'assistant' : 'user', content: m.content }));

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          query: text, 
          facilityId: facility.id,
          userRole: user.role,
          userId: user.id,
          userKeys: userKeys,
          chatHistory: chatHistory
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      if (data.executedActions && data.executedActions.length > 0) {
        let needsRefresh = false;
        data.executedActions.forEach((act: any) => {
          if (act.type === 'CHANGE_THEME') {
            if (act.theme !== theme) {
              toggleTheme();
            }
          } else if (act.type === 'NAVIGATE_TO' && act.url) {
            router.push(act.url);
            setIsOpen(false);
          } else if (act.type === 'UPDATE_API_KEY' && act.provider && act.key) {
            localStorage.setItem(`user_${act.provider}_key`, act.key.trim());
            toast.success(`${act.provider} key updated successfully via Chat!`);
          } else {
            // It's a DB modification (UPDATE_RESIDENT, LOG_OBSERVATION, etc)
            needsRefresh = true;
          }
        });
        
        if (needsRefresh) {
          window.dispatchEvent(new Event('refresh_data'));
        }
      }

      setMessages(prev => [...prev, { role: 'ai', content: data.answer, actions: data.executedActions, pendingAction: data.pendingAction }]);
    } catch (err: any) {
      setMessages(prev => [...prev, { role: 'ai', content: `Error: ${err.message}` }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* Floating Action Button - Glassmorphic Orb matching primary color */}
      <div className={`fixed bottom-6 right-6 z-40 transition-all duration-500 ${isOpen ? 'scale-0 pointer-events-none' : 'scale-100'}`}>
        {/* Pulsing ring behind the button */}
        <div className="absolute inset-0 rounded-full bg-primary/30 animate-ping opacity-75"></div>
        <button
          onClick={() => setIsOpen(true)}
          className="group relative w-16 h-16 rounded-full flex items-center justify-center transition-all duration-300 transform hover:scale-110 active:scale-95 shadow-[0_0_20px_rgba(59,130,246,0.4)] hover:shadow-[0_0_30px_rgba(59,130,246,0.7)] cursor-pointer overflow-hidden border border-white/30"
        >
          {/* Animated Accent Backplane */}
          <div className="absolute inset-0 bg-gradient-to-tr from-primary via-indigo-550 to-blue-500 animate-[spin_6s_linear_infinite] opacity-90 group-hover:opacity-100"></div>
          {/* Glass Overlay */}
          <div className="absolute inset-[2.5px] bg-slate-50 dark:bg-slate-900 rounded-full backdrop-blur-md flex items-center justify-center">
            <NurseIcon className="w-7 h-7 text-primary group-hover:scale-110 transition-transform duration-300" />
          </div>
        </button>
      </div>


      {/* Premium Glassmorphic Chat Drawer */}
      {isOpen && (
        <div className="fixed bottom-6 right-6 w-[430px] h-[640px] max-h-[85vh] bg-white/95 dark:bg-[#0f172a]/85 backdrop-blur-3xl border border-border rounded-[32px] shadow-[0_25px_60px_-15px_rgba(0,0,0,0.3)] dark:shadow-[0_25px_60px_-15px_rgba(0,0,0,0.7)] z-50 flex flex-col overflow-hidden animate-in slide-in-from-bottom-5 duration-300">
          
          {/* Accent colored top strip */}
          <div className="h-[3px] w-full bg-gradient-to-r from-primary via-indigo-500 to-primary"></div>

          {/* Background Ambient Glows */}
          <div className="absolute top-0 left-0 w-48 h-48 bg-primary/5 rounded-full blur-[80px] pointer-events-none -z-10"></div>
          <div className="absolute bottom-0 right-0 w-48 h-48 bg-indigo-500/5 rounded-full blur-[80px] pointer-events-none -z-10"></div>

          {/* Header */}
          <div className="px-5 py-4 flex items-center justify-between text-text-primary border-b border-border bg-white/30 dark:bg-black/10 backdrop-blur-md">
            <div className="flex items-center gap-3">
              {/* Premium AI Icon representation */}
              <div className="relative w-10 h-10 rounded-xl bg-gradient-to-tr from-primary to-indigo-500 p-[1.5px] shadow-sm">
                <div className="w-full h-full rounded-[10px] bg-surface-solid flex items-center justify-center">
                  <NurseIcon className="w-5 h-5 text-primary" />
                </div>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm tracking-tight text-text-primary">Clinical Assistant</span>
                  <span className="flex h-2 w-2 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                </div>
                <p className="text-[9px] font-bold text-text-secondary uppercase tracking-widest mt-0.5">Secured Clinical AI Copilot</p>
              </div>
            </div>
            
            <div className="flex items-center gap-1.5">
              {messages.length > 0 && (
                <button 
                  onClick={clearChat} 
                  className="p-2 bg-white/40 dark:bg-white/5 hover:bg-white/80 dark:hover:bg-white/10 text-text-secondary hover:text-text-primary rounded-xl transition-all border border-border cursor-pointer" 
                  title="Clear Chat History"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
              <button 
                onClick={() => setIsOpen(false)} 
                className="p-2 bg-white/40 dark:bg-white/5 hover:bg-white/80 dark:hover:bg-white/10 text-text-secondary hover:text-text-primary rounded-xl transition-all border border-border cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-transparent custom-scrollbar">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-4 space-y-6">
                
                {/* Nurse Orb */}
                <div className="relative w-24 h-24 flex items-center justify-center">
                  {/* Glowing auras */}
                  <div className="absolute inset-0 bg-teal-accent/20 rounded-full blur-2xl opacity-70 animate-pulse"></div>
                  
                  {/* Faint Static Core Glow */}
                  <div className="absolute inset-0 rounded-full border-[1.5px] border-teal-accent/15"></div>

                  {/* Liquid Orb Orbit (No path line) */}
                  <div 
                    className="absolute inset-[-15px] flex items-center justify-center animate-[spin_4s_linear_infinite]"
                  >
                    <svg viewBox="0 0 100 100" className="w-full h-full overflow-visible">
                      {/* Single glowing light blue liquid orb orbiting the center */}
                      <circle 
                        cx="50" cy="4" 
                        r="4.5" 
                        className="fill-blue-400 drop-shadow-[0_0_12px_rgba(96,165,250,0.9)]" 
                      />
                    </svg>
                  </div>
                  
                  {/* Core Glass Sphere */}
                  <div className="relative w-16 h-16 rounded-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/10 flex items-center justify-center shadow-lg">
                    <NurseIcon className="w-8 h-8 text-primary" />
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-bold text-text-primary tracking-wide">How can I assist you today?</h3>
                  <p className="text-xs text-text-secondary mt-1.5 max-w-[290px] leading-relaxed">
                    Ask questions about recent handovers, create clinical tasks, or log observations directly into the resident timeline.
                  </p>
                </div>
                
                {/* Suggestions List */}
                <div className="w-full pt-4 space-y-2">
                  <p className="text-[9px] font-bold text-text-secondary uppercase tracking-widest text-left pl-1">Suggested Prompts</p>
                  {suggestions.map((s, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSuggestionClick(s.text)}
                      className="w-full text-left p-3.5 text-xs bg-white/30 dark:bg-white/5 border border-border rounded-2xl hover:border-primary/50 text-text-primary hover:bg-white/60 dark:hover:bg-white/10 transition-all font-medium flex items-center gap-2.5 shadow-sm cursor-pointer"
                    >
                      <NurseIcon className="w-3.5 h-3.5 text-primary shrink-0" />
                      <span>{s.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((m, i) => (
                <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in duration-200`}>
                  <div className={`max-w-[85%] rounded-[22px] px-4 py-3 text-[13px] ${
                    m.role === 'user' 
                      ? 'bg-gradient-to-r from-primary to-indigo-600 text-white rounded-br-none shadow-[0_4px_15px_rgba(59,130,246,0.2)] border border-white/10 font-medium' 
                      : 'bg-white/60 dark:bg-white/5 text-text-primary border border-border rounded-bl-none shadow-sm backdrop-blur-md'
                  }`}>
                    <div className="markdown-body max-w-none">
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={{
                          h1: ({node, ...props}) => <h1 className="text-lg font-bold mb-3 mt-4 first:mt-0 tracking-tight" {...props} />,
                          h2: ({node, ...props}) => <h2 className="text-base font-bold mb-2.5 mt-4 first:mt-0 tracking-tight" {...props} />,
                          h3: ({node, ...props}) => <h3 className="text-[14px] font-bold mb-2 mt-3 first:mt-0" {...props} />,
                          table: ({node, ...props}) => <div className="overflow-x-auto my-3 rounded-lg border border-border"><table className="min-w-full text-left border-collapse" {...props} /></div>,
                          th: ({node, ...props}) => <th className="border-b border-border px-3 py-2.5 text-[11px] font-bold uppercase tracking-wider text-text-secondary bg-surface" {...props} />,
                          td: ({node, ...props}) => <td className="border-b border-border px-3 py-2.5 text-[13px]" {...props} />,
                          p: ({node, ...props}) => <p className="mb-3 last:mb-0 leading-relaxed text-[13px] whitespace-pre-wrap break-words" {...props} />,
                          ul: ({node, ...props}) => <ul className="list-disc pl-5 mb-3 text-[13px] space-y-1.5" {...props} />,
                          ol: ({node, ...props}) => <ol className="list-decimal pl-5 mb-3 text-[13px] space-y-1.5" {...props} />,
                          li: ({node, ...props}) => <li className="leading-relaxed mb-1" {...props} />,
                          strong: ({node, ...props}) => <strong className="font-bold" {...props} />,
                          em: ({node, ...props}) => <em className="italic opacity-90" {...props} />,
                          code: ({node, inline, className, children, ...props}: any) => {
                            const match = /language-(\w+)/.exec(className || '');
                            const isMermaid = match && match[1] === 'mermaid';
                            if (isMermaid) {
                              return <MermaidChart chart={String(children).replace(/\n$/, '')} />;
                            }
                            return !inline ? (
                              <pre className="bg-slate-900/5 dark:bg-black/30 p-3 rounded-lg overflow-x-auto border border-border my-3 text-[12px]"><code className={className} {...props}>{children}</code></pre>
                            ) : (
                              <code className="bg-slate-900/5 dark:bg-black/30 px-1.5 py-0.5 rounded text-[12px] text-primary" {...props}>{children}</code>
                            );
                          }
                        }}
                      >
                        {m.content}
                      </ReactMarkdown>
                    </div>

                    {m.pendingAction && (
                      <div className="mt-4 flex items-center gap-3 border-t border-border/50 pt-3">
                        <button 
                          onClick={() => {
                            // Safely extract the action string BEFORE mutating state
                            const actionStr = `<execute_action>\n${JSON.stringify(m.pendingAction, null, 2)}\n</execute_action>`;
                            
                            setMessages(prev => {
                              const updated = [...prev];
                              // Use object spread to avoid mutating the original message reference
                              updated[i] = { ...updated[i], pendingAction: null };
                              return updated;
                            });
                            
                            sendAutoMessage(actionStr);
                          }} 
                          className="bg-primary/10 text-primary px-4 py-2 rounded-xl text-xs font-bold hover:bg-primary hover:text-white transition-colors"
                        >
                          Confirm Update
                        </button>
                        <button 
                          onClick={() => {
                            setMessages(prev => {
                              const updated = [...prev];
                              updated[i] = { ...updated[i], pendingAction: null };
                              return [...updated, { role: 'ai', content: "Action cancelled." }];
                            });
                          }} 
                          className="bg-slate-100 dark:bg-slate-800 text-text-secondary px-4 py-2 rounded-xl text-xs font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    )}

                    {/* Inline Config UI */}
                    {m.requiresConfig && (
                      <div className="mt-4 p-4 rounded-xl bg-slate-900/5 dark:bg-white/5 border border-primary/20">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-xs font-bold">Quick Configuration</p>
                        </div>
                        <p className="text-[10px] text-text-secondary mb-3">Setup your preferred AI Engine instantly without leaving the chat.</p>
                        <div className="flex gap-2">
                          <select 
                            id={`inline-provider-${i}`}
                            className="bg-white dark:bg-black/40 border border-border rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-primary/60 min-w-[100px]"
                          >
                            <option value="groq">Groq</option>
                            <option value="openrouter">OpenRouter</option>
                            <option value="anthropic">Anthropic</option>
                          </select>
                          <input 
                            type="password" 
                            placeholder="Paste API Key here..." 
                            id={`inline-key-${i}`}
                            className="flex-1 min-w-0 bg-white dark:bg-black/40 border border-border rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-primary/60"
                          />
                          <button 
                            onClick={() => {
                              const keyInput = document.getElementById(`inline-key-${i}`) as HTMLInputElement;
                              const providerSelect = document.getElementById(`inline-provider-${i}`) as HTMLSelectElement;
                              
                              if (keyInput && keyInput.value && providerSelect) {
                                const provider = providerSelect.value;
                                localStorage.setItem(`user_${provider}_key`, keyInput.value.trim());
                                toast.success(`${provider} key saved! Try your query again.`);
                                
                                const updatedMessages = [...messages];
                                updatedMessages[i].requiresConfig = false;
                                setMessages(updatedMessages);
                              }
                            }}
                            className="bg-primary shrink-0 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-primary/90 transition-colors"
                          >
                            Save Key
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Executed Smart Actions Visual Cards */}
                    {m.actions && m.actions.length > 0 && (
                      <div className="mt-3 space-y-2 border-t border-border pt-3">
                        {m.actions.map((act, idx) => (
                          <div key={idx} className="bg-green-500/10 border border-green-500/20 rounded-xl p-3 flex items-start gap-2.5">
                            <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center text-white shrink-0 mt-0.5 shadow-sm">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                            </div>
                            <div className="min-w-0">
                              <span className="font-bold text-[10px] text-green-600 dark:text-green-400 uppercase tracking-widest block">
                                {act.type === 'CREATE_TASK' ? 'Task Created' :
                                 act.type === 'LOG_OBSERVATION' ? 'Observation Logged' :
                                 act.type === 'UPDATE_RESIDENT' ? 'Profile Updated' :
                                 act.type === 'REGISTER_RESIDENT' ? 'Resident Registered' :
                                 act.type === 'DELETE_RESIDENT' ? 'Resident Deleted' :
                                 act.type === 'ADD_MEDICATION' ? 'Medication Added' :
                                 act.type === 'CHANGE_THEME' ? 'Theme Changed' :
                                 act.type === 'NAVIGATE_TO' ? 'Navigation' : 
                                 act.type === 'UPDATE_API_KEY' ? 'API Key Updated' : 'Action Executed'}
                              </span>
                              <span className="font-bold text-xs text-text-primary mt-0.5 block">
                                {act.title || act.action_type || act.name || act.medication_name || act.theme || act.url || act.provider || 'Success'}
                              </span>
                              {act.description && (
                                <p className="text-[10px] text-text-secondary mt-1 leading-relaxed">
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
                <div className="bg-white/40 dark:bg-white/5 border border-border rounded-2xl rounded-bl-none p-3 shadow-md flex items-center gap-2.5">
                  <Loader2 className="w-4 h-4 animate-spin text-primary" />
                  <span className="text-xs text-text-secondary font-semibold">Processing clinical database...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <form onSubmit={handleSend} className="p-4 bg-white/20 dark:bg-black/10 border-t border-border backdrop-blur-md">
            <div className="relative flex items-center">
              <textarea
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    if (query.trim() && !isLoading) {
                      handleSend(e);
                    }
                  }
                }}
                placeholder="Ask about a resident... (Shift+Enter for new line)"
                className="w-full min-h-[48px] max-h-[120px] bg-surface-solid border border-border rounded-2xl pl-5 pr-12 py-3 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-text-primary placeholder-text-secondary shadow-inner resize-none scrollbar-hide"
                rows={1}
              />
              <button 
                type="submit" 
                disabled={!query.trim() || isLoading}
                className="absolute right-1.5 w-9 h-9 bg-primary hover:opacity-90 disabled:opacity-50 text-white rounded-full flex items-center justify-center transition-all active:scale-95 shadow-md shadow-primary/20 cursor-pointer"
              >
                <Send className="w-3.5 h-3.5 text-white" />
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}


