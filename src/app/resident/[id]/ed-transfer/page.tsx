'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useRouter, useParams } from 'next/navigation';
import { ChevronLeft, Printer, AlertTriangle, ShieldAlert, Pill, FileText } from 'lucide-react';
import Link from 'next/link';

export default function EDTransferPage() {
  const { user, facility, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const residentId = params.id as string;

  const [resident, setResident] = useState<any>(null);
  const [meds, setMeds] = useState<any[]>([]);
  const [latestHandover, setLatestHandover] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) router.push('/login');
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!residentId) return;

    const fetchData = async () => {
      try {
        setLoading(true);
        // Resident
        const { data: resData } = await supabase.from('residents').select('*').eq('id', residentId).single();
        if (resData) setResident(resData);

        // Meds - Bypass RLS via API
        const res = await fetch(`/api/medications?residentId=${residentId}`);
        const medJson = await res.json();
        if (res.ok && medJson.success && medJson.data) {
          setMeds(medJson.data.filter((m: any) => m.status === 'active'));
        }
        // Latest Handover (ISBAR)
        const { data: hData } = await supabase.from('handovers').select('*').eq('resident_id', residentId).order('created_at', { ascending: false }).limit(1).single();
        if (hData) {
          if (hData.submitted_by) {
            const { data: staffData } = await supabase.from('staff').select('name').eq('id', hData.submitted_by).single();
            if (staffData) hData.submitted_by_name = staffData.name;
          }
          setLatestHandover(hData);
        }

      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [residentId]);

  if (loading || authLoading) {
    return <div className="min-h-screen flex items-center justify-center">Loading Transfer Pack...</div>;
  }

  if (!resident) {
    return <div className="min-h-screen flex items-center justify-center">Resident not found.</div>;
  }

  const age = new Date().getFullYear() - new Date(resident.dob).getFullYear();

  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-[#020617] text-slate-900 dark:text-slate-100 font-sans pb-20">
      <div className="print:hidden sticky top-0 z-40 bg-white/80 dark:bg-[#0c1220]/80 backdrop-blur-md border-b border-slate-200/50 dark:border-white/5 px-6 py-4 flex justify-between items-center shadow-sm">
        <Link href={`/resident/${resident.id}`} className="flex items-center gap-2 text-slate-600 dark:text-slate-400 hover:text-primary transition-colors font-bold text-sm">
          <ChevronLeft className="w-5 h-5" /> Back to Profile
        </Link>
        <button onClick={() => window.print()} className="flex items-center gap-2 bg-primary text-white px-5 py-2.5 rounded-full font-bold text-xs tracking-widest uppercase hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 cursor-pointer">
          <Printer className="w-4 h-4" /> Print ED Pack
        </button>
      </div>

      <div className="max-w-4xl mx-auto p-8 print:p-0 print:max-w-full">
        {/* Header Section */}
        <div className="relative overflow-hidden bg-white dark:bg-[#0c1220] rounded-[32px] p-8 mb-10 shadow-sm border border-slate-200/50 dark:border-white/5 print:border-0 print:border-b-4 print:border-rose-600 print:rounded-none print:shadow-none print:bg-transparent print:p-0 print:mb-8 flex justify-between items-end">
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-rose-500 to-rose-600 print:hidden"></div>
          <div className="relative z-10">
            <h1 className="text-4xl font-black uppercase tracking-tight text-slate-900 dark:text-white mb-2">Emergency Transfer Pack</h1>
            <p className="text-slate-500 dark:text-slate-400 font-bold tracking-widest uppercase text-sm">Facility: {facility?.name}</p>
            <p className="text-slate-500 dark:text-slate-400 font-bold tracking-widest uppercase text-sm mt-1">Generated: {new Date().toLocaleString()}</p>
          </div>
          <div className="text-right relative z-10">
            <ShieldAlert className="w-16 h-16 text-rose-600 inline-block mb-2 drop-shadow-sm" />
            <div className="font-bold text-rose-600 tracking-widest uppercase">To Attending ED Officer</div>
          </div>
        </div>

        {/* Resident Demographics */}
        <section className="mb-10">
          <h2 className="text-sm font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-4 px-2">Patient Details</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 bg-white/60 dark:bg-[#0c1220]/60 backdrop-blur-md p-6 rounded-3xl border border-slate-200/50 dark:border-white/5 shadow-sm print:bg-transparent print:border print:border-slate-300 print:rounded-none print:shadow-none">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-1">Full Name</div>
              <div className="text-xl font-bold text-slate-900 dark:text-white">{resident.name}</div>
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-1">Date of Birth (Age)</div>
              <div className="text-xl font-bold text-slate-900 dark:text-white">{new Date(resident.dob).toLocaleDateString()} ({age}y)</div>
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-1">Room / Location</div>
              <div className="text-xl font-bold text-slate-900 dark:text-white">{resident.room_number}</div>
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-1">Care Level</div>
              <div className="text-xl font-bold text-slate-900 dark:text-white">{resident.care_level}</div>
            </div>
          </div>
        </section>

        {/* Latest Clinical Summary (ISBAR) */}
        <section className="mb-10">
          <h2 className="text-sm font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-4 px-2 flex items-center gap-2">
            <FileText className="w-4 h-4 text-primary" />
            Most Recent Clinical Summary (ISBAR)
          </h2>
          {latestHandover ? (
            <div className="bg-white/60 dark:bg-[#0c1220]/60 backdrop-blur-md p-6 rounded-3xl border border-slate-200/50 dark:border-white/5 shadow-sm print:bg-transparent print:border print:border-slate-300 print:rounded-none print:shadow-none">
              <div className="text-[11px] font-bold tracking-wider uppercase text-slate-500 dark:text-slate-400 mb-6 bg-slate-100 dark:bg-slate-800/50 inline-block px-3 py-1.5 rounded-lg border border-slate-200/50 dark:border-white/5 print:border-none print:p-0 print:bg-transparent">
                Recorded by {latestHandover.submitted_by_name || 'Staff'} on {new Date(latestHandover.created_at).toLocaleString()}
              </div>
              <div className="space-y-5">
                {latestHandover.rn_summary ? (
                  <>
                    {latestHandover.rn_summary.situation && (
                      <div>
                        <h3 className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1.5 flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-indigo-500"></div>Situation</h3>
                        <p className="text-sm font-medium text-slate-800 dark:text-slate-200 whitespace-pre-wrap pl-3.5 border-l-2 border-indigo-500/20">{latestHandover.rn_summary.situation}</p>
                      </div>
                    )}
                    {latestHandover.rn_summary.background && (
                      <div>
                        <h3 className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1.5 flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>Background</h3>
                        <p className="text-sm font-medium text-slate-800 dark:text-slate-200 whitespace-pre-wrap pl-3.5 border-l-2 border-blue-500/20">{latestHandover.rn_summary.background}</p>
                      </div>
                    )}
                    {latestHandover.rn_summary.assessment && (
                      <div>
                        <h3 className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1.5 flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-purple-500"></div>Assessment</h3>
                        <p className="text-sm font-medium text-slate-800 dark:text-slate-200 whitespace-pre-wrap pl-3.5 border-l-2 border-purple-500/20">{latestHandover.rn_summary.assessment}</p>
                      </div>
                    )}
                    {latestHandover.rn_summary.recommendation && (
                      <div>
                        <h3 className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1.5 flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>Recommendation</h3>
                        <p className="text-sm font-medium text-slate-800 dark:text-slate-200 whitespace-pre-wrap pl-3.5 border-l-2 border-emerald-500/20">{latestHandover.rn_summary.recommendation}</p>
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-200 whitespace-pre-wrap p-4 bg-slate-100 dark:bg-slate-800/50 rounded-xl">{latestHandover.raw_input || 'No summary entered.'}</p>
                )}
              </div>
              
              {latestHandover.risk_flags && latestHandover.risk_flags.length > 0 && (
                <div className="mt-8 p-5 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 rounded-2xl print:border-rose-400 print:bg-transparent">
                  <h3 className="text-rose-700 dark:text-rose-400 font-bold text-[10px] uppercase tracking-widest mb-3 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" />
                    Active Risk Flags
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {latestHandover.risk_flags.map((flag: string, i: number) => (
                      <span key={i} className="px-3 py-1.5 bg-white dark:bg-[#0c1220] shadow-sm border border-rose-200 dark:border-rose-500/30 text-rose-700 dark:text-rose-400 font-bold rounded-lg text-xs uppercase tracking-wider print:shadow-none">
                        {flag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="p-8 bg-white/60 dark:bg-[#0c1220]/60 border border-dashed border-slate-300 dark:border-slate-700 rounded-3xl text-center text-slate-500 dark:text-slate-400 font-bold shadow-sm">
              No recent handover summary available.
            </div>
          )}
        </section>

        {/* Active Medications */}
        <section className="mb-10">
          <h2 className="text-sm font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-4 px-2 flex items-center gap-2">
            <Pill className="w-4 h-4 text-primary" />
            Current Active Medications
          </h2>
          {meds.length > 0 ? (
            <div className="bg-white/60 dark:bg-[#0c1220]/60 backdrop-blur-md rounded-3xl border border-slate-200/50 dark:border-white/5 shadow-sm overflow-hidden print:bg-transparent print:border print:border-slate-300 print:rounded-none print:shadow-none">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-white/5 border-b border-slate-200/50 dark:border-white/10 print:bg-transparent">
                    <th className="py-4 px-6 text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">Medication</th>
                    <th className="py-4 px-6 text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">Dosage</th>
                    <th className="py-4 px-6 text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">Frequency / Route</th>
                    <th className="py-4 px-6 text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">Last Reconciled</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/5 print:divide-slate-300">
                  {meds.map((m, idx) => (
                    <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors print:hover:bg-transparent">
                      <td className="py-4 px-6 font-bold text-slate-900 dark:text-slate-100">{m.medication_name}</td>
                      <td className="py-4 px-6 font-medium text-slate-700 dark:text-slate-300">{m.dosage}</td>
                      <td className="py-4 px-6 font-medium text-slate-700 dark:text-slate-300">{m.frequency} ({m.route})</td>
                      <td className="py-4 px-6 text-sm text-slate-500 dark:text-slate-400">{m.last_reconciled_at ? new Date(m.last_reconciled_at).toLocaleDateString() : 'N/A'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-8 bg-white/60 dark:bg-[#0c1220]/60 border border-dashed border-slate-300 dark:border-slate-700 rounded-3xl text-center text-slate-500 dark:text-slate-400 font-bold shadow-sm">
              No active medications recorded or script not executed.
            </div>
          )}
        </section>

      </div>
    </div>
  );
}
