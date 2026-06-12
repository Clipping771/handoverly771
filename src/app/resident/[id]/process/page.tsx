'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { useRouter, useParams } from 'next/navigation';
import { Sparkles, Brain, ShieldAlert, Sun, Moon } from 'lucide-react';

const STEPS = [
  { label: 'Analyze Raw Notes', desc: 'Decoding clinical context and transcripts' },
  { label: 'Map to ISBAR Format', desc: 'Formatting RN Clinical sections' },
  { label: 'Risk Flags Scan', desc: 'Checking safety incidents and flags' },
  { label: 'Synthesize Carer Tasks', desc: 'Drafting carer numbered checklists' },
  { label: 'Final Polish & Assembly', desc: 'Optimizing and validating JSON payload' }
];

export default function ProcessHandover() {
  const { user, facility, isLoading: authLoading } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const router = useRouter();
  const params = useParams();
  const residentId = params.id as string;

  const [activeStep, setActiveStep] = useState(0);
  const [error, setError] = useState('');

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

    // Dynamic processing step increment
    const interval = setInterval(() => {
      setActiveStep((prev) => (prev < 4 ? prev + 1 : prev));
    }, 1200);

    const callApi = async () => {
      try {
        const res = await fetch('/api/generate-handover', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ residentId, rawInput, facilityId: facility.id })
        });

        const data = await res.json();

        if (!res.ok || !data.success) {
          throw new Error(data.error || 'Failed to generate handover');
        }

        // Store API result
        sessionStorage.setItem('handover_api_result', JSON.stringify(data.data));

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
            <div className="w-16 h-16 rounded-2xl bg-rose-50 dark:bg-rose-500/10 border border-rose-100 dark:border-rose-500/20 text-rose-600 dark:text-rose-450 flex items-center justify-center mb-5 animate-bounce">
              <ShieldAlert className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">Generation Failed</h3>
            <p className="text-slate-500 dark:text-slate-400 text-xs mt-2 leading-relaxed max-w-xs">{error}</p>
            
            <div className="flex gap-3 mt-8 w-full">
              <button
                onClick={() => router.push(`/resident/${residentId}/input`)}
                className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 dark:bg-[#141b3a] dark:hover:bg-[#1e295d] text-xs font-semibold rounded-xl text-slate-700 dark:text-slate-250 transition-colors border border-slate-200 dark:border-[#222e69]"
              >
                Go Back & Retry
              </button>
              <button
                onClick={() => router.push('/admin')}
                className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-500 dark:bg-indigo-600 dark:hover:bg-indigo-500 text-xs font-semibold rounded-xl text-white transition-colors shadow-lg shadow-indigo-500/20"
              >
                Admin Settings
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col">
            {/* Pulsing Glowing Aura Orb */}
            <div className="relative w-24 h-24 mb-8 mx-auto flex items-center justify-center">
              <div className="absolute inset-0 bg-indigo-500/20 dark:bg-indigo-500/30 rounded-full blur-xl animate-pulse"></div>
              {/* Rotating outer ring */}
              <div className="absolute inset-0 border-2 border-indigo-500/10 rounded-full"></div>
              <div className="absolute inset-0 border-2 border-indigo-600 dark:border-indigo-500 border-t-transparent border-b-transparent rounded-full animate-spin duration-3000"></div>
              {/* Counter-rotating inner ring */}
              <div className="absolute inset-2 border border-violet-500/30 rounded-full"></div>
              <div className="absolute inset-2 border-2 border-violet-600 dark:border-violet-500 border-r-transparent border-l-transparent rounded-full animate-spin [animation-direction:reverse] duration-2000"></div>
              {/* Core Solid Orb */}
              <div className="absolute inset-4 bg-gradient-to-tr from-indigo-600 to-violet-650 dark:from-indigo-650 dark:to-violet-700 rounded-full flex items-center justify-center shadow-lg shadow-indigo-500/25">
                <Brain className="w-8 h-8 text-white animate-pulse" />
              </div>
            </div>

            <div className="text-center mb-6">
              <h3 className="text-lg font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-1.5 justify-center">
                <Sparkles className="w-4.5 h-4.5 text-indigo-650 dark:text-indigo-400 animate-pulse" />
                AI Synthesis Pipeline
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
                Processing informal notes into ISBAR structured handover drafts.
              </p>
            </div>

            {/* Checklist Pipeline Steps */}
            <div className="space-y-3.5 border-t border-slate-150 dark:border-[#1e295d]/30 pt-6">
              {STEPS.map((step, idx) => {
                const isCompleted = idx < activeStep;
                const isActive = idx === activeStep;
                return (
                  <div
                    key={idx}
                    className={`flex items-start gap-4 p-3 rounded-2xl border transition-all duration-300 ${
                      isActive 
                        ? 'bg-indigo-500/5 dark:bg-indigo-500/10 border-indigo-500/15 dark:border-indigo-500/20 shadow-sm' 
                        : 'border-transparent'
                    }`}
                  >
                    {/* Status Circles */}
                    <div className="mt-0.5 shrink-0">
                      {isCompleted ? (
                        <div className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-[10px] font-bold">
                          ✓
                        </div>
                      ) : isActive ? (
                        <div className="w-5 h-5 rounded-full border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <div className="w-5 h-5 rounded-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 flex items-center justify-center">
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-350 dark:bg-slate-700" />
                        </div>
                      )}
                    </div>

                    {/* Description Text */}
                    <div className="text-left">
                      <h4 className={`text-xs font-bold transition-colors duration-300 ${
                        isActive 
                          ? 'text-indigo-650 dark:text-indigo-400' 
                          : isCompleted 
                          ? 'text-slate-800 dark:text-slate-300' 
                          : 'text-slate-400 dark:text-slate-605'
                      }`}>
                        {step.label}
                      </h4>
                      <p className={`text-[10px] mt-0.5 transition-colors duration-300 ${
                        isActive 
                          ? 'text-slate-500 dark:text-slate-400' 
                          : isCompleted 
                          ? 'text-slate-400 dark:text-slate-500' 
                          : 'text-slate-400/60 dark:text-slate-700'
                      }`}>
                        {step.desc}
                      </p>
                    </div>
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
