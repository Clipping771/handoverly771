'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { useRouter, useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Mic, MicOff, ChevronLeft, Sparkles, AlertCircle, Sun, Moon, Settings, Plus, Trash2, Save } from 'lucide-react';
import Link from 'next/link';
import { saveDraft, getDraft, clearDraft } from '@/lib/db';

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
  const { user, facility, isLoading: authLoading } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const router = useRouter();
  const params = useParams();
  const residentId = params.id as string;

  const [resident, setResident] = useState<Resident | null>(null);
  const [loadingResident, setLoadingResident] = useState(true);
  
  const [tasks, setTasks] = useState<TaskNode[]>([
    { id: Date.now().toString(), tag: '', description: '' }
  ]);
  const [activeMicNodeId, setActiveMicNodeId] = useState<string | null>(null);
  const [interimText, setInterimText] = useState('');
  const [recognitionError, setRecognitionError] = useState('');
  const [enhancingNodeId, setEnhancingNodeId] = useState<string | null>(null);
  const [aiProvider, setAiProvider] = useState<'auto' | 'anthropic' | 'openrouter' | 'groq' | 'ollama' | 'mock'>('auto');

  const recognitionRef = useRef<any>(null);
  const activeMicRef = useRef<string | null>(null);
  const tasksRef = useRef<TaskNode[]>([]);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<BlobPart[]>([]);
  const [isUsingFallback, setIsUsingFallback] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [lastSaved, setLastSaved] = useState<number | null>(null);

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
  }, []);

  useEffect(() => {
    activeMicRef.current = activeMicNodeId;
  }, [activeMicNodeId]);

  useEffect(() => {
    tasksRef.current = tasks;
  }, [tasks]);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    } else if (user && user.role === 'carer') {
      router.push('/shift');
    }
  }, [user, authLoading, router]);

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
          } else {
            console.log('Falling back to robust cloud transcription...');
            setIsUsingFallback(true);
          }
          setActiveMicNodeId(null);
          setInterimText('');
        };

        rec.onend = () => {
          if (!isUsingFallback) {
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
    const task = tasksRef.current.find(t => t.id === nodeId);
    if (!task || !task.description.trim()) return;

    setEnhancingNodeId(nodeId);
    try {
      const userKeys = {
        anthropicKey: typeof window !== 'undefined' ? localStorage.getItem('user_anthropic_key') || '' : '',
        openrouterKey: typeof window !== 'undefined' ? localStorage.getItem('user_openrouter_key') || '' : '',
        openrouterModel: typeof window !== 'undefined' ? localStorage.getItem('user_openrouter_model') || 'google/gemini-2.5-flash' : 'google/gemini-2.5-flash',
        groqKey: typeof window !== 'undefined' ? localStorage.getItem('user_groq_key') || '' : '',
        groqModel: typeof window !== 'undefined' ? localStorage.getItem('user_groq_model') || 'llama-3.3-70b-versatile' : 'llama-3.3-70b-versatile',
      };

      const res = await fetch('/api/enhance-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: task.description, userKeys })
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
          recognitionRef.current.start();
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
      <div className="min-h-screen bg-slate-50 dark:bg-[#080b16] flex flex-col items-center justify-center">
        <div className="w-10 h-10 border-2 border-slate-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="mt-4 text-slate-500 dark:text-slate-400 font-mono text-xs tracking-widest uppercase">Loading Registry Profile...</p>
      </div>
    );
  }

  if (!resident) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-[#080b16] flex flex-col items-center justify-center p-4 text-center">
        <AlertCircle className="w-12 h-12 text-rose-500 mb-3" />
        <h3 className="text-lg font-bold">Resident Not Found</h3>
        <Link href="/shift" className="mt-4 text-slate-600 font-semibold hover:underline">
          Return to Shift List
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0b0b0d] text-[#1f1f1f] dark:text-[#e2e8f0] flex flex-col pb-12 relative transition-colors duration-200">
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#e2e8f0_1px,transparent_1px),linear-gradient(to_bottom,#e2e8f0_1px,transparent_1px)] dark:bg-[linear-gradient(to_right,#161b30_1px,transparent_1px),linear-gradient(to_bottom,#161b30_1px,transparent_1px)] bg-[size:4rem_4rem] opacity-10 pointer-events-none"></div>

      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/80 dark:bg-[#0b0b0d]/80 backdrop-blur-md border-b border-[#e3e3e3] dark:border-[#202024] px-6 py-4 transition-colors duration-200">
        <div className="max-w-xl mx-auto flex items-center justify-between">
          <Link 
            href="/shift" 
            className="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-[#1f1f1f] dark:text-slate-400 dark:hover:text-white transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            Shift List
          </Link>
          <div className="flex items-center gap-3">
            <button
              onClick={toggleTheme}
              className="p-2 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 transition-all duration-100 dark:bg-[#121214] dark:hover:bg-[#1c1c21] dark:border dark:border-[#202024] dark:text-slate-350 cursor-pointer"
              title={theme === 'dark' ? "Switch to Day Mode" : "Switch to Night Mode"}
              type="button"
            >
              {theme === 'dark' ? <Sun className="w-3.5 h-3.5 text-amber-500" /> : <Moon className="w-3.5 h-3.5 text-[#1f1f1f]" />}
            </button>

            <div className="text-right">
              <h1 className="text-sm font-semibold text-[#1f1f1f] dark:text-white tracking-tight">{resident.name}</h1>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium mt-0.5">Room {resident.room_number}</p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-xl mx-auto w-full px-4 mt-8 flex-1 flex flex-col relative z-10">
        <div className="mb-6 flex justify-between items-end">
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <span className="w-1.5 h-1.5 rounded-full bg-slate-650 dark:bg-slate-450"></span>
              <span className="text-[10px] font-semibold tracking-wider uppercase text-slate-500 dark:text-slate-400">Node Based Tasks</span>
            </div>
            <h2 className="text-2xl font-normal tracking-tight text-[#1f1f1f] dark:text-white">Record Shift Notes</h2>
          </div>
          
          <button
            type="button"
            onClick={addTaskNode}
            className="flex items-center gap-1.5 px-4 py-2 bg-slate-800 hover:bg-slate-700 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-900 rounded-full text-xs font-semibold tracking-wide transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Add Task
          </button>
        </div>

        {recognitionError && (
          <div className="mb-6 p-4 rounded-[20px] bg-rose-50 border border-rose-100 text-rose-800 dark:bg-rose-955/20 dark:border-rose-900/30 dark:text-rose-200 text-xs flex flex-col gap-2.5 shadow-sm relative z-10">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4.5 h-4.5 shrink-0 text-rose-600 dark:text-rose-450" />
              <span className="font-semibold">{recognitionError}</span>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex-1 flex flex-col gap-5">
          {/* Task Nodes List */}
          <div className="flex flex-col gap-4">
            {tasks.map((task, index) => {
              const isListening = activeMicNodeId === task.id;
              const isEnhancing = enhancingNodeId === task.id;
              return (
                <div key={task.id} className={`relative flex flex-col bg-white border focus-within:border-slate-400 dark:bg-[#121214] dark:border-[#202024] rounded-[24px] p-5 transition-colors shadow-sm overflow-hidden group ${isEnhancing ? 'border-violet-300 dark:border-violet-800' : 'border-[#e3e3e3]'}`}>
                  {/* Task Header: Tag Input & Actions */}
                  <div className="flex items-center gap-3 mb-4">
                    <div className="flex-1">
                      <input
                        type="text"
                        value={task.tag}
                        onChange={(e) => updateTask(task.id, 'tag', e.target.value)}
                        placeholder="Tagline (e.g. Pain Assessment)"
                        className="w-full bg-transparent text-sm font-bold placeholder-slate-400 dark:placeholder-slate-500 text-[#1f1f1f] dark:text-white focus:outline-none border-b border-transparent focus:border-slate-300 dark:focus:border-slate-700 pb-1 transition-colors"
                      />
                    </div>
                    
                    {/* Audio Mic Button for this Node */}
                    <button
                      type="button"
                      onClick={() => toggleListening(task.id)}
                      className={`w-10 h-10 shrink-0 rounded-full flex items-center justify-center border transition-all duration-300 cursor-pointer ${
                        isListening 
                          ? 'bg-rose-600 border-rose-600 text-white shadow-md shadow-rose-600/20 animate-pulse' 
                          : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border-transparent text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                    </button>

                    {/* Delete Node Button */}
                    <button
                      type="button"
                      onClick={() => removeTaskNode(task.id)}
                      className="w-10 h-10 shrink-0 rounded-full flex items-center justify-center bg-rose-50 text-rose-600 hover:bg-rose-100 dark:bg-rose-950/30 dark:text-rose-400 dark:hover:bg-rose-900/50 transition-colors cursor-pointer"
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
                      className={`w-full bg-transparent text-sm resize-y focus:outline-none placeholder-slate-400 dark:placeholder-slate-600 text-[#1f1f1f] dark:text-slate-300 leading-relaxed min-h-[80px] transition-opacity ${isEnhancing ? 'opacity-40' : 'opacity-100'}`}
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
              className="w-full h-14 bg-slate-800 hover:bg-slate-700 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-[#0b0b0d] text-sm font-semibold tracking-wider uppercase rounded-full shadow-md shadow-slate-200/50 dark:shadow-none disabled:opacity-40 transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer"
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
      </main>
    </div>
  );
}
