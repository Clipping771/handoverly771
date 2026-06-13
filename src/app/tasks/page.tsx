'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContextProvider';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { CheckCircle2, Circle, Clock, Sun, Moon, ArrowLeft, Stethoscope, User, HeartHandshake, ChevronDown, ChevronUp, XCircle, Calendar } from 'lucide-react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { getAdelaideMidnightISO } from '@/lib/taskUtils';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';

interface Task {
  id: string;
  title: string;
  description: string;
  tags: string[];
  is_completed: boolean;
  assigned_role: string;
  resident_id: string;
  resident: { name: string; room_number: string };
  created_at: string;
  handover?: { shift_type: string; approved_at: string };
  clinical_purpose?: string;
  outcome?: string;
  carry_until_date?: string;
}

function getPresetsForTask(task: Task) {
  const tags = task.tags || [];
  if (tags.includes('medication')) {
    return ['Taken successfully', 'Refused', 'Spit out / Wasted', 'Slept through'];
  }
  if (tags.includes('hygiene')) {
    return ['Routine shower completed', 'Wash in bed / Assisted', 'Refused wash', 'Skin check completed'];
  }
  if (tags.includes('nutrition')) {
    return ['All consumed', 'Partial intake', 'Refused food/drink', 'Encouraged fluids'];
  }
  if (tags.includes('mobility') || tags.includes('incidents')) {
    return ['Stable / No issues', 'Refused activity', 'Assisted transfer', 'Pain cues noted'];
  }
  return ['Done / Routine', 'Refused care', 'Completed with assistance', 'Distressed during care'];
}

export default function TasksPage() {
  const { user, facility, isLoading: authLoading, isCarer, isRN, isAdmin } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const router = useRouter();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterTab, setFilterTab] = useState<'my_tasks' | 'all_tasks'>('my_tasks');
  const [carePlansExpanded, setCarePlansExpanded] = useState(true);
  const [pendingExpanded, setPendingExpanded] = useState(false);
  const [completedExpanded, setCompletedExpanded] = useState(false);
  const [declinedExpanded, setDeclinedExpanded] = useState(false);
  const [expandedRooms, setExpandedRooms] = useState<Record<string, boolean>>({});
  const [completions, setCompletions] = useState<Record<string, { completedAt: string; completedBy: string; status: 'completed' | 'declined'; reason?: string }>>({});
  const [activeLoggingTaskId, setActiveLoggingTaskId] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);



  const handleGsapTaskCompletion = (taskId: string, e: React.MouseEvent) => {
    setActiveLoggingTaskId(taskId);
  };

  const fetchTasks = async () => {
    if (!facility) return;
    try {
      setLoading(true);
      const todayStr = getAdelaideMidnightISO();
      
      const { data, error } = await supabase
        .from('tasks')
        .select(`
          id, title, description, tags, is_completed, assigned_role, created_at, resident_id, clinical_purpose, outcome, carry_until_date,
          resident:residents!inner(name, room_number, is_active),
          handover:handovers(shift_type, approved_at)
        `)
        .eq('facility_id', facility.id)
        .eq('resident.is_active', true)
        .or(`outcome.is.null,created_at.gte.${todayStr},carry_until_date.gte.${todayStr.split('T')[0]}`)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTasks(data as any || []);

      // Fetch completions, declines, and reopenings from activity timeline for today
      const { data: timelineData } = await supabase
        .from('activity_timeline')
        .select('created_at, metadata, description, action_type')
        .eq('facility_id', facility.id)
        .in('action_type', ['task_completed', 'task_declined', 'task_reopened'])
        .gte('created_at', todayStr)
        .order('created_at', { ascending: true });

      const compMap: Record<string, { completedAt: string; completedBy: string; status: 'completed' | 'declined'; reason?: string }> = {};
      (timelineData || []).forEach((item: any) => {
        let meta = item.metadata;
        if (typeof meta === 'string') {
          try { meta = JSON.parse(meta); } catch(e) { meta = {}; }
        }
        const taskId = meta?.task_id;
        if (taskId) {
          if (item.action_type === 'task_reopened') {
            delete compMap[taskId];
          } else {
            const isDeclined = item.action_type === 'task_declined';
            const parts = item.description.split(isDeclined ? ' declined: ' : ' completed by ');
            let completedBy = 'Staff';
            let reason = '';
            
            if (isDeclined) {
              const descParts = parts[1] || '';
              const recordParts = descParts.split(' (recorded by ');
              reason = recordParts[0] || 'Resident declined';
              completedBy = recordParts[1]?.replace(')', '') || 'Staff';
            } else {
              completedBy = parts[1] || 'Staff';
            }

            compMap[taskId] = {
              completedAt: item.created_at,
              completedBy: completedBy,
              status: isDeclined ? 'declined' : 'completed',
              reason: reason
            };
          }
        }
      });
      setCompletions(compMap);
    } catch (err) {
      console.error('Error fetching tasks:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();

    if (!facility) return;

    // Real-time subscription to instantly update UI when tasks are added or changed
    const taskSubscription = supabase
      .channel('tasks-channel')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tasks', filter: `facility_id=eq.${facility.id}` },
        () => {
          fetchTasks();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(taskSubscription);
    };
  }, [facility]);

  const toggleTaskStatus = async (
    taskId: string, 
    currentStatus: boolean, 
    customStatus: 'completed' | 'declined' | 'reopened' = 'completed', 
    outcomeText?: string
  ) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task || !user) return;

    // Allow matching roles dynamically
    const taskRole = task.assigned_role;
    let isMatchingRole = false;
    
    if (isAdmin || isRN) {
      isMatchingRole = true;
    } else if (taskRole === 'all' || taskRole === 'carer') {
      isMatchingRole = isCarer;
    } else {
      isMatchingRole = taskRole === user.role;
    }
    
    if (!isMatchingRole) {
      toast.error(`Only RNs, Admins, or Carers can modify this task.`);
      return;
    }

    let newStatus = false;
    if (customStatus === 'completed') {
      newStatus = !currentStatus;
    } else if (customStatus === 'declined') {
      newStatus = false;
    } else if (customStatus === 'reopened') {
      newStatus = false;
    }

    try {
      // Optimistic update
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, is_completed: newStatus } : t));
      
      if (customStatus === 'completed' && newStatus) {
        setCompletions(prev => ({
          ...prev,
          [taskId]: {
            completedAt: new Date().toISOString(),
            completedBy: user?.name || 'Staff',
            status: 'completed'
          }
        }));
      } else if (customStatus === 'declined') {
        setCompletions(prev => ({
          ...prev,
          [taskId]: {
            completedAt: new Date().toISOString(),
            completedBy: user?.name || 'Staff',
            status: 'declined',
            reason: outcomeText || 'Resident declined'
          }
        }));
      } else {
        setCompletions(prev => {
          const updated = { ...prev };
          delete updated[taskId];
          return updated;
        });
      }

      const { error } = await supabase
        .from('tasks')
        .update({ 
          is_completed: newStatus,
          outcome: customStatus === 'reopened' ? null : outcomeText || (customStatus === 'declined' ? 'Resident declined' : 'Completed')
        })
        .eq('id', taskId);

      if (error) throw error;
      
      // Update local task state outcome dynamically
      setTasks(prev => prev.map(t => t.id === taskId ? { 
        ...t, 
        outcome: customStatus === 'reopened' ? undefined : outcomeText || (customStatus === 'declined' ? 'Resident declined' : 'Completed')
      } : t));

      // Log in activity timeline
      if (task && facility && user) {
        let actionType = 'task_reopened';
        let description = `Task "${task.title}" reopened by ${user.name}`;

        if (customStatus === 'completed' && newStatus) {
          actionType = 'task_completed';
          description = `Task "${task.title}" completed by ${user.name}${outcomeText ? ` (Outcome: ${outcomeText})` : ''}`;
        } else if (customStatus === 'declined') {
          actionType = 'task_declined';
          description = `Task "${task.title}" declined: ${outcomeText || 'Resident declined'} (recorded by ${user.name})`;
        }

        const { error: timelineError } = await supabase.from('activity_timeline').insert([
          {
            resident_id: task.resident_id,
            staff_id: user.id,
            facility_id: facility.id,
            action_type: actionType,
            description: description,
            metadata: {
              task_id: taskId,
              task_title: task.title
            }
          }
        ]);
        if (timelineError) {
          console.error("Activity timeline insert error:", timelineError);
          // Don't throw here to avoid reverting the task completion entirely just because the log failed, 
          // but we should fix the root cause if it is failing.
        }
      }
    } catch (err) {
      console.error('Failed to update task:', err);
      // Revert
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, is_completed: currentStatus } : t));
      if (currentStatus) {
        // Was completed, failed to reopen, restore completion info if we had it
        fetchTasks();
      } else {
        // Was pending, failed to complete, remove completion info
        setCompletions(prev => {
          const updated = { ...prev };
          delete updated[taskId];
          return updated;
        });
      }
    }
  };

  const filteredTasks = useMemo(() => {
    return tasks.filter(t => {
      // Short-Term Care Plans are global, everyone should always see them
      if (t.carry_until_date != null) {
        return true;
      }

      if (filterTab === 'my_tasks') {
        if (!user) return false;

        // RN should see all declined tasks under My Tasks
        const isDeclined = completions[t.id]?.status === 'declined';
        if (isRN && isDeclined) {
          return true;
        }

        const taskRole = t.assigned_role;
        return taskRole === 'all' || 
               (taskRole === 'rn' && isRN) || 
               (taskRole === 'carer' && isCarer) || 
               taskRole === user.role;
      }
      return true;
    });
  }, [tasks, filterTab, user, completions, isRN, isCarer]);

  const carryOverTasks = useMemo(() => filteredTasks.filter(t => t.carry_until_date != null), [filteredTasks]);

  const pendingTasks = useMemo(() => filteredTasks.filter(t => {
    if (t.carry_until_date != null) return false;
    const isCompleted = t.is_completed;
    return !isCompleted && completions[t.id]?.status !== 'declined';
  }), [filteredTasks, completions]);

  const completedTasks = useMemo(() => filteredTasks.filter(t => {
    if (t.carry_until_date != null) return false;
    const isCompleted = t.is_completed || completions[t.id]?.status === 'completed';
    return isCompleted && completions[t.id]?.status !== 'declined';
  }), [filteredTasks, completions]);

  const declinedTasks = useMemo(() => filteredTasks.filter(t => {
    if (t.carry_until_date != null) return false;
    return completions[t.id]?.status === 'declined';
  }), [filteredTasks, completions]);

  const incompleteCarryOverCount = useMemo(() => carryOverTasks.filter(task => {
    const isCompleted = completions[task.id]?.status === 'completed';
    const isDeclined = completions[task.id]?.status === 'declined';
    return !isCompleted && !isDeclined;
  }).length, [carryOverTasks, completions]);

  // Group tasks by resident room
  // Group tasks by resident ID to handle shared rooms properly
  const groupTasksByResident = (taskList: Task[]) => {
    const groups: Record<string, { residentName: string; room: string; tasks: Task[] }> = {};
    taskList.forEach(task => {
      const residentId = task.resident_id || 'Unknown';
      const room = task.resident?.room_number || 'Unknown';
      const name = task.resident?.name || 'Unknown Resident';
      if (!groups[residentId]) {
        groups[residentId] = { residentName: name, room, tasks: [] };
      }
      groups[residentId].tasks.push(task);
    });
    return Object.entries(groups).sort((a, b) => a[1].room.localeCompare(b[1].room));
  };

  const groupedCarePlans = useMemo(() => groupTasksByResident(carryOverTasks), [carryOverTasks]);
  const groupedPending = useMemo(() => groupTasksByResident(pendingTasks), [pendingTasks]);
  const groupedCompleted = useMemo(() => groupTasksByResident(completedTasks), [completedTasks]);
  const groupedDeclined = useMemo(() => groupTasksByResident(declinedTasks), [declinedTasks]);

  if (authLoading || !user || !facility) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center">
        <div className="w-12 h-12 border-[3px] border-teal-accent border-t-transparent rounded-full animate-spin"></div>
        <p className="mt-6 text-text-secondary font-medium text-sm tracking-wide">Syncing Workspace...</p>
      </div>
    );
  }

  const renderRoleBadge = (role: string) => {
    if (role === 'rn') {
      return (
        <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300">
          <Stethoscope className="w-3 h-3" />
          <span className="text-[10px] font-bold uppercase tracking-wider">RN Task</span>
        </div>
      );
    }
    if (role === 'carer') {
      return (
        <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300">
          <HeartHandshake className="w-3 h-3" />
          <span className="text-[10px] font-bold uppercase tracking-wider">Carer Task</span>
        </div>
      );
    }
    return (
      <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
        <User className="w-3 h-3" />
        <span className="text-[10px] font-bold uppercase tracking-wider">All Staff</span>
      </div>
    );
  };

  const renderGroupedTasksList = (
    grouped: [string, { residentName: string; room: string; tasks: Task[]; }][],
    listType: 'pending' | 'completed' | 'declined'
  ) => {
    return (
      <div className="space-y-6 mt-6">
        <AnimatePresence initial={false}>
          {grouped.map(([residentId, { residentName, room, tasks }]) => {
            const isRoomExpanded = expandedRooms[residentId] !== undefined 
              ? expandedRooms[residentId] 
              : listType === 'pending'; // Expanded by default only for pending list

            return (
              <motion.div 
                key={residentId}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="border border-border rounded-3xl overflow-hidden bg-surface-solid"
              >
                {/* Collapsible Room Header */}
                <div 
                  onClick={() => setExpandedRooms(prev => ({ ...prev, [residentId]: !isRoomExpanded }))}
                  className="flex items-center justify-between p-4 cursor-pointer hover:bg-surface-hover transition-colors select-none"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-full bg-surface flex items-center justify-center text-text-secondary">
                      {isRoomExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </div>
                    <span className="text-sm font-bold uppercase tracking-wider text-text-primary">
                      Room {room} — <span className="text-text-secondary font-semibold">{residentName}</span>
                    </span>
                  </div>
                  <span className="text-xs font-bold text-text-secondary">
                    ({tasks.length} {tasks.length === 1 ? 'task' : 'tasks'})
                  </span>
                </div>
                
                {isRoomExpanded && (
                  <div className="p-4 pt-0 border-t border-border bg-surface">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                      {tasks.map(task => {
                        const isDeclined = completions[task.id]?.status === 'declined';
                        const isCompleted = task.carry_until_date 
                          ? (completions[task.id]?.status === 'completed')
                          : (task.is_completed || completions[task.id]?.status === 'completed');
                        return (
                          <motion.div 
                            key={task.id} 
                            className={`task-row-container apple-card ${
                              isDeclined
                                ? 'border-rose-200 dark:border-rose-900/30'
                                : isCompleted
                                ? 'border-emerald-200 dark:border-emerald-900/30'
                                : ''
                            } rounded-[24px] p-5 flex items-start gap-4 shadow-sm hover:shadow-md transition-shadow group relative overflow-hidden`}
                          >
                            {/* Status Toggle */}
                            <div className="flex items-center gap-1">
                                <button
                                  onClick={(e) => {
                                    if (isDeclined || isCompleted) {
                                      toggleTaskStatus(task.id, false, 'reopened');
                                    } else {
                                      handleGsapTaskCompletion(task.id, e);
                                    }
                                  }}
                                disabled={
                                  !user || 
                                  (!isAdmin && !isRN && (
                                    // Carers cannot check off RN tasks
                                    (isCarer && task.assigned_role === 'rn')
                                  ))
                                }
                                className="mt-1 shrink-0 transition-transform active:scale-90 disabled:opacity-40 disabled:cursor-not-allowed"
                                title={
                                  !user || (!isAdmin && !isRN && isCarer && task.assigned_role === 'rn')
                                    ? "Only RNs and Admins can complete RN tasks."
                                    : "Toggle status"
                                }
                              >
                                {isDeclined ? (
                                  <XCircle className="w-7 h-7 text-rose-500" />
                                ) : isCompleted ? (
                                  <CheckCircle2 className="w-7 h-7 text-emerald-500" />
                                ) : (
                                  <Circle className="w-7 h-7 text-slate-300 dark:text-slate-600 group-hover:text-indigo-400 transition-colors" />
                                )}
                              </button>
        
                              {!isCompleted && !isDeclined && (
                                  <button
                                    onClick={() => {
                                      setActiveLoggingTaskId(task.id);
                                    }}
                                    disabled={
                                      !user || 
                                      (!isAdmin && !isRN && (
                                        // Carers cannot decline RN tasks
                                        (isCarer && task.assigned_role === 'rn')
                                      ))
                                    }
                                  className="mt-1 shrink-0 p-1 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                  title={
                                    !user || (!isAdmin && !isRN && isCarer && task.assigned_role === 'rn')
                                      ? "Only RNs and Admins can decline RN tasks"
                                      : "Mark as Resident Declined"
                                  }
                                >
                                  <XCircle className="w-5.5 h-5.5" />
                                </button>
                              )}
                            </div>
                            
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between mb-2 gap-2">
                                <h3 className={`font-bold text-[15px] leading-snug ${isCompleted ? 'text-text-secondary line-through' : 'text-text-primary'}`}>
                                  {task.title}
                                  {task.carry_until_date && (
                                    <span className="text-[10px] font-bold text-amber-700 bg-amber-100 dark:bg-amber-950/45 dark:text-amber-400 px-2.5 py-0.5 rounded-md ml-2 inline-block leading-none align-middle">
                                      until {new Date(task.carry_until_date + 'T00:00:00').toLocaleDateString([], { day: 'numeric', month: 'short' })}
                                    </span>
                                  )}
                                </h3>
                                <div className="shrink-0 mt-0.5">
                                  {renderRoleBadge(task.assigned_role)}
                                </div>
                              </div>
                              
                              <p className={`text-sm leading-relaxed ${isCompleted ? 'text-text-secondary' : 'text-text-secondary'}`}>
                                {task.description}
                              </p>
                              
                              {task.clinical_purpose && (
                                <p className="text-[11px] font-medium text-indigo-650 dark:text-indigo-400 mt-2 bg-indigo-50/45 dark:bg-indigo-950/25 px-3 py-1.5 rounded-xl border border-indigo-100/40 dark:border-indigo-900/30">
                                  <strong>Why:</strong> {task.clinical_purpose}
                                </p>
                              )}
                              
                              {/* Context-aware inline Outcome presets */}
                              {activeLoggingTaskId === task.id && (
                                <div className="mt-4 p-4 border-t border-border bg-surface-solid rounded-2xl space-y-3">
                                  <div className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">Record Care Outcome (Quick Select)</div>
                                  <div className="flex flex-wrap gap-2.5">
                                    {getPresetsForTask(task).map(preset => {
                                      const isNegative = preset.toLowerCase().includes('refused') || preset.toLowerCase().includes('declined') || preset.toLowerCase().includes('distressed');
                                      return (
                                        <button
                                          key={preset}
                                          onClick={() => {
                                            const isDeclinedVal = preset.toLowerCase().includes('refused') || preset.toLowerCase().includes('declined') || preset.toLowerCase().includes('slept through');
                                            toggleTaskStatus(task.id, isCompleted, isDeclinedVal ? 'declined' : 'completed', preset);
                                            setActiveLoggingTaskId(null);
                                          }}
                                          className={`px-4 py-2 rounded-full text-xs font-bold transition-all duration-300 cursor-pointer shadow-sm hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 backdrop-blur-md ${
                                            isNegative 
                                              ? 'bg-white/40 text-rose-600 border border-white/50 hover:bg-white/60 hover:border-rose-300 dark:bg-black/20 dark:text-rose-400 dark:border-white/10 dark:hover:bg-black/40 dark:hover:border-rose-500/30' 
                                              : 'bg-white/40 text-indigo-700 border border-white/50 hover:bg-white/60 hover:border-indigo-300 dark:bg-black/20 dark:text-indigo-400 dark:border-white/10 dark:hover:bg-black/40 dark:hover:border-indigo-500/30'
                                          }`}
                                        >
                                          {preset}
                                        </button>
                                      );
                                    })}
                                  </div>
                                  <div className="flex flex-col gap-2.5 w-full">
                                    <input
                                      type="text"
                                      id={`custom-outcome-${task.id}`}
                                      placeholder="Or type custom outcome note..."
                                      className="w-full h-10 bg-white dark:bg-[#070708] border border-[#e3e3e3] dark:border-[#202024] rounded-xl px-4 text-[13px] focus:outline-none focus:border-indigo-400 dark:focus:border-indigo-500 text-text-primary shadow-sm transition-all"
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                          const val = (e.currentTarget as HTMLInputElement).value;
                                          const isDeclinedVal = val.toLowerCase().includes('refused') || val.toLowerCase().includes('declined');
                                          toggleTaskStatus(task.id, isCompleted, isDeclinedVal ? 'declined' : 'completed', val || 'Completed');
                                          setActiveLoggingTaskId(null);
                                        }
                                      }}
                                    />
                                    <div className="flex gap-2 h-10 w-full">
                                      <button
                                        onClick={() => {
                                          const el = document.getElementById(`custom-outcome-${task.id}`) as HTMLInputElement;
                                          const val = el?.value || 'Completed';
                                          const isDeclinedVal = val.toLowerCase().includes('refused') || val.toLowerCase().includes('declined');
                                          toggleTaskStatus(task.id, isCompleted, isDeclinedVal ? 'declined' : 'completed', val);
                                          setActiveLoggingTaskId(null);
                                        }}
                                        className="flex-1 px-5 bg-primary hover:opacity-90 text-white rounded-xl text-[13px] font-bold shadow-sm transition-all cursor-pointer"
                                      >
                                        Save
                                      </button>
                                      <button
                                        onClick={() => setActiveLoggingTaskId(null)}
                                        className="flex-1 px-4 bg-slate-100 hover:bg-slate-200 dark:bg-[#1a1a1c] dark:hover:bg-[#252528] text-slate-700 dark:text-slate-300 rounded-xl text-[13px] font-semibold transition-all cursor-pointer"
                                      >
                                        Cancel
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              )}
                              
                              <div className="flex items-center justify-between mt-4">
                                <div className="flex flex-wrap gap-2">
                                  {task.tags.map(tag => (
                                    <span key={tag} className={`text-[10px] font-bold uppercase tracking-widest ${task.is_completed ? 'text-slate-300' : 'text-indigo-500/80'} bg-surface-solid px-2 py-0.5 rounded-md`}>
                                      #{tag}
                                    </span>
                                  ))}
                                </div>
                              </div>
                              
                              {isDeclined ? (
                                <div className="mt-4 pt-3 border-t border-rose-100 text-rose-750 text-[10px] flex flex-wrap gap-x-4 gap-y-1 items-center font-medium">
                                  <span className="text-rose-600 font-bold uppercase tracking-wider">
                                    DECLINED
                                  </span>
                                  <span>•</span>
                                  <span>
                                    Reason: <strong className="text-rose-650">{completions[task.id]?.reason || 'Resident declined'}</strong>
                                  </span>
                                  <span>•</span>
                                  <span>
                                    Recorded: <strong>{completions[task.id] ? new Date(completions[task.id].completedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Done'}</strong>
                                  </span>
                                  <span>•</span>
                                  <span>
                                    By: <strong>{completions[task.id]?.completedBy || 'Staff'}</strong>
                                  </span>
                                </div>
                              ) : task.is_completed ? (
                                <div className="mt-4 pt-3 border-t border-emerald-100 text-emerald-750 text-[10px] flex flex-wrap gap-x-4 gap-y-1 items-center font-medium">
                                  <span>
                                    Shift: <strong className="capitalize">{task.handover?.shift_type || 'routine'}</strong>
                                  </span>
                                  <span>•</span>
                                  <span>
                                    Recorded: <strong>{completions[task.id] ? new Date(completions[task.id].completedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Done'}</strong>
                                  </span>
                                  <span>•</span>
                                  <span>
                                    By: <strong>{completions[task.id]?.completedBy || 'Staff'}</strong>
                                  </span>
                                  {task.outcome && (
                                    <div className="mt-2 text-[11px] font-semibold text-emerald-800 bg-emerald-100/80 px-3 py-1.5 rounded-full border border-emerald-200/50 inline-block">
                                      Outcome: {task.outcome}
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <div className="mt-4 pt-3 border-t border-border text-[10px] text-text-secondary flex flex-wrap gap-x-4 gap-y-1 items-center font-medium">
                                  <span>
                                    Created: <strong className="capitalize">{task.handover?.shift_type || 'routine'} Shift</strong>
                                  </span>
                                  <span>•</span>
                                  <span>
                                    Time: <strong>{new Date(task.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</strong>
                                  </span>
                                </div>
                              )}
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background text-text-primary flex flex-col pb-24 transition-colors duration-300 font-sans">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-surface/95 backdrop-blur-xl border-b border-border px-6 py-4 animate-fade-in-up">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href={user && isCarer ? "/" : "/shift"} className="p-2 -ml-2 rounded-full hover:bg-surface-hover transition-colors">
              <ArrowLeft className="w-5 h-5 text-text-secondary" />
            </Link>
            <h1 className="font-bold text-xl tracking-tight">Shift Tasks</h1>
          </div>
          
          <button
            onClick={toggleTheme}
            className="p-2 rounded-full hover:bg-surface-hover text-text-secondary transition-colors"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-500" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto w-full px-6 mt-8 flex-1 flex flex-col">
        
        {/* Toggle Tabs */}
        {(isRN || isAdmin) && (
          <div className="flex bg-surface-solid p-1.5 rounded-2xl mb-8 self-center sm:self-start border border-border animate-fade-in-up">
            <button
              onClick={() => setFilterTab('my_tasks')}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-[12px] text-xs font-semibold transition-all duration-300 ${
                filterTab === 'my_tasks'
                  ? 'bg-surface shadow-sm text-teal-accent' 
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              My Tasks
            </button>
            <button
              onClick={() => setFilterTab('all_tasks')}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-[12px] text-xs font-semibold transition-all duration-300 ${
                filterTab === 'all_tasks'
                  ? 'bg-surface shadow-sm text-teal-accent' 
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              All Tasks
            </button>
          </div>
        )}

        {/* Tasks Lists */}
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-6 h-6 border-2 border-slate-400 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Short-Term Care Plans (Carry Overs) */}
            {carryOverTasks.length > 0 && (
              <div className="apple-card rounded-[24px] overflow-hidden animate-fade-in-up shadow-md border-2 border-amber-200/50 dark:border-amber-900/30" style={{ animationDelay: '0.05s' }}>
                <button
                  onClick={() => setCarePlansExpanded(p => !p)}
                  className="w-full flex items-center justify-between px-6 py-5 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20 hover:from-amber-100 hover:to-orange-100 dark:hover:from-amber-900/30 dark:hover:to-orange-900/30 transition-all text-left border-b border-amber-200/50 dark:border-amber-900/30 cursor-pointer outline-none focus:outline-none focus-visible:outline-none"
                >
                  <div className="flex items-center gap-3">
                    <div className="relative flex items-center justify-center w-8 h-8 -ml-1.5">
                      {incompleteCarryOverCount > 0 && (
                        <>
                          <div className="absolute inset-0 rounded-full bg-amber-400 opacity-20 animate-ping"></div>
                          <div className="absolute inset-[-4px] rounded-full bg-amber-300/30 animate-pulse"></div>
                        </>
                      )}
                      <Calendar className="relative z-10 w-5 h-5 text-amber-600 dark:text-amber-500" />
                    </div>
                    <div>
                      <span className="font-black text-[15px] tracking-wide uppercase text-amber-900 dark:text-amber-400">
                        Short-Term Care Plans ({carryOverTasks.length})
                      </span>
                      <p className="text-[10px] font-bold text-amber-700/70 dark:text-amber-500/70 uppercase tracking-widest mt-0.5">Active until expiry date</p>
                    </div>
                  </div>
                  {carePlansExpanded ? <ChevronUp className="w-4 h-4 text-amber-700" /> : <ChevronDown className="w-4 h-4 text-amber-700" />}
                </button>
                
                {carePlansExpanded && (
                  <div className="p-6 bg-amber-50/30 dark:bg-amber-950/10">
                    {renderGroupedTasksList(groupedCarePlans, 'pending')}
                  </div>
                )}
              </div>
            )}

            {/* Pending Tasks */}
            <div className="apple-card rounded-[24px] overflow-hidden animate-fade-in-up shadow-sm border border-white/40 dark:border-white/10" style={{ animationDelay: '0.1s' }}>
              <button
                onClick={() => setPendingExpanded(p => !p)}
                className="w-full flex items-center justify-between px-6 py-5 bg-transparent hover:bg-white/40 dark:hover:bg-white/5 transition-all text-left border-b border-white/20 dark:border-white/5 cursor-pointer outline-none focus:outline-none focus-visible:outline-none"
              >
                <div className="flex items-center gap-3">
                  <div className="relative flex items-center justify-center w-8 h-8 -ml-1.5">
                    {pendingTasks.length > 0 && (
                      <>
                        <div className="absolute inset-0 rounded-full bg-indigo-400 opacity-20 animate-ping"></div>
                        <div className="absolute inset-[-4px] rounded-full bg-indigo-300/30 animate-pulse"></div>
                      </>
                    )}
                    <Clock className="relative z-10 w-5 h-5 text-indigo-500" />
                  </div>
                  <span className="font-bold text-sm tracking-wide uppercase text-text-primary">
                    Pending Actions ({pendingTasks.length})
                  </span>
                </div>
                {pendingExpanded ? <ChevronUp className="w-4 h-4 text-text-secondary" /> : <ChevronDown className="w-4 h-4 text-text-secondary" />}
              </button>
              
              {pendingExpanded && (
                <div className="p-6">
                  {pendingTasks.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <motion.div initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 200, damping: 15 }}>
                        <CheckCircle2 className="w-12 h-12 text-emerald-400 mb-3 drop-shadow-sm" />
                      </motion.div>
                      <p className="text-sm font-semibold text-text-primary">All caught up!</p>
                      <p className="text-xs text-text-secondary mt-0.5">No pending tasks for this list.</p>
                    </div>
                  ) : (
                    renderGroupedTasksList(groupedPending, 'pending')
                  )}
                </div>
              )}
            </div>

            {/* Completed Tasks */}
            <div className="apple-card rounded-[24px] overflow-hidden animate-fade-in-up shadow-sm border border-white/40 dark:border-white/10" style={{ animationDelay: '0.2s' }}>
              <button
                onClick={() => setCompletedExpanded(c => !c)}
                className="w-full flex items-center justify-between px-6 py-5 bg-transparent hover:bg-white/40 dark:hover:bg-white/5 transition-all text-left border-b border-white/20 dark:border-white/5 cursor-pointer outline-none focus:outline-none focus-visible:outline-none"
              >
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                  <span className="font-bold text-sm tracking-wide uppercase text-text-primary">
                    Completed Actions ({completedTasks.length})
                  </span>
                </div>
                {completedExpanded ? <ChevronUp className="w-4 h-4 text-text-secondary" /> : <ChevronDown className="w-4 h-4 text-text-secondary" />}
              </button>
              
              {completedExpanded && (
                <div className="p-6">
                  {completedTasks.length === 0 ? (
                    <div className="text-center py-12">
                      <p className="text-xs text-text-secondary italic">No tasks completed yet.</p>
                    </div>
                  ) : (
                    renderGroupedTasksList(groupedCompleted, 'completed')
                  )}
                </div>
              )}
            </div>

            {/* Declined Tasks */}
            <div className="apple-card rounded-[24px] overflow-hidden animate-fade-in-up shadow-sm border border-white/40 dark:border-white/10" style={{ animationDelay: '0.3s' }}>
              <button
                onClick={() => setDeclinedExpanded(d => !d)}
                className="w-full flex items-center justify-between px-6 py-5 bg-transparent hover:bg-white/40 dark:hover:bg-white/5 transition-all text-left border-b border-white/20 dark:border-white/5 cursor-pointer outline-none focus:outline-none focus-visible:outline-none"
              >
                <div className="flex items-center gap-3">
                  <XCircle className="w-5 h-5 text-rose-500" />
                  <span className="font-bold text-sm tracking-wide uppercase text-text-primary">
                    Declined Actions ({declinedTasks.length})
                  </span>
                </div>
                {declinedExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
              </button>
              
              {declinedExpanded && (
                <div className="p-6">
                  {declinedTasks.length === 0 ? (
                    <div className="text-center py-12">
                      <p className="text-xs text-slate-400 italic">No tasks declined.</p>
                    </div>
                  ) : (
                    renderGroupedTasksList(groupedDeclined, 'declined')
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
