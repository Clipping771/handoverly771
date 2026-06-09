'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { CheckCircle2, Circle, Clock, Sun, Moon, ArrowLeft, Stethoscope, User, HeartHandshake } from 'lucide-react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';

interface Task {
  id: string;
  title: string;
  description: string;
  tags: string[];
  is_completed: boolean;
  assigned_role: string;
  resident: { name: string; room_number: string };
  created_at: string;
}

export default function TasksPage() {
  const { user, facility, isLoading: authLoading } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const router = useRouter();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterTab, setFilterTab] = useState<'my_tasks' | 'all_tasks'>('my_tasks');

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  const fetchTasks = async () => {
    if (!facility) return;
    try {
      setLoading(true);
      const todayStr = new Date().toISOString().split('T')[0];
      
      const { data, error } = await supabase
        .from('tasks')
        .select(`
          id, title, description, tags, is_completed, assigned_role, created_at,
          resident:residents(name, room_number)
        `)
        .eq('facility_id', facility.id)
        .gte('created_at', todayStr)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTasks(data as any || []);
    } catch (err) {
      console.error('Error fetching tasks:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, [facility]);

  const toggleTaskStatus = async (taskId: string, currentStatus: boolean) => {
    try {
      // Optimistic update
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, is_completed: !currentStatus } : t));

      const { error } = await supabase
        .from('tasks')
        .update({ is_completed: !currentStatus })
        .eq('id', taskId);

      if (error) throw error;
    } catch (err) {
      console.error('Failed to update task:', err);
      // Revert
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, is_completed: currentStatus } : t));
    }
  };

  if (authLoading || !user || !facility) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-[#080b16] flex flex-col items-center justify-center">
        <div className="w-10 h-10 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  // Filter tasks based on the active tab
  const filteredTasks = tasks.filter(t => {
    if (filterTab === 'my_tasks') {
      if (user.role === 'admin') return true;
      return t.assigned_role === user.role || t.assigned_role === 'all';
    }
    return true;
  });

  // Group the filtered tasks by resident room
  const groupedTasks = useMemo(() => {
    const groups: Record<string, { residentName: string, tasks: Task[] }> = {};
    filteredTasks.forEach(task => {
      const room = task.resident?.room_number || 'Unknown';
      const name = task.resident?.name || 'Unknown Resident';
      if (!groups[room]) {
        groups[room] = { residentName: name, tasks: [] };
      }
      groups[room].tasks.push(task);
    });
    // Sort groups by room number
    return Object.entries(groups).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filteredTasks]);

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

  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-[#0b0b0d] text-[#1f1f1f] dark:text-[#e3e3e3] flex flex-col pb-24 transition-colors duration-300 font-sans">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-[#f8fafc]/80 dark:bg-[#0b0b0d]/80 backdrop-blur-md border-b border-[#e3e3e3] dark:border-[#202024] px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/shift" className="p-2 -ml-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors">
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

        {/* Tasks List */}
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-6 h-6 border-2 border-slate-400 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : groupedTasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 border-2 border-dashed border-slate-300 dark:border-[#202024] rounded-3xl text-center bg-slate-100/50 dark:bg-transparent">
            <CheckCircle2 className="w-14 h-14 text-emerald-400 dark:text-emerald-500/50 mb-4" />
            <p className="text-base font-semibold text-slate-600 dark:text-slate-300">You're all caught up!</p>
            <p className="text-sm text-slate-400 mt-1">No tasks assigned to you right now.</p>
          </div>
        ) : (
          <div className="space-y-10">
            <AnimatePresence initial={false}>
              {groupedTasks.map(([room, { residentName, tasks }]) => (
                <motion.div 
                  key={room}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-4"
                >
                  <h2 className="text-sm font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 pl-2 border-l-2 border-slate-300 dark:border-slate-700">
                    Room {room} — <span className="text-slate-600 dark:text-slate-300">{residentName}</span>
                  </h2>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {tasks.map(task => (
                      <motion.div 
                        key={task.id} 
                        layout
                        className={`bg-white dark:bg-[#121214] border ${task.is_completed ? 'border-emerald-200 dark:border-emerald-900/30 bg-emerald-50/30 dark:bg-[#121214]' : 'border-slate-200 dark:border-[#202024]'} rounded-[24px] p-5 flex items-start gap-4 shadow-sm hover:shadow-md transition-all group relative overflow-hidden`}
                      >
                        {/* Status Toggle */}
                        <button
                          onClick={() => toggleTaskStatus(task.id, task.is_completed)}
                          className="mt-1 shrink-0 transition-transform active:scale-90"
                        >
                          {task.is_completed ? (
                            <CheckCircle2 className="w-7 h-7 text-emerald-500" />
                          ) : (
                            <Circle className="w-7 h-7 text-slate-300 dark:text-slate-600 group-hover:text-indigo-400 transition-colors" />
                          )}
                        </button>
                        
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
                            <span className="text-[10px] font-semibold text-slate-400 flex items-center gap-1 shrink-0">
                              <Clock className="w-3 h-3" />
                              {new Date(task.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </main>
    </div>
  );
}
