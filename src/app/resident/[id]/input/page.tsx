'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContextProvider';
import { useRouter, useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Mic, MicOff, ChevronLeft, ChevronDown, Sparkles, AlertCircle, Sun, Moon, Settings, Plus, Trash2, Save, Clock, Loader2, Pencil, Check, X } from 'lucide-react';
import HeaderThemeSelector from '@/components/HeaderThemeSelector';
import Link from 'next/link';
import { saveDraft, getDraft, clearDraft } from '@/lib/db';
import { getAdelaideTodayStr } from '@/lib/taskUtils';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';

interface Resident {
  id: string;
  name: string;
  room_number: string;
  care_level: string;
}

interface TaskNode {
  id: string;
  tag: string;
  description: string;
}

export default function ResidentInput() {
  const { user, facility, isLoading: authLoading, isCarer } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const router = useRouter();
  const params = useParams();
  const residentId = params.id as string;

  const [resident, setResident] = useState<Resident | null>(null);
  const [loadingResident, setLoadingResident] = useState(true);

  const [tasks, setTasks] = useState<TaskNode[]>([
    { id: Date.now().toString(), tag: '', description: '' }
  ]);
  const [pendingTasks, setPendingTasks] = useState<any[]>([]);
  const [activeMicNodeId, setActiveMicNodeId] = useState<string | null>(null);
  const [interimText, setInterimText] = useState('');
  const [recognitionError, setRecognitionError] = useState('');
  const [enhancingNodeId, setEnhancingNodeId] = useState<string | null>(null);
  const [aiProvider, setAiProvider] = useState<'auto' | 'anthropic' | 'openrouter' | 'groq' | 'ollama' | 'mock'>('auto');
  const [dbUserKeys, setDbUserKeys] = useState<any>(null);
  const [insights, setInsights] = useState<any | null>(null);
  const [loadingInsights, setLoadingInsights] = useState(false);
  const [isInsightsCollapsed, setIsInsightsCollapsed] = useState(false);

  // States for editing pending carryover tasks
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editCarryDate, setEditCarryDate] = useState('');

  const recognitionRef = useRef<any>(null);
  const activeMicRef = useRef<string | null>(null);
  const tasksRef = useRef<TaskNode[]>([]);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<BlobPart[]>([]);
  const [isUsingFallback, setIsUsingFallback] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [lastSaved, setLastSaved] = useState<number | null>(null);

  // Fetch incomplete tasks for carryover reference
  useEffect(() => {
    if (!residentId) return;
    const fetchPendingTasks = async () => {
      try {
        const todayStr = getAdelaideTodayStr();
        const { data, error } = await supabase
          .from('tasks')
          .select('id, title, description, tags, assigned_role, is_completed, carry_until_date')
          .eq('resident_id', residentId)
          .eq('facility_id', facility?.id)
          .or(`is_completed.eq.false,carry_until_date.gte.${todayStr}`);
        if (!error && data) {
          setPendingTasks(data);
        }
      } catch (err) {
        console.error('Failed to fetch pending tasks:', err);
      }
    };
    fetchPendingTasks();
  }, [residentId]);

  // Fetch active insights (uses database-backed cache transparently via API)
  const handleDeletePendingTask = async (taskId: string) => {
    const confirmDelete = window.confirm("Are you sure you want to delete this carryover task?");
    if (!confirmDelete) return;
    try {
      const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', taskId)
        .eq('facility_id', facility?.id);
      if (error) throw error;
      setPendingTasks(prev => prev.filter(t => t.id !== taskId));
    } catch (err) {
      console.error('Failed to delete pending task:', err);
      alert('Failed to delete task.');
    }
  };

  const handleSavePendingTask = async (taskId: string) => {
    try {
      const { error } = await supabase
        .from('tasks')
        .update({
          title: editTitle.trim(),
          description: editDescription.trim(),
          carry_until_date: editCarryDate || null
        })
        .eq('id', taskId)
        .eq('facility_id', facility?.id);
      if (error) throw error;
      setPendingTasks(prev => prev.map(t => {
        if (t.id === taskId) {
          return {
            ...t,
            title: editTitle.trim(),
            description: editDescription.trim(),
            carry_until_date: editCarryDate || undefined
          };
        }
        return t;
      }));
      setEditingTaskId(null);
    } catch (err) {
      console.error('Failed to update pending task:', err);
      alert('Failed to update task.');
    }
  };

  // Fetch active insights (uses database-backed cache transparently via API)
  useEffect(() => {
    if (!residentId) return;

    setLoadingInsights(true);
    const fetchInsights = async () => {
      try {
        const userKeys = {
          anthropicKey: typeof window !== 'undefined' ? localStorage.getItem('user_anthropic_key') || '' : '',
        };
        const res = await fetch('/api/generate-insights', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ residentId, userKeys, forceRefresh: false })
        });
        const data = await res.json();
        if (res.ok) {
          setInsights(data);
        }
      } catch (err) {
        console.error('Failed to fetch insights:', err);
      } finally {
        setLoadingInsights(false);
      }
    };
    fetchInsights();
  }, [residentId]);

  // Load draft on mount
  useEffect(() => {
    if (!residentId) return;
    getDraft(residentId).then(draft => {
      if (draft && draft.tasks && draft.tasks.length > 0) {
        setTasks(draft.tasks);
        setLastSaved(draft.last_modified);
      }
    });
  }, [residentId]);

  // Parse update query parameter on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const isUpdate = urlParams.get('update') === 'true';
      sessionStorage.setItem('handover_is_update', isUpdate ? 'true' : 'false');
      
      const shiftDate = urlParams.get('date');
      const shiftType = urlParams.get('shift');
      if (shiftDate && shiftType) {
        sessionStorage.setItem('handover_shift_date', shiftDate);
        sessionStorage.setItem('handover_shift_type', shiftType);
      } else {
        sessionStorage.removeItem('handover_shift_date');
        sessionStorage.removeItem('handover_shift_type');
      }
    }
  }, []);

  // Autosave interval
  useEffect(() => {
    if (!residentId) return;
    const interval = setInterval(() => {
      const currentTasks = tasksRef.current;
      if (currentTasks.length > 0 && currentTasks.some(t => t.tag || t.description)) {
        saveDraft(residentId, currentTasks).then(() => {
          setLastSaved(Date.now());
        });
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [residentId]);

  // Save before unload
  useEffect(() => {
    const handleBeforeUnload = () => {
      const currentTasks = tasksRef.current;
      if (currentTasks.some(t => t.tag || t.description)) {
        saveDraft(residentId, currentTasks);
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [residentId]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const active = localStorage.getItem('user_active_provider');
      if (active) {
        setAiProvider(active as any);
      }
    }

    if (facility) {
      const fetchAiConfig = async () => {
        try {
          const { data } = await supabase.from('facilities').select('ai_config').eq('id', facility.id).single();
          if (data?.ai_config) {
            if (data.ai_config.keys) setDbUserKeys(data.ai_config.keys);
            if (data.ai_config.activeProvider) setAiProvider(data.ai_config.activeProvider);

          }
        } catch (e) {
          console.error('Failed to fetch facility AI config', e);
        }
      };
      fetchAiConfig();
    }
  }, [facility]);

  useEffect(() => {
    activeMicRef.current = activeMicNodeId;
  }, [activeMicNodeId]);

  useEffect(() => {
    tasksRef.current = tasks;
  }, [tasks]);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    } else if (user && isCarer) {
      router.push('/shift');
    }
  }, [user, authLoading, router, isCarer]);

  useEffect(() => {
    if (!residentId) return;

    const fetchResident = async () => {
      try {
        setLoadingResident(true);
        const { data, error } = await supabase
          .from('residents')
          .select('id, name, room_number, care_level')
          .eq('id', residentId)
          .single();

        if (error) throw error;
        setResident(data);
      } catch (err) {
        console.error('Error fetching resident details:', err);
      } finally {
        setLoadingResident(false);
      }
    };

    fetchResident();
  }, [residentId]);

  // Setup Web Speech API
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const rec = new SpeechRecognition();
        rec.continuous = true;
        rec.interimResults = true;
        rec.lang = 'en-AU';

        rec.onresult = (event: any) => {
          let finalTranscript = '';
          let interimTranscript = '';

          for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
              finalTranscript += event.results[i][0].transcript;
            } else {
              interimTranscript += event.results[i][0].transcript;
            }
          }

          setInterimText(interimTranscript);

          if (finalTranscript && activeMicRef.current) {
            const raw = finalTranscript.trim();
            setTasks((prev) => prev.map(task => {
              if (task.id === activeMicRef.current) {
                return {
                  ...task,
                  description: task.description + (task.description.endsWith(' ') || task.description === '' ? '' : ' ') + raw
                };
              }
              return task;
            }));
          }
        };

        rec.onerror = (event: any) => {
          console.error('Speech recognition error:', event.error);
          if (event.error === 'not-allowed') {
            setRecognitionError('Microphone access denied. Please check your browser permissions.');
          } else if (event.error === 'no-speech') {
            // Keep Web Speech API active, don't fallback to cloud transcript
            setRecognitionError('No speech detected. Please speak clearly into your microphone.');
            setTimeout(() => setRecognitionError(''), 4000);
          } else {
            console.log('Falling back to robust cloud transcription...');
            setIsUsingFallback(true);
          }
          setActiveMicNodeId(null);
          setInterimText('');
        };

        rec.onend = () => {
          if (!isUsingFallback) {
            const currentMic = activeMicRef.current;
            if (currentMic) {
              enhanceNodeText(currentMic);
            }
            setActiveMicNodeId(null);
            setInterimText('');
          }
        };

        recognitionRef.current = rec;
      } else {
        setIsUsingFallback(true);
      }
    }
  }, []);

  const enhanceNodeText = async (nodeId: string) => {
    const task = tasks.find(t => t.id === nodeId);
    if (!task || !task.description.trim()) return;

    setEnhancingNodeId(nodeId);
    try {
      const userKeys = dbUserKeys || {
        anthropicKey: typeof window !== 'undefined' ? localStorage.getItem('user_anthropic_key') || '' : '',
        openrouterKey: typeof window !== 'undefined' ? localStorage.getItem('user_openrouter_key') || '' : '',
        openrouterModel: typeof window !== 'undefined' ? localStorage.getItem('user_openrouter_model') || 'google/gemini-1.5-flash' : 'google/gemini-1.5-flash',
        groqKey: typeof window !== 'undefined' ? localStorage.getItem('user_groq_key') || '' : '',
        groqModel: typeof window !== 'undefined' ? localStorage.getItem('user_groq_model') || 'llama-3.3-70b-versatile' : 'llama-3.3-70b-versatile',
        ollamaUrl: typeof window !== 'undefined' ? localStorage.getItem('user_ollama_url') || '' : '',
        ollamaModel: typeof window !== 'undefined' ? localStorage.getItem('user_ollama_model') || '' : '',
      };

      const otherTasks = tasks.filter(t => t.id !== nodeId && (t.tag.trim() || t.description.trim()));

      const res = await fetch('/api/enhance-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: task.description,
          tag: task.tag,
          resident,
          otherTasks,
          userKeys,
          provider: aiProvider,
          facilityId: facility?.id
        })
      });

      const data = await res.json();
      if (data.refined) {
        setTasks((prev) => prev.map(t =>
          t.id === nodeId ? { ...t, description: data.refined } : t
        ));
      }
    } catch (err) {
      console.error('Text enhancement failed:', err);
    } finally {
      setEnhancingNodeId(null);
    }
  };

  const toggleListening = async (nodeId: string) => {
    setRecognitionError('');

    if (activeMicNodeId === nodeId) {
      // Stop listening
      if (isUsingFallback && mediaRecorderRef.current) {
        mediaRecorderRef.current.stop();
      } else if (recognitionRef.current) {
        recognitionRef.current.stop();
        enhanceNodeText(nodeId);
      }
      setActiveMicNodeId(null);
      setInterimText('');
    } else {
      if (activeMicNodeId) {
        if (isUsingFallback && mediaRecorderRef.current) mediaRecorderRef.current.stop();
        else if (recognitionRef.current) recognitionRef.current.stop();
      }

      setActiveMicNodeId(nodeId);
      setInterimText('');

      if (isUsingFallback) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          const mediaRecorder = new MediaRecorder(stream);
          mediaRecorderRef.current = mediaRecorder;
          audioChunksRef.current = [];

          mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
              audioChunksRef.current.push(event.data);
            }
          };

          mediaRecorder.onstop = async () => {
            const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
            stream.getTracks().forEach(track => track.stop());

            setIsTranscribing(true);
            try {
              const formData = new FormData();
              formData.append('file', audioBlob);
              formData.append('userKeys', JSON.stringify({
                groqKey: localStorage.getItem('user_groq_key') || ''
              }));

              const res = await fetch('/api/transcribe', {
                method: 'POST',
                body: formData
              });

              const data = await res.json();
              if (data.text) {
                setTasks((prev) => prev.map(task => {
                  if (task.id === nodeId) {
                    return {
                      ...task,
                      description: task.description + (task.description.endsWith(' ') || task.description === '' ? '' : ' ') + data.text
                    };
                  }
                  return task;
                }));
                setTimeout(() => enhanceNodeText(nodeId), 100);
              } else if (data.error) {
                setRecognitionError(data.error);
              }
            } catch (err) {
              setRecognitionError('Cloud transcription failed.');
            } finally {
              setIsTranscribing(false);
            }
          };

          mediaRecorder.start();
        } catch (err) {
          setRecognitionError('Microphone access denied.');
          setActiveMicNodeId(null);
        }
      } else {
        try {
          // Abort any active session first to prevent InvalidStateError
          recognitionRef.current.abort();

          setTimeout(() => {
            try {
              recognitionRef.current.start();
            } catch (startErr: any) {
              console.warn('Speech recognition start retry:', startErr.message);
            }
          }, 150);
        } catch (err) {
          console.error('Failed to start speech recognition:', err);
          setIsUsingFallback(true);
          setActiveMicNodeId(null);
        }
      }
    }
  };

  const addTaskNode = () => {
    setTasks((prev) => [...prev, { id: Date.now().toString(), tag: '', description: '' }]);
  };

  const handleApproveVitals = async (vitalsText: string, vitalsData: { temperature: number | null; systolic: number | null; diastolic: number | null }) => {
    if (!resident || !user || !facility) return;

    try {
      // 1. Record activity timeline entry (safety audit trail)
      const { error } = await supabase
        .from('activity_timeline')
        .insert({
          resident_id: resident.id,
          staff_id: user.id,
          facility_id: facility.id,
          action_type: 'vitals_recorded',
          description: `Vitals recorded via Aria speech parser: Temp ${vitalsData.temperature ? `${vitalsData.temperature}°C` : 'N/A'}, BP ${vitalsData.systolic && vitalsData.diastolic ? `${vitalsData.systolic}/${vitalsData.diastolic} mmHg` : 'N/A'}.`,
          metadata: {
            source: 'aria_voice_parser',
            temperature: vitalsData.temperature,
            systolic: vitalsData.systolic,
            diastolic: vitalsData.diastolic
          }
        });

      if (error) throw error;

      // 2. Add as a draft task node
      setTasks(prev => {
        // If there's only one empty node, replace it. Otherwise append.
        const isEmpty = prev.length === 1 && !prev[0].tag && !prev[0].description;
        const newNode = {
          id: Date.now().toString(),
          tag: 'Vitals',
          description: vitalsText
        };
        if (isEmpty) {
          return [newNode];
        } else {
          return [...prev, newNode];
        }
      });

      toast.success('Vitals parsed and appended to handover draft successfully.');
    } catch (err: any) {
      console.error('Failed to save vitals:', err);
      toast.error('Failed to log vitals: ' + err.message);
    }
  };

  const removeTaskNode = (id: string) => {
    if (window.confirm("Are you sure you want to delete this task node? This cannot be undone.")) {
      setTasks((prev) => prev.filter(task => task.id !== id));
      if (activeMicNodeId === id) {
        recognitionRef.current?.stop();
        setActiveMicNodeId(null);
      }
    }
  };

  const updateTask = (id: string, field: 'tag' | 'description', value: string) => {
    setTasks((prev) => prev.map(task => task.id === id ? { ...task, [field]: value } : task));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const validTasks = tasks.filter(t => t.tag.trim() || t.description.trim());
    if (validTasks.length === 0) return;

    let formattedInput = '';
    validTasks.forEach((task) => {
      formattedInput += `[Task Tag: ${task.tag || 'Untitled'}]\n${task.description || 'No description provided.'}\n\n`;
    });

    sessionStorage.setItem('handover_raw_input', formattedInput.trim());
    sessionStorage.setItem('handover_input_method', 'node-based');
    sessionStorage.setItem('handover_ai_provider', aiProvider);

    router.push(`/resident/${residentId}/process`);
  };

  if (authLoading || loadingResident || !user) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center">
        <div className="w-10 h-10 border-2 border-slate-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="mt-4 text-slate-500 dark:text-slate-400 font-mono text-xs tracking-widest uppercase">Loading Registry Profile...</p>
      </div>
    );
  }

  if (!resident) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 text-center">
        <AlertCircle className="w-12 h-12 text-rose-500 mb-3" />
        <h3 className="text-lg font-bold">Resident Not Found</h3>
        <Link href="/shift" className="mt-4 text-slate-600 font-semibold hover:underline">
          Return to Shift List
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-text-primary flex flex-col font-sans transition-colors duration-200 relative">
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#e2e8f0_1px,transparent_1px),linear-gradient(to_bottom,#e2e8f0_1px,transparent_1px)] dark:bg-[linear-gradient(to_right,#161b30_1px,transparent_1px),linear-gradient(to_bottom,#161b30_1px,transparent_1px)] bg-[size:4rem_4rem] opacity-10 pointer-events-none"></div>

      {/* Header */}
      <header className="sticky top-0 z-40 bg-surface/95 backdrop-blur-xl border-b border-border px-6 py-4 transition-colors duration-200 animate-fade-in-up">
        <div className="max-w-xl mx-auto flex items-center justify-between">
          <Link
            href="/shift"
            className="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-[#1f1f1f] dark:text-slate-400 dark:hover:text-white transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            Shift List
          </Link>
          <div className="flex items-center gap-3">
            <HeaderThemeSelector />

            <div className="text-right">
              <h1 className="text-sm font-semibold text-[#1f1f1f] dark:text-white tracking-tight">{resident.name}</h1>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium mt-0.5">Room {resident.room_number}</p>
            </div>
          </div>
        </div>
      </header>

      {/* Premium Dark Mode Ambient Background */}
      <div className="hidden dark:block fixed inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[600px] h-[600px] bg-indigo-600/10 rounded-full blur-[140px] mix-blend-screen" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-[120px] mix-blend-screen" />
      </div>

      {/* Main Container */}
      <main className="max-w-2xl mx-auto w-full px-4 mt-8 mb-12 flex-1 flex flex-col relative z-10">
        <div className="flex-1 bg-white/40 dark:bg-[#0f172a]/40 backdrop-blur-3xl rounded-[32px] border border-white/60 dark:border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.04)] p-6 sm:p-8 flex flex-col custom-scrollbar">
        <div className="mb-6 flex justify-between items-end">
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <span className="w-1.5 h-1.5 rounded-full bg-slate-650 dark:bg-slate-450 shadow-[0_0_8px_rgba(148,163,184,0.6)]"></span>
              <span className="text-[10px] font-bold tracking-wider uppercase text-slate-500 dark:text-slate-400">Node Based Tasks</span>
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-text-primary">Record Shift Notes</h2>
          </div>

          <div className="flex gap-2">
            <motion.button
              whileHover={{ scale: 1.02, y: -1 }}
              whileTap={{ scale: 0.96 }}
              onClick={addTaskNode}
              className="flex items-center gap-1.5 px-4 py-2 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 rounded-xl text-xs font-bold tracking-wide transition-all shadow-sm cursor-pointer outline-none focus:outline-none focus-visible:outline-none"
            >
              <Plus className="w-4 h-4" />
              Add Task
            </motion.button>
          </div>
        </div>

        {recognitionError && (
          <div className="mb-6 p-4 rounded-[20px] bg-rose-50 border border-rose-100 text-rose-800 dark:bg-rose-955/20 dark:border-rose-900/30 dark:text-rose-200 text-xs flex flex-col gap-2.5 shadow-sm relative z-10">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4.5 h-4.5 shrink-0 text-rose-600 dark:text-rose-450" />
              <span className="font-semibold">{recognitionError}</span>
            </div>
          </div>
        )}

        {/* Proactive Safety Alerts & Optimizations Banner */}
        {insights && (insights.proactive_alerts?.length > 0 || insights.optimizations?.length > 0) && (
          <div className="mb-6 p-5 rounded-[24px] border border-violet-200 bg-violet-50/20 dark:border-violet-900/30 dark:bg-violet-950/10 space-y-4">
            <button
              type="button"
              onClick={() => setIsInsightsCollapsed(!isInsightsCollapsed)}
              className="w-full flex items-center justify-between text-xs font-bold text-violet-800 dark:text-violet-400 uppercase tracking-wider font-sans focus:outline-none"
            >
              <div className="flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-violet-500 animate-pulse" />
                Active Clinical Insights & Warnings
              </div>
              <ChevronDown className={`w-4 h-4 text-violet-650 dark:text-violet-400 transition-transform duration-200 ${isInsightsCollapsed ? '' : 'rotate-180'}`} />
            </button>
            
            {!isInsightsCollapsed && (
              <>
                {insights.proactive_alerts?.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-[10px] font-bold text-slate-400 dark:text-slate-550 uppercase tracking-wider">Safety Warnings:</div>
                    {insights.proactive_alerts.map((alert: any) => (
                      <div key={alert.id} className="text-xs text-slate-700 dark:text-slate-300 bg-white dark:bg-[#121214] p-3 rounded-xl border border-rose-100 dark:border-rose-955/40 flex items-start gap-2">
                        <span className="text-rose-500 font-bold shrink-0">⚠️</span>
                        <div>
                          <strong className="text-slate-900 dark:text-white">{alert.message}</strong>
                          <div className="text-[10px] text-slate-400 dark:text-slate-550 mt-0.5">Evidence: {alert.evidence}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {insights.optimizations?.length > 0 && (
                  <div className="space-y-2 pt-2 border-t border-violet-100 dark:border-violet-900/30">
                    <div className="text-[10px] font-bold text-slate-400 dark:text-slate-550 uppercase tracking-wider">Workflow Suggestions:</div>
                    {insights.optimizations.map((opt: any) => (
                      <div key={opt.id} className="text-xs text-slate-700 dark:text-slate-300 bg-white dark:bg-[#121214] p-3 rounded-xl border border-violet-100 dark:border-violet-950/30 flex items-start gap-2">
                        <span className="text-violet-500 font-bold shrink-0">💡</span>
                        <div>
                          <strong className="text-slate-900 dark:text-white">{opt.message}</strong>
                          <div className="text-[10px] text-slate-400 dark:text-slate-550 mt-0.5">Evidence: {opt.evidence}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}
        {/* Pending Tasks Carryover Alert */}
        {pendingTasks.length > 0 && (
          <div className="mb-6 p-5 rounded-[24px] border border-amber-200/60 bg-amber-50/40 dark:border-amber-500/20 dark:bg-[#1A1105]/80 backdrop-blur-xl shadow-lg shadow-amber-500/5">
            <h4 className="text-xs font-bold text-amber-800 dark:text-amber-400 uppercase tracking-wider mb-2.5 flex items-center gap-1.5 font-sans">
              <Clock className="w-4 h-4" />
              Incomplete Tasks Carrying Forward:
            </h4>
            <ul className="space-y-3">
              {pendingTasks.map((t) => {
                const isEditing = editingTaskId === t.id;
                return (
                  <li key={t.id} className="text-xs text-slate-700 dark:text-slate-350 bg-white/50 dark:bg-black/20 p-3.5 rounded-2xl border border-amber-250/30 dark:border-amber-900/20 flex flex-col gap-2 relative">
                    {isEditing ? (
                      <div className="space-y-2.5">
                        <div className="flex gap-2">
                          <div className="flex-1">
                            <label className="text-[9px] font-bold text-amber-800 dark:text-amber-450 uppercase block mb-1">Title / Tagline</label>
                            <input
                              type="text"
                              value={editTitle}
                              onChange={(e) => setEditTitle(e.target.value)}
                              className="w-full h-9 bg-white dark:bg-[#121214] border border-amber-300 dark:border-amber-850 rounded-xl px-3 text-xs text-slate-800 dark:text-slate-100 font-bold focus:outline-none"
                            />
                          </div>
                          <div>
                            <label className="text-[9px] font-bold text-amber-800 dark:text-amber-450 uppercase block mb-1">Carry Until</label>
                            <input
                              type="date"
                              value={editCarryDate}
                              onChange={(e) => setEditCarryDate(e.target.value)}
                              className="h-9 bg-white dark:bg-[#121214] border border-amber-300 dark:border-amber-850 rounded-xl px-3 text-xs text-slate-850 dark:text-slate-100 focus:outline-none"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="text-[9px] font-bold text-amber-800 dark:text-amber-450 uppercase block mb-1">Description / Action Required</label>
                          <textarea
                            value={editDescription}
                            onChange={(e) => setEditDescription(e.target.value)}
                            className="w-full h-24 bg-surface dark:bg-[#121214] border border-amber-300 dark:border-amber-850 rounded-xl p-3 text-xs text-text-primary focus:outline-none resize-none min-h-[50px] leading-relaxed"
                          />
                        </div>
                        <div className="flex gap-2 justify-end">
                          <button
                            type="button"
                            onClick={() => setEditingTaskId(null)}
                            className="h-8 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 cursor-pointer flex items-center justify-center gap-1 text-[11px] font-bold"
                          >
                            <X className="w-3.5 h-3.5" />
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSavePendingTask(t.id)}
                            className="h-8 px-3 rounded-xl bg-amber-600 hover:bg-amber-500 text-white cursor-pointer flex items-center justify-center gap-1 text-[11px] font-bold"
                          >
                            <Check className="w-3.5 h-3.5" />
                            Save
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-2 leading-relaxed">
                          <span className="text-amber-500 mt-0.5">•</span>
                          <div>
                            <span className="font-semibold text-slate-800 dark:text-slate-200">{t.title}</span> - {t.description}
                            {t.carry_until_date && (
                              <span className="text-[9px] font-bold text-amber-700 bg-amber-100 dark:bg-amber-950/40 dark:text-amber-400 px-2 py-0.5 rounded ml-2 inline-block">
                                until {new Date(t.carry_until_date + 'T00:00:00').toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' })}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingTaskId(t.id);
                              setEditTitle(t.title);
                              setEditDescription(t.description || '');
                              setEditCarryDate(t.carry_until_date || '');
                            }}
                            className="p-1.5 text-slate-400 hover:text-indigo-650 dark:hover:text-indigo-400 transition-colors cursor-pointer"
                            title="Edit Carryover Task"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeletePendingTask(t.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-455 transition-colors cursor-pointer"
                            title="Delete Carryover Task"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex-1 flex flex-col gap-5">
          {/* Task Nodes List */}
          <div className="flex flex-col gap-4">
            {tasks.map((task, index) => {
              const isListening = activeMicNodeId === task.id;
              const isEnhancing = enhancingNodeId === task.id;
              return (
                <div key={task.id} className={`group relative apple-card p-5 rounded-[24px] transition-all hover:shadow-[0_8px_30px_rgba(0,0,0,0.04)] overflow-hidden mb-4 ${isEnhancing ? 'border-primary/40 shadow-[0_0_15px_rgba(59,130,246,0.1)]' : ''}`}>
                  {/* Task Header: Tag Input & Actions */}
                  <div className="flex items-center gap-3 mb-4">
                    <div className="flex-1">
                      <input
                        type="text"
                        value={task.tag}
                        onChange={(e) => updateTask(task.id, 'tag', e.target.value)}
                        placeholder="Tagline (e.g. Pain Assessment)"
                        className="w-full bg-transparent text-sm font-bold placeholder-text-secondary text-text-primary focus:outline-none border-b border-transparent focus:border-border pb-1 transition-colors"
                      />
                    </div>

                    {/* Audio Mic Button for this Node */}
                    <button
                      type="button"
                      onClick={() => toggleListening(task.id)}
                      className={`w-10 h-10 shrink-0 rounded-xl flex items-center justify-center border transition-all duration-300 cursor-pointer ${isListening
                          ? 'bg-red-accent border-red-accent text-white shadow-md shadow-red-accent/20 animate-pulse'
                          : 'bg-surface hover:bg-white/60 dark:hover:bg-white/10 border-border text-text-secondary shadow-sm'
                        }`}
                    >
                      {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                    </button>

                    {/* AI Clinical Rewrite Button */}
                    <button
                      type="button"
                      onClick={() => enhanceNodeText(task.id)}
                      disabled={enhancingNodeId === task.id || !task.description.trim()}
                      className="w-10 h-10 shrink-0 rounded-xl flex items-center justify-center bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 shadow-sm disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                      title="AI Clinical Rewrite & Paraphrase"
                    >
                      {enhancingNodeId === task.id ? <Loader2 className="w-4 h-4 animate-spin text-indigo-500" /> : <Sparkles className="w-4 h-4" />}
                    </button>

                    {/* Delete Node Button */}
                    <button
                      type="button"
                      onClick={() => removeTaskNode(task.id)}
                      className="w-10 h-10 shrink-0 rounded-xl flex items-center justify-center bg-red-accent/10 text-red-accent hover:bg-red-accent/20 border border-red-accent/20 transition-colors cursor-pointer"
                      title="Delete Task Node"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Description Textarea */}
                  <div className="relative">
                    <textarea
                      value={task.description}
                      onChange={(e) => updateTask(task.id, 'description', e.target.value)}
                      placeholder="Describe the task, observation, or requirement..."
                      disabled={isEnhancing}
                      className={`w-full bg-transparent text-sm resize-y focus:outline-none placeholder-text-secondary text-text-primary leading-relaxed min-h-[80px] transition-opacity ${isEnhancing ? 'opacity-40' : 'opacity-100'}`}
                    ></textarea>
                    {isEnhancing && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="flex items-center gap-2 bg-white dark:bg-[#1c1c21] border border-violet-200 dark:border-violet-800 rounded-full px-3 py-1.5 shadow-sm">
                          <div className="w-3 h-3 border-2 border-violet-500 border-t-transparent rounded-full animate-spin"></div>
                          <span className="text-[10px] text-violet-600 dark:text-violet-400 font-bold uppercase tracking-wider">✨ Refining text...</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Real-time Interim Voice Transcription */}
                  {isListening && interimText && (
                    <div className="mt-3 mb-1 text-sm text-slate-500 italic bg-slate-50 dark:bg-slate-800/30 p-3 rounded-xl border border-[#e3e3e3] dark:border-[#202024] animate-pulse">
                      {interimText}
                    </div>
                  )}

                  {isListening && (
                    <div className="absolute bottom-3 right-5 flex items-center gap-2 pointer-events-none">
                      <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping"></span>
                      <span className="text-[10px] text-rose-600 dark:text-rose-400 font-bold uppercase tracking-wider">Listening...</span>
                    </div>
                  )}
                  {isTranscribing && task.id === activeMicRef.current && (
                    <div className="absolute bottom-3 right-5 flex items-center gap-2 pointer-events-none">
                      <span className="w-2 h-2 rounded-full bg-blue-500 animate-ping"></span>
                      <span className="text-[10px] text-blue-600 dark:text-blue-400 font-bold uppercase tracking-wider">Transcribing...</span>
                    </div>
                  )}
                  {isEnhancing && (
                    <div className="absolute bottom-3 right-5 flex items-center gap-2 pointer-events-none">
                      <span className="w-2 h-2 rounded-full bg-violet-500 animate-ping"></span>
                      <span className="text-[10px] text-violet-600 dark:text-violet-400 font-bold uppercase tracking-wider">✨ AI Refining...</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="flex flex-col items-center gap-2 mt-2">
            <button
              type="submit"
              disabled={tasks.every(t => !t.tag.trim() && !t.description.trim()) || activeMicNodeId !== null}
              className="w-full h-14 bg-primary hover:bg-primary/90 text-white text-sm font-bold tracking-wider uppercase rounded-2xl shadow-[0_8px_25px_rgba(59,130,246,0.3)] disabled:bg-slate-200 dark:disabled:bg-slate-800 disabled:text-slate-400 disabled:shadow-none transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed"
            >
              <Sparkles className="w-5 h-5" />
              Generate Handover Draft
            </button>

            {lastSaved && (
              <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-medium">
                <Save className="w-3 h-3" />
                Draft saved locally {Math.round((Date.now() - lastSaved) / 1000)} seconds ago
              </div>
            )}
          </div>
        </form>
        </div>
      </main>
    </div>
  );
}
