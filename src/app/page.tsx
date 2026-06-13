'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { User2, LogOut, Clock, ShieldAlert, Sparkles, Brain, CheckCircle2, Sun, Moon, Activity, Inbox, Volume2, Search, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, HeartHandshake } from 'lucide-react';
import Link from 'next/link';
import AdvancedCalendar from '@/components/AdvancedCalendar';
import OnboardingTour from '@/components/OnboardingTour';
import AmbientOrb from '@/components/AmbientOrb';
import SentinelBadge from '@/components/SentinelBadge';
import toast from 'react-hot-toast';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';

interface HandoverWithDetails {
  id: string;
  resident_name: string;
  room_number: string;
  care_level: string;
  rn_name: string;
  rn_summary: any;
  carer_tasks: any[];
  urgency: 'critical' | 'attention' | 'routine';
  risk_flags: string[];
  approved_at: string;
  shift_type: 'morning' | 'afternoon' | 'night';
}

export default function Dashboard() {
  const { user, facility, logout, isLoading: authLoading, isCarer } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const router = useRouter();

  const [handovers, setHandovers] = useState<HandoverWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterRole, setFilterRole] = useState<'rn' | 'carer'>('carer');
  const [urgencyFilter, setUrgencyFilter] = useState<'all' | 'critical' | 'attention' | 'routine'>('all');
  const [selectedDate, setSelectedDate] = useState<Date>(() => {
    const now = new Date();
    const localHour = now.getHours();
    if (localHour >= 0 && localHour < 12) {
      now.setDate(now.getDate() - 1);
    }
    return now;
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [expandedResidents, setExpandedResidents] = useState<string[]>([]);
  const [expandedShifts, setExpandedShifts] = useState<string[]>([]);
  const [datesWithHandovers, setDatesWithHandovers] = useState<string[]>([]);
  const [facilityUnacknowledgedTasks, setFacilityUnacknowledgedTasks] = useState<any[]>([]);
  const [facilityProactiveAlerts, setFacilityProactiveAlerts] = useState<any[]>([]);

  const filteredHandovers = useMemo(() => {
    return handovers.filter((h) => {
      let matchUrgency = true;
      if (urgencyFilter !== 'all') {
        matchUrgency = h.urgency === urgencyFilter;
      }
      const matchSearch = h.resident_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          h.room_number.toLowerCase().includes(searchQuery.toLowerCase());
      return matchUrgency && matchSearch;
    });
  }, [handovers, urgencyFilter, searchQuery]);

  interface GroupedHandover {
    residentName: string;
    roomNumber: string;
    careLevel: string;
    handovers: HandoverWithDetails[];
  }

  const groupedHandovers = useMemo(() => {
    const groups: Record<string, GroupedHandover> = {};
    filteredHandovers.forEach(h => {
      const key = `${h.resident_name}-${h.room_number}`;
      if (!groups[key]) {
        groups[key] = {
          residentName: h.resident_name,
          roomNumber: h.room_number,
          careLevel: h.care_level,
          handovers: []
        };
      }
      groups[key].handovers.push(h);
    });
    return Object.values(groups).sort((a, b) => a.roomNumber.localeCompare(b.roomNumber));
  }, [filteredHandovers]);

  const totalPages = useMemo(() => {
    return Math.ceil(groupedHandovers.length / itemsPerPage);
  }, [groupedHandovers, itemsPerPage]);

  const paginatedGroups = useMemo(() => {
    return groupedHandovers.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  }, [groupedHandovers, currentPage, itemsPerPage]);

  const toggleResidentExpand = (residentKey: string) => {
    setExpandedResidents(prev =>
      prev.includes(residentKey) ? prev.filter(x => x !== residentKey) : [...prev, residentKey]
    );
  };

  const toggleShiftExpand = (shiftId: string) => {
    setExpandedShifts(prev =>
      prev.includes(shiftId) ? prev.filter(x => x !== shiftId) : [...prev, shiftId]
    );
  };

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    } else if (user) {
      setFilterRole(isCarer ? 'carer' : 'rn');
    }
  }, [user, authLoading, router, isCarer]);

  const fetchAvailableDates = async () => {
    if (!facility) return;
    try {
      const { data, error } = await supabase
        .from('handovers')
        .select('shift_date')
        .eq('facility_id', facility.id)
        .eq('is_approved', true);

      if (error) throw error;
      if (data) {
        const uniqueDates = Array.from(new Set(data.map((h: any) => h.shift_date)));
        setDatesWithHandovers(uniqueDates);
      }
    } catch (err) {
      console.error('Error fetching available dates:', err);
    }
  };

  const fetchHandovers = async () => {
    if (!facility) return;
    try {
      setLoading(true);
      const year = selectedDate.getFullYear();
      const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
      const day = String(selectedDate.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;

      const { data, error } = await supabase
        .from('handovers')
        .select(`
          id,
          urgency,
          risk_flags,
          rn_summary,
          carer_tasks,
          approved_at,
          created_at,
          shift_type,
          residents!inner (name, room_number, care_level, is_active),
          staff (name)
        `)
        .eq('facility_id', facility.id)
        .eq('is_approved', true)
        .eq('shift_date', dateStr)
        .eq('residents.is_active', true);

      if (error) throw error;

      const mapped = (data || []).map((h: any) => {
        const fallbackTime = h.approved_at || h.created_at;
        return {
          id: h.id,
          resident_name: h.residents?.name || 'Unknown',
          room_number: h.residents?.room_number || '?',
          care_level: h.residents?.care_level || 'Routine',
          rn_name: h.staff?.name || 'System',
          rn_summary: h.rn_summary,
          carer_tasks: h.carer_tasks || [],
          urgency: h.urgency,
          risk_flags: h.risk_flags || [],
          approved_at: fallbackTime,
          shift_type: h.shift_type
        };
      });

      mapped.sort((a, b) => new Date(b.approved_at).getTime() - new Date(a.approved_at).getTime());

      setHandovers(mapped);
    } catch (err) {
      console.error('Error fetching handovers:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchSentinelData = async () => {
    if (!facility) return;
    try {
      const { data: facilityTasks } = await supabase
        .from('tasks')
        .select(`
          id, title, description, tags, created_at, resident_id, assigned_role, facility_id,
          resident:residents(name, room_number, is_active),
          handover:handovers(urgency)
        `)
        .eq('facility_id', facility.id)
        .or('is_completed.is.null,is_completed.eq.false');

      const filteredTasks = (facilityTasks || []).filter((t: any) => {
        const resObj = Array.isArray(t.resident) ? t.resident[0] : t.resident;
        if (!resObj || !resObj.is_active) return false;
        return true; // Show all uncompleted tasks immediately
      });
      setFacilityUnacknowledgedTasks(filteredTasks);

      const { data: cachedInsights } = await supabase
        .from('resident_insights')
        .select('resident_id, insights, residents:residents(name, room_number, is_active)')
        .eq('facility_id', facility.id);
        
      const allAlerts: any[] = [];
      (cachedInsights || []).forEach((row: any) => {
        const resObj = Array.isArray(row.residents) ? row.residents[0] : row.residents;
        if (resObj && resObj.is_active) {
          const alertsList = row.insights?.proactive_alerts || [];
          alertsList.forEach((alert: any) => {
            allAlerts.push({
              ...alert,
              residentId: row.resident_id,
              residentName: resObj?.name || 'Resident',
              roomNumber: resObj?.room_number || 'N/A'
            });
          });
        }
      });
      setFacilityProactiveAlerts(allAlerts);
    } catch (err) {
      console.error('Error fetching sentinel data:', err);
    }
  };

  const handleAcknowledgeAlert = async (alertId: string, alertMessage: string, residentId?: string) => {
    if (!user || !facility) return;
    try {
      const { error } = await supabase
        .from('activity_timeline')
        .insert({
          resident_id: residentId || 'unknown',
          staff_id: user.id,
          facility_id: facility.id,
          action_type: 'insight_acknowledged',
          description: `Acknowledged alert: ${alertId} (${alertMessage.substring(0, 45)}...) by ${user.name}`,
          metadata: { alert_id: alertId }
        });

      if (error) throw error;
      toast.success('Alert acknowledged and muted.');
      
      await fetch('/api/generate-insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ residentId, userKeys: {}, forceRefresh: true })
      });
      fetchSentinelData();
    } catch (e: any) {
      console.error('Failed to acknowledge alert:', e);
      toast.error('Failed to acknowledge alert.');
    }
  };

  const handleAcknowledgeTask = async (taskId: string) => {
    if (!user || !facility) return;
    try {
      const { error } = await supabase
        .from('tasks')
        .update({ 
          is_completed: true, 
          completed_by: user.id, 
          completed_at: new Date().toISOString() 
        })
        .eq('id', taskId);

      if (error) throw error;
      toast.success('Task marked as completed.');
      fetchSentinelData();
    } catch (e: any) {
      console.error('Failed to complete task:', e);
      toast.error('Failed to complete task.');
    }
  };

  useEffect(() => {
    if (!facility) return;

    fetchHandovers();
    fetchAvailableDates();
    fetchSentinelData();

    const handleRefresh = () => {
      fetchHandovers();
      fetchAvailableDates();
      fetchSentinelData();
    };
    window.addEventListener('refresh_data', handleRefresh);

    const channel = supabase
      .channel('handover-updates')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'handovers', filter: `facility_id=eq.${facility.id}` },
        () => {
          fetchHandovers();
          fetchAvailableDates();
          fetchSentinelData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [facility, selectedDate]);

  const handleLogout = () => {
    logout();
  };

  useGSAP(() => {
    const targets = gsap.utils.toArray('.critical-indicator');
    if (targets.length > 0) {
      gsap.fromTo(targets, 
        { scale: 1, opacity: 1 }, 
        { scale: 1.15, opacity: 0.7, duration: 2, repeat: -1, ease: 'sine.inOut', yoyo: true }
      );
    }
  }, { dependencies: [paginatedGroups] });

  if (authLoading || !user || !facility) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center">
        <div className="w-12 h-12 border-[3px] border-teal-accent border-t-transparent rounded-full animate-spin"></div>
        <p className="mt-6 text-text-secondary font-medium text-sm tracking-wide">Syncing Workspace...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-text-primary flex flex-col pb-16 font-sans transition-colors duration-300 relative">
      <OnboardingTour />
      {/* Premium Minimalist Header (Themed) */}
      <header className="sticky top-0 z-40 bg-white/80 dark:bg-[#0f172a]/80 backdrop-blur-2xl border-b border-slate-200/60 dark:border-white/10 px-6 md:px-8 py-4 transition-colors duration-300">
        <div className="max-w-[1400px] mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            {/* Themed Brand Logo Box */}
            <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shadow-inner transition-colors">
              <span className="font-extrabold text-lg text-primary">H</span>
            </div>
            <div className="flex flex-col">
              <h1 className="text-lg font-extrabold text-slate-900 dark:text-white tracking-tight leading-none mb-1">
                {facility.name}
              </h1>
              <div className="flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-accent opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-teal-accent"></span>
                </span>
                <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest leading-none">
                  Live Handover
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <SentinelBadge 
              userId={user.id}
              unacknowledgedTasks={facilityUnacknowledgedTasks}
              proactiveAlerts={facilityProactiveAlerts}
              onAcknowledgeAlert={(id, msg) => {
                const alertObj = facilityProactiveAlerts.find(a => a.id === id);
                return handleAcknowledgeAlert(id, msg, alertObj?.residentId);
              }}
              onAcknowledgeTask={handleAcknowledgeTask}
            />

            <button
              id="tour-theme-toggle"
              onClick={toggleTheme}
              className="p-2 rounded-lg border border-transparent hover:border-border bg-surface-solid/50 hover:bg-surface-solid text-text-secondary hover:text-text-primary transition-all duration-200 shadow-sm"
              title={theme === 'dark' ? "Switch to Day Mode" : "Switch to Night Mode"}
            >
              {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-500" /> : <Moon className="w-4 h-4" />}
            </button>

            {isCarer ? (
              <Link
                id="tour-shift-action"
                href="/tasks"
                className="px-5 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-white text-sm font-bold transition-all shadow-[0_4px_12px_rgba(45,212,191,0.2)] flex items-center gap-2"
              >
                <span>Shift Tasks</span>
                <ChevronRight className="w-4 h-4 opacity-70" />
              </Link>
            ) : (
              <Link
                id="tour-shift-action"
                href="/shift"
                className="px-5 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-white text-sm font-bold transition-all shadow-[0_4px_12px_rgba(45,212,191,0.2)] flex items-center gap-2"
              >
                <span>My Shift</span>
                <ChevronRight className="w-4 h-4 opacity-70" />
              </Link>
            )}
            
            <div className="w-px h-6 bg-slate-200 dark:bg-white/10 mx-1"></div>

            <button
              onClick={handleLogout}
              className="p-2 rounded-lg bg-blue-500/10 backdrop-blur-xl hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-500/30 transition-all duration-200 shadow-[0_4px_12px_rgba(59,130,246,0.1)]"
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="w-full flex-1 flex flex-col relative z-10 p-6 md:p-8">
        
        {/* Hourglass Glass Container Wrapper */}
        <div className="max-w-[1400px] mx-auto w-full bg-white/40 dark:bg-[#0f172a]/40 backdrop-blur-3xl rounded-[40px] border border-white/60 dark:border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.04)] overflow-hidden min-h-[80vh] flex flex-col">
          
          {/* Welcome Area (Hourglass Style) */}
          <div className="p-8 md:p-12 relative z-10 flex flex-col md:flex-row md:items-end justify-between gap-8">
            <div className="max-w-2xl">
              <h2 className="text-5xl md:text-6xl font-bold tracking-tight text-text-primary mb-2 font-sans">
                Welcome
              </h2>
              <p className="text-text-secondary text-lg font-medium max-w-lg leading-relaxed">
                Handoverly Synchronized Engine
              </p>
            </div>

            {/* Floating Soft Stats Row */}
            <div className="flex gap-4 self-start md:self-end">
               <div className="bg-white/70 dark:bg-slate-800/60 backdrop-blur-md rounded-[28px] p-6 min-w-[140px] flex flex-col items-start shadow-sm border border-white/80 dark:border-white/5">
                 <div className="text-4xl font-bold text-text-primary mb-1">{paginatedGroups.length}</div>
                 <div className="text-[11px] font-bold uppercase tracking-widest text-text-secondary">Active Rooms</div>
               </div>
               <div className="bg-white/70 dark:bg-slate-800/60 backdrop-blur-md rounded-[28px] p-6 min-w-[140px] flex flex-col items-start shadow-sm border border-white/80 dark:border-white/5">
                 <div className="text-4xl font-bold text-red-500 mb-1 flex items-center gap-2">
                    <span className="critical-indicator">
                      {paginatedGroups.filter(g => g.handovers.some(h => h.urgency === 'critical')).length}
                    </span>
                 </div>
                 <div className="text-[11px] font-bold uppercase tracking-widest text-text-secondary">Critical Risks</div>
               </div>
            </div>
          </div>

          {/* Content Area Inside Glass Container */}
          <div className="px-8 md:px-12 pb-12 flex-1 relative z-20">
          
          {/* Controls Bar */}
          <div className="flex flex-col md:flex-row justify-between items-center gap-6 mb-8 apple-card p-4 rounded-[24px]">
            {/* Role Switcher (Circular Buttons Style) */}
            <div id="tour-role-switcher" className="flex items-center gap-4 w-full md:w-auto">
              <button
                onClick={() => setFilterRole('carer')}
                className="flex flex-col items-center gap-2 group"
              >
                <div className={`w-14 h-14 rounded-full flex items-center justify-center transition-all duration-300 ${
                  filterRole === 'carer'
                    ? 'bg-white shadow-md border border-white/50 text-primary dark:bg-slate-800'
                    : 'glass-pill text-text-secondary group-hover:bg-white/80'
                }`}>
                  <HeartHandshake className="w-6 h-6" />
                </div>
                <span className={`text-[10px] font-bold uppercase tracking-widest ${filterRole === 'carer' ? 'text-primary' : 'text-text-secondary'}`}>Carer</span>
              </button>
              
              <button
                onClick={() => setFilterRole('rn')}
                className="flex flex-col items-center gap-2 group"
              >
                <div className={`w-14 h-14 rounded-full flex items-center justify-center transition-all duration-300 ${
                  filterRole === 'rn'
                    ? 'bg-white shadow-md border border-white/50 text-primary dark:bg-slate-800'
                    : 'glass-pill text-text-secondary group-hover:bg-white/80'
                }`}>
                  <Brain className="w-6 h-6" />
                </div>
                <span className={`text-[10px] font-bold uppercase tracking-widest ${filterRole === 'rn' ? 'text-primary' : 'text-text-secondary'}`}>RN</span>
              </button>
            </div>
          </div>

          {/* Advanced Calendar Date Selector */}
          <div id="tour-calendar" className="mb-8">
            <AdvancedCalendar
              selectedDate={selectedDate}
              onChange={setSelectedDate}
              datesWithHandovers={datesWithHandovers}
            />
          </div>

          {/* Toolbar: Urgency, Search, Pagination Limit */}
          <div className="flex flex-col md:flex-row gap-6 justify-between items-start md:items-center mb-8">
            {/* Urgency Filter Tabs (Soft Pills) */}
            <div id="tour-urgency-filter" className="flex gap-3 overflow-x-auto no-scrollbar w-full md:w-auto pb-2 md:pb-0">
              {(['all', 'critical', 'attention', 'routine'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => { setUrgencyFilter(tab); setCurrentPage(1); }}
                  className={`px-6 py-3 rounded-full text-xs font-bold tracking-widest uppercase transition-all duration-300 shrink-0 ${
                    urgencyFilter === tab
                      ? 'bg-white text-slate-900 shadow-md border border-white/80 dark:bg-slate-800 dark:text-white'
                      : 'glass-pill text-slate-500 hover:bg-white/80 dark:text-slate-400'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-4 w-full md:w-auto">
              {/* Search Bar */}
              <div id="tour-search" className="relative w-full sm:w-64">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search room or name..."
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                  className="w-full glass-pill rounded-full pl-11 pr-4 py-3 text-sm font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all border-white/60"
                />
              </div>
              
              {/* Items Per Page */}
              <select
                value={itemsPerPage}
                onChange={(e) => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}
                className="w-full sm:w-auto glass-pill rounded-full px-5 py-3 text-sm font-bold text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all border-white/60"
              >
              <option value={10}>10 per page</option>
              <option value={20}>20 per page</option>
              <option value={50}>50 per page</option>
            </select>
          </div>
        </div>

        {/* List of handovers */}
        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center py-20">
             <div className="w-10 h-10 border-[3px] border-teal-accent border-t-transparent rounded-full animate-spin mb-6"></div>
          </div>
        ) : paginatedGroups.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center py-24 px-6 rounded-[32px] apple-card animate-fade-in-up">
            <div className="w-16 h-16 rounded-3xl apple-card-inner flex items-center justify-center mb-6">
              <Search className="w-8 h-8 text-text-secondary" />
            </div>
            <h3 className="text-xl font-semibold tracking-tight text-text-primary mb-2">No results found</h3>
            <p className="text-sm text-text-secondary text-center max-w-sm leading-relaxed">
              Try adjusting your search query or urgency filter.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {paginatedGroups.map((group) => {
              const residentKey = `${group.residentName}-${group.roomNumber}`;
              const isResidentExpanded = expandedResidents.includes(residentKey);
              
              const hasCritical = group.handovers.some(h => h.urgency === 'critical');
              const hasAttention = group.handovers.some(h => h.urgency === 'attention');
              const groupUrgency = hasCritical ? 'critical' : hasAttention ? 'attention' : 'routine';
              
              let urgencyBorder = 'bg-white/80 dark:bg-slate-800/80 backdrop-blur-md border border-white dark:border-white/5 shadow-sm hover:shadow-md';
              let urgencyIndicator = 'bg-slate-300 dark:bg-slate-600';
              if (groupUrgency === 'critical') {
                urgencyBorder = 'bg-white/80 dark:bg-slate-800/80 backdrop-blur-md border border-red-500/30 shadow-[0_4px_24px_rgba(255,59,48,0.12)] hover:shadow-[0_8px_32px_rgba(255,59,48,0.2)]';
                urgencyIndicator = 'bg-red-500 critical-indicator';
              } else if (groupUrgency === 'attention') {
                urgencyBorder = 'bg-white/80 dark:bg-slate-800/80 backdrop-blur-md border border-amber-500/30 shadow-sm hover:shadow-md';
                urgencyIndicator = 'bg-amber-500';
              } else if (groupUrgency === 'routine') {
                urgencyIndicator = 'bg-green-500';
              }

              return (
                <div 
                  key={residentKey}
                  className={`relative rounded-[32px] overflow-hidden transition-all duration-300 animate-fade-in-up ${urgencyBorder}`}
                >
                  <div className={`absolute top-0 left-0 w-2 h-full ${urgencyIndicator.split(' ')[0]}`}></div>
                  
                  {/* Resident Header (Mother row) */}
                  <div 
                    onClick={() => toggleResidentExpand(residentKey)}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 md:p-8 cursor-pointer hover:bg-white/40 dark:hover:bg-white/5 transition-colors select-none pl-10"
                  >
                    <div className="flex items-center gap-6">
                      <div className="w-12 h-12 rounded-full glass-pill flex items-center justify-center text-text-secondary shrink-0 transition-transform duration-300">
                        {isResidentExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                      </div>
                      <div>
                        <div className="flex items-center gap-4 mb-1">
                          <h3 className="text-2xl font-bold tracking-tight text-text-primary">{group.residentName}</h3>
                          <div className={`w-3 h-3 rounded-full ${urgencyIndicator}`}></div>
                        </div>
                        <div className="flex items-center gap-3 mt-2">
                          <span className="text-[11px] font-bold px-3 py-1.5 rounded-full glass-pill text-text-secondary border-none">
                            Room {group.roomNumber}
                          </span>
                          <span className="text-[11px] font-bold px-3 py-1.5 rounded-full glass-pill text-text-secondary border-none uppercase tracking-widest">
                            Level {group.careLevel}
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    {/* Shift Indicators */}
                    <div className="flex items-center gap-2">
                      {['morning', 'afternoon', 'night'].map(shift => {
                        const hasShift = group.handovers.some(h => h.shift_type === shift);
                        if (!hasShift) return null;
                        return (
                          <span 
                            key={shift} 
                            className="text-[9px] uppercase tracking-widest font-extrabold px-3 py-1 rounded-full bg-indigo-50 text-indigo-650 dark:bg-indigo-950/30 dark:text-indigo-400 border border-indigo-100/50 dark:border-indigo-900/20"
                          >
                            {shift}
                          </span>
                        );
                      })}
                      <span className="text-xs text-slate-400 dark:text-slate-500 font-bold ml-1">
                        ({group.handovers.length} {group.handovers.length === 1 ? 'shift' : 'shifts'})
                      </span>
                    </div>
                  </div>
                  
                  {/* Expanded Shifts list (Children) */}
                  {isResidentExpanded && (
                    <div className="px-6 pb-6 border-t border-slate-100 dark:border-white/5 bg-slate-50/20 dark:bg-black/5 space-y-4 pt-4">
                      {group.handovers.map((h) => {
                        const isShiftExpanded = expandedShifts.includes(h.id);
                        let shiftUrgencyIndicator = 'bg-slate-400 dark:bg-slate-500';
                        if (h.urgency === 'critical') shiftUrgencyIndicator = 'bg-red-500';
                        else if (h.urgency === 'attention') shiftUrgencyIndicator = 'bg-amber-500';
                        else if (h.urgency === 'routine') shiftUrgencyIndicator = 'bg-emerald-500';

                        return (
                          <div 
                            key={h.id}
                            className="border border-slate-200/60 dark:border-white/5 rounded-2xl bg-white dark:bg-[#111113] overflow-hidden"
                          >
                            {/* Shift Header Row */}
                            <div 
                              onClick={() => toggleShiftExpand(h.id)}
                              className="flex items-center justify-between p-4 cursor-pointer hover:bg-slate-50 dark:hover:bg-white/[0.01] transition-colors select-none"
                            >
                              <div className="flex items-center gap-3">
                                <div className={`w-2 h-2 rounded-full ${shiftUrgencyIndicator}`}></div>
                                <span className="text-xs uppercase tracking-widest font-extrabold px-3 py-1 rounded-full bg-slate-100 text-slate-700 dark:bg-white/5 dark:text-slate-300">
                                  {h.shift_type} Shift
                                </span>
                                <span className="text-[10px] text-slate-400 font-medium">
                                  Approved: {new Date(h.approved_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </div>
                              <div className="flex items-center gap-3">
                                <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                                  <User2 className="w-3.5 h-3.5" />
                                  <span>{h.rn_name}</span>
                                </div>
                                <div className="text-slate-400">
                                  {isShiftExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                </div>
                              </div>
                            </div>
                            
                            {/* Shift Details (ISBAR / Actions) */}
                            {isShiftExpanded && (
                              <div className="p-5 border-t border-slate-100 dark:border-white/5 bg-slate-50/10 dark:bg-black/[0.01]">
                                {filterRole === 'rn' ? (
                                  /* RN SUMMARY: ISBAR Display */
                                  <div className="space-y-5">
                                    {h.rn_summary ? (
                                      (['identify', 'situation', 'background', 'assessment', 'recommendation'] as const).map((field) => {
                                        if (!h.rn_summary[field]) return null;
                                        return (
                                          <div key={field} className="flex flex-col sm:flex-row sm:gap-4 group/field">
                                            <span className="text-[10px] font-bold uppercase tracking-widest text-blue-600 dark:text-blue-400 sm:w-32 shrink-0 pt-0.5 opacity-80 group-hover/field:opacity-100 transition-opacity">
                                              {field}
                                            </span>
                                            <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed font-medium">
                                              {h.rn_summary[field]}
                                            </p>
                                          </div>
                                        );
                                      })
                                    ) : (
                                      <p className="text-sm text-slate-400 italic bg-slate-50 dark:bg-white/5 p-4 rounded-2xl">No summary draft generated</p>
                                    )}

                                    {/* Display risks */}
                                    {h.risk_flags && h.risk_flags.length > 0 && (
                                      <div className="mt-6 pt-5 border-t border-slate-100 dark:border-white/5">
                                        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3">Detected Risks</p>
                                        <div className="flex flex-wrap items-center gap-2">
                                          {h.risk_flags.map((flag) => (
                                            <span 
                                              key={flag}
                                              className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-red-50 text-red-700 border border-red-100 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20 flex items-center gap-1.5"
                                            >
                                              <ShieldAlert className="w-3.5 h-3.5" />
                                              {flag}
                                            </span>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  /* CARER SUMMARY: Tasks List */
                                  <div>
                                    <h4 className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-4 flex items-center gap-2">
                                      <Sparkles className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                                      Today's Actions
                                    </h4>
                                    {(() => {
                                      const carerTasksOnly = (h.carer_tasks || []).filter((t: any) => 
                                        typeof t === 'string' || 
                                        t?.assigned_role === 'carer' || 
                                        t?.assigned_role === 'all' || 
                                        !t?.assigned_role
                                      );
                                      if (carerTasksOnly.length === 0) return <p className="text-sm text-slate-400 italic bg-slate-50 dark:bg-white/5 p-4 rounded-2xl">No action items assigned for this shift.</p>;
                                      return (
                                        <ul className="space-y-3">
                                          {carerTasksOnly.map((task, idx) => {
                                            const title = typeof task === 'string' ? 'Action Item' : (task?.title || 'Action Item');
                                            const desc = typeof task === 'string' ? task : (task?.description || '');
                                            const tags = typeof task === 'string' ? [] : (task?.tags || []);
                                            
                                            const tagColors: Record<string, string> = {
                                              incidents: 'bg-red-500/10 text-red-750 dark:bg-red-500/20 dark:text-red-300 border border-red-500/20',
                                              medication: 'bg-purple-500/10 text-purple-750 dark:bg-purple-500/20 dark:text-purple-300 border border-purple-500/20',
                                              hygiene: 'bg-emerald-500/10 text-emerald-750 dark:bg-emerald-500/20 dark:text-emerald-300 border border-emerald-500/20',
                                              mobility: 'bg-blue-500/10 text-blue-750 dark:bg-blue-500/20 dark:text-blue-300 border border-blue-500/20',
                                              nutrition: 'bg-amber-500/10 text-amber-750 dark:bg-amber-500/20 dark:text-amber-300 border border-amber-500/20',
                                              general: 'bg-slate-500/10 text-slate-750 dark:bg-slate-500/20 dark:text-slate-300 border border-slate-500/20',
                                            };

                                            const playSpeech = (e: React.MouseEvent) => {
                                              e.stopPropagation();
                                              if ('speechSynthesis' in window) {
                                                window.speechSynthesis.cancel();
                                                const utterance = new SpeechSynthesisUtterance(`${title}. ${desc}`);
                                                utterance.rate = 0.9;
                                                window.speechSynthesis.speak(utterance);
                                              }
                                            };

                                            return (
                                              <li key={idx} className="flex gap-4 items-start bg-slate-50 hover:bg-slate-100 dark:bg-white/5 dark:hover:bg-white/10 p-4 rounded-2xl transition-colors duration-200">
                                                <span className="w-7 h-7 rounded-xl bg-slate-200 text-slate-800 dark:bg-white/10 dark:text-slate-350 font-bold text-sm flex items-center justify-center shrink-0">
                                                  {idx + 1}
                                                </span>
                                                <div className="flex-1 flex flex-col gap-2">
                                                  <div className="flex items-start justify-between gap-2">
                                                    <div className="flex flex-col">
                                                      <span className="text-sm font-bold text-slate-800 dark:text-slate-100 tracking-tight">{title}</span>
                                                      <span className="text-xs text-slate-500 dark:text-slate-400 font-medium leading-relaxed mt-0.5">{desc}</span>
                                                    </div>
                                                    <button
                                                      onClick={playSpeech}
                                                      className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-white/10 transition-all cursor-pointer shrink-0 mt-0.5"
                                                      title="Read task aloud"
                                                    >
                                                      <Volume2 className="w-3.5 h-3.5" />
                                                    </button>
                                                  </div>
                                                  {tags.length > 0 && (
                                                    <div className="flex flex-wrap gap-1">
                                                      {tags.map((t: string) => (
                                                        <span key={t} className={`text-[8.5px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${tagColors[t] || 'bg-slate-100 text-slate-600 dark:bg-white/5 dark:text-slate-400'}`}>
                                                          {t}
                                                        </span>
                                                      ))}
                                                    </div>
                                                  )}
                                                </div>
                                              </li>
                                            );
                                          })}
                                        </ul>
                                      );
                                    })()}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination Controls */}
        {!loading && groupedHandovers.length > 0 && (
          <div className="flex items-center justify-between mt-8 mb-4 border-t border-slate-200 dark:border-white/5 pt-6">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, groupedHandovers.length)} of {groupedHandovers.length} residents
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-2 rounded-lg border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 disabled:opacity-50 transition-colors flex items-center"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-200 px-3">
                {currentPage} / {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-2 rounded-lg border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 disabled:opacity-50 transition-colors flex items-center"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
        </div>
        </div>
      </main>
    </div>
  );
}
