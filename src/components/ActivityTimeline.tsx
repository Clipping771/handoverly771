'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Clock } from 'lucide-react';

interface Activity {
  id: string;
  action_type: string;
  description: string;
  created_at: string;
}

export default function ActivityTimeline({ residentId }: { residentId: string }) {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

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

  if (loading) return <div className="text-xs text-slate-400">Loading timeline...</div>;
  if (activities.length === 0) return <div className="text-xs text-slate-400 italic">No activities recorded yet.</div>;

  return (
    <div className="space-y-4 relative before:absolute before:inset-0 before:ml-2.5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-200 dark:before:via-[#1e295d] before:to-transparent">
      {activities.map((activity) => {
        const date = new Date(activity.created_at);
        const timeString = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const dateString = date.toLocaleDateString([], { month: 'short', day: 'numeric' });
        
        return (
          <div key={activity.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
            {/* Icon */}
            <div className="flex items-center justify-center w-5 h-5 rounded-full border border-white/40 bg-white/80 text-primary dark:bg-slate-800 dark:text-primary dark:border-white/10 shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 shadow-sm">
              <Clock className="w-3 h-3" />
            </div>
            
            {/* Content */}
            <div className="w-[calc(100%-2rem)] md:w-[calc(50%-1.5rem)] p-3 rounded-xl border border-white/50 bg-white/40 dark:bg-white/5 dark:border-white/5 backdrop-blur-md shadow-sm">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-bold text-primary dark:text-primary uppercase tracking-wider">{activity.action_type.replace(/_/g, ' ')}</span>
                <time className="text-[10px] text-text-secondary">{dateString} {timeString}</time>
              </div>
              <p className="text-xs text-text-primary">{activity.description}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
