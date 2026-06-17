'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContextProvider';
import { useRouter, useParams } from 'next/navigation';
import { Sparkles, Brain, ShieldAlert, Sun, Moon, Activity } from 'lucide-react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';

const STEPS = [
  { label: 'Synthesizing Audio & Text', desc: 'Decoding clinical context and intent' },
  { label: 'ISBAR Mapping', desc: 'Structuring into clinical guidelines' },
  { label: 'Risk Intelligence', desc: 'Scanning for emerging risk flags' },
  { label: 'Task Delegation', desc: 'Creating actionable items for carers' },
  { label: 'Final Verification', desc: 'Validating clinical safety constraints' }
];

export default function ProcessHandover() {
  const { user, facility, isLoading: authLoading } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const router = useRouter();
  const params = useParams();
  const residentId = params.id as string;

  const [activeStep, setActiveStep] = useState(0);
  const [error, setError] = useState('');
  const orbRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    if (orbRef.current && !error) {
      // Siri-like organic breathing & morphing
      gsap.to('.orb-layer-1', {
        scale: 1.15, rotate: 90, duration: 4, yoyo: true, repeat: -1, ease: 'sine.inOut'
      });
      gsap.to('.orb-layer-2', {
        scale: 1.25, rotate: -90, duration: 5, yoyo: true, repeat: -1, ease: 'sine.inOut', delay: 0.5
      });
      gsap.to('.orb-layer-3', {
        scale: 1.1, rotate: 180, duration: 6, yoyo: true, repeat: -1, ease: 'sine.inOut', delay: 1
      });
    }
  }, { dependencies: [error] });

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!residentId || !facility) return;

    const rawInput = sessionStorage.getItem('handover_raw_input');
    
    if (!rawInput) {
      router.push(`/resident/${residentId}/input`);
      return;
    }

    const shiftType = sessionStorage.getItem('handover_shift_type') || 'morning';
    const shiftDate = sessionStorage.getItem('handover_shift_date') || new Date().toISOString().split('T')[0];
    const inputMethod = sessionStorage.getItem('handover_input_method') || 'text';

    // Dynamic processing step increment
    const interval = setInterval(() => {
      setActiveStep((prev) => (prev < 4 ? prev + 1 : prev));
    }, 1200);

    const callApi = async () => {
      try {
        const res = await fetch('/api/generate-handover', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            residentId, 
            rawInput, 
            facilityId: facility.id,
            staffId: user?.id,
            shiftType,
            shiftDate,
            inputMethod
          })
        });

        const data = await res.json();

        if (!res.ok || !data.success) {
          throw new Error(data.error || 'Failed to generate handover');
        }

        // Store handover ID
        sessionStorage.setItem('handover_db_id', data.handoverId);

        if (data.fallbackEngineUsed) {
          sessionStorage.setItem('handover_fallback', data.usedProvider || 'Fallback Engine');
        } else {
          sessionStorage.removeItem('handover_fallback');
        }

        // Let the animation finish nicely or wait a brief moment
        setTimeout(() => {
          const followupCompleted = sessionStorage.getItem('followup_completed') === 'true';
          if (data.data.follow_up_questions && data.data.follow_up_questions.length > 0 && !followupCompleted) {
            router.push(`/resident/${residentId}/followup`);
          } else {
            sessionStorage.removeItem('followup_completed');
            router.push(`/resident/${residentId}/review`);
          }
        }, 800);
      } catch (err: any) {
        console.error('Generation failed:', err);
        setError(err.message || 'An error occurred during generation.');
      } finally {
        clearInterval(interval);
      }
    };

    const callApiTimeout = setTimeout(() => {
      callApi();
    }, 500); // Small buffer

    return () => {
      clearInterval(interval);
      clearTimeout(callApiTimeout);
    };
  }, [residentId, router]);

  return (
    <div className="min-h-screen bg-transparent text-[#0f172a] dark:text-[#e2e8f0] flex flex-col items-center justify-center p-6 relative transition-colors duration-300">
      {/* Background gridding */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#e2e8f0_1px,transparent_1px),linear-gradient(to_bottom,#e2e8f0_1px,transparent_1px)] dark:bg-[linear-gradient(to_right,#161b30_1px,transparent_1px),linear-gradient(to_bottom,#161b30_1px,transparent_1px)] bg-[size:4rem_4rem] opacity-20 pointer-events-none"></div>

      {/* Dynamic Background Glows */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-500/10 dark:bg-indigo-550/15 rounded-full blur-3xl pointer-events-none animate-pulse duration-[8000ms]"></div>
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-violet-500/10 dark:bg-violet-550/15 rounded-full blur-3xl pointer-events-none animate-pulse duration-[10000ms] delay-1000"></div>

      {/* Theme Toggle Button */}
      <div className="absolute top-6 right-6 z-20">
        <button
          onClick={toggleTheme}
          className="p-2.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 shadow-sm dark:bg-[#0d1226]/80 dark:hover:bg-[#151a3a] dark:border-[#1e295d] transition-all duration-100 text-slate-700 dark:text-slate-350"
          title={theme === 'dark' ? "Switch to Day Mode" : "Switch to Night Mode"}
        >
          {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-indigo-600" />}
        </button>
      </div>

      {/* Loading & Error Glassmorphic Card */}
      <div className="max-w-md w-full bg-white/70 dark:bg-[#0a0d1e]/60 backdrop-blur-2xl border border-slate-200/80 dark:border-[#1e295d]/50 rounded-[32px] p-8 shadow-[0_24px_50px_-12px_rgba(0,0,0,0.1)] dark:shadow-[0_24px_50px_-12px_rgba(0,0,0,0.4)] relative z-10 overflow-hidden">
        
        {error ? (
          <div className="flex flex-col items-center text-center">
            <div className="w-20 h-20 rounded-3xl bg-rose-500/10 border border-rose-500/20 text-rose-500 flex items-center justify-center mb-6 shadow-[0_0_40px_rgba(244,63,94,0.2)]">
              <ShieldAlert className="w-10 h-10" />
            </div>
            <h3 className="text-xl font-bold text-text-primary tracking-tight">Processing Interrupted</h3>
            <p className="text-text-secondary text-sm mt-2 max-w-xs leading-relaxed">{error}</p>
            
            <div className="flex gap-3 mt-8 w-full">
              <button
                onClick={() => router.push(`/resident/${residentId}/input`)}
                className="flex-1 py-3.5 bg-surface-solid hover:bg-surface-hover text-sm font-bold rounded-xl text-text-primary transition-all border border-border shadow-sm"
              >
                Go Back & Edit
              </button>
              <button
                onClick={() => window.location.reload()}
                className="flex-1 py-3.5 bg-rose-500 hover:bg-rose-600 text-sm font-bold rounded-xl text-white transition-all shadow-md shadow-rose-500/20"
              >
                Retry Request
              </button>
            </div>
          </div>
        ) : (
          <div ref={containerRef} className="flex flex-col items-center">
            {/* Siri-Like Morphing Orb */}
            <div ref={orbRef} className="relative w-36 h-36 mb-10 flex items-center justify-center">
              {/* Outer Glow */}
              <div className="absolute inset-[-50%] bg-primary/20 rounded-full blur-3xl animate-pulse duration-[4000ms]"></div>
              
              {/* Orb Layers */}
              <div className="orb-layer-1 absolute inset-0 rounded-full bg-gradient-to-tr from-blue-500 via-indigo-500 to-purple-500 opacity-80 blur-[8px] mix-blend-screen"></div>
              <div className="orb-layer-2 absolute inset-2 rounded-[40%_60%_70%_30%] bg-gradient-to-br from-teal-400 via-blue-500 to-indigo-600 opacity-90 blur-[6px] mix-blend-screen"></div>
              <div className="orb-layer-3 absolute inset-4 rounded-[60%_40%_30%_70%] bg-gradient-to-tl from-purple-600 via-pink-500 to-amber-400 opacity-70 blur-[10px] mix-blend-screen"></div>
              
              {/* Core Sharp Orb */}
              <div className="absolute inset-6 bg-surface-solid/80 backdrop-blur-md rounded-full shadow-[inset_0_0_20px_rgba(255,255,255,0.8)] border border-white/50 flex items-center justify-center z-10">
                <Brain className="w-8 h-8 text-primary animate-pulse" />
              </div>
            </div>

            <div className="text-center mb-8 relative z-10">
              <h3 className="text-xl font-black tracking-tight text-text-primary flex items-center justify-center gap-2">
                <Sparkles className="w-5 h-5 text-primary animate-pulse" />
                Handover Intelligence
              </h3>
              <p className="text-xs font-bold text-text-secondary mt-2 tracking-widest uppercase">
                Synthesizing Clinical Context...
              </p>
            </div>

            {/* Checklist Pipeline Steps */}
            <div className="w-full space-y-3 relative z-10">
              {STEPS.map((step, idx) => {
                const isCompleted = idx < activeStep;
                const isActive = idx === activeStep;
                return (
                  <div
                    key={idx}
                    className={`flex items-center justify-between p-3.5 rounded-2xl border transition-all duration-500 ${
                      isActive 
                        ? 'bg-primary/5 border-primary/20 shadow-[0_4px_20px_rgba(59,130,246,0.1)] scale-[1.02]' 
                        : isCompleted
                        ? 'bg-emerald-500/5 border-emerald-500/20'
                        : 'bg-transparent border-transparent opacity-50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="shrink-0">
                        {isCompleted ? (
                          <div className="w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-sm shadow-emerald-500/30">
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                          </div>
                        ) : isActive ? (
                          <div className="w-6 h-6 rounded-full border-[2.5px] border-primary/20 border-t-primary animate-spin" />
                        ) : (
                          <div className="w-6 h-6 rounded-full bg-surface-solid border border-border flex items-center justify-center">
                            <span className="w-1.5 h-1.5 rounded-full bg-border-solid" />
                          </div>
                        )}
                      </div>
                      <div className="text-left">
                        <h4 className={`text-[13px] font-bold transition-colors ${
                          isActive ? 'text-primary' : isCompleted ? 'text-text-primary' : 'text-text-secondary'
                        }`}>
                          {step.label}
                        </h4>
                      </div>
                    </div>
                    {isActive && (
                      <Activity className="w-4 h-4 text-primary animate-pulse" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
