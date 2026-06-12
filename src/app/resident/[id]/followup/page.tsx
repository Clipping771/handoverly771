'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { useRouter, useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Mic, MicOff, AlertTriangle, ArrowRight, ChevronLeft, Sun, Moon, Sparkles } from 'lucide-react';
import Link from 'next/link';

interface Resident {
  id: string;
  name: string;
  room_number: string;
}

export default function FollowUp() {
  const { user, isLoading: authLoading } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const router = useRouter();
  const params = useParams();
  const residentId = params.id as string;

  const [resident, setResident] = useState<Resident | null>(null);
  const [questions, setQuestions] = useState<string[]>([]);
  const [answers, setAnswers] = useState<string[]>([]);
  const [isListeningIdx, setIsListeningIdx] = useState<number | null>(null);
  const [recognitionError, setRecognitionError] = useState('');
  
  const recognitionRef = useRef<any>(null);
  const listeningIdxRef = useRef<number | null>(null);

  useEffect(() => {
    if (!authLoading && !user) router.push('/login');
  }, [user, authLoading, router]);

  useEffect(() => {
    const storedResult = sessionStorage.getItem('handover_api_result');
    const rawInput = sessionStorage.getItem('handover_raw_input');

    if (!storedResult || !rawInput) {
      router.push(`/resident/${residentId}/input`);
      return;
    }

    try {
      const parsed = JSON.parse(storedResult);
      if (parsed.follow_up_questions && parsed.follow_up_questions.length > 0) {
        setQuestions(parsed.follow_up_questions);
        setAnswers(new Array(parsed.follow_up_questions.length).fill(''));
      } else {
        router.push(`/resident/${residentId}/review`);
      }
    } catch {
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

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const rec = new SpeechRecognition();
        rec.continuous = false;
        rec.interimResults = false;
        rec.lang = 'en-AU';
        rec.onresult = (event: any) => {
          const text = event.results[0][0].transcript;
          if (listeningIdxRef.current !== null) {
            setAnswers((prev) => {
              const updated = [...prev];
              updated[listeningIdxRef.current!] = (updated[listeningIdxRef.current!] + ' ' + text).trim();
              return updated;
            });
          }
        };
        rec.onerror = (event: any) => {
          console.error(event.error);
          setRecognitionError('Microphone error. Please type your answer instead.');
          setIsListeningIdx(null);
          listeningIdxRef.current = null;
        };
        rec.onend = () => {
          setIsListeningIdx(null);
          listeningIdxRef.current = null;
        };
        recognitionRef.current = rec;
      }
    }
  }, []);

  const toggleListening = (idx: number) => {
    setRecognitionError('');
    if (!recognitionRef.current) {
      setRecognitionError('Speech recognition is not supported in this browser.');
      return;
    }
    if (isListeningIdx === idx) {
      recognitionRef.current.stop();
      setIsListeningIdx(null);
      listeningIdxRef.current = null;
    } else {
      if (isListeningIdx !== null) {
        recognitionRef.current.stop();
      }
      listeningIdxRef.current = idx;
      setIsListeningIdx(idx);
      try { recognitionRef.current.start(); } catch { 
        setIsListeningIdx(null); 
        listeningIdxRef.current = null;
      }
    }
  };

  const handleAnswerChange = (idx: number, text: string) => {
    setAnswers((prev) => {
      const updated = [...prev];
      updated[idx] = text;
      return updated;
    });
  };

  const handleNext = () => {
    const rawInput = sessionStorage.getItem('handover_raw_input') || '';
    let appendedNote = rawInput;
    questions.forEach((q, idx) => {
      const ans = answers[idx]?.trim();
      if (ans) appendedNote += `\nClarification Q: ${q}\nAnswer: ${ans}`;
    });
    sessionStorage.setItem('handover_raw_input', appendedNote);
    sessionStorage.setItem('handover_input_method', 'voice');
    sessionStorage.setItem('followup_completed', 'true');
    router.push(`/resident/${residentId}/process`);
  };

  const handleSkip = () => {
    router.push(`/resident/${residentId}/review`);
  };

  if (authLoading || !user || !resident) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-slate-500 dark:text-slate-400">Loading clarification...</p>
        </div>
      </div>
    );
  }

  const answeredCount = answers.filter(a => a.trim()).length;

  return (
    <div className="min-h-screen bg-background flex flex-col transition-colors duration-300">
      
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/40 dark:bg-[#0a0a0c]/40 backdrop-blur-2xl border-b border-slate-200/60 dark:border-white/5 px-6 py-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <Link
            href={`/resident/${residentId}/input`}
            className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            Back to Notes
          </Link>

          <div className="flex items-center gap-3">
            <button
              onClick={toggleTheme}
              className="w-8 h-8 rounded-full bg-slate-100 dark:bg-white/5 flex items-center justify-center transition-colors"
            >
              {theme === 'dark' ? <Sun className="w-3.5 h-3.5 text-amber-400" /> : <Moon className="w-3.5 h-3.5 text-slate-600" />}
            </button>

            <div className="text-right">
              <p className="text-sm font-semibold text-slate-900 dark:text-white">{resident.name}</p>
              <p className="text-[10px] text-slate-400 font-medium">Room {resident.room_number}</p>
            </div>
          </div>
        </div>
      </header>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto pb-32">
        <main className="max-w-2xl mx-auto w-full px-6 py-8">

          {/* Alert Banner */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-200/60 dark:border-amber-500/20 p-5 mb-8">
            <div className="absolute top-0 right-0 w-32 h-32 bg-amber-400/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl" />
            <div className="flex gap-4 relative">
              <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-500/20 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-amber-900 dark:text-amber-300">Mandatory Clarification Required</h2>
                <p className="text-xs text-amber-700/80 dark:text-amber-400/70 mt-1 leading-relaxed">
                  The AI Risk Engine detected a potential safety incident but critical details are missing. Please answer the questions below before regenerating.
                </p>
              </div>
            </div>
          </div>

          {/* Progress Indicator */}
          <div className="flex items-center gap-3 mb-6">
            <div className="flex-1 h-1.5 bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-violet-500 to-indigo-500 rounded-full transition-all duration-500"
                style={{ width: `${questions.length > 0 ? (answeredCount / questions.length) * 100 : 0}%` }}
              />
            </div>
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 shrink-0">
              {answeredCount}/{questions.length} answered
            </span>
          </div>

          {recognitionError && (
            <div className="mb-5 p-3.5 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200/60 dark:border-rose-500/20 text-rose-700 dark:text-rose-400 text-xs font-medium">
              {recognitionError}
            </div>
          )}

          {/* Questions */}
          <div className="space-y-4">
            {questions.map((q, idx) => {
              const isAnswered = !!answers[idx]?.trim();
              const isActive = isListeningIdx === idx;
              return (
                <div
                  key={idx}
                  className={`relative bg-white dark:bg-white/[0.03] border rounded-2xl p-5 transition-all duration-200 ${
                    isActive
                      ? 'border-violet-300 dark:border-violet-500/50 shadow-lg shadow-violet-500/10'
                      : isAnswered
                      ? 'border-emerald-200 dark:border-emerald-500/30'
                      : 'border-slate-200/60 dark:border-white/8'
                  }`}
                >
                  {/* Question number badge */}
                  <div className="flex items-start gap-3 mb-3">
                    <span className={`shrink-0 w-6 h-6 rounded-full text-[10px] font-bold flex items-center justify-center mt-0.5 ${
                      isAnswered ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400' : 'bg-slate-100 dark:bg-white/5 text-slate-500'
                    }`}>
                      {isAnswered ? '✓' : idx + 1}
                    </span>
                    <label className="text-sm font-semibold text-slate-800 dark:text-white leading-relaxed">
                      {q}
                    </label>
                  </div>

                  <div className="flex gap-2.5 ml-9">
                    <input
                      type="text"
                      value={answers[idx] || ''}
                      onChange={(e) => handleAnswerChange(idx, e.target.value)}
                      placeholder="Type your answer..."
                      className="flex-1 h-11 bg-slate-50 dark:bg-white/[0.04] border border-slate-200/80 dark:border-white/8 rounded-xl px-4 text-sm focus:outline-none focus:border-violet-400 dark:focus:border-violet-500 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => toggleListening(idx)}
                      className={`w-11 h-11 rounded-xl flex items-center justify-center border transition-all duration-200 shrink-0 ${
                        isActive
                          ? 'bg-rose-500 border-rose-500 text-white shadow-lg shadow-rose-500/30 animate-pulse'
                          : 'bg-slate-50 dark:bg-white/[0.04] border-slate-200 dark:border-white/8 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'
                      }`}
                    >
                      {isActive ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                    </button>
                  </div>

                  {isActive && (
                    <div className="absolute bottom-3 right-4 flex items-center gap-1.5 pointer-events-none">
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping" />
                      <span className="text-[10px] text-rose-500 font-bold uppercase tracking-wider">Listening...</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </main>
      </div>

      {/* Sticky Bottom Action Bar — Always Visible */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-white/40 dark:bg-[#0a0a0c]/40 backdrop-blur-2xl border-t border-slate-200/60 dark:border-white/5 px-6 py-4">
        <div className="max-w-2xl mx-auto flex gap-3">
          <Link
            href={`/resident/${residentId}/input`}
            className="px-4 h-12 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-500 dark:text-slate-400 text-xs font-semibold flex items-center justify-center transition-all hover:bg-slate-50 dark:hover:bg-white/8 shrink-0"
          >
            Cancel
          </Link>
          <button
            onClick={handleSkip}
            className="flex-1 h-12 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 hover:bg-slate-50 dark:hover:bg-white/8 text-slate-700 dark:text-slate-300 text-xs font-semibold flex items-center justify-center transition-all cursor-pointer"
          >
            Skip Clarification
          </button>
          <button
            onClick={handleNext}
            className="flex-1 h-12 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-lg shadow-indigo-600/25 transition-all duration-200 active:scale-[0.98] cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5" />
            Regenerate
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
