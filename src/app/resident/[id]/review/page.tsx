'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { ChevronLeft, Check, Edit2, X, AlertCircle, FileText, Activity } from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';

interface HandoverRecord {
  id: string;
  resident_id: string;
  facility_id: string;
  raw_input: string;
  rn_summary: any;
  status: string;
  confidence_score: number;
  uncertainty_reason: string;
  created_at: string;
}

export default function ReviewHandover() {
  const { user, facility, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const residentId = params.id as string;
  const handoverId = searchParams.get('id');

  const [handover, setHandover] = useState<HandoverRecord | null>(null);
  const [resident, setResident] = useState<any>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editedSummary, setEditedSummary] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!handoverId || !facility) return;

    const fetchData = async () => {
      // Fetch Resident
      const { data: resData } = await supabase
        .from('residents')
        .select('id, name, room_number')
        .eq('id', residentId)
        .single();
      if (resData) setResident(resData);

      // Fetch Handover
      const { data: handData, error } = await supabase
        .from('handovers')
        .select('*')
        .eq('id', handoverId)
        .single();
      
      if (handData) {
        setHandover(handData);
        setEditedSummary(handData.rn_summary);
      } else {
        toast.error('Handover not found');
        router.push('/shift');
      }
    };
    fetchData();
  }, [handoverId, residentId, facility]);

  const handleAction = async (action: 'approve' | 'edit' | 'reject') => {
    if (!facility || !user || !handoverId) return;
    setIsSubmitting(true);
    try {
      const payload = {
        handoverId,
        facilityId: facility.id,
        staffId: user.id,
        action,
        newSummary: action === 'edit' ? editedSummary : undefined,
      };

      const res = await fetch('/api/handovers/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      toast.success(`Handover ${action}d successfully`);
      router.push('/shift');
    } catch (err: any) {
      toast.error(err.message || 'Failed to process action');
      setIsSubmitting(false);
    }
  };

  if (authLoading || !handover || !resident) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center">
        <div className="w-12 h-12 border-[3px] border-amber-accent border-t-transparent rounded-full animate-spin"></div>
        <p className="mt-4 text-text-secondary font-medium text-sm tracking-wide">Loading Review Queue...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-text-primary flex flex-col pb-12 relative">
      <header className="sticky top-0 z-40 bg-surface/95 backdrop-blur-xl border-b border-border px-4 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <Link href="/shift" className="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-700 transition-colors">
            <ChevronLeft className="w-4 h-4" />
            Back to Shift
          </Link>
          <div className="text-right">
            <h1 className="text-sm font-bold tracking-wide">{resident.name}</h1>
            <p className="text-[10px] text-text-secondary font-semibold mt-0.5">Room {resident.room_number}</p>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto w-full px-4 mt-8 flex-1 flex flex-col relative z-10">
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-2">
            <span className="flex items-center gap-1 text-[10px] font-bold px-2.5 py-0.5 rounded-lg bg-amber-accent/10 text-amber-accent border border-amber-accent/20">
              <AlertCircle className="w-3 h-3" />
              NEEDS REVIEW
            </span>
            {handover.confidence_score && (
              <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-lg border border-slate-200">
                AI Confidence: {(handover.confidence_score * 100).toFixed(1)}%
              </span>
            )}
          </div>
          <h2 className="text-2xl font-extrabold tracking-tight">Clinical Review Required</h2>
          {handover.uncertainty_reason && (
            <p className="text-red-500 text-xs mt-2 font-medium bg-red-50 p-3 rounded-lg border border-red-100">
              <span className="font-bold">System Flag:</span> {handover.uncertainty_reason}
            </p>
          )}
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Left Column: Raw Input */}
          <div className="bg-surface rounded-2xl border border-border shadow-sm flex flex-col h-[500px]">
            <div className="p-4 border-b border-border flex items-center gap-2 bg-surface-solid rounded-t-2xl">
              <FileText className="w-4 h-4 text-slate-400" />
              <h3 className="text-xs font-bold text-text-primary uppercase tracking-wider">Original Input</h3>
            </div>
            <div className="p-5 flex-1 overflow-y-auto">
              <p className="text-sm text-text-secondary leading-relaxed whitespace-pre-wrap">
                {handover.raw_input || "No raw input recorded."}
              </p>
            </div>
          </div>

          {/* Right Column: AI Generated Summary */}
          <div className="bg-surface rounded-2xl border border-border shadow-sm flex flex-col h-[500px]">
            <div className="p-4 border-b border-border flex items-center justify-between bg-surface-solid rounded-t-2xl">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-teal-accent" />
                <h3 className="text-xs font-bold text-text-primary uppercase tracking-wider">AI Generated ISBAR</h3>
              </div>
              {!isEditing && (
                <button onClick={() => setIsEditing(true)} className="text-[10px] font-bold text-teal-accent hover:underline flex items-center gap-1">
                  <Edit2 className="w-3 h-3" /> Edit
                </button>
              )}
            </div>
            <div className="p-5 flex-1 overflow-y-auto space-y-4">
              {['identify', 'situation', 'background', 'assessment', 'recommendation'].map((section) => (
                <div key={section}>
                  <label className="block text-[10px] font-bold text-text-secondary uppercase tracking-widest mb-1.5">{section}</label>
                  {isEditing ? (
                    <textarea
                      value={editedSummary[section] || ''}
                      onChange={(e) => setEditedSummary({...editedSummary, [section]: e.target.value})}
                      className="w-full bg-surface-solid border border-border rounded-xl p-3 text-sm focus:border-teal-accent/50 outline-none min-h-[80px]"
                    />
                  ) : (
                    <p className="text-sm text-text-primary leading-relaxed bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-border/50">
                      {editedSummary[section] || 'N/A'}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Action Bar */}
        <div className="mt-8 flex items-center justify-end gap-3 bg-surface p-4 rounded-2xl border border-border shadow-sm">
          <button 
            disabled={isSubmitting}
            onClick={() => handleAction('reject')}
            className="px-5 py-2.5 rounded-xl font-bold text-xs bg-red-50 text-red-600 hover:bg-red-100 border border-red-100 transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            <X className="w-4 h-4" /> Reject & Discard
          </button>
          
          {isEditing ? (
            <button 
              disabled={isSubmitting}
              onClick={() => handleAction('edit')}
              className="px-5 py-2.5 rounded-xl font-bold text-xs bg-teal-accent text-white hover:bg-teal-accent/90 shadow-md transition-all flex items-center gap-2 disabled:opacity-50"
            >
              <Check className="w-4 h-4" /> Save Edits & Publish
            </button>
          ) : (
            <button 
              disabled={isSubmitting}
              onClick={() => handleAction('approve')}
              className="px-5 py-2.5 rounded-xl font-bold text-xs bg-teal-accent text-white hover:bg-teal-accent/90 shadow-md transition-all flex items-center gap-2 disabled:opacity-50"
            >
              <Check className="w-4 h-4" /> Approve & Publish
            </button>
          )}
        </div>
      </main>
    </div>
  );
}
