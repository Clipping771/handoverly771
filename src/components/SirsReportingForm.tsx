'use client';

import React, { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { AlertOctagon, X, Send } from 'lucide-react';
import toast from 'react-hot-toast';

interface SirsReportingFormProps {
  isOpen: boolean;
  onClose: () => void;
  residentId: string;
  facilityId?: string;
}

export default function SirsReportingForm({ isOpen, onClose, residentId, facilityId }: SirsReportingFormProps) {
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    incident_type: 'Unexplained absence',
    description: '',
    priority: 'high'
  });

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !facilityId) return;

    if (!formData.description.trim()) {
      toast.error('Description is required for compliance.');
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase.from('sirs_reports').insert([{
        resident_id: residentId,
        facility_id: facilityId,
        reporter_id: user.id,
        incident_type: formData.incident_type,
        description: formData.description,
        priority: formData.priority,
        status: 'submitted'
      }]);

      if (error) {
         if (error.code === '42P01') {
            throw new Error('SIRS tables not created. Please ask the admin to run setup_advanced_features.sql');
         }
         throw error;
      }

      // Automatically trigger a Sentinel Alert (Critical Task) for RNs/Admins
      await supabase.from('tasks').insert([{
        facility_id: facilityId,
        resident_id: residentId,
        assigned_role: 'rn',
        title: `🚨 CRITICAL: SIRS INCIDENT (${formData.incident_type})`,
        description: formData.description,
        clinical_purpose: 'Immediate RN/Admin review required for SIRS compliance and resident safety.',
        tags: ['sirs', 'critical', 'incident'],
        is_completed: false
      }]);

      toast.success('SIRS incident report submitted successfully.');
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Failed to submit report.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 dark:bg-black/60 backdrop-blur-md px-4 transition-opacity">
      <div className="w-full max-w-lg bg-white/70 dark:bg-[#0f172a]/70 backdrop-blur-2xl p-6 sm:p-8 rounded-[32px] border border-white/60 dark:border-white/10 shadow-[0_8px_40px_rgba(225,29,72,0.15)] relative overflow-hidden group">
        
        {/* Animated decorative gradient background */}
        <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-rose-500/15 dark:from-rose-500/10 to-transparent pointer-events-none"></div>
        <div className="absolute -top-20 -right-20 w-40 h-40 bg-rose-500/10 dark:bg-rose-500/20 rounded-full blur-3xl pointer-events-none"></div>

        <div className="flex justify-between items-start mb-6 relative z-10">
          <div className="flex gap-4">
            <div className="w-12 h-12 rounded-[16px] bg-gradient-to-br from-rose-400 to-rose-600 p-[1px] shadow-lg shadow-rose-500/20 shrink-0">
              <div className="w-full h-full bg-white/90 dark:bg-slate-900/90 rounded-[15px] flex items-center justify-center backdrop-blur-md">
                <AlertOctagon className="w-6 h-6 text-rose-500" />
              </div>
            </div>
            <div>
              <h3 className="font-black text-xl text-slate-800 dark:text-white tracking-tight leading-none mb-1">
                SIRS Report
              </h3>
              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 shadow-sm inline-flex mt-1">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse"></span>
                <span className="text-[9px] font-bold text-rose-700 dark:text-rose-400 uppercase tracking-widest leading-none">Serious Incident</span>
              </div>
            </div>
          </div>
          <button onClick={onClose} className="p-2.5 hover:bg-slate-100 dark:hover:bg-white/10 rounded-full transition-colors cursor-pointer text-slate-400 hover:text-slate-600 dark:hover:text-white">
            <X className="w-5 h-5"/>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 animate-fade-in relative z-10">
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-2 block pl-1">
              Incident Category
            </label>
            <select 
              value={formData.incident_type}
              onChange={(e) => setFormData({...formData, incident_type: e.target.value})}
              className="w-full h-12 px-4 rounded-[16px] bg-white/60 dark:bg-black/20 backdrop-blur-md border border-white/40 dark:border-white/5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-rose-500/20 transition-all text-slate-800 dark:text-slate-200 shadow-inner"
            >
              <option value="Unreasonable use of force">Unreasonable use of force</option>
              <option value="Unlawful sexual contact">Unlawful sexual contact</option>
              <option value="Neglect">Neglect</option>
              <option value="Psychological abuse">Psychological or emotional abuse</option>
              <option value="Unexpected death">Unexpected death</option>
              <option value="Stealing">Stealing or financial coercion</option>
              <option value="Inappropriate restraint">Inappropriate use of restrictive practices</option>
              <option value="Unexplained absence">Unexplained absence from care</option>
            </select>
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-2 block pl-1">
              Priority Level
            </label>
            <div className="flex gap-3">
              <label className={`flex-1 flex items-center justify-center gap-2 h-12 rounded-[16px] border cursor-pointer transition-all ${formData.priority === 'critical' ? 'bg-rose-50/80 border-rose-500 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300 shadow-[0_0_15px_rgba(225,29,72,0.2)]' : 'bg-white/40 border-white/40 text-slate-600 dark:bg-black/20 dark:border-white/5 dark:text-slate-400 hover:bg-white/60 dark:hover:bg-black/40'}`}>
                <input type="radio" name="priority" value="critical" checked={formData.priority === 'critical'} onChange={() => setFormData({...formData, priority: 'critical'})} className="hidden" />
                <span className="text-[11px] font-black uppercase tracking-widest">Critical (24h)</span>
              </label>
              <label className={`flex-1 flex items-center justify-center gap-2 h-12 rounded-[16px] border cursor-pointer transition-all ${formData.priority === 'high' ? 'bg-amber-50/80 border-amber-500 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300 shadow-[0_0_15px_rgba(245,166,35,0.2)]' : 'bg-white/40 border-white/40 text-slate-600 dark:bg-black/20 dark:border-white/5 dark:text-slate-400 hover:bg-white/60 dark:hover:bg-black/40'}`}>
                <input type="radio" name="priority" value="high" checked={formData.priority === 'high'} onChange={() => setFormData({...formData, priority: 'high'})} className="hidden" />
                <span className="text-[11px] font-black uppercase tracking-widest">High (30d)</span>
              </label>
            </div>
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-2 block pl-1">
              Detailed Description
            </label>
            <textarea 
              required
              rows={4}
              placeholder="Provide a factual description of what occurred, who was involved, and immediate actions taken..."
              value={formData.description}
              onChange={(e) => setFormData({...formData, description: e.target.value})}
              className="w-full p-4 rounded-[20px] bg-white/60 dark:bg-black/20 backdrop-blur-md border border-white/40 dark:border-white/5 text-sm font-medium resize-none focus:outline-none focus:ring-2 focus:ring-rose-500/20 transition-all text-slate-800 dark:text-slate-200 shadow-inner"
            />
          </div>

          <div className="pt-4">
            <button 
              type="submit"
              disabled={isSubmitting}
              className="w-full h-14 bg-gradient-to-r from-rose-500 to-rose-600 hover:from-rose-600 hover:to-rose-700 text-white rounded-[20px] font-bold text-sm tracking-wide flex items-center justify-center gap-2 transition-all disabled:opacity-50 shadow-lg shadow-rose-500/20 active:scale-[0.98]"
            >
              <Send className="w-4 h-4" />
              {isSubmitting ? 'Submitting Report...' : 'Submit SIRS Report'}
            </button>
            <p className="text-[10px] text-center text-slate-500 dark:text-slate-400 mt-4 font-semibold uppercase tracking-wider flex items-center justify-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-600"></span>
              Secure & Confidential Submission
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}
