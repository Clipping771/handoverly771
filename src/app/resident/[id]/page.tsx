'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContextProvider';
import { useRouter, useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { ChevronLeft, Brain, Activity, TrendingUp, AlertTriangle, Play, FileText, Sun, Moon, History, RotateCcw, Pencil, X, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import ActivityTimeline from '@/components/ActivityTimeline';
import MedicationsList from '@/components/MedicationsList';
import ExternalCommsLog from '@/components/ExternalCommsLog';
import SirsReportingForm from '@/components/SirsReportingForm';
import VitalsTrending from '@/components/VitalsTrending';
import toast from 'react-hot-toast';
import { ShieldAlert, CheckCircle2, Lightbulb } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface Resident {
  id: string;
  name: string;
  room_number: string;
  care_level: string;
  dob: string;
  wing_id?: string;
  facility_id?: string;
}

interface Wing {
  id: string;
  name: string;
}

interface ProactiveAlert {
  id: string;
  severity: 'critical' | 'warning';
  message: string;
  evidence: string;
}

interface OptimizationSuggestion {
  id: string;
  message: string;
  evidence: string;
}

interface Insights {
  summary: string;
  risk_level: 'Low' | 'Medium' | 'High';
  proactive_alerts: ProactiveAlert[];
  optimizations: OptimizationSuggestion[];
}

const MotionLink = motion.create(Link);

export default function ResidentProfile() {
  const { user, facility, isLoading: authLoading } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const router = useRouter();
  const params = useParams();
  const residentId = params.id as string;

  const [resident, setResident] = useState<Resident | null>(null);
  const [insights, setInsights] = useState<Insights | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingInsights, setLoadingInsights] = useState(false);
  const [error, setError] = useState('');
  const [activeBottomTab, setActiveBottomTab] = useState<'timeline' | 'history' | 'medications' | 'comms'>('timeline');
  const [unacknowledgedTasks, setUnacknowledgedTasks] = useState<any[]>([]);

  // Edit modal state
  const [showEditModal, setShowEditModal] = useState(false);
  const [wings, setWings] = useState<Wing[]>([]);
  const [editForm, setEditForm] = useState({ name: '', room_number: '', dob: '', care_level: 'High', wing_id: '' });
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError, setEditError] = useState('');

  // SIRS state
  const [showSirsForm, setShowSirsForm] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!residentId) return;

    const fetchResident = async () => {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('residents')
          .select('*')
          .eq('id', residentId)
          .eq('facility_id', facility?.id)
          .single();

        if (error) throw error;
        setResident(data);
      } catch (err: any) {
        setError(err.message || 'Failed to load resident');
      } finally {
        setLoading(false);
      }
    };

    fetchResident();

    const handleRefresh = () => fetchResident();
    window.addEventListener('refresh_data', handleRefresh);
    return () => window.removeEventListener('refresh_data', handleRefresh);
  }, [residentId]);

  // Fetch wings when resident loads
  useEffect(() => {
    if (!resident?.facility_id) return;
    supabase
      .from('wings')
      .select('id, name')
      .eq('facility_id', resident.facility_id)
      .order('name')
      .then(({ data }) => setWings(data || []));
  }, [resident?.facility_id]);

  const openEditModal = () => {
    if (!resident) return;
    setEditForm({
      name: resident.name,
      room_number: resident.room_number,
      dob: resident.dob || '',
      care_level: resident.care_level,
      wing_id: resident.wing_id || ''
    });
    setEditError('');
    setShowEditModal(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resident) return;
    if (!editForm.name || !editForm.room_number) {
      setEditError('Name and room number are required.');
      return;
    }
    setEditSubmitting(true);
    setEditError('');
    try {
      const { data, error } = await supabase
        .from('residents')
        .update({
          name: editForm.name.trim(),
          room_number: editForm.room_number.trim(),
          dob: editForm.dob || null,
          care_level: editForm.care_level,
          wing_id: editForm.wing_id || null
        })
        .eq('id', resident.id)
        .eq('facility_id', facility?.id)
        .select()
        .single();
      if (error) throw error;
      setResident(data);
      setShowEditModal(false);
    } catch (err: any) {
      setEditError(err.message || 'Failed to update resident.');
    } finally {
      setEditSubmitting(false);
    }
  };

  const generateInsights = async (forceRefresh = false) => {
    if (!residentId) return;
    
    setLoadingInsights(true);
    try {
      const userKeys = {
        anthropicKey: typeof window !== 'undefined' ? localStorage.getItem('user_anthropic_key') || '' : '',
      };

      const res = await fetch('/api/generate-insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ residentId, userKeys, forceRefresh })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      
      setInsights(data);
    } catch (err: any) {
      console.error('Failed to generate insights:', err);
    } finally {
      setLoadingInsights(false);
    }
  };

  const handleAcknowledgeAlert = async (alertId: string, alertMessage: string) => {
    if (!resident || !user || !facility) return;
    
    try {
      const { error } = await supabase
        .from('activity_timeline')
        .insert({
          resident_id: resident.id,
          staff_id: user.id,
          facility_id: facility.id,
          action_type: 'insight_acknowledged',
          description: `Acknowledged alert: ${alertId} (${alertMessage.substring(0, 45)}...) by ${user.name}`,
          metadata: {
            alert_id: alertId
          }
        });
        
      if (error) throw error;
      
      // Update local state by filtering out acknowledged alert
      setInsights(prev => {
        if (!prev) return null;
        return {
          ...prev,
          proactive_alerts: prev.proactive_alerts.filter(a => a.id !== alertId)
        };
      });
      
      toast.success('Alert acknowledged and muted.');
      
      // Refresh database cache
      generateInsights(true);
    } catch (e: any) {
      console.error('Failed to acknowledge alert:', e);
      toast.error('Failed to acknowledge alert.');
    }
  };

  useEffect(() => {
    if (resident) {
      generateInsights(false); // Use cache on load
    }
  }, [resident]);

  useEffect(() => {
    if (!residentId) return;
    
    const fetchUnacknowledgedTasks = async () => {
      try {
        const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
        const { data, error } = await supabase
          .from('tasks')
          .select(`
            id, title, description, tags, created_at,
            handover:handovers(urgency)
          `)
          .eq('resident_id', residentId)
          .eq('facility_id', facility?.id)
          .is('outcome', null)
          .lt('created_at', twoHoursAgo);

        if (!error && data) {
          const priorityTasks = data.filter((t: any) => {
            const urgency = t.handover?.urgency || 'routine';
            const hasPriorityTag = t.tags?.includes('medication') || t.tags?.includes('incidents');
            return urgency === 'critical' || urgency === 'attention' || hasPriorityTag;
          });
          setUnacknowledgedTasks(priorityTasks);
        }
      } catch (err) {
        console.error('Failed to fetch unacknowledged tasks:', err);
      }
    };

    fetchUnacknowledgedTasks();
    const timer = setInterval(fetchUnacknowledgedTasks, 60000);
    return () => clearInterval(timer);
  }, [residentId]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center">
        <div className="w-10 h-10 border-2 border-slate-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="mt-4 text-slate-500 dark:text-slate-400 font-mono text-xs tracking-widest uppercase">Loading Profile...</p>
      </div>
    );
  }

  if (error || !resident) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center text-rose-500">
        Error: {error || 'Resident not found'}
      </div>
    );
  }

  const age = new Date().getFullYear() - new Date(resident.dob).getFullYear();

  return (
    <div className="min-h-screen bg-background text-text-primary flex flex-col pb-12 transition-colors duration-300">
      
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/80 dark:bg-[#0b0b0d]/80 backdrop-blur-md border-b border-[#e3e3e3] dark:border-[#202024] px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <MotionLink 
            href="/shift" 
            whileHover={{ x: -2 }}
            whileTap={{ scale: 0.98 }}
            className="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-[#1f1f1f] dark:text-slate-400 dark:hover:text-white transition-colors outline-none focus:outline-none focus-visible:outline-none"
          >
            <ChevronLeft className="w-4 h-4" />
            Back to Registry
          </MotionLink>
          <div className="flex items-center gap-2">
            {/* Edit Resident — non-carer only */}
            {user?.role !== 'carer' && (
              <motion.button
                onClick={openEditModal}
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.92 }}
                className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-900 text-slate-500 dark:text-slate-400 transition-colors cursor-pointer outline-none focus:outline-none focus-visible:outline-none"
                title="Edit Resident Info"
              >
                <Pencil className="w-4 h-4" />
              </motion.button>
            )}
            <motion.button
              onClick={toggleTheme}
              whileHover={{ scale: 1.08, rotate: 15 }}
              whileTap={{ scale: 0.92, rotate: -15 }}
              className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-900 text-slate-600 dark:text-slate-400 transition-colors cursor-pointer outline-none focus:outline-none focus-visible:outline-none"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-500" /> : <Moon className="w-4 h-4 text-[#1f1f1f]" />}
            </motion.button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main id="printable-ehr" className="max-w-4xl mx-auto w-full px-6 mt-10">
        
        {/* Resident Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
          <div>
            <div className="flex items-center gap-3 mb-2">
               <span className="text-xs font-bold px-3 py-1 rounded-full bg-slate-200 text-slate-800 dark:bg-[#1c1c21] dark:text-slate-300">
                  Room {resident.room_number}
               </span>
               <span className="text-xs font-bold px-3 py-1 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                  {resident.care_level} Care
               </span>
            </div>
            <h1 className="text-4xl font-normal tracking-tight text-[#1f1f1f] dark:text-white">
              {resident.name} <span className="text-xl text-slate-400 dark:text-slate-500">({age} yrs)</span>
            </h1>
          </div>
          
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <motion.button
              onClick={async () => {
                try {
                  const html2pdf = (await import('html2pdf.js')).default;
                  const element = document.getElementById('printable-ehr');
                  if (!element) {
                     toast.error('Could not find EHR content to print.');
                     return;
                  }
                  
                  // Clone the element to format for print
                  const clone = element.cloneNode(true) as HTMLElement;
                  clone.classList.add('p-8', 'bg-white');
                  
                  const opt = {
                    margin:       10,
                    filename:     `Handoverly_EHR_${resident.name.replace(/\s+/g, '_')}.pdf`,
                    image:        { type: 'jpeg' as const, quality: 0.98 },
                    html2canvas:  { scale: 2, useCORS: true },
                    jsPDF:        { unit: 'mm' as const, format: 'a4' as const, orientation: 'portrait' as const }
                  };
                  
                  toast.success('Generating PDF...');
                  html2pdf().set(opt).from(clone).save();
                } catch (e) {
                  console.error(e);
                  toast.error('Failed to generate PDF');
                }
              }}
              whileHover={{ scale: 1.03, y: -2 }}
              whileTap={{ scale: 0.97 }}
              className="px-6 py-3 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs tracking-widest uppercase transition-all duration-300 flex items-center gap-2 shadow-sm whitespace-nowrap cursor-pointer"
            >
              <FileText className="w-4 h-4" />
              Export to PDF
            </motion.button>
            <motion.button
              onClick={() => setShowSirsForm(true)}
              whileHover={{ scale: 1.03, y: -2 }}
              whileTap={{ scale: 0.97 }}
              className="px-6 py-3 rounded-full bg-rose-50 hover:bg-rose-100 dark:bg-rose-500/10 dark:hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 font-bold text-xs tracking-widest uppercase transition-all duration-300 flex items-center gap-2 shadow-sm whitespace-nowrap cursor-pointer border border-rose-200 dark:border-rose-500/30"
            >
              <AlertTriangle className="w-4 h-4" />
              Report Incident (SIRS)
            </motion.button>
            <MotionLink
              href={`/resident/${resident.id}/ed-transfer`}
              whileHover={{ scale: 1.03, y: -2 }}
              whileTap={{ scale: 0.97 }}
              className="px-6 py-3 rounded-full bg-amber-50 hover:bg-amber-100 dark:bg-amber-500/10 dark:hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 font-bold text-xs tracking-widest uppercase transition-all duration-300 flex items-center gap-2 shadow-sm whitespace-nowrap cursor-pointer"
            >
              <AlertCircle className="w-4 h-4" />
              ED Transfer Pack
            </MotionLink>
            <MotionLink
              href={`/resident/${resident.id}/input`}
              whileHover={{ scale: 1.03, y: -2 }}
              whileTap={{ scale: 0.97 }}
              className="px-6 py-3 rounded-full bg-primary hover:opacity-95 text-white font-bold text-xs tracking-widest uppercase transition-all duration-300 flex items-center gap-2 shadow-md hover:shadow-lg whitespace-nowrap cursor-pointer outline-none focus:outline-none focus-visible:outline-none"
            >
              <Play className="w-4 h-4" />
              Start New Handover
            </MotionLink>
          </div>
        </div>

        {/* Unacknowledged Escalation Warning Banner */}
        {unacknowledgedTasks.length > 0 && (
          <div className="mb-6 p-5 rounded-[24px] border border-rose-200 bg-rose-50/20 dark:border-rose-900/30 dark:bg-rose-950/10 space-y-3 relative z-10">
            <h4 className="text-xs font-bold text-rose-800 dark:text-rose-400 uppercase tracking-wider flex items-center gap-1.5 font-sans">
              <ShieldAlert className="w-4.5 h-4.5 text-rose-500 animate-pulse" />
              SIRS Compliance Warning: Uncompleted Critical Tasks
            </h4>
            <div className="text-xs text-rose-800 dark:text-rose-350 leading-relaxed font-semibold">
              The following critical care tasks have remained uncompleted for over 2 hours and may violate shift transition governance:
            </div>
            <ul className="space-y-2">
              {unacknowledgedTasks.map((t) => (
                <li key={t.id} className="text-xs text-slate-700 dark:text-slate-350 bg-white dark:bg-[#121214] p-3 rounded-xl border border-rose-100 dark:border-rose-955/40 flex items-start justify-between gap-3">
                  <div>
                    <strong className="text-slate-900 dark:text-white">{t.title}</strong> - {t.description}
                    <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                      Created: {new Date(t.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} ({new Date(t.created_at).toLocaleDateString([], { day: 'numeric', month: 'short' })})
                    </div>
                  </div>
                  <span className="text-[9px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-md bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-455 shrink-0">
                    Overdue
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Vitals Trending Sparklines */}
        <VitalsTrending residentId={residentId} />

        {/* Smart Insights Panel */}
        <section className="apple-card rounded-[32px] p-8 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3"></div>
          
          <div className="flex items-center justify-between mb-8 relative z-10">
             <div className="flex items-center gap-3">
               <div className="w-12 h-12 rounded-2xl bg-primary/10 dark:bg-primary/20 flex items-center justify-center">
                 <Brain className="w-6 h-6 text-primary" />
               </div>
               <div>
                 <h2 className="text-xl font-bold text-slate-900 dark:text-white">Smart Insights</h2>
                 <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">AI Analysis of the last 7 days</p>
               </div>
             </div>
             <button
                onClick={() => generateInsights(true)}
                disabled={loadingInsights}
                className="p-2 rounded-full bg-slate-50 hover:bg-slate-100 dark:bg-[#1c1c21] dark:hover:bg-[#25252b] text-slate-500 transition-colors disabled:opacity-50 cursor-pointer"
                title="Force Refresh Insights"
              >
                <Activity className={`w-5 h-5 ${loadingInsights ? 'animate-spin text-primary' : ''}`} />
              </button>
           </div>
           
           {loadingInsights ? (
            <div className="grid md:grid-cols-2 gap-8 relative z-10 animate-pulse">
               <div className="space-y-6">
                 <div>
                   <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-1/3 mb-3"></div>
                   <div className="h-24 bg-slate-100 dark:bg-slate-900/60 rounded-2xl"></div>
                 </div>
                 <div>
                   <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-1/4 mb-3"></div>
                   <div className="h-8 bg-slate-100 dark:bg-slate-900/60 rounded-full w-1/3"></div>
                 </div>
               </div>
               <div className="space-y-6">
                 <div>
                   <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-1/3 mb-3"></div>
                   <div className="h-20 bg-slate-100 dark:bg-slate-900/60 rounded-2xl"></div>
                 </div>
                 <div>
                   <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-1/3 mb-3"></div>
                   <div className="h-20 bg-slate-100 dark:bg-slate-900/60 rounded-2xl"></div>
                 </div>
               </div>
            </div>
          ) : insights ? (
            <div className="grid md:grid-cols-2 gap-8 relative z-10">
              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-3 flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    Clinical Summary
                  </h3>
                  <p className="text-sm text-slate-700 dark:text-slate-350 leading-relaxed bg-slate-50/50 dark:bg-slate-900/40 p-4.5 rounded-2xl border border-border">
                    {insights.summary}
                  </p>
                </div>
                
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-3 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" />
                    Resident Risk Level
                  </h3>
                  <div className={`inline-flex px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider ${
                    insights.risk_level === 'High' ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/30 dark:text-rose-400' :
                    insights.risk_level === 'Medium' ? 'bg-amber-100 text-amber-700 dark:bg-amber-955/20 dark:text-amber-400' :
                    'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400'
                  }`}>
                    {insights.risk_level} Risk Profile
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-3 flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 text-rose-500" />
                    Proactive Safety Alerts
                  </h3>
                  {insights.proactive_alerts?.length === 0 ? (
                    <div className="text-xs text-slate-400 dark:text-slate-500 italic p-4 bg-slate-50/55 dark:bg-slate-900/20 rounded-2xl border border-border">
                      No active critical care alerts.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {insights.proactive_alerts?.map((alert: any) => (
                        <div key={alert.id} className={`p-4 rounded-2xl border flex flex-col gap-2 ${
                          alert.severity === 'critical' 
                            ? 'bg-rose-50/20 border-rose-200/60 dark:bg-[#1c1216] dark:border-rose-900/30' 
                            : 'bg-amber-50/20 border-amber-200/60 dark:bg-[#1c1912] dark:border-amber-900/30'
                        }`}>
                          <div className="flex items-start justify-between gap-3">
                            <span className={`text-[9px] uppercase tracking-widest font-bold px-2 py-0.5 rounded-md ${
                              alert.severity === 'critical' ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-455' : 'bg-amber-100 text-amber-750 dark:bg-amber-950/40 dark:text-amber-450'
                            }`}>
                              {alert.severity}
                            </span>
                            <button
                              onClick={() => handleAcknowledgeAlert(alert.id, alert.message)}
                              className="text-[9px] font-bold text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors uppercase tracking-wider cursor-pointer"
                            >
                              Acknowledge
                            </button>
                          </div>
                          <p className="text-xs text-slate-805 dark:text-slate-250 leading-relaxed font-semibold">
                            {alert.message}
                          </p>
                          <span className="text-[9px] text-slate-400 dark:text-slate-500 font-medium">
                            Evidence: {alert.evidence}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
 
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-3 flex items-center gap-2">
                    <Lightbulb className="w-4 h-4 text-violet-500" />
                    Care Optimizations
                  </h3>
                  {insights.optimizations?.length === 0 ? (
                    <div className="text-xs text-slate-400 dark:text-slate-500 italic p-4 bg-slate-50/55 dark:bg-slate-900/20 rounded-2xl border border-border">
                      No suggestions at this time.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {insights.optimizations?.map((opt: any) => (
                        <div key={opt.id} className="p-4 bg-primary/5 border border-border rounded-2xl flex flex-col gap-1.5">
                          <p className="text-xs text-slate-750 dark:text-slate-300 leading-relaxed font-medium">
                            {opt.message}
                          </p>
                          <span className="text-[9px] text-slate-400 dark:text-slate-500 font-medium">
                            Evidence: {opt.evidence}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="py-8 text-center text-slate-500">
              No insights generated yet.
            </div>
          )}
        </section>

        {/* Lower Section Tabs: Activity Timeline vs Handover Version History */}
        <section className="mt-12 mb-10">
          <div className="flex p-1 bg-slate-100/60 dark:bg-slate-800/40 backdrop-blur-md rounded-full border border-slate-200/50 dark:border-white/5 relative z-10 w-full max-w-[600px] shadow-sm mb-6">
            <button
              onClick={() => setActiveBottomTab('timeline')}
              className="flex-1 py-2 text-xs font-bold rounded-full relative transition-colors duration-300 tracking-wider uppercase outline-none focus:outline-none focus-visible:outline-none cursor-pointer z-20 text-center"
            >
              {activeBottomTab === 'timeline' && (
                <motion.div
                  layoutId="activeTabIndicator"
                  className="absolute inset-0 bg-white dark:bg-slate-700 rounded-full z-[-1] shadow-xs"
                  transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                />
              )}
              <span className={`transition-colors duration-300 ${activeBottomTab === 'timeline' ? 'text-primary' : 'text-slate-500 hover:text-slate-850 dark:text-slate-400 dark:hover:text-slate-200'}`}>
                Activity Timeline
              </span>
            </button>
            <button
              onClick={() => setActiveBottomTab('medications')}
              className="flex-1 py-2 text-xs font-bold rounded-full relative transition-colors duration-300 tracking-wider uppercase outline-none focus:outline-none focus-visible:outline-none cursor-pointer z-20 text-center"
            >
              {activeBottomTab === 'medications' && (
                <motion.div
                  layoutId="activeTabIndicator"
                  className="absolute inset-0 bg-white dark:bg-slate-700 rounded-full z-[-1] shadow-xs"
                  transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                />
              )}
              <span className={`transition-colors duration-300 ${activeBottomTab === 'medications' ? 'text-primary' : 'text-slate-500 hover:text-slate-850 dark:text-slate-400 dark:hover:text-slate-200'}`}>
                Medications
              </span>
            </button>
            <button
              onClick={() => setActiveBottomTab('comms')}
              className="flex-1 py-2 text-xs font-bold rounded-full relative transition-colors duration-300 tracking-wider uppercase outline-none focus:outline-none focus-visible:outline-none cursor-pointer z-20 text-center"
            >
              {activeBottomTab === 'comms' && (
                <motion.div
                  layoutId="activeTabIndicator"
                  className="absolute inset-0 bg-white dark:bg-slate-700 rounded-full z-[-1] shadow-xs"
                  transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                />
              )}
              <span className={`transition-colors duration-300 ${activeBottomTab === 'comms' ? 'text-primary' : 'text-slate-500 hover:text-slate-850 dark:text-slate-400 dark:hover:text-slate-200'}`}>
                External Comms
              </span>
            </button>
          </div>

          {activeBottomTab === 'timeline' && <ActivityTimeline residentId={residentId} />}
          {activeBottomTab === 'history' && <HandoverHistory residentId={residentId} />}
          {activeBottomTab === 'medications' && <MedicationsList residentId={residentId} facilityId={resident?.facility_id} />}
          {activeBottomTab === 'comms' && <ExternalCommsLog residentId={residentId} facilityId={resident?.facility_id} />}
        </section>

      </main>

      {/* Edit Resident Modal */}
      {showEditModal && resident && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md px-4">
          <div className="w-full max-w-[400px] bg-white dark:bg-[#121214] border border-[#e3e3e3] dark:border-[#202024] p-7 rounded-[28px] shadow-2xl flex flex-col">
            <div className="flex items-center justify-between border-b border-[#e3e3e3] dark:border-[#202024] pb-4 mb-6">
              <div>
                <h3 className="text-lg font-normal tracking-tight text-slate-900 dark:text-white">Edit Resident</h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Update profile details for {resident.name}.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowEditModal(false)}
                className="p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-900 text-slate-400 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {editError && (
              <div className="mb-4 p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 dark:bg-rose-950/40 dark:border-rose-500/30 dark:text-rose-200 text-xs flex items-center gap-2.5">
                <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
                <span className="font-semibold">{editError}</span>
              </div>
            )}

            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div>
                <label className="text-[10px] font-bold text-slate-450 dark:text-slate-500 uppercase tracking-wider block mb-1">Full Name</label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full h-11 bg-slate-50 dark:bg-slate-900/60 border border-[#e3e3e3] dark:border-[#202024] rounded-xl px-3.5 text-xs focus:outline-none focus:border-[#1f1f1f] dark:focus:border-[#e3e3e3] text-slate-800 dark:text-slate-100 font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-450 dark:text-slate-500 uppercase tracking-wider block mb-1">Room No.</label>
                  <input
                    type="text"
                    value={editForm.room_number}
                    onChange={e => setEditForm(f => ({ ...f, room_number: e.target.value }))}
                    className="w-full h-11 bg-slate-50 dark:bg-slate-900/60 border border-[#e3e3e3] dark:border-[#202024] rounded-xl px-3.5 text-xs focus:outline-none focus:border-[#1f1f1f] dark:focus:border-[#e3e3e3] text-slate-800 dark:text-slate-100 font-bold"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-450 dark:text-slate-500 uppercase tracking-wider block mb-1">DOB</label>
                  <input
                    type="date"
                    value={editForm.dob}
                    onChange={e => setEditForm(f => ({ ...f, dob: e.target.value }))}
                    className="w-full h-11 bg-slate-50 dark:bg-slate-900/60 border border-[#e3e3e3] dark:border-[#202024] rounded-xl px-3 text-xs focus:outline-none text-slate-700 dark:text-slate-300"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-450 dark:text-slate-500 uppercase tracking-wider block mb-1">Care Level</label>
                <select
                  value={editForm.care_level}
                  onChange={e => setEditForm(f => ({ ...f, care_level: e.target.value }))}
                  className="w-full h-11 bg-slate-50 dark:bg-slate-900/60 border border-[#e3e3e3] dark:border-[#202024] rounded-xl px-3.5 text-xs focus:outline-none text-slate-700 dark:text-slate-300"
                >
                  <option value="High">High Care</option>
                  <option value="Low">Low Care</option>
                  <option value="Dementia">Dementia Care</option>
                </select>
              </div>

              {wings.length > 0 && (
                <div>
                  <label className="text-[10px] font-bold text-slate-450 dark:text-slate-500 uppercase tracking-wider block mb-1">Wing</label>
                  <select
                    value={editForm.wing_id}
                    onChange={e => setEditForm(f => ({ ...f, wing_id: e.target.value }))}
                    className="w-full h-11 bg-slate-50 dark:bg-slate-900/60 border border-[#e3e3e3] dark:border-[#202024] rounded-xl px-3.5 text-xs focus:outline-none text-slate-700 dark:text-slate-300"
                  >
                    <option value="">No Wing (Unassigned)</option>
                    {wings.map(w => (
                      <option key={w.id} value={w.id}>{w.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex gap-3 pt-5 border-t border-[#e3e3e3] dark:border-[#202024] mt-6">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="flex-1 h-11 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-[#1c1c21] dark:hover:bg-[#25252b] text-slate-700 dark:text-slate-250 text-xs font-semibold tracking-wider uppercase transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editSubmitting}
                  className="flex-1 h-11 rounded-full bg-slate-800 hover:bg-slate-700 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-[#0b0b0d] text-xs font-semibold tracking-wider uppercase transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {editSubmitting ? (
                    <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  ) : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SIRS Reporting Form */}
      <SirsReportingForm
        isOpen={showSirsForm}
        onClose={() => setShowSirsForm(false)}
        residentId={residentId}
        facilityId={resident?.facility_id}
      />
    </div>
  );
}

function HandoverHistory({ residentId }: { residentId: string }) {
  const { facility } = useAuth();
  const [handovers, setHandovers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchHandovers = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('handovers')
        .select('*')
        .eq('resident_id', residentId)
        .eq('facility_id', facility?.id)
        .eq('status', 'published') // Only show published ones in EHR
        .eq('is_active', true)
        .order('shift_date', { ascending: false })
        .order('created_at', { ascending: false });
      
      if (!error && data) {
        setHandovers(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (facility?.id) {
      fetchHandovers();
    }
  }, [residentId, facility?.id]);

  if (loading) return <div className="text-xs text-text-secondary">Loading longitudinal EHR...</div>;
  if (handovers.length === 0) return <div className="text-xs text-text-secondary italic p-4 bg-surface rounded-2xl">No published clinical records found.</div>;

  return (
    <div className="relative space-y-6 before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-border-solid before:to-transparent">
      {handovers.map((h, index) => (
        <div key={h.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
          {/* Timeline Marker */}
          <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-background bg-surface-solid shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 text-primary z-10">
            <Activity className="w-4 h-4" />
          </div>
          
          {/* Card */}
          <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] apple-card p-5 rounded-3xl group-hover:-translate-y-1 transition-all">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-primary/10 text-primary capitalize tracking-wide">
                {h.shift_type} Shift
              </span>
              <span className="text-[10px] font-bold text-text-secondary tracking-widest uppercase">
                {new Date(h.shift_date + 'T00:00:00').toLocaleDateString([], { day: 'numeric', month: 'short' })}
              </span>
            </div>

            <div className="space-y-4">
              <div>
                <h4 className="text-[10px] font-bold text-text-secondary uppercase tracking-widest mb-1.5 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span> Situation
                </h4>
                <p className="text-xs text-text-primary leading-relaxed">
                  {h.rn_summary?.situation || 'No situation detailed.'}
                </p>
              </div>
              
              <div>
                <h4 className="text-[10px] font-bold text-text-secondary uppercase tracking-widest mb-1.5 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-purple-500"></span> Background
                </h4>
                <p className="text-xs text-text-primary leading-relaxed line-clamp-2 hover:line-clamp-none transition-all">
                  {h.rn_summary?.background || 'No background detailed.'}
                </p>
              </div>

              <div>
                <h4 className="text-[10px] font-bold text-text-secondary uppercase tracking-widest mb-1.5 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span> Assessment
                </h4>
                <p className="text-xs text-text-primary leading-relaxed line-clamp-2 hover:line-clamp-none transition-all">
                  {h.rn_summary?.assessment || 'No assessment detailed.'}
                </p>
              </div>

              <div>
                <h4 className="text-[10px] font-bold text-text-secondary uppercase tracking-widest mb-1.5 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Recommendation
                </h4>
                <p className="text-xs text-text-primary leading-relaxed font-medium">
                  {h.rn_summary?.recommendation || 'No recommendations.'}
                </p>
              </div>
            </div>

            {h.risk_flags && h.risk_flags.length > 0 && (
              <div className="mt-4 pt-4 border-t border-border flex flex-wrap gap-1.5">
                {h.risk_flags.map((flag: string, i: number) => (
                  <span key={i} className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-rose-500/10 text-rose-500 border border-rose-500/20">
                    {flag}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
