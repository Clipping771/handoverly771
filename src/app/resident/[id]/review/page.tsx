'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { useRouter, useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { ChevronLeft, FileCheck, Brain, Sparkles, Plus, Trash2, ShieldAlert, Sun, Moon, Volume2 } from 'lucide-react';
import Link from 'next/link';
import { addToQueue, clearDraft } from '@/lib/db';
import { useSync } from '@/context/SyncContext';
import toast from 'react-hot-toast';

interface Resident {
  id: string;
  name: string;
  room_number: string;
}

interface ISBAR {
  identify: string;
  situation: string;
  background: string;
  assessment: string;
  recommendation: string;
}

interface CarerTask {
  title: string;
  description: string;
  tags: string[];
}

const AVAILABLE_TAGS = ['incidents', 'medication', 'hygiene', 'mobility', 'nutrition', 'general'];

const TAG_COLORS: Record<string, string> = {
  incidents: 'bg-red-500/10 text-red-700 dark:bg-red-500/20 dark:text-red-300 border border-red-500/20',
  medication: 'bg-purple-500/10 text-purple-700 dark:bg-purple-500/20 dark:text-purple-300 border border-purple-500/20',
  hygiene: 'bg-emerald-500/10 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300 border border-emerald-500/20',
  mobility: 'bg-blue-500/10 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300 border border-blue-500/20',
  nutrition: 'bg-amber-500/10 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300 border border-amber-500/20',
  general: 'bg-slate-500/10 text-slate-700 dark:bg-slate-500/20 dark:text-slate-300 border border-slate-500/20',
};

export default function ReviewHandover() {
  const { user, facility, isLoading: authLoading } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const router = useRouter();
  const params = useParams();
  const residentId = params.id as string;

  const [resident, setResident] = useState<Resident | null>(null);
  const [activeTab, setActiveTab] = useState<'rn' | 'carer'>('rn');
  
  // Handover state
  const [rawInput, setRawInput] = useState('');
  const [inputMethod, setInputMethod] = useState<'voice' | 'text'>('text');
  const [originalResult, setOriginalResult] = useState<any>(null);
  const [isbar, setIsbar] = useState<ISBAR>({ identify: '', situation: '', background: '', assessment: '', recommendation: '' });
  const [carerTasks, setCarerTasks] = useState<CarerTask[]>([]);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskText, setNewTaskText] = useState('');
  const [urgency, setUrgency] = useState<'critical' | 'attention' | 'routine'>('routine');
  const [riskFlags, setRiskFlags] = useState<string[]>([]);
  const [flagsStatus, setFlagsStatus] = useState<string>('none_detected');

  const [isConfirmed, setIsConfirmed] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { triggerSync } = useSync();

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!residentId) return;

    // Load data from session storage
    const storedInput = sessionStorage.getItem('handover_raw_input') || '';
    const rawMethod = sessionStorage.getItem('handover_input_method') || 'text';
    const normalizedMethod = rawMethod === 'voice' ? 'voice' : 'text';
    const storedResult = sessionStorage.getItem('handover_api_result');

    setRawInput(storedInput);
    setInputMethod(normalizedMethod);

    if (!storedResult) {
      router.push(`/resident/${residentId}/input`);
      return;
    }

    try {
      const parsed = JSON.parse(storedResult);
      setOriginalResult(parsed);
      setIsbar(parsed.rn_summary);
      
      const normalizedTasks: CarerTask[] = (parsed.carer_tasks || []).map((t: any) => {
        if (typeof t === 'string') {
          return { title: 'Action Item', description: t, tags: ['general'] };
        }
        return {
          title: t.title || 'Action Item',
          description: t.description || '',
          tags: Array.isArray(t.tags) ? t.tags : ['general']
        };
      });
      setCarerTasks(normalizedTasks);
      setUrgency(parsed.urgency || 'routine');
      setRiskFlags(parsed.risk_flags || []);
      setFlagsStatus(parsed.flags_status || 'none_detected');
    } catch (err) {
      router.push(`/resident/${residentId}/input`);
    }
  }, [residentId, router]);

  useEffect(() => {
    if (!residentId) return;

    const fetchResident = async () => {
      const { data } = await supabase
        .from('residents')
        .select('id, name, room_number')
        .eq('id', residentId)
        .single();
      if (data) setResident(data);
    };
    fetchResident();
  }, [residentId]);

  // ISBAR field editors
  const handleIsbarChange = (field: keyof ISBAR, val: string) => {
    setIsbar((prev) => ({ ...prev, [field]: val }));
  };

  // Carer tasks editors
  const handleTaskTitleChange = (idx: number, val: string) => {
    setCarerTasks((prev) => {
      const updated = [...prev];
      updated[idx] = { ...updated[idx], title: val };
      return updated;
    });
  };

  const handleTaskChange = (idx: number, val: string) => {
    setCarerTasks((prev) => {
      const updated = [...prev];
      updated[idx] = { ...updated[idx], description: val };
      return updated;
    });
  };

  const handleTaskTagToggle = (taskIdx: number, tag: string) => {
    setCarerTasks((prev) => {
      const updated = [...prev];
      const currentTags = updated[taskIdx].tags || [];
      if (currentTags.includes(tag)) {
        updated[taskIdx] = {
          ...updated[taskIdx],
          tags: currentTags.filter((t) => t !== tag)
        };
      } else {
        updated[taskIdx] = {
          ...updated[taskIdx],
          tags: [...currentTags, tag]
        };
      }
      return updated;
    });
  };

  const handleAddTask = () => {
    if (!newTaskTitle.trim() || !newTaskText.trim()) return;
    setCarerTasks((prev) => [...prev, { title: newTaskTitle.trim(), description: newTaskText.trim(), tags: ['general'] }]);
    setNewTaskTitle('');
    setNewTaskText('');
  };

  const handleRemoveTask = (idx: number) => {
    setCarerTasks((prev) => prev.filter((_, i) => i !== idx));
  };

  const playTaskAudio = (text: string) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.9;
      window.speechSynthesis.speak(utterance);
    } else {
      alert("Text-to-speech is not supported by your browser.");
    }
  };

  const handleApprove = async () => {
    if (!facility || !user) return;
    if (!isConfirmed) {
      toast.error('You must confirm the accuracy of these notes.');
      return;
    }

    setIsSubmitting(true);

    try {
      const localHour = new Date().getHours();
      let shiftType: 'morning' | 'afternoon' | 'night' = 'morning';
      if (localHour >= 14 && localHour < 22) {
        shiftType = 'afternoon';
      } else if (localHour >= 22 || localHour < 6) {
        shiftType = 'night';
      }

      const todayStr = new Date().toISOString().split('T')[0];

      // Generate a mock device id and version number for MVP
      const deviceId = localStorage.getItem('device_id') || `Device-${Math.floor(Math.random() * 1000)}`;
      localStorage.setItem('device_id', deviceId);

      const handoverRecord = {
        facility_id: facility.id,
        resident_id: residentId,
        submitted_by: user.id,
        raw_input: rawInput,
        rn_summary: isbar,
        rn_summary_original: originalResult.rn_summary,
        carer_tasks: carerTasks,
        urgency,
        risk_flags: riskFlags,
        flags_status: flagsStatus,
        is_approved: true,
        approved_at: new Date().toISOString(),
        shift_date: todayStr,
        shift_type: shiftType,
        input_method: inputMethod,
        device_id: deviceId,
        version_number: '1.0.0'
      };

      await addToQueue({
        id: crypto.randomUUID(),
        resident_id: residentId,
        payload: {
          endpoint: '/api/sync-handover',
          method: 'POST',
          body: { handoverRecord, carerTasks }
        }
      });

      await clearDraft(residentId);
      sessionStorage.removeItem('handover_raw_input');
      sessionStorage.removeItem('handover_input_method');
      sessionStorage.removeItem('handover_api_result');

      // Trigger background sync and wait for it if online
      toast.success('Submitting handover...');
      await triggerSync();

      router.push('/shift');
    } catch (err) {
      console.error('Failed to submit handover:', err);
      toast.error('Failed to save handover. Please try again.');
      setIsSubmitting(false);
    }
  };

  if (authLoading || !user || !resident) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-[#080b16] flex flex-col items-center justify-center">
        <div className="w-10 h-10 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="mt-4 text-slate-500 dark:text-slate-400 font-mono text-xs tracking-widest uppercase">Loading Draft Summaries...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#080b16] text-[#0f172a] dark:text-[#e2e8f0] flex flex-col pb-12 relative transition-colors duration-200">
      {/* Background grids */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#e2e8f0_1px,transparent_1px),linear-gradient(to_bottom,#e2e8f0_1px,transparent_1px)] dark:bg-[linear-gradient(to_right,#161b30_1px,transparent_1px),linear-gradient(to_bottom,#161b30_1px,transparent_1px)] bg-[size:4rem_4rem] opacity-20 pointer-events-none"></div>

      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/90 dark:bg-[#0d1226]/90 backdrop-blur-md border-b border-slate-200 dark:border-[#1e295d] px-4 py-4 transition-colors duration-200">
        <div className="max-w-xl mx-auto flex items-center justify-between">
          <Link 
            href={`/resident/${residentId}/input`} 
            className="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            Edit Note
          </Link>
          <div className="flex items-center gap-3">
            {/* Theme Toggle Button */}
            <button
              onClick={toggleTheme}
              className="p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 shadow-sm transition-all duration-100 dark:bg-[#141b3a] dark:hover:bg-[#1a234b] dark:border dark:border-[#1e295d] dark:text-slate-300"
              title={theme === 'dark' ? "Switch to Day Mode" : "Switch to Night Mode"}
            >
              {theme === 'dark' ? <Sun className="w-3.5 h-3.5 text-amber-400" /> : <Moon className="w-3.5 h-3.5 text-blue-600" />}
            </button>
            <div className="text-right">
              <h1 className="text-sm font-bold text-slate-800 dark:text-white tracking-wide">{resident.name}</h1>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold mt-0.5">Room {resident.room_number}</p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-xl mx-auto w-full px-4 mt-8 flex-1 flex flex-col relative z-10">
        {/* Title */}
        <div className="mb-6">
          <div className="flex items-center gap-1.5 mb-2">
            <span className="w-2 h-2 rounded-full bg-blue-500"></span>
            <span className="text-[10px] font-mono tracking-widest uppercase text-blue-600 dark:text-blue-400 font-bold">Draft Verification</span>
          </div>
          <h2 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">Review Handover</h2>
          <p className="text-slate-500 dark:text-slate-400 text-xs mt-1 font-medium">
            Verify risk triggers and modify clinical text before approving.
          </p>
        </div>

        {/* Risk Flags Indicator */}
        <div className="mb-6 bg-white border border-slate-200 dark:bg-[#0d1226]/60 dark:border-[#1e295d] p-4 rounded-2xl transition-colors duration-200">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[9px] font-mono text-slate-400 dark:text-slate-400 font-bold uppercase tracking-widest">
              Identified Risks:
            </span>
            {riskFlags.length === 0 ? (
              <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                No safety incidents flagged
              </span>
            ) : (
              riskFlags.map((flag) => (
                <span 
                  key={flag}
                  className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-lg bg-red-500/10 text-red-650 border border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20 flex items-center gap-1.5 animate-pulse"
                >
                  <ShieldAlert className="w-3.5 h-3.5" />
                  {flag}
                </span>
              ))
            )}
          </div>
        </div>

        {/* Tab Controls */}
        <div className="flex bg-slate-200/50 p-1 border border-slate-300 rounded-xl mb-6 dark:bg-[#0b0e22]/80 dark:border-[#1c2759]">
          <button
            onClick={() => setActiveTab('rn')}
            className={`flex-1 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all duration-100 flex items-center justify-center gap-1.5 ${
              activeTab === 'rn' 
                ? 'bg-white text-slate-900 shadow-sm dark:bg-[#1e295d] dark:text-white' 
                : 'text-slate-500 hover:text-slate-800 dark:text-slate-500 dark:hover:text-slate-300'
            }`}
          >
            <Brain className="w-4 h-4" />
            RN ISBAR Summary
          </button>
          <button
            onClick={() => setActiveTab('carer')}
            className={`flex-1 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all duration-100 flex items-center justify-center gap-1.5 ${
              activeTab === 'carer' 
                ? 'bg-white text-slate-900 shadow-sm dark:bg-[#1e295d] dark:text-white' 
                : 'text-slate-500 hover:text-slate-800 dark:text-slate-500 dark:hover:text-slate-300'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            Carer Task List
          </button>
        </div>

        {/* Tab Content */}
        <div className="flex-1 flex flex-col">
          {activeTab === 'rn' ? (
            /* ISBAR Editors */
            <div className="space-y-4">
              {(['identify', 'situation', 'background', 'assessment', 'recommendation'] as const).map((field) => (
                <div key={field} className="space-y-1">
                  <label className="text-[10px] font-mono font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 block capitalize">
                    {field.slice(0, 1)} — {field}
                  </label>
                  <textarea
                    value={isbar[field] || ''}
                    onChange={(e) => handleIsbarChange(field, e.target.value)}
                    className="w-full bg-white border border-slate-200 focus:border-blue-500 dark:bg-[#0d1226]/40 dark:border-[#1e295d] rounded-xl p-3 text-sm focus:outline-none dark:text-white leading-relaxed min-h-[90px]"
                  />
                </div>
              ))}
            </div>
          ) : (
            /* Carer Tasks Editor */
            <div className="space-y-5">
              <div className="space-y-3">
                <label className="text-[10px] font-mono font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 block">
                  Action Tasks & Tag Classifications
                </label>
                {carerTasks.map((task, idx) => (
                  <div key={idx} className="flex flex-col gap-3 bg-white border border-[#e3e3e3] dark:bg-[#121214] dark:border-[#202024] p-5 rounded-[20px] transition-colors duration-200 shadow-sm relative">
                    
                    {/* Top Row: Title/Tagline, Play, Delete */}
                    <div className="flex gap-2.5 items-center justify-between">
                      <div className="flex gap-2 items-center flex-1">
                        <span className="text-xs font-bold text-slate-400 dark:text-slate-500">{idx + 1}.</span>
                        <input
                          type="text"
                          value={task.title}
                          onChange={(e) => handleTaskTitleChange(idx, e.target.value)}
                          className="bg-transparent text-sm focus:outline-none text-slate-900 dark:text-white font-bold tracking-tight w-full placeholder-slate-400"
                          placeholder="Task Tagline (e.g. Comfort Checks)"
                        />
                      </div>
                      
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => playTaskAudio(`${task.title}. ${task.description}`)}
                          className="p-1.5 text-slate-400 hover:text-slate-655 dark:text-slate-500 dark:hover:text-white transition-colors cursor-pointer"
                          title="Play Audio (TTS)"
                        >
                          <Volume2 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveTask(idx)}
                          className="p-1.5 text-slate-400 hover:text-rose-655 dark:text-slate-500 dark:hover:text-rose-400 transition-colors cursor-pointer"
                          title="Delete Task"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Middle Row: Description text */}
                    <div className="pl-5">
                      <textarea
                        value={task.description}
                        onChange={(e) => handleTaskChange(idx, e.target.value)}
                        className="w-full bg-transparent text-xs focus:outline-none text-slate-600 dark:text-slate-300 font-medium resize-none min-h-[45px] leading-relaxed border-l-2 border-slate-100 dark:border-slate-800 pl-3"
                        placeholder="Task Description..."
                      />
                    </div>

                    {/* Bottom Row: Tag Selectors */}
                    <div className="flex flex-wrap gap-1.5 pt-2 border-t border-[#f5f5f5] dark:border-[#1c1c1f] pl-5">
                      {AVAILABLE_TAGS.map((tag) => {
                        const isActive = task.tags?.includes(tag);
                        return (
                          <button
                            key={tag}
                            type="button"
                            onClick={() => handleTaskTagToggle(idx, tag)}
                            className={`text-[8.5px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-full transition-all cursor-pointer ${
                              isActive 
                                ? TAG_COLORS[tag] || 'bg-slate-200 text-slate-800' 
                                : 'border border-dashed border-[#e3e3e3] dark:border-[#202024] text-slate-400 dark:text-slate-500 hover:border-slate-400 hover:text-slate-600 dark:hover:text-slate-355 bg-transparent'
                            }`}
                          >
                            {tag}
                          </button>
                        );
                      })}
                    </div>

                  </div>
                ))}
              </div>

              {/* Add New Task Form */}
              <div className="bg-slate-50 dark:bg-[#121214] border border-[#e3e3e3] dark:border-[#202024] p-4.5 rounded-[20px] space-y-3">
                <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 block">
                  Add Custom Task Node
                </span>
                <input
                  type="text"
                  placeholder="Task Tagline (e.g. Comfort Checks)"
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  className="w-full h-10 bg-white border border-[#e3e3e3] rounded-xl px-4 text-xs focus:outline-none focus:border-slate-800 dark:focus:border-slate-150 text-slate-900 dark:bg-[#0b0b0d] dark:border-[#202024] dark:text-white font-bold"
                />
                <div className="flex gap-2">
                  <textarea
                    placeholder="Task Description details..."
                    value={newTaskText}
                    onChange={(e) => setNewTaskText(e.target.value)}
                    className="flex-1 min-h-[50px] bg-white border border-[#e3e3e3] rounded-xl p-3 text-xs focus:outline-none focus:border-slate-800 dark:focus:border-slate-150 text-slate-800 dark:bg-[#0b0b0d] dark:border-[#202024] dark:text-white resize-none"
                  />
                  <button
                    type="button"
                    onClick={handleAddTask}
                    className="w-11 h-11 self-end bg-slate-800 hover:bg-slate-700 dark:bg-slate-105 dark:hover:bg-white text-white dark:text-slate-900 rounded-xl flex items-center justify-center transition-colors cursor-pointer shrink-0"
                    style={{ color: theme === 'dark' ? '#0b0b0d' : '#ffffff' }}
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Urgency Override Selection */}
        <div className="mt-8 border-t border-slate-200 dark:border-[#1e295d]/50 pt-6">
          <label className="text-[10px] font-mono font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 block mb-3">
            Handover Urgency
          </label>
          <div className="grid grid-cols-3 gap-2">
            {(['critical', 'attention', 'routine'] as const).map((level) => (
              <button
                key={level}
                type="button"
                onClick={() => setUrgency(level)}
                className={`py-2 px-4 rounded-xl text-xs font-bold uppercase tracking-wider border capitalize transition-all duration-100 ${
                  urgency === level 
                    ? level === 'critical'
                      ? 'bg-red-50 border-red-500 text-red-750 font-bold dark:bg-red-500/10 dark:border-red-500 dark:text-red-400'
                      : level === 'attention'
                        ? 'bg-amber-50 border-amber-500 text-amber-750 font-bold dark:bg-amber-500/10 dark:border-amber-500 dark:text-amber-400'
                        : 'bg-emerald-50 border-emerald-500 text-emerald-750 font-bold dark:bg-emerald-500/10 dark:border-emerald-500 dark:text-emerald-400'
                    : 'bg-white border-slate-200 text-slate-400 dark:bg-[#0d1226]/40 dark:border-[#1e295d] dark:text-slate-500'
                }`}
              >
                {level}
              </button>
            ))}
          </div>
        </div>

        {/* Approval Lock Button */}
        <div className="mt-8">
          <label className="flex items-start gap-3 p-4 bg-slate-100 border border-slate-300 dark:bg-[#141b3a] dark:border-[#1e295d] rounded-xl cursor-pointer">
            <input 
              type="checkbox" 
              checked={isConfirmed}
              onChange={(e) => setIsConfirmed(e.target.checked)}
              className="mt-0.5 w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-700"
            />
            <div className="flex flex-col">
              <span className="text-sm font-bold text-slate-800 dark:text-slate-200">
                Sign off & verify accuracy
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                I confirm these clinical notes and tasks accurately represent the resident's condition for this shift.
              </span>
            </div>
          </label>

          <button
            onClick={handleApprove}
            disabled={isSubmitting || !isConfirmed}
            className="w-full h-12 mt-4 bg-blue-600 hover:bg-blue-500 active:scale-[0.99] text-white text-xs font-bold tracking-wider uppercase rounded-xl shadow-lg shadow-blue-600/15 disabled:opacity-50 transition-all duration-100 flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <>
                <FileCheck className="w-4.5 h-4.5" />
                Approve & Publish Handover
              </>
            )}
          </button>
        </div>
      </main>
    </div>
  );
}
