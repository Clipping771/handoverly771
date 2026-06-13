'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { Clock, Search, Calendar, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface Activity {
  id: string;
  action_type: string;
  description: string;
  created_at: string;
}

export default function ActivityTimeline({ residentId }: { residentId: string }) {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDate, setFilterDate] = useState('');

  useEffect(() => {
    const fetchActivities = async () => {
      try {
        const { data, error } = await supabase
          .from('activity_timeline')
          .select('id, action_type, description, created_at')
          .eq('resident_id', residentId)
          .order('created_at', { ascending: false });
        
        if (!error && data) {
          setActivities(data);
        }
      } catch (err) {
        console.error('Failed to fetch activity timeline', err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchActivities();
  }, [residentId]);

  const filteredActivities = useMemo(() => {
    let result = activities;
    
    // Keyword Filter
    if (searchQuery.trim()) {
      const lowerQuery = searchQuery.toLowerCase();
      result = result.filter(a => 
        a.description?.toLowerCase().includes(lowerQuery) || 
        a.action_type?.replace(/_/g, ' ').toLowerCase().includes(lowerQuery)
      );
    }

    // Exact Date Filter
    if (filterDate) {
      result = result.filter(a => {
        // filterDate format: 'YYYY-MM-DD'
        // To avoid timezone shift issues, use substring
        const localDate = new Date(a.created_at);
        const yyyy = localDate.getFullYear();
        const mm = String(localDate.getMonth() + 1).padStart(2, '0');
        const dd = String(localDate.getDate()).padStart(2, '0');
        const aDate = `${yyyy}-${mm}-${dd}`;
        return aDate === filterDate;
      });
    }

    return result;
  }, [activities, searchQuery, filterDate]);

  const groupedActivities = useMemo(() => {
    const groups: Record<string, Activity[]> = {};
    filteredActivities.forEach(activity => {
      // Create a nice date string like "Thursday, June 13, 2026"
      const dateStr = new Date(activity.created_at).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
      if (!groups[dateStr]) groups[dateStr] = [];
      groups[dateStr].push(activity);
    });
    return Object.entries(groups);
  }, [filteredActivities]);

  if (loading) return <div className="text-xs text-slate-400 py-8 text-center animate-pulse">Loading timeline...</div>;

  return (
    <div className="space-y-6">
      {/* Search & Filter Bar */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search timeline events or keywords..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-11 bg-white/40 dark:bg-black/20 border border-slate-200/50 dark:border-white/5 rounded-[16px] pl-10 pr-4 text-[13px] font-medium focus:outline-none focus:border-indigo-400 dark:focus:border-indigo-500/50 focus:ring-4 focus:ring-indigo-500/10 text-text-primary shadow-sm backdrop-blur-md transition-all"
          />
        </div>
        <div className="relative shrink-0 md:w-[200px]">
          <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="date"
            value={filterDate}
            onChange={(e) => setFilterDate(e.target.value)}
            className="w-full h-11 bg-white/40 dark:bg-black/20 border border-slate-200/50 dark:border-white/5 rounded-[16px] pl-10 pr-10 text-[13px] font-medium focus:outline-none focus:border-indigo-400 dark:focus:border-indigo-500/50 focus:ring-4 focus:ring-indigo-500/10 text-text-primary shadow-sm backdrop-blur-md transition-all [&::-webkit-calendar-picker-indicator]:opacity-50 dark:[&::-webkit-calendar-picker-indicator]:invert"
          />
          {filterDate && (
            <button 
              onClick={() => setFilterDate('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 bg-slate-200 dark:bg-slate-700 rounded-full hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors z-10"
              title="Clear Date"
            >
              <X className="w-3 h-3 text-slate-600 dark:text-slate-300" />
            </button>
          )}
        </div>
      </div>

      {activities.length === 0 ? (
        <div className="text-xs text-slate-400 italic text-center py-8 bg-white/30 dark:bg-black/10 rounded-2xl border border-dashed border-slate-200 dark:border-white/5">No activities recorded yet.</div>
      ) : filteredActivities.length === 0 ? (
        <div className="text-xs text-slate-400 italic text-center py-8 bg-white/30 dark:bg-black/10 rounded-2xl border border-dashed border-slate-200 dark:border-white/5">No events match your search '{searchQuery}'.</div>
      ) : (
        <div className="space-y-8 relative before:absolute before:inset-0 before:ml-[19px] md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-indigo-500/50 before:via-indigo-200 dark:before:from-indigo-500/30 dark:before:via-indigo-900/50 before:to-transparent pt-2">
          <AnimatePresence>
            {groupedActivities.map(([dateString, groupActivities]) => (
              <motion.div 
                key={dateString}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="relative"
              >
                {/* Date Header Badge */}
                <div className="flex items-center justify-start md:justify-center mb-6 relative z-10 pl-10 md:pl-0">
                  <div className="px-4 py-1.5 bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/30 text-indigo-700 dark:text-indigo-300 rounded-full text-[10px] font-bold uppercase tracking-widest shadow-sm backdrop-blur-xl">
                    {dateString}
                  </div>
                </div>

                <div className="space-y-6">
                  {groupActivities.map((activity) => {
                    const date = new Date(activity.created_at);
                    const timeString = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                    
                    return (
                      <div key={activity.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                        {/* Center Node / Dot */}
                        <div className="absolute left-[19px] md:static flex items-center justify-center w-[14px] h-[14px] rounded-full border-[3px] border-indigo-500 bg-white dark:bg-[#0c1220] -translate-x-1/2 md:order-1 md:translate-x-0 z-10 shadow-[0_0_12px_rgba(99,102,241,0.4)]">
                        </div>
                        
                        {/* Event Card */}
                        <div className="w-[calc(100%-3rem)] ml-[3rem] md:ml-0 md:w-[calc(50%-2rem)] p-4 rounded-[20px] border border-white/60 bg-white/70 dark:bg-[#121827]/60 dark:border-white/10 backdrop-blur-2xl shadow-sm hover:shadow-[0_8px_30px_rgba(0,0,0,0.04)] transition-all duration-300 group-hover:border-indigo-300 dark:group-hover:border-indigo-500/50 hover:-translate-y-0.5">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-[9.5px] font-black text-indigo-700 dark:text-indigo-300 uppercase tracking-widest bg-indigo-100 dark:bg-indigo-500/20 px-2 py-0.5 rounded-md">
                              {activity.action_type.replace(/_/g, ' ')}
                            </span>
                            <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800/50 px-2 py-0.5 rounded-md">
                              <Clock className="w-3 h-3" />
                              <time className="text-[10px] font-bold">{timeString}</time>
                            </div>
                          </div>
                          <p className="text-[13px] font-semibold text-slate-700 dark:text-slate-200 leading-relaxed">{activity.description}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
