'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { MessageSquarePlus, ThumbsUp, ThumbsDown, AlertCircle, X, Check } from 'lucide-react';
import toast from 'react-hot-toast';

export default function HandoverFeedbackWidget() {
  const { user, facility } = useAuth();
  const [showForm, setShowForm] = useState(false);
  const [rating, setRating] = useState<'excellent' | 'adequate' | 'incomplete' | null>(null);
  const [comments, setComments] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(false);

  // Check if they've already submitted feedback for their shift today
  useEffect(() => {
    if (!user || !facility) return;
    const checkExisting = async () => {
      const today = new Date().toISOString().split('T')[0];
      const { data } = await supabase
        .from('handover_feedback')
        .select('id')
        .eq('incoming_staff_id', user.id)
        .eq('shift_date', today)
        .limit(1);
        
      if (data && data.length > 0) {
        setHasSubmitted(true);
      }
    };
    checkExisting();
  }, [user, facility]);

  if (hasSubmitted) return null;

  const handleSubmit = async () => {
    if (!rating) {
      toast.error('Please select a rating');
      return;
    }
    if (rating === 'incomplete' && !comments.trim()) {
      toast.error('Please add comments detailing what was missing.');
      return;
    }

    if (!user || !facility) return;
    setIsSubmitting(true);

    try {
      const shiftDate = new Date().toISOString().split('T')[0];
      const hour = new Date().getHours();
      let shiftType = 'morning';
      if (hour >= 14 && hour < 22) shiftType = 'afternoon';
      else if (hour >= 22 || hour < 6) shiftType = 'night';

      const { error } = await supabase.from('handover_feedback').insert([{
        facility_id: facility.id,
        incoming_staff_id: user.id,
        shift_date: shiftDate,
        shift_type: shiftType,
        rating,
        comments
      }]);

      if (error) {
        if (error.code === '42P01') {
           throw new Error('Feedback table not created. Admin needs to run setup_advanced_features.sql');
        }
        throw error;
      }

      toast.success('Feedback recorded. Thank you!');
      setHasSubmitted(true);
      setShowForm(false);
    } catch (err: any) {
      toast.error(err.message || 'Failed to submit feedback');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!showForm) {
    return (
      <div className="bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/20 rounded-[24px] p-5 mb-8 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm animate-fade-in">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 flex items-center justify-center shrink-0">
            <MessageSquarePlus className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-bold text-indigo-900 dark:text-indigo-400">Rate Previous Handover</h4>
            <p className="text-xs text-indigo-700/80 dark:text-indigo-300/80 mt-0.5">Help us improve shift transitions by rating the handover you just received.</p>
          </div>
        </div>
        <button 
          onClick={() => setShowForm(true)}
          className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold transition-colors whitespace-nowrap shadow-sm"
        >
          Provide Feedback
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-[#121214] border border-[#e3e3e3] dark:border-[#202024] rounded-[24px] p-6 shadow-sm mb-8 animate-fade-in relative">
      <button onClick={() => setShowForm(false)} className="absolute top-4 right-4 p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10 rounded-full transition-colors">
        <X className="w-4 h-4" />
      </button>

      <h4 className="font-bold text-lg mb-4 flex items-center gap-2">
        <MessageSquarePlus className="w-5 h-5 text-indigo-500" />
        Handover Feedback
      </h4>
      
      <div className="space-y-6">
        <div>
          <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-3">Overall Quality</label>
          <div className="flex gap-3">
            <button 
              onClick={() => setRating('excellent')}
              className={`flex-1 flex flex-col items-center justify-center p-4 rounded-2xl border transition-all ${rating === 'excellent' ? 'bg-emerald-50 border-emerald-500 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400 shadow-sm' : 'bg-slate-50 border-slate-200 text-slate-500 dark:bg-[#1a1a1c] dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/5'}`}
            >
              <ThumbsUp className="w-6 h-6 mb-2" />
              <span className="text-xs font-bold">Excellent</span>
            </button>
            <button 
              onClick={() => setRating('adequate')}
              className={`flex-1 flex flex-col items-center justify-center p-4 rounded-2xl border transition-all ${rating === 'adequate' ? 'bg-amber-50 border-amber-500 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400 shadow-sm' : 'bg-slate-50 border-slate-200 text-slate-500 dark:bg-[#1a1a1c] dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/5'}`}
            >
              <Check className="w-6 h-6 mb-2" />
              <span className="text-xs font-bold">Adequate</span>
            </button>
            <button 
              onClick={() => setRating('incomplete')}
              className={`flex-1 flex flex-col items-center justify-center p-4 rounded-2xl border transition-all ${rating === 'incomplete' ? 'bg-rose-50 border-rose-500 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400 shadow-sm' : 'bg-slate-50 border-slate-200 text-slate-500 dark:bg-[#1a1a1c] dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/5'}`}
            >
              <ThumbsDown className="w-6 h-6 mb-2" />
              <span className="text-xs font-bold">Incomplete</span>
            </button>
          </div>
        </div>

        {(rating === 'incomplete' || rating === 'adequate') && (
          <div className="animate-fade-in">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-2">
              What was missing or unclear? <span className="text-rose-500">{rating === 'incomplete' ? '*' : ''}</span>
            </label>
            <textarea 
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              placeholder="E.g. Medication chart not updated for Room 12..."
              className="w-full h-24 p-3 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#1a1a1c] text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>
        )}

        <div className="flex justify-end">
          <button 
            onClick={handleSubmit}
            disabled={isSubmitting || !rating}
            className="px-6 py-3 bg-slate-900 text-white dark:bg-white dark:text-slate-900 rounded-xl text-sm font-bold transition-all hover:opacity-90 disabled:opacity-50"
          >
            {isSubmitting ? 'Submitting...' : 'Submit Feedback'}
          </button>
        </div>
      </div>
    </div>
  );
}
