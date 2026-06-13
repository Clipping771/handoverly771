'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { Plus, Pill, RefreshCw, X, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';

export default function MedicationsList({ residentId, facilityId }: { residentId: string; facilityId?: string }) {
  const { user } = useAuth();
  const [meds, setMeds] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newMed, setNewMed] = useState({ medication_name: '', dosage: '', frequency: '', route: 'Oral', status: 'active' });

  const fetchMeds = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('medication_profiles')
        .select(`
          *,
          last_reconciled_by (name)
        `)
        .eq('resident_id', residentId)
        .order('status', { ascending: true })
        .order('medication_name', { ascending: true });

      if (error && error.code !== '42P01') throw error; // Ignore table missing error if user hasn't run SQL yet
      if (data) setMeds(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMeds();
  }, [residentId]);

  const handleAddMed = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!facilityId) return;

    try {
      const { error } = await supabase
        .from('medication_profiles')
        .insert([{
          resident_id: residentId,
          facility_id: facilityId,
          ...newMed
        }]);

      if (error) throw error;
      toast.success('Medication added');
      setShowAdd(false);
      setNewMed({ medication_name: '', dosage: '', frequency: '', route: 'Oral', status: 'active' });
      fetchMeds();
    } catch (err: any) {
      toast.error(err.message || 'Failed to add medication. Did you run the SQL script?');
    }
  };

  const handleReconcile = async () => {
    if (!user) return;
    try {
      const activeMedIds = meds.filter(m => m.status === 'active').map(m => m.id);
      if (activeMedIds.length === 0) return toast.error('No active medications to reconcile');

      const { error } = await supabase
        .from('medication_profiles')
        .update({
          last_reconciled_at: new Date().toISOString(),
          last_reconciled_by: user.id
        })
        .in('id', activeMedIds);

      if (error) throw error;
      toast.success('Medications reconciled successfully');
      fetchMeds();
    } catch (err: any) {
      toast.error('Failed to reconcile medications');
    }
  };

  return (
    <div className="bg-white dark:bg-[#121214] border border-[#e3e3e3] dark:border-[#202024] rounded-[24px] p-6 shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Pill className="w-5 h-5 text-indigo-500" />
            Active Medications
          </h3>
          <p className="text-xs text-slate-500 mt-1">Manage and track prescription changes.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={handleReconcile} className="px-4 py-2 bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-400 rounded-xl text-xs font-bold transition-colors hover:bg-indigo-100 flex items-center gap-1.5 cursor-pointer">
            <RefreshCw className="w-3.5 h-3.5" />
            Reconcile All
          </button>
          <button onClick={() => setShowAdd(true)} className="px-4 py-2 bg-slate-900 text-white dark:bg-white dark:text-slate-900 rounded-xl text-xs font-bold transition-colors hover:opacity-90 flex items-center gap-1.5 cursor-pointer">
            <Plus className="w-3.5 h-3.5" />
            Add Med
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-8 text-slate-500 text-xs">Loading...</div>
      ) : meds.length === 0 ? (
        <div className="text-center py-12 bg-slate-50 dark:bg-[#1a1a1c] rounded-2xl border border-dashed border-slate-200 dark:border-white/10 text-slate-500 text-sm">
          No medications listed.
        </div>
      ) : (
        <div className="space-y-3">
          {meds.map(med => (
            <div key={med.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-2xl border border-[#e3e3e3] dark:border-[#202024] bg-slate-50/50 dark:bg-[#1a1a1c]/50 gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-bold text-[15px] text-slate-900 dark:text-white">{med.medication_name}</span>
                  <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-md ${med.status === 'active' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400' : 'bg-slate-200 text-slate-600 dark:bg-white/10 dark:text-slate-400'}`}>
                    {med.status}
                  </span>
                </div>
                <div className="text-sm text-slate-600 dark:text-slate-400 font-medium">
                  {med.dosage} • {med.frequency} • {med.route}
                </div>
              </div>
              <div className="text-right">
                {med.last_reconciled_at ? (
                  <>
                    <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-0.5">Last Reconciled</div>
                    <div className="text-xs text-slate-600 dark:text-slate-300 font-medium">
                      {new Date(med.last_reconciled_at).toLocaleDateString()} by {med.last_reconciled_by?.name || 'Staff'}
                    </div>
                  </>
                ) : (
                  <span className="text-xs text-amber-600 font-bold bg-amber-50 px-2 py-1 rounded-lg">Unreconciled</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <div className="w-full max-w-md bg-white dark:bg-[#121214] p-6 rounded-3xl border border-[#e3e3e3] dark:border-[#202024] shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-bold text-lg">Add Medication</h3>
              <button onClick={() => setShowAdd(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-white/10 rounded-full transition-colors cursor-pointer"><X className="w-4 h-4"/></button>
            </div>
            <form onSubmit={handleAddMed} className="space-y-4">
              <div><label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1 block">Name</label><input required className="w-full h-11 px-3 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#1a1a1c] text-sm" value={newMed.medication_name} onChange={e=>setNewMed({...newMed, medication_name: e.target.value})}/></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1 block">Dosage</label><input required className="w-full h-11 px-3 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#1a1a1c] text-sm" placeholder="e.g. 5mg" value={newMed.dosage} onChange={e=>setNewMed({...newMed, dosage: e.target.value})}/></div>
                <div><label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1 block">Frequency</label><input required className="w-full h-11 px-3 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#1a1a1c] text-sm" placeholder="e.g. BD" value={newMed.frequency} onChange={e=>setNewMed({...newMed, frequency: e.target.value})}/></div>
              </div>
              <div><label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1 block">Route</label><input required className="w-full h-11 px-3 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#1a1a1c] text-sm" value={newMed.route} onChange={e=>setNewMed({...newMed, route: e.target.value})}/></div>
              <button type="submit" className="w-full h-11 rounded-xl bg-slate-900 text-white dark:bg-white dark:text-slate-900 font-bold text-sm mt-4 hover:opacity-90 transition-opacity">Add Medication</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
