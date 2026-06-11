'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { User2, LogOut, Clock, ShieldAlert, Sparkles, Brain, CheckCircle2, Sun, Moon, Activity, Inbox, Volume2, Search, ChevronDown, ChevronUp, ChevronLeft, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import AdvancedCalendar from '@/components/AdvancedCalendar';
import OnboardingTour from '@/components/OnboardingTour';

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

  useEffect(() => {
    if (!facility) return;

    fetchHandovers();
    fetchAvailableDates();

    const channel = supabase
      .channel('handover-updates')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'handovers', filter: `facility_id=eq.${facility.id}` },
        () => {
          fetchHandovers();
          fetchAvailableDates();
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

  if (authLoading || !user || !facility) {
    return (
      <div className="min-h-screen bg-[#f8f9fa] dark:bg-[#121212] flex flex-col items-center justify-center">
        <div className="w-12 h-12 border-[3px] border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="mt-6 text-slate-500 dark:text-slate-400 font-medium text-sm tracking-wide">Syncing Workspace...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8f9fa] dark:bg-[#0a0a0c] text-slate-900 dark:text-slate-100 flex flex-col pb-16 font-sans selection:bg-blue-100 dark:selection:bg-blue-900/30 transition-colors duration-300">
      <OnboardingTour />
      {/* Premium Header */}
      <header className="sticky top-0 z-40 bg-white/80 dark:bg-[#0a0a0c]/80 backdrop-blur-2xl border-b border-slate-200/60 dark:border-white/5 px-6 py-4 transition-colors duration-300">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-11 h-11 rounded-[14px] bg-white dark:bg-[#1a1a1c] border border-slate-200 dark:border-white/10 flex items-center justify-center shadow-sm">
              <Activity className="w-5 h-5 text-slate-700 dark:text-slate-300 animate-pulse" />
            </div>
            <div>
              <h1 className="text-base font-semibold text-slate-900 dark:text-white tracking-tight">{facility.name}</h1>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5 font-medium uppercase tracking-widest mt-0.5">
                <Clock className="w-3 h-3 text-blue-500" />
                Live Handover
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              id="tour-theme-toggle"
              onClick={toggleTheme}
              className="p-2.5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 transition-all duration-200 dark:bg-white/5 dark:hover:bg-white/10 dark:text-slate-300"
              title={theme === 'dark' ? "Switch to Day Mode" : "Switch to Night Mode"}
            >
              {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-700" />}
            </button>

            {isCarer ? (
              <Link
                id="tour-shift-action"
                href="/tasks"
                className="px-5 py-2.5 rounded-full bg-white border border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700 text-sm font-semibold dark:bg-[#1a1a1c] dark:border-white/10 dark:hover:border-white/20 dark:text-slate-200 transition-all shadow-sm"
              >
                Shift Tasks
              </Link>
            ) : (
              <Link
                id="tour-shift-action"
                href="/shift"
                className="px-5 py-2.5 rounded-full bg-white border border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700 text-sm font-semibold dark:bg-[#1a1a1c] dark:border-white/10 dark:hover:border-white/20 dark:text-slate-200 transition-all shadow-sm"
              >
                My Shift
              </Link>
            )}
            <button
              onClick={handleLogout}
              className="p-2.5 rounded-full bg-slate-100 hover:bg-red-50 hover:text-red-600 text-slate-600 transition-all duration-200 dark:bg-white/5 dark:hover:bg-red-500/10 dark:hover:text-red-400 dark:text-slate-300"
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto w-full px-6 mt-12 flex-1 flex flex-col relative z-10">
        
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-100 dark:bg-white/5 border border-slate-200/60 dark:border-white/10 mb-5">
              <CheckCircle2 className="w-3 h-3 text-slate-400 dark:text-slate-500" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">Synchronized</span>
            </div>
            <h2 className="text-4xl font-semibold tracking-tight text-slate-900 dark:text-white mb-3">Shift Handovers</h2>
            <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">
              Monitor and review active shift transitions across the facility in real-time.
            </p>
          </div>

          {/* Role Switcher (Segmented Control) */}
          <div id="tour-role-switcher" className="flex bg-slate-200/60 p-1.5 rounded-full dark:bg-white/5 border border-slate-200/50 dark:border-white/5 self-start shadow-inner">
            <button
              onClick={() => setFilterRole('carer')}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-full text-xs font-semibold transition-all duration-300 ${
                filterRole === 'carer'
                  ? 'bg-white text-slate-900 shadow-sm dark:bg-[#2a2a2d] dark:text-white dark:shadow-black/20'
                  : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              <Sparkles className="w-4 h-4" />
              Carer View
            </button>
            <button
              onClick={() => setFilterRole('rn')}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-full text-xs font-semibold transition-all duration-300 ${
                filterRole === 'rn'
                  ? 'bg-white text-slate-900 shadow-sm dark:bg-[#2a2a2d] dark:text-white dark:shadow-black/20'
                  : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              <Brain className="w-4 h-4" />
              RN View
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
        <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center mb-8">
          {/* Urgency Filter Tabs */}
          <div id="tour-urgency-filter" className="flex gap-2 overflow-x-auto no-scrollbar w-full md:w-auto">
            {(['all', 'critical', 'attention', 'routine'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => { setUrgencyFilter(tab); setCurrentPage(1); }}
                className={`px-5 py-2.5 rounded-full text-[11px] font-bold tracking-wider uppercase transition-all duration-300 shrink-0 ${
                  urgencyFilter === tab
                    ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200/80 dark:bg-[#2a2a2d] dark:text-white dark:ring-white/10'
                    : 'bg-transparent text-slate-500 hover:bg-slate-200/50 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-slate-200'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
            {/* Search Bar */}
            <div id="tour-search" className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search room or name..."
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                className="w-full bg-white dark:bg-[#1a1a1c] border border-slate-200 dark:border-white/10 rounded-full pl-9 pr-4 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>
            
            {/* Items Per Page */}
            <select
              value={itemsPerPage}
              onChange={(e) => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}
              className="w-full sm:w-auto bg-white dark:bg-[#1a1a1c] border border-slate-200 dark:border-white/10 rounded-full px-4 py-2 text-sm text-slate-700 dark:text-slate-300 focus:outline-none focus:border-blue-500 transition-colors"
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
             <div className="w-10 h-10 border-[3px] border-blue-600 border-t-transparent rounded-full animate-spin mb-6"></div>
          </div>
        ) : paginatedGroups.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center py-24 px-6 rounded-3xl border border-slate-200/60 bg-white/50 dark:border-white/5 dark:bg-white/[0.02] shadow-sm backdrop-blur-xl">
            <div className="w-16 h-16 rounded-3xl bg-slate-100 dark:bg-white/5 flex items-center justify-center mb-6 shadow-inner">
              <Search className="w-8 h-8 text-slate-400 dark:text-slate-500" />
            </div>
            <h3 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-100 mb-2">No results found</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 text-center max-w-sm leading-relaxed">
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
              
              let urgencyBorder = 'border-slate-200/80 bg-white dark:border-white/10 dark:bg-[#151518]';
              let urgencyIndicator = 'bg-slate-400 dark:bg-slate-500';
              if (groupUrgency === 'critical') {
                urgencyBorder = 'border-red-200/80 bg-white dark:border-red-500/25 dark:bg-[#1a1213]';
                urgencyIndicator = 'bg-red-500 shadow-[0_0_12px_rgba(239,68,68,0.5)]';
              } else if (groupUrgency === 'attention') {
                urgencyBorder = 'border-amber-200/80 bg-white dark:border-amber-500/25 dark:bg-[#1a1712]';
                urgencyIndicator = 'bg-amber-500 shadow-[0_0_12px_rgba(245,158,11,0.5)]';
              } else if (groupUrgency === 'routine') {
                urgencyBorder = 'border-emerald-200/80 bg-white dark:border-emerald-500/25 dark:bg-[#121a15]';
                urgencyIndicator = 'bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.5)]';
              }

              return (
                <div 
                  key={residentKey}
                  className={`relative border rounded-[28px] shadow-sm overflow-hidden transition-all duration-300 ${urgencyBorder}`}
                >
                  <div className={`absolute top-0 left-0 w-full h-1 opacity-50 ${urgencyIndicator.split(' ')[0]}`}></div>
                  
                  {/* Resident Header (Mother row) */}
                  <div 
                    onClick={() => toggleResidentExpand(residentKey)}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 cursor-pointer hover:bg-slate-50/50 dark:hover:bg-white/[0.02] transition-colors select-none"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-9 h-9 rounded-full bg-slate-100 dark:bg-white/5 flex items-center justify-center text-slate-500 dark:text-slate-400 shrink-0 transition-transform duration-300">
                        {isResidentExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                      </div>
                      <div>
                        <div className="flex items-center gap-3 mb-1">
                          <h3 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">{group.residentName}</h3>
                          <div className={`w-2.5 h-2.5 rounded-full ${urgencyIndicator}`}></div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 dark:bg-white/5 dark:text-slate-350">
                            Room {group.roomNumber}
                          </span>
                          <span className="text-xs text-slate-500 dark:text-slate-400 font-bold">Care Level: {group.careLevel}</span>
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

      </main>
    </div>
  );
}
