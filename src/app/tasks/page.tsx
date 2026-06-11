'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { CheckCircle2, Circle, Clock, Sun, Moon, ArrowLeft, Stethoscope, User, HeartHandshake, ChevronDown, ChevronUp, XCircle } from 'lucide-react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';

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
}

export default function TasksPage() {
  const { user, facility, isLoading: authLoading, isCarer, isRN, isAdmin } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const router = useRouter();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterTab, setFilterTab] = useState<'my_tasks' | 'all_tasks'>('my_tasks');
  const [pendingExpanded, setPendingExpanded] = useState(true);
  const [completedExpanded, setCompletedExpanded] = useState(false);
  const [declinedExpanded, setDeclinedExpanded] = useState(false);
  const [expandedRooms, setExpandedRooms] = useState<Record<string, boolean>>({});
  const [completions, setCompletions] = useState<Record<string, { completedAt: string; completedBy: string; status: 'completed' | 'declined'; reason?: string }>>({});

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  const fetchTasks = async () => {
    if (!facility) return;
    try {
      setLoading(true);
      const localMidnight = new Date();
      localMidnight.setHours(0, 0, 0, 0);
      const todayStr = localMidnight.toISOString();
      
      const { data, error } = await supabase
        .from('tasks')
        .select(`
          id, title, description, tags, is_completed, assigned_role, created_at, resident_id,
          resident:residents!inner(name, room_number, is_active),
          handover:handovers(shift_type, approved_at)
        `)
        .eq('facility_id', facility.id)
        .eq('resident.is_active', true)
        .gte('created_at', todayStr)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTasks(data as any || []);

      // Fetch completions, declines, and reopenings from activity timeline
      const { data: timelineData } = await supabase
        .from('activity_timeline')
        .select('created_at, metadata, description, action_type')
        .eq('facility_id', facility.id)
        .in('action_type', ['task_completed', 'task_declined', 'task_reopened'])
        .order('created_at', { ascending: true });

      const compMap: Record<string, { completedAt: string; completedBy: string; status: 'completed' | 'declined'; reason?: string }> = {};
      (timelineData || []).forEach((item: any) => {
        const taskId = item.metadata?.task_id;
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
  }, [facility]);

  const toggleTaskStatus = async (
    taskId: string, 
    currentStatus: boolean, 
    customStatus: 'completed' | 'declined' | 'reopened' = 'completed', 
    declineReason?: string
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
            reason: declineReason
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
        .update({ is_completed: newStatus })
        .eq('id', taskId);

      if (error) throw error;

      // Log in activity timeline
      if (task && facility && user) {
        let actionType = 'task_reopened';
        let description = `Task "${task.title}" reopened by ${user.name}`;

        if (customStatus === 'completed' && newStatus) {
          actionType = 'task_completed';
          description = `Task "${task.title}" completed by ${user.name}`;
        } else if (customStatus === 'declined') {
          actionType = 'task_declined';
          description = `Task "${task.title}" declined: ${declineReason || 'Resident declined'} (recorded by ${user.name})`;
        }

        await supabase.from('activity_timeline').insert([
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

  // Filter tasks based on the active tab
  const filteredTasks = useMemo(() => {
    return tasks.filter(t => {
      if (filterTab === 'my_tasks') {
        if (!user) return false;
        if (isAdmin) return true;

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
  }, [tasks, filterTab, user, completions]);

  const pendingTasks = useMemo(() => filteredTasks.filter(t => !t.is_completed && completions[t.id]?.status !== 'declined'), [filteredTasks, completions]);
  const completedTasks = useMemo(() => filteredTasks.filter(t => t.is_completed && completions[t.id]?.status !== 'declined'), [filteredTasks, completions]);
  const declinedTasks = useMemo(() => filteredTasks.filter(t => completions[t.id]?.status === 'declined'), [filteredTasks, completions]);

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

  const groupedPending = useMemo(() => groupTasksByResident(pendingTasks), [pendingTasks]);
  const groupedCompleted = useMemo(() => groupTasksByResident(completedTasks), [completedTasks]);
  const groupedDeclined = useMemo(() => groupTasksByResident(declinedTasks), [declinedTasks]);

  if (authLoading || !user || !facility) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-[#080b16] flex flex-col items-center justify-center">
        <div className="w-10 h-10 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
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
                className="border border-slate-200/80 dark:border-white/5 rounded-3xl overflow-hidden bg-slate-50/20 dark:bg-black/5"
              >
                {/* Collapsible Room Header */}
                <div 
                  onClick={() => setExpandedRooms(prev => ({ ...prev, [residentId]: !isRoomExpanded }))}
                  className="flex items-center justify-between p-4 cursor-pointer hover:bg-slate-100/50 dark:hover:bg-white/5 transition-colors select-none"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-full bg-slate-100 dark:bg-white/5 flex items-center justify-center text-slate-500">
                      {isRoomExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </div>
                    <span className="text-sm font-bold uppercase tracking-wider text-slate-750 dark:text-slate-200">
                      Room {room} — <span className="text-slate-500 dark:text-slate-400 font-semibold">{residentName}</span>
                    </span>
                  </div>
                  <span className="text-xs font-bold text-slate-400 dark:text-slate-500">
                    ({tasks.length} {tasks.length === 1 ? 'task' : 'tasks'})
                  </span>
                </div>
                
                {isRoomExpanded && (
                  <div className="p-4 pt-0 border-t border-slate-100 dark:border-white/5 bg-white dark:bg-[#0d0d0f]">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                      {tasks.map(task => {
                        const isDeclined = completions[task.id]?.status === 'declined';
                        return (
                          <motion.div 
                            key={task.id} 
                            layout
                            className={`bg-white dark:bg-[#121214] border ${
                              isDeclined
                                ? 'border-rose-200 dark:border-rose-900/30 bg-rose-50/20 dark:bg-[#121214]'
                                : task.is_completed
                                ? 'border-emerald-200 dark:border-emerald-900/30 bg-emerald-50/30 dark:bg-[#121214]'
                                : 'border-slate-200 dark:border-[#202024]'
                            } rounded-[24px] p-5 flex items-start gap-4 shadow-sm hover:shadow-md transition-all group relative overflow-hidden`}
                          >
                            {/* Status Toggle */}
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => {
                                  if (isDeclined) {
                                    toggleTaskStatus(task.id, false, 'reopened');
                                  } else {
                                    toggleTaskStatus(task.id, task.is_completed, 'completed');
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
                                ) : task.is_completed ? (
                                  <CheckCircle2 className="w-7 h-7 text-emerald-500" />
                                ) : (
                                  <Circle className="w-7 h-7 text-slate-300 dark:text-slate-600 group-hover:text-indigo-400 transition-colors" />
                                )}
                              </button>
        
                              {!task.is_completed && !isDeclined && (
                                  <button
                                    onClick={() => {
                                      const reason = prompt("Enter reason for resident decline (e.g. Refused, Asleep):", "Resident declined");
                                      if (reason !== null) {
                                        toggleTaskStatus(task.id, false, 'declined', reason);
                                      }
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
                                <h3 className={`font-bold text-[15px] leading-snug ${task.is_completed ? 'text-slate-400 line-through' : 'text-slate-900 dark:text-white'}`}>
                                  {task.title}
                                </h3>
                                <div className="shrink-0 mt-0.5">
                                  {renderRoleBadge(task.assigned_role)}
                                </div>
                              </div>
                              
                              <p className={`text-sm leading-relaxed mb-4 ${task.is_completed ? 'text-slate-400' : 'text-slate-600 dark:text-slate-300'}`}>
                                {task.description}
                              </p>
                              
                              <div className="flex items-center justify-between mt-auto">
                                <div className="flex flex-wrap gap-2">
                                  {task.tags.map(tag => (
                                    <span key={tag} className={`text-[10px] font-bold uppercase tracking-widest ${task.is_completed ? 'text-slate-300 dark:text-slate-600' : 'text-indigo-500/80 dark:text-indigo-400/60'} bg-slate-50 dark:bg-slate-800/50 px-2 py-0.5 rounded-md`}>
                                      #{tag}
                                    </span>
                                  ))}
                                </div>
                              </div>
                              
                              {isDeclined ? (
                                <div className="mt-4 pt-3 border-t border-rose-100 dark:border-rose-950/20 text-rose-750 dark:text-rose-400 text-[10px] flex flex-wrap gap-x-4 gap-y-1 items-center font-medium">
                                  <span className="text-rose-600 dark:text-rose-400 font-bold uppercase tracking-wider">
                                    DECLINED
                                  </span>
                                  <span>•</span>
                                  <span>
                                    Reason: <strong className="text-rose-650 dark:text-rose-300">{completions[task.id]?.reason || 'Resident declined'}</strong>
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
                                <div className="mt-4 pt-3 border-t border-emerald-100 dark:border-emerald-950/20 text-emerald-750 dark:text-emerald-400 text-[10px] flex flex-wrap gap-x-4 gap-y-1 items-center font-medium">
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
                                </div>
                              ) : (
                                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/60 text-[10px] text-slate-500 dark:text-slate-400 flex flex-wrap gap-x-4 gap-y-1 items-center font-medium">
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
    <div className="min-h-screen bg-[#f8fafc] dark:bg-[#0b0b0d] text-[#1f1f1f] dark:text-[#e3e3e3] flex flex-col pb-24 transition-colors duration-300 font-sans">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-[#f8fafc]/80 dark:bg-[#0b0b0d]/80 backdrop-blur-md border-b border-[#e3e3e3] dark:border-[#202024] px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href={user && isCarer ? "/" : "/shift"} className="p-2 -ml-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors">
              <ArrowLeft className="w-5 h-5 text-slate-600 dark:text-slate-300" />
            </Link>
            <h1 className="font-bold text-xl tracking-tight">Shift Tasks</h1>
          </div>
          
          <button
            onClick={toggleTheme}
            className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 transition-colors"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-500" /> : <Moon className="w-4 h-4 text-[#1f1f1f]" />}
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto w-full px-6 mt-8 flex-1 flex flex-col">
        
        {/* Toggle Tabs */}
        <div className="flex bg-slate-200 dark:bg-[#121214] p-1.5 rounded-2xl mb-8 self-center sm:self-start border border-slate-300/50 dark:border-[#202024]">
          <button
            onClick={() => setFilterTab('my_tasks')}
            className={`px-8 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${
              filterTab === 'my_tasks' 
                ? 'bg-white dark:bg-[#1c1c21] shadow-sm text-indigo-600 dark:text-indigo-400' 
                : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            My Tasks
          </button>
          <button
            onClick={() => setFilterTab('all_tasks')}
            className={`px-8 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${
              filterTab === 'all_tasks' 
                ? 'bg-white dark:bg-[#1c1c21] shadow-sm text-indigo-600 dark:text-indigo-400' 
                : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            All Tasks
          </button>
        </div>

        {/* Tasks Lists */}
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-6 h-6 border-2 border-slate-400 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Collapsible Pending Tasks */}
            <div className="border border-slate-200 dark:border-[#202024] rounded-3xl bg-white dark:bg-[#0d0d0f] overflow-hidden shadow-sm">
              <button
                onClick={() => setPendingExpanded(p => !p)}
                className="w-full flex items-center justify-between px-6 py-5 bg-slate-50/50 dark:bg-[#121214]/50 border-b border-slate-200 dark:border-[#202024] text-left hover:bg-slate-100/30 dark:hover:bg-[#1c1c21]/30 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Clock className="w-5 h-5 text-indigo-500" />
                  <span className="font-bold text-sm tracking-wide uppercase text-slate-750 dark:text-slate-200">
                    Pending Actions ({pendingTasks.length})
                  </span>
                </div>
                {pendingExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
              </button>
              
              {pendingExpanded && (
                <div className="p-6">
                  {pendingTasks.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <CheckCircle2 className="w-12 h-12 text-emerald-400 dark:text-emerald-500/50 mb-3 animate-pulse" />
                      <p className="text-sm font-semibold text-slate-600 dark:text-slate-350">All caught up!</p>
                      <p className="text-xs text-slate-400 mt-0.5">No pending tasks for this list.</p>
                    </div>
                  ) : (
                    renderGroupedTasksList(groupedPending, 'pending')
                  )}
                </div>
              )}
            </div>

            {/* Collapsible Completed Tasks */}
            <div className="border border-slate-200 dark:border-[#202024] rounded-3xl bg-white dark:bg-[#0d0d0f] overflow-hidden shadow-sm">
              <button
                onClick={() => setCompletedExpanded(c => !c)}
                className="w-full flex items-center justify-between px-6 py-5 bg-slate-50/50 dark:bg-[#121214]/50 border-b border-slate-200 dark:border-[#202024] text-left hover:bg-slate-100/30 dark:hover:bg-[#1c1c21]/30 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                  <span className="font-bold text-sm tracking-wide uppercase text-slate-750 dark:text-slate-200">
                    Completed Actions ({completedTasks.length})
                  </span>
                </div>
                {completedExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
              </button>
              
              {completedExpanded && (
                <div className="p-6">
                  {completedTasks.length === 0 ? (
                    <div className="text-center py-12">
                      <p className="text-xs text-slate-400 italic">No tasks completed yet.</p>
                    </div>
                  ) : (
                    renderGroupedTasksList(groupedCompleted, 'completed')
                  )}
                </div>
              )}
            </div>

            {/* Collapsible Declined Tasks */}
            <div className="border border-slate-200 dark:border-[#202024] rounded-3xl bg-white dark:bg-[#0d0d0f] overflow-hidden shadow-sm">
              <button
                onClick={() => setDeclinedExpanded(d => !d)}
                className="w-full flex items-center justify-between px-6 py-5 bg-slate-50/50 dark:bg-[#121214]/50 border-b border-slate-200 dark:border-[#202024] text-left hover:bg-slate-100/30 dark:hover:bg-[#1c1c21]/30 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <XCircle className="w-5 h-5 text-rose-500" />
                  <span className="font-bold text-sm tracking-wide uppercase text-slate-750 dark:text-slate-200">
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
