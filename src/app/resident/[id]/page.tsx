'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { useRouter, useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { ChevronLeft, Brain, Activity, TrendingUp, AlertTriangle, Play, FileText, Sun, Moon } from 'lucide-react';
import Link from 'next/link';
import ActivityTimeline from '@/components/ActivityTimeline';

interface Resident {
  id: string;
  name: string;
  room_number: string;
  care_level: string;
  dob: string;
}

interface Insights {
  summary: string;
  trends: string[];
  recommendations: string[];
  risk_level: 'Low' | 'Medium' | 'High';
}

export default function ResidentProfile() {
  const { user, facility, isLoading: authLoading } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const router = useRouter();
  const params = useParams();
  const residentId = params.id as string;

  const [resident, setResident] = useState<Resident | null>(null);
  const [insights, setInsights] = useState<Insights | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingInsights, setLoadingInsights] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!residentId) return;

    const fetchResident = async () => {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('residents')
          .select('*')
          .eq('id', residentId)
          .single();

        if (error) throw error;
        setResident(data);
      } catch (err: any) {
        setError(err.message || 'Failed to load resident');
      } finally {
        setLoading(false);
      }
    };

    fetchResident();
  }, [residentId]);

  const generateInsights = async () => {
    if (!residentId) return;
    setLoadingInsights(true);
    
    try {
      const userKeys = {
        anthropicKey: typeof window !== 'undefined' ? localStorage.getItem('user_anthropic_key') || '' : '',
      };

      const res = await fetch('/api/generate-insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ residentId, userKeys })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      
      setInsights(data);
    } catch (err: any) {
      console.error('Failed to generate insights:', err);
    } finally {
      setLoadingInsights(false);
    }
  };

  useEffect(() => {
    if (resident) {
      generateInsights();
    }
  }, [resident]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-[#080b16] flex flex-col items-center justify-center">
        <div className="w-10 h-10 border-2 border-slate-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="mt-4 text-slate-500 dark:text-slate-400 font-mono text-xs tracking-widest uppercase">Loading Profile...</p>
      </div>
    );
  }

  if (error || !resident) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-[#0b0b0d] flex items-center justify-center text-rose-500">
        Error: {error || 'Resident not found'}
      </div>
    );
  }

  const age = new Date().getFullYear() - new Date(resident.dob).getFullYear();

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0b0b0d] text-[#1f1f1f] dark:text-[#e2e8f0] flex flex-col pb-12 transition-colors duration-300">
      
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/80 dark:bg-[#0b0b0d]/80 backdrop-blur-md border-b border-[#e3e3e3] dark:border-[#202024] px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <Link href="/shift" className="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-[#1f1f1f] dark:text-slate-400 dark:hover:text-white transition-colors">
            <ChevronLeft className="w-4 h-4" />
            Back to Registry
          </Link>
          <div className="flex items-center gap-3">
             <button
              onClick={toggleTheme}
              className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-900 text-slate-600 dark:text-slate-400 transition-colors cursor-pointer"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-500" /> : <Moon className="w-4 h-4 text-[#1f1f1f]" />}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto w-full px-6 mt-10">
        
        {/* Resident Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
          <div>
            <div className="flex items-center gap-3 mb-2">
               <span className="text-xs font-bold px-3 py-1 rounded-full bg-slate-200 text-slate-800 dark:bg-[#1c1c21] dark:text-slate-300">
                  Room {resident.room_number}
               </span>
               <span className="text-xs font-bold px-3 py-1 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                  {resident.care_level} Care
               </span>
            </div>
            <h1 className="text-4xl font-normal tracking-tight text-[#1f1f1f] dark:text-white">
              {resident.name} <span className="text-xl text-slate-400 dark:text-slate-500">({age} yrs)</span>
            </h1>
          </div>
          
          <Link
            href={`/resident/${resident.id}/input`}
            className="px-6 py-3 rounded-full bg-violet-600 hover:bg-violet-700 text-white font-semibold text-sm tracking-wide transition-colors flex items-center gap-2 shadow-lg shadow-violet-500/20"
          >
            <Play className="w-4 h-4" />
            Start New Handover
          </Link>
        </div>

        {/* Smart Insights Panel */}
        <section className="bg-white dark:bg-[#121214] border border-violet-200 dark:border-violet-900/50 rounded-[32px] p-8 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-violet-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3"></div>
          
          <div className="flex items-center justify-between mb-8 relative z-10">
             <div className="flex items-center gap-3">
               <div className="w-12 h-12 rounded-2xl bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center">
                 <Brain className="w-6 h-6 text-violet-600 dark:text-violet-400" />
               </div>
               <div>
                 <h2 className="text-xl font-bold text-slate-900 dark:text-white">Smart Insights</h2>
                 <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">AI Analysis of the last 7 days</p>
               </div>
             </div>
             <button
               onClick={generateInsights}
               disabled={loadingInsights}
               className="p-2 rounded-full bg-slate-50 hover:bg-slate-100 dark:bg-[#1c1c21] dark:hover:bg-[#25252b] text-slate-500 transition-colors disabled:opacity-50"
               title="Refresh Insights"
             >
               <Activity className={`w-5 h-5 ${loadingInsights ? 'animate-spin text-violet-500' : ''}`} />
             </button>
          </div>

          {loadingInsights ? (
            <div className="py-12 flex flex-col items-center justify-center text-violet-500">
               <Brain className="w-8 h-8 animate-pulse mb-4" />
               <p className="text-sm font-medium">Analyzing handover history...</p>
            </div>
          ) : insights ? (
            <div className="grid md:grid-cols-2 gap-8 relative z-10">
              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-3 flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    Clinical Summary
                  </h3>
                  <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed bg-slate-50 dark:bg-slate-900/40 p-4 rounded-2xl border border-slate-100 dark:border-[#202024]">
                    {insights.summary}
                  </p>
                </div>
                
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-3 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" />
                    Risk Level
                  </h3>
                  <div className={`inline-flex px-4 py-1.5 rounded-full text-sm font-bold ${
                    insights.risk_level === 'High' ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400' :
                    insights.risk_level === 'Medium' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                    'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                  }`}>
                    {insights.risk_level} Risk
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-3 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4" />
                    Identified Trends
                  </h3>
                  <ul className="space-y-2">
                    {insights.trends.map((trend, i) => (
                      <li key={i} className="text-sm text-slate-700 dark:text-slate-300 flex items-start gap-2">
                        <span className="text-violet-500 mt-1">•</span>
                        <span>{trend}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div>
                  <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-3 flex items-center gap-2">
                    <Activity className="w-4 h-4" />
                    Recommendations
                  </h3>
                  <ul className="space-y-2">
                    {insights.recommendations.map((rec, i) => (
                      <li key={i} className="text-sm text-slate-700 dark:text-slate-300 flex items-start gap-2">
                        <span className="text-violet-500 mt-1">•</span>
                        <span>{rec}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          ) : (
            <div className="py-8 text-center text-slate-500">
              No insights generated yet.
            </div>
          )}
          )}
        </section>

        {/* Activity Timeline */}
        <section className="mt-12 mb-10">
          <h2 className="text-xl font-bold tracking-tight text-[#1f1f1f] dark:text-white mb-6">Activity Timeline</h2>
          <ActivityTimeline residentId={residentId} />
        </section>

      </main>
    </div>
  );
}
