'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { X, Calendar, Printer, ChevronDown, ChevronUp, AlertTriangle, ShieldAlert, CheckCircle2, Clock, Download, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { getAdelaideTodayStr } from '@/lib/taskUtils';

interface FullHandoverReportProps {
  onClose: () => void;
}

interface HandoverEntry {
  id: string;
  resident_id: string;
  shift_type: string;
  shift_date: string;
  urgency: string;
  raw_input: string;
  rn_summary: any;
  carer_tasks?: any[];
  created_at: string;
  approved_at: string;
  status: string;
  user: { name: string; role: string } | null;
}

interface Resident {
  id: string;
  name: string;
  room_number: string;
  care_level: string;
  is_active: boolean;
}

interface Task {
  id: string;
  title: string;
  description: string;
  is_completed: boolean;
  tags: string[];
  resident_id: string;
  created_at: string;
  carry_until_date: string | null;
  handover_id: string | null;
}

export default function FullHandoverReport({ onClose }: FullHandoverReportProps) {
  const { facility } = useAuth();
  const [selectedDate, setSelectedDate] = useState<string>(getAdelaideTodayStr());
  const [loading, setLoading] = useState(true);
  const [residents, setResidents] = useState<Record<string, Resident>>({});
  const [handovers, setHandovers] = useState<HandoverEntry[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [expandedResidents, setExpandedResidents] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!facility) return;
    
    const fetchData = async () => {
      setLoading(true);
      try {
        // Fetch residents
        const { data: residentsData } = await supabase
          .from('residents')
          .select('id, name, room_number, care_level, is_active')
          .eq('facility_id', facility.id);
          
        const resMap: Record<string, Resident> = {};
        (residentsData || []).forEach(r => {
          resMap[r.id] = r;
        });
        setResidents(resMap);

        // Fetch handovers for selected date
        const { data: handoverData } = await supabase
          .from('handovers')
          .select(`
            id, resident_id, shift_type, shift_date, urgency, raw_input, rn_summary, carer_tasks, created_at, approved_at, status,
            user:submitted_by(name, role)
          `)
          .eq('facility_id', facility.id)
          .eq('shift_date', selectedDate)
          .order('created_at', { ascending: true });
          
        setHandovers(handoverData as any || []);

        // Fetch tasks — use a wide ±1 day window around selectedDate to safely cover
        // Australia/Adelaide timezone (UTC+9:30 or +10:30 DST), then rely on resident
        // grouping to scope correctly. Carry-over tasks (carry_until_date) for this date
        // are also included so the report shows them.
        const prevDateObj = new Date(selectedDate);
        prevDateObj.setDate(prevDateObj.getDate() - 1);
        const prevDateStr = `${prevDateObj.getFullYear()}-${String(prevDateObj.getMonth() + 1).padStart(2, '0')}-${String(prevDateObj.getDate()).padStart(2, '0')}`;

        const nextDateObj = new Date(selectedDate);
        nextDateObj.setDate(nextDateObj.getDate() + 1);
        const nextDateStr = `${nextDateObj.getFullYear()}-${String(nextDateObj.getMonth() + 1).padStart(2, '0')}-${String(nextDateObj.getDate()).padStart(2, '0')}`;
        
        const { data: tasksData } = await supabase
          .from('tasks')
          .select('id, title, description, is_completed, tags, resident_id, created_at, carry_until_date, handover_id')
          .eq('facility_id', facility.id)
          .or(`and(created_at.gte.${prevDateStr}T00:00:00Z,created_at.lt.${nextDateStr}T23:59:59Z),carry_until_date.gte.${selectedDate}`);
          
        // Only include tasks that are actually linked to a handover on selectedDate,
        // OR carry-over tasks active on selectedDate
        const handoverIdsForDate = new Set((handoverData || []).map((h: any) => h.id));
        const filteredTasksData = (tasksData || []).filter((t: any) => {
          if (t.carry_until_date && t.carry_until_date >= selectedDate) return true;
          return t.handover_id && handoverIdsForDate.has(t.handover_id);
        });
        setTasks(filteredTasksData);
        
        // Expand residents with handovers by default
        const activeRes: Record<string, boolean> = {};
        (handoverData || []).forEach(h => {
          activeRes[h.resident_id] = true;
        });
        setExpandedResidents(activeRes);
        
      } catch (err) {
        console.error('Error fetching report data:', err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, [facility, selectedDate]);

  const toggleExpand = (resId: string) => {
    setExpandedResidents(prev => ({
      ...prev,
      [resId]: !prev[resId]
    }));
  };

  const handleDeleteHandover = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this handover log? This cannot be undone.')) return;
    try {
      const res = await fetch('/api/handovers/remove', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });
      
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to delete handover');
      }
      
      setHandovers(prev => prev.filter(h => h.id !== id));
    } catch (err) {
      console.error('Error deleting handover:', err);
      alert('Failed to delete handover. Please try again.');
    }
  };

  // Grouping
  const residentsWithData = useMemo(() => {
    const map = new Map<string, {
      resident: Resident;
      handovers: HandoverEntry[];
      tasks: Task[];
    }>();
    
    handovers.forEach(h => {
      if (!map.has(h.resident_id) && residents[h.resident_id]) {
        map.set(h.resident_id, { resident: residents[h.resident_id], handovers: [], tasks: [] });
      }
      map.get(h.resident_id)?.handovers.push(h);
    });
    
    tasks.forEach(t => {
      // If a task belongs to a resident that doesn't have a handover today, maybe we still show them?
      // For a "Handover Report", it's best to show residents who had either a task or handover today
      if (!map.has(t.resident_id) && residents[t.resident_id]) {
        map.set(t.resident_id, { resident: residents[t.resident_id], handovers: [], tasks: [] });
      }
      map.get(t.resident_id)?.tasks.push(t);
    });
    
    return Array.from(map.values()).sort((a, b) => {
      return a.resident.room_number.localeCompare(b.resident.room_number, undefined, { numeric: true });
    });
  }, [handovers, tasks, residents]);

  const shiftOrder = { morning: 1, afternoon: 2, night: 3 };

  return (
    <div className="fixed inset-0 z-[100] bg-background/95 backdrop-blur-3xl flex flex-col overflow-hidden print:bg-white print:static print:h-auto print:overflow-visible">
      {/* Header */}
      <div className="flex-none px-6 py-4 border-b border-border bg-surface/80 flex items-center justify-between print:hidden">
        <div>
          <h1 className="text-2xl font-bold text-text-primary tracking-tight">24-Hour Clinical Handover</h1>
          <p className="text-sm font-medium text-text-secondary mt-1">Complete audit trail across all shifts</p>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 bg-surface-solid border border-border rounded-xl p-1 shadow-sm">
            <div className="pl-3 text-text-secondary">
              <Calendar className="w-4 h-4" />
            </div>
            <input 
              type="date" 
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-transparent border-none text-sm font-bold text-text-primary focus:ring-0 cursor-pointer px-3 py-2 outline-none"
            />
          </div>
          
          <div className="w-px h-8 bg-border mx-2"></div>
          
          <button 
            onClick={onClose}
            className="p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main Content (UI View) */}
      <div id="report-ui-content" className="flex-1 overflow-y-auto p-6 md:p-8 custom-scrollbar print:hidden">
        <div className="max-w-5xl mx-auto space-y-6">
          
          {loading ? (
            <div className="flex justify-center items-center h-64">
              <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : residentsWithData.length === 0 ? (
            <div className="text-center py-20 bg-surface-solid rounded-[32px] border border-border">
              <ShieldAlert className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
              <h3 className="text-lg font-bold text-text-primary">No Handover Data</h3>
              <p className="text-sm text-text-secondary mt-2">No records found for the selected date.</p>
            </div>
          ) : (
            residentsWithData.map(({ resident, handovers, tasks }) => {
              const isExpanded = expandedResidents[resident.id];
              
              // Sort handovers: morning -> afternoon -> night
              const sortedHandovers = [...handovers].sort((a, b) => {
                const aOrder = shiftOrder[a.shift_type as keyof typeof shiftOrder] || 99;
                const bOrder = shiftOrder[b.shift_type as keyof typeof shiftOrder] || 99;
                return aOrder - bOrder;
              });

              // Check completion status of 3 shifts
              const completedShifts = new Set(handovers.map(h => h.shift_type));
              const hasMorning = completedShifts.has('morning');
              const hasAfternoon = completedShifts.has('afternoon');
              const hasNight = completedShifts.has('night');
              
              // Highest Urgency in the day
              const urgencies = handovers.map(h => h.urgency);
              const isCritical = urgencies.includes('critical');
              const isUrgent = urgencies.includes('urgent');

              return (
                <div key={resident.id} className="bg-white dark:bg-[#0f172a] rounded-[32px] border border-slate-200 dark:border-slate-800/60 shadow-sm overflow-hidden print:border-slate-300 print:shadow-none print:break-inside-avoid print:mb-6">
                  
                  {/* Resident Header */}
                  <div 
                    onClick={() => toggleExpand(resident.id)}
                    className="flex items-center justify-between p-5 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors print:bg-slate-50"
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-slate-500 bg-slate-100 dark:bg-slate-800 print:hidden ${isExpanded ? 'rotate-180' : ''} transition-transform`}>
                        <ChevronDown className="w-5 h-5" />
                      </div>
                      
                      <div>
                        <div className="flex items-center gap-3">
                          <h2 className="text-xl font-bold text-slate-900 dark:text-white print:text-black tracking-tight">{resident.name}</h2>
                          {isCritical ? (
                            <div className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse print:hidden"></div>
                          ) : isUrgent ? (
                            <div className="w-2.5 h-2.5 rounded-full bg-orange-500 print:hidden"></div>
                          ) : (
                            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 print:hidden"></div>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-1.5">
                          <span className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md print:border print:border-slate-300">
                            Room {resident.room_number}
                          </span>
                          <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-md border ${
                            resident.care_level.toLowerCase() === 'high' ? 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/30 dark:text-rose-400 dark:border-rose-900/50' : 
                            resident.care_level.toLowerCase() === 'medium' ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-900/50' : 
                            'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-900/50'
                          }`}>
                            Level {resident.care_level}
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex flex-col items-end gap-3">
                      <div className="flex gap-1.5">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${hasMorning ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300' : 'bg-slate-100 text-slate-400 dark:bg-slate-800'}`} title="Morning Shift">M</div>
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${hasAfternoon ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300' : 'bg-slate-100 text-slate-400 dark:bg-slate-800'}`} title="Afternoon Shift">A</div>
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${hasNight ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300' : 'bg-slate-100 text-slate-400 dark:bg-slate-800'}`} title="Night Shift">N</div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                          ({sortedHandovers.length} shifts)
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  {/* Expanded Content */}
                  <AnimatePresence>
                    {(isExpanded || window.matchMedia('print').matches) && (
                      <motion.div 
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="border-t border-slate-100 dark:border-slate-800/60 print:border-t-2 print:border-black"
                      >
                        <div className="p-5 md:p-6 space-y-6">
                          
                          {/* Shift Handovers */}
                          {sortedHandovers.length > 0 ? (
                            sortedHandovers.map(shift => {
                              const s = shift.rn_summary || {};
                              // Helper to gracefully extract values
                              const getValue = (field: any) => {
                                if (!field) return null;
                                if (typeof field === 'string') return field;
                                if (typeof field === 'object' && field.value) return field.value;
                                return null;
                              };

                              const identify = getValue(s.identify);
                              const situation = getValue(s.situation);
                              const background = getValue(s.background);
                              const assessment = getValue(s.assessment);
                              const recommendation = getValue(s.recommendation);
                              
                              const vitals = s.vitals || s.clinical_vitals || null;
                              
                              return (
                                <div key={shift.id} className="relative border border-slate-200 dark:border-slate-800/80 rounded-2xl p-5 bg-slate-50/50 dark:bg-[#070708]/30 print:bg-white print:border-slate-300 print:mb-4">
                                  
                                  {/* Shift Marker */}
                                  <div className="absolute top-0 left-0 w-1.5 h-full bg-indigo-500 rounded-l-2xl print:bg-black"></div>
                                  
                                  <div className="flex justify-between items-center mb-4 border-b border-slate-200 dark:border-slate-800 pb-3 pl-2">
                                    <div className="flex items-center gap-3">
                                      <span className="text-xs font-black uppercase tracking-widest text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm">
                                        {shift.shift_type} SHIFT
                                      </span>
                                      <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                                        {shift.user?.role?.toUpperCase()} • {shift.user?.name}
                                      </span>
                                    </div>
                                    <button
                                      onClick={() => handleDeleteHandover(shift.id)}
                                      className="p-1.5 text-rose-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/30 rounded-lg transition-colors print:hidden"
                                      title="Delete Handover"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </div>
                                  
                                  {/* ISBAR Layout */}
                                  <div className="pl-2 space-y-4">
                                    {identify && (
                                      <div className="grid grid-cols-[100px_1fr] md:grid-cols-[120px_1fr] gap-4 items-start">
                                        <span className="text-[10px] font-black text-indigo-500 uppercase tracking-widest mt-1">Identify</span>
                                        <p className="text-[13px] md:text-sm text-slate-800 dark:text-slate-300 leading-relaxed">{identify}</p>
                                      </div>
                                    )}
                                    {situation && (
                                      <div className="grid grid-cols-[100px_1fr] md:grid-cols-[120px_1fr] gap-4 items-start">
                                        <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest mt-1">Situation</span>
                                        <p className="text-[13px] md:text-sm text-slate-800 dark:text-slate-300 leading-relaxed font-medium">{situation}</p>
                                      </div>
                                    )}
                                    {background && (
                                      <div className="grid grid-cols-[100px_1fr] md:grid-cols-[120px_1fr] gap-4 items-start">
                                        <span className="text-[10px] font-black text-amber-500 uppercase tracking-widest mt-1">Background</span>
                                        <p className="text-[13px] md:text-sm text-slate-800 dark:text-slate-300 leading-relaxed">{background}</p>
                                      </div>
                                    )}
                                    {assessment && (
                                      <div className="grid grid-cols-[100px_1fr] md:grid-cols-[120px_1fr] gap-4 items-start">
                                        <span className="text-[10px] font-black text-rose-500 uppercase tracking-widest mt-1">Assessment</span>
                                        <p className="text-[13px] md:text-sm text-slate-800 dark:text-slate-300 leading-relaxed">{assessment}</p>
                                      </div>
                                    )}
                                    {recommendation && (
                                      <div className="grid grid-cols-[100px_1fr] md:grid-cols-[120px_1fr] gap-4 items-start">
                                        <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mt-1">Recommendation</span>
                                        <p className="text-[13px] md:text-sm text-slate-800 dark:text-slate-300 leading-relaxed font-medium">{recommendation}</p>
                                      </div>
                                    )}
                                    
                                    {/* Delegated Tasks Section */}
                                    {shift.carer_tasks && shift.carer_tasks.length > 0 && (
                                      <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-800">
                                        <span className="text-[10px] font-black text-indigo-500 dark:text-indigo-400 uppercase tracking-widest mb-3 block flex items-center gap-1.5">
                                          Delegated Tasks
                                        </span>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                          {shift.carer_tasks.map((task: any, idx: number) => {
                                            const role = (task.assigned_role || 'carer').toUpperCase();
                                            const roleColor = role === 'RN' ? 'text-rose-600 bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-900/50' : 
                                                              role === 'ALL' ? 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900/50' :
                                                              'text-amber-600 bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900/50';

                                            return (
                                              <div key={idx} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-3">
                                                <div className="flex justify-between items-start mb-1">
                                                  <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{task.title}</p>
                                                  <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded border ${roleColor}`}>
                                                    {role}
                                                  </span>
                                                </div>
                                                {task.description && <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">{task.description}</p>}
                                                {task.clinical_purpose && <p className="text-[11px] italic text-slate-500 dark:text-slate-400 mt-1.5">"{task.clinical_purpose}"</p>}
                                                {task.tags && task.tags.length > 0 && (
                                                  <div className="flex flex-wrap gap-1 mt-2">
                                                    {task.tags.map((tag: string) => (
                                                      <span key={tag} className="text-[9px] font-bold uppercase text-slate-500 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                                                        #{tag}
                                                      </span>
                                                    ))}
                                                  </div>
                                                )}
                                              </div>
                                            );
                                          })}
                                        </div>
                                      </div>
                                    )}
                                    
                                    {/* Always show the raw detailed notes for full context */}
                                    {shift.raw_input && (
                                      <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-800">
                                        <span className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2 block">Detailed Notes / Transcript</span>
                                        <p className="text-[13px] md:text-sm text-slate-700 dark:text-slate-400 leading-relaxed whitespace-pre-wrap">
                                          {shift.raw_input}
                                        </p>
                                      </div>
                                    )}
                                    
                                    {vitals && Object.keys(vitals).length > 0 && (
                                      <div className="grid grid-cols-[100px_1fr] md:grid-cols-[120px_1fr] gap-4 items-start mt-2">
                                        <span className="text-[10px] font-black text-teal-500 uppercase tracking-widest mt-1">Vitals</span>
                                        <div className="flex flex-wrap gap-2">
                                          {Object.entries(vitals).map(([k, v]: [string, any]) => {
                                            const valStr = typeof v === 'object' ? v.value : v;
                                            if (!valStr) return null;
                                            return (
                                              <span key={k} className="text-xs font-bold bg-white dark:bg-[#1a1a1c] border border-slate-200 dark:border-slate-800 px-2 py-1 rounded-md text-slate-700 dark:text-slate-300">
                                                {k.toUpperCase()}: <span className="text-teal-600 dark:text-teal-400">{valStr}</span>
                                              </span>
                                            );
                                          })}
                                        </div>
                                      </div>
                                    )}
                                    
                                    {/* Raw Input as Fallback or Additional Context */}
                                    {(!situation && !background) && shift.raw_input && (
                                      <div className="grid grid-cols-[100px_1fr] md:grid-cols-[120px_1fr] gap-4 items-start">
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Raw Log</span>
                                        <p className="text-[13px] md:text-sm text-slate-600 dark:text-slate-400 leading-relaxed italic">{shift.raw_input}</p>
                                      </div>
                                    )}

                                    {/* Risks */}
                                    {s.detected_risks && s.detected_risks.length > 0 && (
                                      <div className="grid grid-cols-[100px_1fr] md:grid-cols-[120px_1fr] gap-4 items-start pt-4 border-t border-slate-200 dark:border-slate-800/80 print:border-slate-300">
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Detected Risks</span>
                                        <div className="flex flex-wrap gap-2">
                                          {s.detected_risks.map((risk: string) => (
                                            <span key={risk} className="text-[10px] font-bold uppercase tracking-widest bg-rose-50 text-rose-600 border border-rose-200 px-2.5 py-1 rounded-full flex items-center gap-1 dark:bg-rose-950/20 dark:border-rose-900/50">
                                              <AlertTriangle className="w-3 h-3" />
                                              {risk}
                                            </span>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })
                          ) : (
                            <div className="text-sm text-slate-500 italic">No formal handover logs recorded for this resident on this date.</div>
                          )}
                          
                          {/* Associated Tasks */}
                          {tasks.length > 0 && (
                            <div className="mt-6">
                              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                                <CheckCircle2 className="w-4 h-4" />
                                <span>Day Tasks / Actions</span>
                              </h4>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {tasks.map(t => (
                                  <div key={t.id} className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 flex items-start gap-3 print:bg-white print:border-slate-300">
                                    <div className="mt-0.5">
                                      {t.is_completed ? (
                                        <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                                      ) : (
                                        <div className="w-5 h-5 rounded-full border-2 border-slate-300 dark:border-slate-600"></div>
                                      )}
                                    </div>
                                    <div>
                                      <p className={`text-sm font-bold ${t.is_completed ? 'text-slate-400 line-through' : 'text-slate-800 dark:text-slate-200'}`}>
                                        {t.title}
                                      </p>
                                      {t.description && (
                                        <p className="text-xs text-slate-500 mt-1 line-clamp-2 print:line-clamp-none">{t.description}</p>
                                      )}
                                      {t.tags && t.tags.length > 0 && (
                                        <div className="flex flex-wrap gap-1 mt-2">
                                          {t.tags.map(tag => (
                                            <span key={tag} className="text-[9px] font-bold uppercase tracking-widest text-indigo-500 bg-indigo-50 dark:bg-indigo-950/30 px-1.5 py-0.5 rounded border border-indigo-100 dark:border-indigo-900/40">
                                              #{tag}
                                            </span>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
