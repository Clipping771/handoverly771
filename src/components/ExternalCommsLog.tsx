'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { Phone, Mail, FileText, Globe, Plus, Check, X, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';

export default function ExternalCommsLog({ residentId, facilityId }: { residentId: string; facilityId?: string }) {
  const { user } = useAuth();
  const [comms, setComms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  
  const [newComm, setNewComm] = useState({
    comm_type: 'fax',
    recipient_type: 'gp',
    recipient_name: '',
    topic: '',
    status: 'pending',
    notes: ''
  });

  const fetchComms = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('external_comms')
        .select(`
          *,
          staff:staff_id(name)
        `)
        .eq('resident_id', residentId)
        .order('created_at', { ascending: false });

      if (error && error.code !== '42P01') throw error;
      if (data) setComms(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchComms();
  }, [residentId]);

  const handleAddComm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!facilityId || !user) return;

    try {
      const { error } = await supabase
        .from('external_comms')
        .insert([{
          resident_id: residentId,
          facility_id: facilityId,
          staff_id: user.id,
          ...newComm
        }]);

      if (error) throw error;
      toast.success('Communication logged');
      setShowAdd(false);
      setNewComm({ comm_type: 'fax', recipient_type: 'gp', recipient_name: '', topic: '', status: 'pending', notes: '' });
      fetchComms();
    } catch (err: any) {
      toast.error(err.message || 'Failed to log comm. Did you run the SQL script?');
    }
  };

  const updateStatus = async (id: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('external_comms')
        .update({ status: newStatus })
        .eq('id', id);
      if (error) throw error;
      fetchComms();
    } catch (err: any) {
      toast.error('Failed to update status');
    }
  };

  const getTypeIcon = (type: string) => {
    switch(type) {
      case 'fax': return <FileText className="w-4 h-4 text-slate-500" />;
      case 'phone': return <Phone className="w-4 h-4 text-emerald-500" />;
      case 'email': return <Mail className="w-4 h-4 text-blue-500" />;
      default: return <Globe className="w-4 h-4 text-indigo-500" />;
    }
  };

  return (
    <div className="bg-white dark:bg-[#121214] border border-[#e3e3e3] dark:border-[#202024] rounded-[24px] p-6 shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Globe className="w-5 h-5 text-indigo-500" />
            External Communications Log
          </h3>
          <p className="text-xs text-slate-500 mt-1">Track faxes, calls, and requests to GPs and Pharmacies.</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="px-4 py-2 bg-slate-900 text-white dark:bg-white dark:text-slate-900 rounded-xl text-xs font-bold transition-colors hover:opacity-90 flex items-center gap-1.5 cursor-pointer">
          <Plus className="w-3.5 h-3.5" />
          Log Comms
        </button>
      </div>

      {loading ? (
        <div className="text-center py-8 text-slate-500 text-xs">Loading...</div>
      ) : comms.length === 0 ? (
        <div className="text-center py-12 bg-slate-50 dark:bg-[#1a1a1c] rounded-2xl border border-dashed border-slate-200 dark:border-white/10 text-slate-500 text-sm">
          No external communications logged.
        </div>
      ) : (
        <div className="space-y-4">
          {comms.map(comm => (
            <div key={comm.id} className="p-4 rounded-2xl border border-[#e3e3e3] dark:border-[#202024] bg-slate-50/50 dark:bg-[#1a1a1c]/50">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-white dark:bg-white/5 flex items-center justify-center shadow-sm">
                    {getTypeIcon(comm.comm_type)}
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-slate-900 dark:text-white capitalize">{comm.topic}</h4>
                    <div className="text-xs text-slate-500 font-medium">
                      To: <span className="uppercase font-bold tracking-widest">{comm.recipient_type}</span> {comm.recipient_name && `(${comm.recipient_name})`}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-md ${
                    comm.status === 'completed' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400' :
                    comm.status === 'pending' ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400' :
                    'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-400'
                  }`}>
                    {comm.status}
                  </span>
                  {comm.status === 'pending' && (
                    <button onClick={() => updateStatus(comm.id, 'completed')} className="w-7 h-7 rounded-full bg-emerald-50 hover:bg-emerald-100 text-emerald-600 dark:bg-emerald-500/10 dark:hover:bg-emerald-500/20 flex items-center justify-center transition-colors" title="Mark as Completed">
                      <Check className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
              {comm.notes && (
                <div className="text-xs text-slate-600 dark:text-slate-400 bg-white dark:bg-[#121214] p-3 rounded-xl border border-[#e3e3e3] dark:border-[#202024]">
                  {comm.notes}
                </div>
              )}
              <div className="mt-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                Logged by {comm.staff?.name || 'Staff'} on {new Date(comm.created_at).toLocaleString()}
              </div>
            </div>
          ))}
        </div>
      )}

      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <div className="w-full max-w-lg bg-white dark:bg-[#121214] p-6 rounded-3xl border border-[#e3e3e3] dark:border-[#202024] shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-bold text-lg">Log Communication</h3>
              <button onClick={() => setShowAdd(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-white/10 rounded-full transition-colors cursor-pointer"><X className="w-4 h-4"/></button>
            </div>
            <form onSubmit={handleAddComm} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1 block">Method</label>
                  <select className="w-full h-11 px-3 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#1a1a1c] text-sm" value={newComm.comm_type} onChange={e=>setNewComm({...newComm, comm_type: e.target.value})}>
                    <option value="fax">Fax</option>
                    <option value="phone">Phone Call</option>
                    <option value="email">Email</option>
                    <option value="portal">Web Portal</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1 block">Recipient Type</label>
                  <select className="w-full h-11 px-3 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#1a1a1c] text-sm" value={newComm.recipient_type} onChange={e=>setNewComm({...newComm, recipient_type: e.target.value})}>
                    <option value="gp">GP (Doctor)</option>
                    <option value="pharmacy">Pharmacy</option>
                    <option value="hospital">Hospital / ED</option>
                    <option value="specialist">Specialist</option>
                    <option value="family">Family / NOK</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1 block">Recipient Name (Optional)</label>
                <input className="w-full h-11 px-3 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#1a1a1c] text-sm" placeholder="e.g. Dr. Smith" value={newComm.recipient_name} onChange={e=>setNewComm({...newComm, recipient_name: e.target.value})}/>
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1 block">Topic / Subject</label>
                <input required className="w-full h-11 px-3 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#1a1a1c] text-sm" placeholder="e.g. Requesting antibiotic chart" value={newComm.topic} onChange={e=>setNewComm({...newComm, topic: e.target.value})}/>
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1 block">Notes / Details</label>
                <textarea className="w-full h-24 p-3 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#1a1a1c] text-sm resize-none" placeholder="Details of the communication..." value={newComm.notes} onChange={e=>setNewComm({...newComm, notes: e.target.value})}/>
              </div>
              <button type="submit" className="w-full h-11 rounded-xl bg-slate-900 text-white dark:bg-white dark:text-slate-900 font-bold text-sm mt-4 hover:opacity-90 transition-opacity cursor-pointer">Log Communication</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
