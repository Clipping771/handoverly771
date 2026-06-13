'use client';

import React, { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { CheckCircle2, AlertCircle, X, ShieldCheck } from 'lucide-react';
import toast from 'react-hot-toast';

interface MedicationReconciliationModalProps {
  isOpen: boolean;
  onClose: () => void;
  meds: any[];
  residentId: string;
  facilityId?: string;
  onSuccess: () => void;
}

export default function MedicationReconciliationModal({ isOpen, onClose, meds, residentId, facilityId, onSuccess }: MedicationReconciliationModalProps) {
  const { user } = useAuth();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [reconciledIds, setReconciledIds] = useState<string[]>([]);
  const [flaggedIds, setFlaggedIds] = useState<Record<string, string>>({}); // medId -> flag note
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [flagNote, setFlagNote] = useState('');

  if (!isOpen) return null;

  const activeMeds = meds.filter(m => m.status === 'active');
  const currentMed = activeMeds[currentIndex];
  const isFinished = currentIndex >= activeMeds.length;

  const handleVerify = () => {
    setReconciledIds(prev => [...prev, currentMed.id]);
    setFlagNote('');
    setCurrentIndex(prev => prev + 1);
  };

  const handleFlag = () => {
    if (!flagNote.trim()) {
      toast.error('Please enter a note describing the issue.');
      return;
    }
    setFlaggedIds(prev => ({ ...prev, [currentMed.id]: flagNote }));
    setFlagNote('');
    setCurrentIndex(prev => prev + 1);
  };

  const submitReconciliation = async () => {
    if (!user || !facilityId) return;
    setIsSubmitting(true);
    try {
      // 1. Update standard medications table for verified ones
      if (reconciledIds.length > 0) {
        const res = await fetch('/api/medications', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ medIds: reconciledIds, userId: user.id })
        });
        const json = await res.json();
        if (!res.ok || !json.success) throw new Error(json.error || 'Failed to update medications');
      }

      // 2. Log all actions in medication_reconciliation_logs
      const logs = [
        ...reconciledIds.map(id => ({
          resident_id: residentId,
          facility_id: facilityId,
          staff_id: user.id,
          medication_id: id,
          action: 'verified',
          notes: ''
        })),
        ...Object.entries(flaggedIds).map(([id, note]) => ({
          resident_id: residentId,
          facility_id: facilityId,
          staff_id: user.id,
          medication_id: id,
          action: 'flagged',
          notes: note as string
        }))
      ];

      if (logs.length > 0) {
        const { error } = await supabase.from('medication_reconciliation_logs').insert(logs);
        // Soft fail if table doesn't exist yet (SQL not run)
        if (error && error.code !== '42P01') {
           console.error('Log insert error:', error);
        }
      }

      toast.success('Medication reconciliation complete!');
      onSuccess();
    } catch (err: any) {
      toast.error(err.message || 'Failed to submit reconciliation.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
      <div className="w-full max-w-lg bg-white dark:bg-[#121214] p-6 sm:p-8 rounded-3xl border border-[#e3e3e3] dark:border-[#202024] shadow-2xl relative overflow-hidden">
        
        {/* Progress Bar */}
        {!isFinished && activeMeds.length > 0 && (
          <div className="absolute top-0 left-0 w-full h-1.5 bg-slate-100 dark:bg-white/5">
            <div 
              className="h-full bg-indigo-500 transition-all duration-300" 
              style={{ width: `${(currentIndex / activeMeds.length) * 100}%` }}
            />
          </div>
        )}

        <div className="flex justify-between items-center mb-6">
          <div>
            <h3 className="font-bold text-xl flex items-center gap-2">
              <ShieldCheck className="w-6 h-6 text-indigo-500" />
              Full Reconciliation
            </h3>
            {!isFinished && activeMeds.length > 0 && (
              <p className="text-xs text-slate-500 font-bold tracking-widest uppercase mt-1">
                Item {currentIndex + 1} of {activeMeds.length}
              </p>
            )}
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-white/10 rounded-full transition-colors cursor-pointer">
            <X className="w-5 h-5"/>
          </button>
        </div>

        {activeMeds.length === 0 ? (
          <div className="text-center py-10">
            <p className="text-slate-500 mb-4">No active medications to reconcile.</p>
            <button onClick={onClose} className="px-6 py-2 bg-slate-900 text-white dark:bg-white dark:text-slate-900 rounded-xl font-bold">Close</button>
          </div>
        ) : isFinished ? (
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h4 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Review Complete</h4>
            <p className="text-sm text-slate-500 mb-6">
              You verified {reconciledIds.length} medications and flagged {Object.keys(flaggedIds).length} for review.
            </p>
            <button 
              onClick={submitReconciliation} 
              disabled={isSubmitting}
              className="w-full h-12 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition-colors disabled:opacity-50"
            >
              {isSubmitting ? 'Signing Off...' : 'Sign Off & Save'}
            </button>
          </div>
        ) : (
          <div className="animate-fade-in">
            <div className="bg-slate-50 dark:bg-[#1a1a1c] border border-slate-200 dark:border-white/10 rounded-2xl p-6 mb-6">
              <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Medication Name</div>
              <div className="text-2xl font-black text-slate-900 dark:text-white mb-4">{currentMed.medication_name}</div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Dosage</div>
                  <div className="font-bold text-slate-700 dark:text-slate-300">{currentMed.dosage}</div>
                </div>
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Frequency</div>
                  <div className="font-bold text-slate-700 dark:text-slate-300">{currentMed.frequency}</div>
                </div>
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Route</div>
                  <div className="font-bold text-slate-700 dark:text-slate-300">{currentMed.route}</div>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <button 
                onClick={handleVerify}
                className="w-full h-14 bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 rounded-xl font-bold flex items-center justify-center gap-2 transition-all"
              >
                <CheckCircle2 className="w-5 h-5" /> Verified & Correct
              </button>
              
              <div className="mt-4 border-t border-slate-100 dark:border-white/10 pt-4">
                <label className="text-xs font-bold text-slate-500 block mb-2">Flag an issue (e.g. incorrect dosage, missed dose):</label>
                <input 
                  type="text" 
                  value={flagNote}
                  onChange={(e) => setFlagNote(e.target.value)}
                  placeholder="Describe the discrepancy..."
                  className="w-full h-12 px-4 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#1a1a1c] text-sm mb-3 focus:outline-none focus:border-amber-400"
                />
                <button 
                  onClick={handleFlag}
                  className="w-full h-12 bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400 border border-amber-200 dark:border-amber-500/20 hover:bg-amber-100 dark:hover:bg-amber-500/20 rounded-xl font-bold flex items-center justify-center gap-2 transition-all"
                >
                  <AlertCircle className="w-5 h-5" /> Flag for Doctor Review
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
