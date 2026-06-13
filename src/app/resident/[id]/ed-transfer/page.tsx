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

        // Meds
        const { data: medData, error: medErr } = await supabase.from('medication_profiles').select('*').eq('resident_id', residentId).eq('status', 'active');
        if (!medErr && medData) setMeds(medData);

        // Latest Handover (ISBAR)
        const { data: hData } = await supabase.from('handovers').select('*').eq('resident_id', residentId).order('created_at', { ascending: false }).limit(1).single();
        if (hData) setLatestHandover(hData);

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
    <div className="min-h-screen bg-white text-black font-sans pb-20">
      <div className="print:hidden sticky top-0 z-40 bg-slate-50 border-b border-slate-200 px-6 py-4 flex justify-between items-center shadow-sm">
        <Link href={`/resident/${resident.id}`} className="flex items-center gap-2 text-slate-600 hover:text-black transition-colors font-bold text-sm">
          <ChevronLeft className="w-5 h-5" /> Back to Profile
        </Link>
        <button onClick={() => window.print()} className="flex items-center gap-2 bg-slate-900 text-white px-5 py-2.5 rounded-full font-bold text-xs tracking-widest uppercase hover:opacity-90 cursor-pointer">
          <Printer className="w-4 h-4" /> Print ED Pack
        </button>
      </div>

      <div className="max-w-4xl mx-auto p-8 print:p-0 print:max-w-full">
        {/* Header Section */}
        <div className="border-b-4 border-rose-600 pb-6 mb-8 flex justify-between items-end">
          <div>
            <h1 className="text-4xl font-black uppercase tracking-tight text-slate-900 mb-2">Emergency Transfer Pack</h1>
            <p className="text-slate-500 font-bold tracking-widest uppercase text-sm">Facility: {facility?.name}</p>
            <p className="text-slate-500 font-bold tracking-widest uppercase text-sm mt-1">Generated: {new Date().toLocaleString()}</p>
          </div>
          <div className="text-right">
            <ShieldAlert className="w-16 h-16 text-rose-600 inline-block mb-2" />
            <div className="font-bold text-rose-600 tracking-widest uppercase">To Attending ED Officer</div>
          </div>
        </div>

        {/* Resident Demographics */}
        <section className="mb-10">
          <h2 className="text-lg font-black uppercase tracking-widest text-slate-400 border-b border-slate-200 pb-2 mb-4">Patient Details</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 bg-slate-50 p-6 rounded-2xl print:bg-transparent print:border print:border-slate-300 print:rounded-none">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Full Name</div>
              <div className="text-xl font-bold">{resident.name}</div>
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Date of Birth (Age)</div>
              <div className="text-xl font-bold">{new Date(resident.dob).toLocaleDateString()} ({age}y)</div>
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Room / Location</div>
              <div className="text-xl font-bold">{resident.room_number}</div>
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Care Level</div>
              <div className="text-xl font-bold">{resident.care_level}</div>
            </div>
          </div>
        </section>

        {/* Latest Clinical Summary (ISBAR) */}
        <section className="mb-10">
          <h2 className="text-lg font-black uppercase tracking-widest text-slate-400 border-b border-slate-200 pb-2 mb-4 flex items-center gap-2">
            <FileText className="w-5 h-5 text-slate-400" />
            Most Recent Clinical Summary (ISBAR)
          </h2>
          {latestHandover ? (
            <div className="bg-slate-50 p-6 rounded-2xl print:bg-transparent print:border print:border-slate-300 print:rounded-none">
              <div className="text-sm font-bold text-slate-500 mb-4">
                Recorded by {latestHandover.submitted_by} on {new Date(latestHandover.created_at).toLocaleString()}
              </div>
              <div className="prose prose-sm max-w-none text-slate-800" dangerouslySetInnerHTML={{ __html: latestHandover.rn_summary }} />
              
              {latestHandover.risk_flags && latestHandover.risk_flags.length > 0 && (
                <div className="mt-6 p-4 bg-rose-50 border border-rose-200 rounded-xl print:border-rose-400">
                  <h3 className="text-rose-800 font-bold text-sm uppercase tracking-widest mb-2 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" />
                    Active Risk Flags
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {latestHandover.risk_flags.map((flag: string, i: number) => (
                      <span key={i} className="px-3 py-1 bg-white border border-rose-200 text-rose-700 font-bold rounded-lg text-xs uppercase tracking-wider">
                        {flag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="p-6 border border-dashed border-slate-300 rounded-2xl text-center text-slate-500 font-bold">
              No recent handover summary available.
            </div>
          )}
        </section>

        {/* Active Medications */}
        <section className="mb-10">
          <h2 className="text-lg font-black uppercase tracking-widest text-slate-400 border-b border-slate-200 pb-2 mb-4 flex items-center gap-2">
            <Pill className="w-5 h-5 text-slate-400" />
            Current Active Medications
          </h2>
          {meds.length > 0 ? (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b-2 border-slate-200">
                  <th className="py-3 px-4 text-xs font-bold uppercase tracking-widest text-slate-500">Medication</th>
                  <th className="py-3 px-4 text-xs font-bold uppercase tracking-widest text-slate-500">Dosage</th>
                  <th className="py-3 px-4 text-xs font-bold uppercase tracking-widest text-slate-500">Frequency / Route</th>
                  <th className="py-3 px-4 text-xs font-bold uppercase tracking-widest text-slate-500">Last Reconciled</th>
                </tr>
              </thead>
              <tbody>
                {meds.map((m, idx) => (
                  <tr key={idx} className="border-b border-slate-100 print:border-slate-300">
                    <td className="py-3 px-4 font-bold text-slate-900">{m.medication_name}</td>
                    <td className="py-3 px-4 font-medium text-slate-700">{m.dosage}</td>
                    <td className="py-3 px-4 font-medium text-slate-700">{m.frequency} ({m.route})</td>
                    <td className="py-3 px-4 text-sm text-slate-500">{m.last_reconciled_at ? new Date(m.last_reconciled_at).toLocaleDateString() : 'N/A'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="p-6 border border-dashed border-slate-300 rounded-2xl text-center text-slate-500 font-bold">
              No active medications recorded or script not executed.
            </div>
          )}
        </section>

      </div>
    </div>
  );
}
