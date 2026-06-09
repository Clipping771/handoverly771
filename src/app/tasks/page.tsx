'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { CheckCircle2, Circle, Clock, Filter, Sun, Moon, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';

interface Task {
  id: string;
  title: string;
  description: string;
  tags: string[];
  is_completed: boolean;
  resident: { name: string; room_number: string };
  created_at: string;
}

export default function TasksPage() {
  const { user, facility, isLoading: authLoading } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const router = useRouter();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'completed'>('pending');

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  const fetchTasks = async () => {
    if (!facility) return;
    try {
      setLoading(true);
      // Fetch tasks for the facility created today
      const todayStr = new Date().toISOString().split('T')[0];
      
      const { data, error } = await supabase
        .from('tasks')
        .select(`
          id, title, description, tags, is_completed, created_at,
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

      if (error) {
        throw error;
      }
    } catch (err) {
      console.error('Failed to update task:', err);
      // Revert optimistic update
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, is_completed: currentStatus } : t));
    }
  };

  if (authLoading || !user || !facility) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-[#080b16] flex flex-col items-center justify-center">
        <div className="w-10 h-10 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const filteredTasks = tasks.filter(t => {
    if (filter === 'pending') return !t.is_completed;
    if (filter === 'completed') return t.is_completed;
    return true;
  });

  return (
    <div className="min-h-screen bg-[#ffffff] dark:bg-[#0b0b0d] text-[#1f1f1f] dark:text-[#e3e3e3] flex flex-col pb-16 transition-colors duration-300 font-sans">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-[#ffffff]/80 dark:bg-[#0b0b0d]/80 backdrop-blur-md border-b border-[#e3e3e3] dark:border-[#202024] px-6 py-3.5">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/shift" className="text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <h1 className="font-semibold text-[17px] tracking-tight">Shift Tasks</h1>
          </div>
          
          <button
            onClick={toggleTheme}
            className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-900 text-slate-600 dark:text-slate-400 transition-colors"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-500" /> : <Moon className="w-4 h-4 text-[#1f1f1f]" />}
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto w-full px-6 mt-8 flex-1 flex flex-col">
        {/* Filters */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex bg-slate-100 dark:bg-[#121214] p-1 rounded-xl">
            {(['pending', 'completed', 'all'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
                  filter === f 
                    ? 'bg-white dark:bg-[#1c1c21] shadow-sm text-blue-600 dark:text-blue-400' 
                    : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
          <span className="text-xs font-semibold text-slate-400">
            {filteredTasks.length} {filteredTasks.length === 1 ? 'task' : 'tasks'}
          </span>
        </div>

        {/* Tasks List */}
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-6 h-6 border-2 border-slate-400 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : filteredTasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 border border-dashed border-[#e3e3e3] dark:border-[#202024] rounded-2xl text-center">
            <CheckCircle2 className="w-12 h-12 text-emerald-400 dark:text-emerald-500/50 mb-3" />
            <p className="text-sm font-semibold text-slate-600 dark:text-slate-400">All caught up!</p>
            <p className="text-xs text-slate-400 mt-1">No tasks in this category.</p>
          </div>
        ) : (
          <div className="space-y-4">
            <AnimatePresence initial={false}>
              {filteredTasks.map(task => (
                <motion.div 
                  key={task.id} 
                  initial={{ opacity: 0, y: -20, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
                  layout
                  className={`bg-white dark:bg-[#121214] border ${task.is_completed ? 'border-emerald-200 dark:border-emerald-900/30' : 'border-[#e3e3e3] dark:border-[#202024]'} rounded-[20px] p-5 flex items-start gap-4 shadow-sm hover:shadow-md`}
                >
                  <button
                    onClick={() => toggleTaskStatus(task.id, task.is_completed)}
                    className="mt-1 shrink-0 transition-colors"
                  >
                    {task.is_completed ? (
                      <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                    ) : (
                      <Circle className="w-6 h-6 text-slate-300 dark:text-slate-600 hover:text-blue-500" />
                    )}
                  </button>
                  
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <h3 className={`font-semibold text-[15px] ${task.is_completed ? 'text-slate-400 line-through transition-all' : 'text-slate-900 dark:text-white transition-all'}`}>
                        {task.title}
                      </h3>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-[#1c1c21] text-slate-600 dark:text-slate-400">
                        Room {task.resident?.room_number}
                      </span>
                    </div>
                    
                    <p className={`text-xs leading-relaxed mb-3 ${task.is_completed ? 'text-slate-400 transition-all' : 'text-slate-600 dark:text-slate-300 transition-all'}`}>
                      {task.description}
                    </p>
                    
                    <div className="flex items-center justify-between">
                      <div className="flex gap-2">
                        {task.tags.map(tag => (
                          <span key={tag} className="text-[9px] font-mono font-bold uppercase tracking-widest text-slate-400">
                            #{tag}
                          </span>
                        ))}
                      </div>
                      <span className="text-[10px] text-slate-400 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(task.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
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
