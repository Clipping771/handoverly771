'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContextProvider';
import { useRouter, useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { ChevronLeft, FileCheck, Brain, Sparkles, Plus, Trash2, ShieldAlert, Sun, Moon, Volume2 } from 'lucide-react';
import Link from 'next/link';
import { addToQueue, clearDraft } from '@/lib/db';
import { useSync } from '@/context/SyncContext';
import toast from 'react-hot-toast';
import { parseUntilDate } from '@/lib/taskUtils';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';

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

interface ShiftTask {
  title: string;
  description: string;
  tags: string[];
  assigned_role?: string;
  clinical_purpose?: string;
  outcome?: string;
  carry_until_date?: string;
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
  const [shiftTasks, setShiftTasks] = useState<ShiftTask[]>([]);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskText, setNewTaskText] = useState('');
  const [newTaskPurpose, setNewTaskPurpose] = useState('');
  const [newTaskCarryDate, setNewTaskCarryDate] = useState('');
  const [urgency, setUrgency] = useState<'critical' | 'attention' | 'routine'>('routine');
  const [riskFlags, setRiskFlags] = useState<string[]>([]);
  const [flagsStatus, setFlagsStatus] = useState<string>('none_detected');

  const [isConfirmed, setIsConfirmed] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [shiftDate, setShiftDate] = useState(() => {
    const now = new Date();
    const localHour = now.getHours();
    const targetDate = new Date(now);
    // 12 AM to 12 PM: Typically Night Shift submission, so date is Yesterday
    if (localHour >= 0 && localHour < 12) {
      targetDate.setDate(targetDate.getDate() - 1);
    }
    const year = targetDate.getFullYear();
    const month = String(targetDate.getMonth() + 1).padStart(2, '0');
    const day = String(targetDate.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  });
  const [shiftType, setShiftType] = useState<'morning' | 'afternoon' | 'night'>(() => {
    const localHour = new Date().getHours();
    // 12 AM to 12 PM: Night Shift submission
    if (localHour >= 0 && localHour < 12) return 'night';
    // 12 PM to 5 PM (17:00): Morning Shift submission
    if (localHour >= 12 && localHour < 17) return 'morning';
    // 5 PM to 12 AM: Afternoon Shift submission
    return 'afternoon';
  });
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
      
      const normalizedTasks: ShiftTask[] = (parsed.shift_tasks || parsed.carer_tasks || []).map((t: any) => {
        if (typeof t === 'string') {
          return { title: 'Action Item', description: t, tags: ['general'], assigned_role: 'carer', clinical_purpose: '', carry_until_date: undefined };
        }
        return {
          title: t.title || 'Action Item',
          description: t.description || '',
          tags: Array.isArray(t.tags) ? t.tags : ['general'],
          assigned_role: t.assigned_role || 'carer',
          clinical_purpose: t.clinical_purpose || '',
          carry_until_date: t.carry_until_date || parseUntilDate(t.description) || parseUntilDate(t.title) || undefined
        };
      });
      setShiftTasks(normalizedTasks);
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

  useGSAP(() => {
    if (activeTab === 'rn') {
      const sections = gsap.utils.toArray('.isbar-section');
      if (sections.length > 0) {
        gsap.fromTo(sections, 
          { y: 20, opacity: 0 }, 
          { y: 0, opacity: 1, duration: 0.4, stagger: 0.1, ease: 'power2.out' }
        );
      }
    }
  }, { dependencies: [activeTab, resident] });

  // ISBAR field editors
  const handleIsbarChange = (field: keyof ISBAR, val: string) => {
    setIsbar((prev) => ({ ...prev, [field]: val }));
  };

  // Shift tasks editors
  const handleTaskTitleChange = (idx: number, val: string) => {
    setShiftTasks((prev) => {
      const updated = [...prev];
      updated[idx] = { ...updated[idx], title: val };
      return updated;
    });
  };

  const handleTaskChange = (idx: number, val: string) => {
    setShiftTasks((prev) => {
      const updated = [...prev];
      updated[idx] = { ...updated[idx], description: val };
      return updated;
    });
  };

  const handleTaskPurposeChange = (idx: number, val: string) => {
    setShiftTasks((prev) => {
      const updated = [...prev];
      updated[idx] = { ...updated[idx], clinical_purpose: val };
      return updated;
    });
  };

  const handleTaskTagToggle = (taskIdx: number, tag: string) => {
    setShiftTasks((prev) => {
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
    setShiftTasks((prev) => [...prev, { 
      title: newTaskTitle.trim(), 
      description: newTaskText.trim(), 
      tags: ['general'], 
      assigned_role: 'carer', 
      clinical_purpose: newTaskPurpose.trim(),
      carry_until_date: newTaskCarryDate || undefined
    }]);
    setNewTaskTitle('');
    setNewTaskText('');
    setNewTaskPurpose('');
    setNewTaskCarryDate('');
  };

  const handleRemoveTask = (idx: number) => {
    setShiftTasks((prev) => prev.filter((_, i) => i !== idx));
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

    try {
      setIsSubmitting(true);
      // Generate a mock device id and version number for MVP
      const deviceId = localStorage.getItem('device_id') || `Device-${Math.floor(Math.random() * 1000)}`;
      localStorage.setItem('device_id', deviceId);

      const isUpdateAction = typeof window !== 'undefined' ? sessionStorage.getItem('handover_is_update') === 'true' : false;

      const handoverRecord = {
        facility_id: facility.id,
        resident_id: residentId,
        submitted_by: user.id,
        raw_input: rawInput,
        rn_summary: isbar,
        rn_summary_original: originalResult.rn_summary,
        shift_tasks: shiftTasks,
        urgency,
        risk_flags: riskFlags,
        flags_status: flagsStatus,
        is_approved: true,
        approved_at: new Date().toISOString(),
        shift_date: shiftDate,
        shift_type: shiftType,
        input_method: inputMethod,
        device_id: deviceId,
        version_number: '1.0.0',
        is_update_action: isUpdateAction
      };

      await addToQueue({
        id: crypto.randomUUID(),
        resident_id: residentId,
        payload: {
          endpoint: '/api/sync-handover',
          method: 'POST',
          body: { handoverRecord, shiftTasks }
        }
      });

      await clearDraft(residentId);
      sessionStorage.removeItem('handover_raw_input');
      sessionStorage.removeItem('handover_input_method');
      sessionStorage.removeItem('handover_api_result');
      sessionStorage.removeItem('handover_is_update');
      localStorage.removeItem(`resident_insights_${residentId}`);

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
      <div className="min-h-screen bg-background flex flex-col items-center justify-center">
        <div className="w-12 h-12 border-[3px] border-teal-accent border-t-transparent rounded-full animate-spin"></div>
        <p className="mt-4 text-text-secondary font-medium text-sm tracking-wide">Loading Draft Summaries...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-text-primary flex flex-col pb-12 relative transition-colors duration-200">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-surface/95 backdrop-blur-xl border-b border-border px-4 py-4 transition-colors duration-200 animate-fade-in-up">
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
              className="p-2.5 rounded-xl bg-surface-solid hover:bg-surface-hover text-text-secondary shadow-sm transition-all duration-100"
              title={theme === 'dark' ? "Switch to Day Mode" : "Switch to Night Mode"}
            >
              {theme === 'dark' ? <Sun className="w-3.5 h-3.5 text-amber-400" /> : <Moon className="w-3.5 h-3.5" />}
            </button>
            <div className="text-right">
              <h1 className="text-sm font-bold text-text-primary tracking-wide">{resident.name}</h1>
              <p className="text-[10px] text-text-secondary font-semibold mt-0.5">Room {resident.room_number}</p>
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
        <div className="mb-6 apple-card p-4 rounded-2xl animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
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

        {/* Shift Details Selectors */}
        <div className="mb-6 apple-card p-5 animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
          <div className="mb-4 flex flex-col sm:flex-row sm:items-center gap-1.5 text-[11px] text-text-secondary bg-surface-solid px-4 py-2.5 rounded-xl border border-border">
            <div>
              <span className="font-semibold text-indigo-600 dark:text-indigo-400">🕐 Auto-selected:</span>
              <span className="ml-1 font-bold text-slate-800 dark:text-slate-200 capitalize">{shiftType} Shift</span>
              <span className="mx-1.5">•</span>
              <span className="font-medium">{new Date(shiftDate + 'T00:00:00').toLocaleDateString([], { day: 'numeric', month: 'short' })}</span>
            </div>
            <span className="text-[10px] text-slate-400 dark:text-slate-500 font-normal sm:ml-auto">If incorrect, please change below ↓</span>
          </div>

          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <label className="text-[10px] font-bold text-text-secondary uppercase tracking-wider block mb-1.5">Shift Date</label>
              <input
                type="date"
                value={shiftDate}
                onChange={(e) => setShiftDate(e.target.value)}
                className="w-full h-11 bg-surface-solid border border-border rounded-xl px-3.5 text-xs focus:outline-none text-text-primary"
              />
            </div>
            <div className="flex-1">
              <label className="text-[10px] font-bold text-text-secondary uppercase tracking-wider block mb-1.5">Shift Type</label>
              <select
                value={shiftType}
                onChange={(e) => setShiftType(e.target.value as any)}
                className="w-full h-11 bg-surface-solid border border-border rounded-xl px-3.5 text-xs focus:outline-none text-text-primary cursor-pointer"
              >
                <option value="morning">Morning Shift</option>
                <option value="afternoon">Afternoon Shift</option>
                <option value="night">Night Shift</option>
              </select>
            </div>
          </div>
        </div>

        {/* Tab Controls */}
        <div className="flex bg-surface-solid p-1 border border-border rounded-xl mb-6 animate-fade-in-up" style={{ animationDelay: '0.3s' }}>
          <button
            onClick={() => setActiveTab('rn')}
            className={`flex-1 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all duration-100 flex items-center justify-center gap-1.5 ${
              activeTab === 'rn' 
                ? 'bg-surface text-teal-accent shadow-sm' 
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            <Brain className="w-4 h-4" />
            RN ISBAR Summary
          </button>
          <button
            onClick={() => setActiveTab('carer')}
            className={`flex-1 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all duration-100 flex items-center justify-center gap-1.5 ${
              activeTab === 'carer' 
                ? 'bg-surface text-teal-accent shadow-sm' 
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            Shift Task List
          </button>
        </div>

        {/* Tab Content */}
        <div className="flex-1 flex flex-col">
          {activeTab === 'rn' ? (
            /* ISBAR Editors */
            <div className="space-y-4">
              {(['identify', 'situation', 'background', 'assessment', 'recommendation'] as const).map((field) => (
                <div key={field} className="isbar-section space-y-1 opacity-0">
                  <label className="text-[10px] font-mono font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 block capitalize">
                    {field.slice(0, 1)} — {field}
                  </label>
                  <textarea
                    value={isbar[field] || ''}
                    onChange={(e) => handleIsbarChange(field, e.target.value)}
                    className="w-full bg-surface-solid border border-border focus:border-teal-accent rounded-xl p-3 text-sm focus:outline-none text-text-primary leading-relaxed min-h-[90px]"
                  />
                </div>
              ))}
            </div>
          ) : (
            /* Shift Tasks Editor */
            <div className="space-y-5">
              <div className="space-y-3">
                <label className="text-[10px] font-mono font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 block">
                  Action Tasks & Tag Classifications
                </label>
                {shiftTasks.map((task, idx) => (
                  <div key={idx} className="flex flex-col gap-3 apple-card p-5 transition-colors duration-200 shadow-sm relative animate-fade-in-up">
                    
                    {/* Top Row: Title/Tagline, Play, Delete */}
                    <div className="flex gap-2.5 items-center justify-between">
                      <div className="flex gap-2 items-center flex-1">
                        <span className="text-xs font-bold text-slate-400 dark:text-slate-500">{idx + 1}.</span>
                        <input
                          type="text"
                          value={task.title}
                          onChange={(e) => handleTaskTitleChange(idx, e.target.value)}
                          className="bg-transparent text-sm focus:outline-none text-text-primary font-bold tracking-tight w-full placeholder-text-secondary"
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
                        className="w-full bg-transparent text-xs focus:outline-none text-text-secondary font-medium resize-none min-h-[45px] leading-relaxed border-l-2 border-border pl-3"
                        placeholder="Task Description..."
                      />
                    </div>

                    {/* Clinical Rationale (hallucination mitigation) */}
                    <div className="pl-5">
                      <div className="text-[9px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse"></span>
                        Clinical Purpose / Rationale (Review required)
                      </div>
                      <input
                        type="text"
                        value={task.clinical_purpose || ''}
                        onChange={(e) => handleTaskPurposeChange(idx, e.target.value)}
                        placeholder="Why is this task needed? (e.g. To prevent dehydration)"
                        className="w-full bg-surface-solid border border-border rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:border-indigo-500 text-text-primary font-medium"
                      />
                    </div>

                    {/* Carry Until Date */}
                    <div className="pl-5 mt-2">
                      <div className="text-[9px] font-bold text-slate-550 dark:text-slate-400 uppercase tracking-wider mb-1">
                        Carry/Repeat Task Until Date (Optional)
                      </div>
                      <input
                        type="date"
                        value={task.carry_until_date || ''}
                        onChange={(e) => {
                          setShiftTasks(prev => {
                            const newTasks = [...prev];
                            newTasks[idx] = { ...newTasks[idx], carry_until_date: e.target.value || undefined };
                            return newTasks;
                          });
                        }}
                        className="w-full bg-surface-solid border border-border rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:border-indigo-500 text-text-primary font-medium"
                      />
                    </div>

                    {/* Bottom Row: Tag Selectors & Role */}
                    <div className="flex flex-wrap items-center gap-2 mt-3 justify-between">
                      <div className="flex flex-wrap items-center gap-2">
                        {AVAILABLE_TAGS.map(tag => (
                          <button
                            key={tag}
                            type="button"
                            onClick={() => handleTaskTagToggle(idx, tag)}
                            className={`px-3 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase transition-colors ${
                              task.tags?.includes(tag)
                                ? TAG_COLORS[tag] || 'bg-slate-200 text-slate-800'
                                : 'bg-slate-100 text-slate-400 hover:bg-slate-200 dark:bg-slate-800/50 dark:text-slate-500 dark:hover:bg-slate-700/50 border border-dashed border-slate-200 dark:border-slate-700'
                            }`}
                          >
                            {tag}
                          </button>
                        ))}
                      </div>
                      <select
                        value={task.assigned_role || 'carer'}
                        onChange={(e) => {
                          setShiftTasks(prev => {
                            const newTasks = [...prev];
                            newTasks[idx].assigned_role = e.target.value;
                            return newTasks;
                          });
                        }}
                        className="bg-slate-100 dark:bg-slate-800/50 border-0 rounded-lg text-[10px] font-bold px-3 py-1.5 focus:ring-2 focus:ring-blue-500/50 dark:text-white uppercase tracking-wider"
                      >
                        <option value="carer">Carer Task</option>
                        <option value="rn">RN Task</option>
                        <option value="all">Any Role</option>
                      </select>
                    </div>

                  </div>
                ))}
              </div>

              {/* Add New Task Form */}
              <div className="bg-surface-solid border border-border p-4.5 rounded-[20px] space-y-3">
                <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-text-secondary block">
                  Add Custom Task Node
                </span>
                <input
                  type="text"
                  placeholder="Task Tagline (e.g. Comfort Checks)"
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  className="w-full h-10 bg-white border border-[#e3e3e3] rounded-xl px-4 text-xs focus:outline-none focus:border-slate-800 dark:focus:border-slate-150 text-slate-900 dark:bg-[#0b0b0d] dark:border-[#202024] dark:text-white font-bold"
                />
                <input
                  type="text"
                  placeholder="Clinical Purpose / Rationale..."
                  value={newTaskPurpose}
                  onChange={(e) => setNewTaskPurpose(e.target.value)}
                  className="w-full h-10 bg-white border border-[#e3e3e3] rounded-xl px-4 text-xs focus:outline-none focus:border-slate-800 dark:focus:border-slate-150 text-slate-900 dark:bg-[#0b0b0d] dark:border-[#202024] dark:text-white font-medium"
                />
                 <div className="flex gap-2">
                  <div className="flex-1 flex flex-col gap-2">
                    <textarea
                      placeholder="Task Description details..."
                      value={newTaskText}
                      onChange={(e) => setNewTaskText(e.target.value)}
                      className="min-h-[50px] bg-white border border-[#e3e3e3] rounded-xl p-3 text-xs focus:outline-none focus:border-slate-800 dark:focus:border-slate-150 text-slate-800 dark:bg-[#0b0b0d] dark:border-[#202024] dark:text-white resize-none"
                    />
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <label className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Carry Until Date (Optional)</label>
                        <input
                          type="date"
                          value={newTaskCarryDate}
                          onChange={(e) => setNewTaskCarryDate(e.target.value)}
                          className="w-full h-9 bg-white border border-[#e3e3e3] rounded-xl px-3 text-xs focus:outline-none focus:border-slate-800 dark:focus:border-slate-150 text-slate-900 dark:bg-[#0b0b0d] dark:border-[#202024] dark:text-white"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={handleAddTask}
                        className="w-11 h-9 self-end bg-slate-800 hover:bg-slate-700 dark:bg-slate-105 dark:hover:bg-white text-white dark:text-slate-900 rounded-xl flex items-center justify-center transition-colors cursor-pointer shrink-0"
                        style={{ color: theme === 'dark' ? '#0b0b0d' : '#ffffff' }}
                      >
                        <Plus className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
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
