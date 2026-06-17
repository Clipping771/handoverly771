'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { Plus, Pill, RefreshCw, X, AlertCircle, Trash2, Edit2 } from 'lucide-react';
import toast from 'react-hot-toast';
import MedicationReconciliationModal from './MedicationReconciliationModal';

export default function MedicationsList({ residentId, facilityId }: { residentId: string; facilityId?: string }) {
  const { user } = useAuth();
  const [meds, setMeds] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showReconciliationModal, setShowReconciliationModal] = useState(false);
  const [editingMedId, setEditingMedId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ medication_name: '', dosage: '', frequency: '', route: 'Oral', status: 'active' });

  const fetchMeds = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/medications?residentId=${residentId}&facilityId=${facilityId}`);
      const json = await res.json();
      
      if (!res.ok || !json.success) throw new Error(json.error || 'Failed to fetch medications');
      
      if (json.data) setMeds(json.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMeds();
    
    // Listen for AI assistant updates
    const handleRefresh = () => fetchMeds();
    window.addEventListener('refresh_data', handleRefresh);
    return () => window.removeEventListener('refresh_data', handleRefresh);
  }, [residentId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!facilityId) return;

    try {
      if (editingMedId) {
        // Update
        const res = await fetch('/api/medications', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            medId: editingMedId,
            facilityId: facilityId,
            updates: formData
          })
        });
        const data = await res.json();
        if (!res.ok || !data.success) throw new Error(data.error || 'Failed to update medication');
        toast.success('Medication updated');
      } else {
        // Add
        const res = await fetch('/api/medications', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            resident_id: residentId,
            facility_id: facilityId,
            ...formData
          })
        });
        const data = await res.json();
        if (!res.ok || !data.success) throw new Error(data.error || 'Failed to add medication');
        toast.success('Medication added');
      }

      setShowModal(false);
      setEditingMedId(null);
      setFormData({ medication_name: '', dosage: '', frequency: '', route: 'Oral', status: 'active' });
      fetchMeds();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save medication');
    }
  };

  const handleEditClick = (med: any) => {
    setEditingMedId(med.id);
    setFormData({
      medication_name: med.medication_name,
      dosage: med.dosage,
      frequency: med.frequency,
      route: med.route,
      status: med.status || 'active'
    });
    setShowModal(true);
  };

  const handleDeleteMed = async (id: string) => {
    if (!confirm('Are you sure you want to delete this medication?')) return;
    try {
      const res = await fetch('/api/medications', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ medId: id, facilityId: facilityId })
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to delete');
      toast.success('Medication deleted');
      fetchMeds();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete medication');
    }
  };

  const handleDeleteAll = async () => {
    if (!confirm('Are you sure you want to delete ALL medications for this resident? This cannot be undone.')) return;
    try {
      const res = await fetch('/api/medications', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ residentId, facilityId: facilityId })
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to delete all');
      toast.success('All medications deleted');
      fetchMeds();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete all medications');
    }
  };

  const handleReconcile = () => {
    const activeMedIds = meds.filter(m => m.status === 'active').map(m => m.id);
    if (activeMedIds.length === 0) return toast.error('No active medications to reconcile');
    setShowReconciliationModal(true);
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
          {meds.length > 0 && (
            <button onClick={handleDeleteAll} className="px-3 py-2 bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400 rounded-xl text-xs font-bold transition-colors hover:bg-red-100 flex items-center gap-1.5 cursor-pointer" title="Delete All">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
          <button onClick={handleReconcile} className="px-4 py-2 bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-400 rounded-xl text-xs font-bold transition-colors hover:bg-indigo-100 flex items-center gap-1.5 cursor-pointer">
            <RefreshCw className="w-3.5 h-3.5" />
            Reconcile All
          </button>
          <button onClick={() => { setEditingMedId(null); setFormData({ medication_name: '', dosage: '', frequency: '', route: 'Oral', status: 'active' }); setShowModal(true); }} className="px-4 py-2 bg-slate-900 text-white dark:bg-white dark:text-slate-900 rounded-xl text-xs font-bold transition-colors hover:opacity-90 flex items-center gap-1.5 cursor-pointer">
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
              <div className="text-right flex flex-col justify-between items-end">
                {med.last_reconciled_at ? (
                  <div className="mb-2">
                    <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-0.5">Last Reconciled</div>
                    <div className="text-xs text-slate-600 dark:text-slate-300 font-medium">
                      {new Date(med.last_reconciled_at).toLocaleDateString()} by {med.last_reconciled_by?.name || 'Staff'}
                    </div>
                  </div>
                ) : (
                  <span className="text-xs text-amber-600 font-bold bg-amber-50 px-2 py-1 rounded-lg mb-2 inline-block">Unreconciled</span>
                )}
                <div className="flex items-center gap-1">
                  <button onClick={() => handleEditClick(med)} className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-500/20 rounded-lg transition-colors cursor-pointer" title="Edit">
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleDeleteMed(med.id)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/20 rounded-lg transition-colors cursor-pointer" title="Delete">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <div className="w-full max-w-md bg-white dark:bg-[#121214] p-6 rounded-3xl border border-[#e3e3e3] dark:border-[#202024] shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-bold text-lg">{editingMedId ? 'Edit Medication' : 'Add Medication'}</h3>
              <button onClick={() => { setShowModal(false); setEditingMedId(null); }} className="p-2 hover:bg-slate-100 dark:hover:bg-white/10 rounded-full transition-colors cursor-pointer"><X className="w-4 h-4"/></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div><label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1 block">Name</label><input required className="w-full h-11 px-3 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#1a1a1c] text-sm" value={formData.medication_name} onChange={e=>setFormData({...formData, medication_name: e.target.value})}/></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1 block">Dosage</label><input required className="w-full h-11 px-3 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#1a1a1c] text-sm" placeholder="e.g. 5mg" value={formData.dosage} onChange={e=>setFormData({...formData, dosage: e.target.value})}/></div>
                <div><label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1 block">Frequency</label><input required className="w-full h-11 px-3 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#1a1a1c] text-sm" placeholder="e.g. BD" value={formData.frequency} onChange={e=>setFormData({...formData, frequency: e.target.value})}/></div>
              </div>
              <div><label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1 block">Route</label><input required className="w-full h-11 px-3 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#1a1a1c] text-sm" value={formData.route} onChange={e=>setFormData({...formData, route: e.target.value})}/></div>
              
              {editingMedId && (
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1 block">Status</label>
                  <select className="w-full h-11 px-3 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#1a1a1c] text-sm outline-none focus:ring-2 focus:ring-primary/20" value={formData.status} onChange={e=>setFormData({...formData, status: e.target.value})}>
                    <option value="active">Active</option>
                    <option value="discontinued">Discontinued</option>
                  </select>
                </div>
              )}

              <button type="submit" className="w-full h-11 rounded-xl bg-slate-900 text-white dark:bg-white dark:text-slate-900 font-bold text-sm mt-4 hover:opacity-90 transition-opacity">
                {editingMedId ? 'Save Changes' : 'Add Medication'}
              </button>
            </form>
          </div>
        </div>
      )}

      <MedicationReconciliationModal
        isOpen={showReconciliationModal}
        onClose={() => setShowReconciliationModal(false)}
        meds={meds}
        residentId={residentId}
        facilityId={facilityId}
        onSuccess={() => {
          setShowReconciliationModal(false);
          fetchMeds();
        }}
      />
    </div>
  );
}
