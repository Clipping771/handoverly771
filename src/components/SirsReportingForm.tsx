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

      toast.success('SIRS incident report submitted successfully.');
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Failed to submit report.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
      <div className="w-full max-w-lg bg-white dark:bg-[#121214] p-6 sm:p-8 rounded-3xl border border-rose-200 dark:border-rose-900/30 shadow-[0_8px_32px_rgba(225,29,72,0.15)] relative overflow-hidden">
        
        {/* Red accent bar */}
        <div className="absolute top-0 left-0 w-full h-1.5 bg-rose-600"></div>

        <div className="flex justify-between items-center mb-6">
          <div>
            <h3 className="font-bold text-xl flex items-center gap-2 text-rose-700 dark:text-rose-500">
              <AlertOctagon className="w-6 h-6" />
              SIRS Incident Report
            </h3>
            <p className="text-xs text-slate-500 mt-1">Serious Incident Response Scheme</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-white/10 rounded-full transition-colors cursor-pointer">
            <X className="w-5 h-5"/>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 animate-fade-in">
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1.5 block">
              Incident Category
            </label>
            <select 
              value={formData.incident_type}
              onChange={(e) => setFormData({...formData, incident_type: e.target.value})}
              className="w-full h-12 px-4 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#1a1a1c] text-sm focus:outline-none focus:ring-2 focus:ring-rose-500/20"
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
            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1.5 block">
              Priority Level
            </label>
            <div className="flex gap-3">
              <label className={`flex-1 flex items-center justify-center gap-2 h-11 rounded-xl border cursor-pointer transition-all ${formData.priority === 'critical' ? 'bg-rose-50 border-rose-500 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400' : 'bg-slate-50 border-slate-200 text-slate-600 dark:bg-[#1a1a1c] dark:border-white/10 dark:text-slate-400'}`}>
                <input type="radio" name="priority" value="critical" checked={formData.priority === 'critical'} onChange={() => setFormData({...formData, priority: 'critical'})} className="hidden" />
                <span className="text-xs font-bold uppercase tracking-widest">Critical (24h)</span>
              </label>
              <label className={`flex-1 flex items-center justify-center gap-2 h-11 rounded-xl border cursor-pointer transition-all ${formData.priority === 'high' ? 'bg-amber-50 border-amber-500 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400' : 'bg-slate-50 border-slate-200 text-slate-600 dark:bg-[#1a1a1c] dark:border-white/10 dark:text-slate-400'}`}>
                <input type="radio" name="priority" value="high" checked={formData.priority === 'high'} onChange={() => setFormData({...formData, priority: 'high'})} className="hidden" />
                <span className="text-xs font-bold uppercase tracking-widest">High (30d)</span>
              </label>
            </div>
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1.5 block">
              Detailed Description
            </label>
            <textarea 
              required
              rows={5}
              placeholder="Provide a factual description of what occurred, who was involved, and immediate actions taken..."
              value={formData.description}
              onChange={(e) => setFormData({...formData, description: e.target.value})}
              className="w-full p-4 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#1a1a1c] text-sm resize-none focus:outline-none focus:ring-2 focus:ring-rose-500/20"
            />
          </div>

          <div className="pt-2">
            <button 
              type="submit"
              disabled={isSubmitting}
              className="w-full h-12 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
              {isSubmitting ? 'Submitting Report...' : 'Submit SIRS Report'}
            </button>
            <p className="text-[10px] text-center text-slate-400 mt-3 font-medium">
              This report will be securely logged and accessible only to facility administrators.
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}
