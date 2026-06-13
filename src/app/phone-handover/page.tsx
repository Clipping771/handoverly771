'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContextProvider';
import { useRouter } from 'next/navigation';
import { PhoneCall, ShieldAlert, CheckCircle2, Mic, Save, ChevronLeft } from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';

export default function PhoneHandoverPage() {
  const { user, facility, authLoading } = useAuth();
  const { theme } = useTheme();
  const router = useRouter();
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    resident_name: '',
    room_number: '',
    sender_name: '',
    sender_facility: '',
    situation: '',
    background: '',
    assessment: '',
    recommendation: '',
    urgency: 'routine'
  });

  useEffect(() => {
    if (!authLoading && !user) router.push('/login');
  }, [user, authLoading, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!facility || !user) return;
    
    setIsSubmitting(true);
    // In a real implementation, we would save this to a `phone_handovers` table 
    // or create a placeholder resident and save to `handovers`.
    // For this prototype, we'll simulate the save.
    
    setTimeout(() => {
      toast.success('Phone handover logged successfully!');
      setIsSubmitting(false);
      router.push('/shift');
    }, 1500);
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0b0b0d] text-slate-900 dark:text-white font-sans selection:bg-indigo-200 dark:selection:bg-indigo-900">
      
      {/* Slim Header for Max Screen Space */}
      <header className="sticky top-0 z-40 bg-white dark:bg-[#121214] border-b border-slate-200 dark:border-white/5 px-6 py-3 flex justify-between items-center shadow-sm">
        <Link href="/shift" className="flex items-center gap-2 text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors text-sm font-bold">
          <ChevronLeft className="w-4 h-4" /> Back
        </Link>
        <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-bold">
          <PhoneCall className="w-4 h-4 animate-pulse" />
          <span className="text-sm tracking-widest uppercase">Live Call Mode</span>
        </div>
        <div className="w-16"></div> {/* Spacer */}
      </header>

      <main className="max-w-3xl mx-auto p-4 sm:p-6 lg:p-8">
        <div className="mb-8">
          <h1 className="text-3xl font-black tracking-tight mb-2">Phone Handover Logger</h1>
          <p className="text-slate-500 font-medium text-sm">Rapid data entry designed for logging verbal handovers from remote facilities or hospitals.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Incoming Details */}
          <section className="bg-white dark:bg-[#121214] border border-slate-200 dark:border-white/5 rounded-2xl p-6 shadow-sm">
            <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4">Caller & Resident Details</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Resident Name</label>
                <input 
                  required
                  type="text" 
                  value={formData.resident_name}
                  onChange={(e) => setFormData({...formData, resident_name: e.target.value})}
                  className="w-full h-12 px-4 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-black/20 text-sm focus:border-indigo-500 outline-none"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Expected Room</label>
                <input 
                  type="text" 
                  value={formData.room_number}
                  onChange={(e) => setFormData({...formData, room_number: e.target.value})}
                  className="w-full h-12 px-4 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-black/20 text-sm focus:border-indigo-500 outline-none"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Caller Name (Sender)</label>
                <input 
                  required
                  type="text" 
                  value={formData.sender_name}
                  onChange={(e) => setFormData({...formData, sender_name: e.target.value})}
                  className="w-full h-12 px-4 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-black/20 text-sm focus:border-indigo-500 outline-none"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Facility / Hospital</label>
                <input 
                  type="text" 
                  value={formData.sender_facility}
                  onChange={(e) => setFormData({...formData, sender_facility: e.target.value})}
                  className="w-full h-12 px-4 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-black/20 text-sm focus:border-indigo-500 outline-none"
                />
              </div>
            </div>
          </section>

          {/* ISBAR */}
          <section className="bg-white dark:bg-[#121214] border border-slate-200 dark:border-white/5 rounded-2xl p-6 shadow-sm">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400">ISBAR Clinical Notes</h2>
              <button type="button" className="text-xs font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-1 hover:opacity-80">
                <Mic className="w-3.5 h-3.5" /> Start Dictation
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest block mb-1">Situation</label>
                <textarea 
                  rows={2}
                  value={formData.situation}
                  onChange={(e) => setFormData({...formData, situation: e.target.value})}
                  className="w-full p-3 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-black/20 text-sm focus:border-indigo-500 outline-none resize-none"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest block mb-1">Background</label>
                <textarea 
                  rows={2}
                  value={formData.background}
                  onChange={(e) => setFormData({...formData, background: e.target.value})}
                  className="w-full p-3 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-black/20 text-sm focus:border-indigo-500 outline-none resize-none"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest block mb-1">Assessment / Vitals</label>
                <textarea 
                  rows={2}
                  value={formData.assessment}
                  onChange={(e) => setFormData({...formData, assessment: e.target.value})}
                  className="w-full p-3 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-black/20 text-sm focus:border-indigo-500 outline-none resize-none"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest block mb-1">Recommendation</label>
                <textarea 
                  rows={2}
                  value={formData.recommendation}
                  onChange={(e) => setFormData({...formData, recommendation: e.target.value})}
                  className="w-full p-3 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-black/20 text-sm focus:border-indigo-500 outline-none resize-none"
                />
              </div>
            </div>
          </section>

          {/* Urgency & Submit */}
          <section className="bg-white dark:bg-[#121214] border border-slate-200 dark:border-white/5 rounded-2xl p-6 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="w-full sm:w-auto">
              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2 block">Urgency Status</label>
              <div className="flex gap-2">
                <button type="button" onClick={() => setFormData({...formData, urgency: 'routine'})} className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${formData.urgency === 'routine' ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 border border-emerald-500/20' : 'bg-slate-50 text-slate-500 border border-transparent dark:bg-white/5'}`}>Routine</button>
                <button type="button" onClick={() => setFormData({...formData, urgency: 'attention'})} className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${formData.urgency === 'attention' ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 border border-amber-500/20' : 'bg-slate-50 text-slate-500 border border-transparent dark:bg-white/5'}`}>Attention</button>
                <button type="button" onClick={() => setFormData({...formData, urgency: 'critical'})} className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${formData.urgency === 'critical' ? 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/10 dark:text-rose-400 border border-rose-500/20' : 'bg-slate-50 text-slate-500 border border-transparent dark:bg-white/5'}`}>Critical</button>
              </div>
            </div>
            
            <button 
              type="submit" 
              disabled={isSubmitting}
              className="w-full sm:w-auto px-8 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-[0_4px_12px_rgba(79,70,229,0.2)] disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {isSubmitting ? 'Saving...' : 'Save Record'}
            </button>
          </section>
        </form>
      </main>
    </div>
  );
}
