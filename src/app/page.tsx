'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { User2, LogOut, Clock, ShieldAlert, Sparkles, Brain, CheckCircle2, Sun, Moon, Activity, Inbox, Volume2, Search, ChevronDown, ChevronUp, ChevronLeft, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import AdvancedCalendar from '@/components/AdvancedCalendar';

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
  const { user, facility, logout, isLoading: authLoading } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const router = useRouter();

  const [handovers, setHandovers] = useState<HandoverWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterRole, setFilterRole] = useState<'rn' | 'carer'>('carer');
  const [urgencyFilter, setUrgencyFilter] = useState<'all' | 'critical' | 'attention' | 'routine'>('all');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [expandedIds, setExpandedIds] = useState<string[]>([]);
  const [datesWithHandovers, setDatesWithHandovers] = useState<string[]>([]);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    } else if (user) {
      setFilterRole(user.role === 'carer' ? 'carer' : 'rn');
    }
  }, [user, authLoading, router]);

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
          shift_type,
          residents!inner (name, room_number, care_level, is_active),
          staff (name)
        `)
        .eq('facility_id', facility.id)
        .eq('is_approved', true)
        .eq('shift_date', dateStr)
        .eq('residents.is_active', true);

      if (error) throw error;

      const mapped = (data || []).map((h: any) => ({
        id: h.id,
        resident_name: h.residents?.name || 'Unknown',
        room_number: h.residents?.room_number || '?',
        care_level: h.residents?.care_level || 'Routine',
        rn_name: h.staff?.name || 'System',
        rn_summary: h.rn_summary,
        carer_tasks: h.carer_tasks || [],
        urgency: h.urgency,
        risk_flags: h.risk_flags || [],
        approved_at: h.approved_at,
        shift_type: h.shift_type
      }));

      const urgencyWeights: Record<string, number> = { critical: 3, attention: 2, routine: 1 };
      mapped.sort((a, b) => (urgencyWeights[b.urgency] || 0) - (urgencyWeights[a.urgency] || 0));

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

  const filteredHandovers = handovers.filter((h) => {
    let matchUrgency = true;
    if (urgencyFilter !== 'all') {
      matchUrgency = h.urgency === urgencyFilter;
    }
    const matchSearch = h.resident_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        h.room_number.toLowerCase().includes(searchQuery.toLowerCase());
    return matchUrgency && matchSearch;
  });

  const totalPages = Math.ceil(filteredHandovers.length / itemsPerPage);
  const paginatedHandovers = filteredHandovers.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  return (
    <div className="min-h-screen bg-[#f8f9fa] dark:bg-[#0a0a0c] text-slate-900 dark:text-slate-100 flex flex-col pb-16 font-sans selection:bg-blue-100 dark:selection:bg-blue-900/30 transition-colors duration-300">
      
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
              onClick={toggleTheme}
              className="p-2.5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 transition-all duration-200 dark:bg-white/5 dark:hover:bg-white/10 dark:text-slate-300"
              title={theme === 'dark' ? "Switch to Day Mode" : "Switch to Night Mode"}
            >
              {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-700" />}
            </button>

            {user.role !== 'carer' && (
              <Link
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
          <div className="flex bg-slate-200/60 p-1.5 rounded-full dark:bg-white/5 border border-slate-200/50 dark:border-white/5 self-start shadow-inner">
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
        <div className="mb-8">
          <AdvancedCalendar
            selectedDate={selectedDate}
            onChange={setSelectedDate}
            datesWithHandovers={datesWithHandovers}
          />
        </div>

        {/* Toolbar: Urgency, Search, Pagination Limit */}
        <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center mb-8">
          {/* Urgency Filter Tabs */}
          <div className="flex gap-2 overflow-x-auto no-scrollbar w-full md:w-auto">
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
            <div className="relative w-full sm:w-64">
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
        ) : paginatedHandovers.length === 0 ? (
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
          <div className="grid grid-cols-1 gap-4">
            {paginatedHandovers.map((h) => {
              const isExpanded = expandedIds.includes(h.id);
              let urgencyBorder = 'border-slate-200/80 hover:border-slate-300 bg-white dark:border-white/10 dark:hover:border-white/20 dark:bg-[#151518]';
              let urgencyIndicator = 'bg-slate-400 dark:bg-slate-500';
              
              if (h.urgency === 'critical') {
                urgencyBorder = 'border-red-200/80 hover:border-red-300 bg-white dark:border-red-500/30 dark:hover:border-red-500/50 dark:bg-[#1a1213]';
                urgencyIndicator = 'bg-red-500 shadow-[0_0_12px_rgba(239,68,68,0.5)]';
              } else if (h.urgency === 'attention') {
                urgencyBorder = 'border-amber-200/80 hover:border-amber-300 bg-white dark:border-amber-500/30 dark:hover:border-amber-500/50 dark:bg-[#1a1712]';
                urgencyIndicator = 'bg-amber-500 shadow-[0_0_12px_rgba(245,158,11,0.5)]';
              } else if (h.urgency === 'routine') {
                urgencyBorder = 'border-emerald-200/80 hover:border-emerald-300 bg-white dark:border-emerald-500/30 dark:hover:border-emerald-500/50 dark:bg-[#121a15]';
                urgencyIndicator = 'bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.5)]';
              }

              return (
                <div 
                  key={h.id} 
                  className={`relative border rounded-2xl shadow-sm hover:shadow-md transition-all duration-300 group overflow-hidden ${urgencyBorder}`}
                >
                  {/* Subtle top gradient line indicating urgency */}
                  <div className={`absolute top-0 left-0 w-full h-1 opacity-50 ${urgencyIndicator.split(' ')[0]}`}></div>

                  {/* Meta header (Clickable to expand) */}
                  <div 
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 cursor-pointer hover:bg-slate-50/50 dark:hover:bg-white/[0.02] transition-colors"
                    onClick={() => toggleExpand(h.id)}
                  >
                    <div className="flex items-center gap-4">
                      {/* Chevron Indicator */}
                      <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-white/5 flex items-center justify-center text-slate-500 dark:text-slate-400 shrink-0 transition-transform duration-300">
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </div>
                      
                      <div>
                        <div className="flex items-center gap-3 mb-1">
                          <h3 className="text-lg font-semibold tracking-tight text-slate-900 dark:text-white">{h.resident_name}</h3>
                          <div className={`w-2 h-2 rounded-full ${urgencyIndicator}`}></div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-lg bg-slate-100 text-slate-600 dark:bg-white/5 dark:text-slate-300">
                            Room {h.room_number}
                          </span>
                          <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Care Level: {h.care_level}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 sm:self-start">
                      <span className="text-[10px] uppercase tracking-widest font-bold px-3 py-1 rounded-full bg-slate-100 text-slate-600 border border-slate-200 dark:bg-white/5 dark:text-slate-300 dark:border-white/10">
                        {h.shift_type}
                      </span>
                      <div className="hidden sm:flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-slate-200 dark:bg-white/10 flex items-center justify-center">
                          <User2 className="w-3 h-3 text-slate-500 dark:text-slate-400" />
                        </div>
                        <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                          {h.rn_name}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Expanded Body Content */}
                  {isExpanded && (
                    <div className="p-5 pt-0 border-t border-slate-100 dark:border-white/5 mt-2">
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
                          )
                        })
                      ) : (
                        <p className="text-sm text-slate-400 italic bg-slate-50 dark:bg-white/5 p-4 rounded-2xl">No summary draft generated</p>
                      )}

                      {/* Display flags */}
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
                      {h.carer_tasks && h.carer_tasks.length > 0 ? (
                        <ul className="space-y-3">
                          {h.carer_tasks.map((task, idx) => {
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
                      ) : (
                        <p className="text-sm text-slate-400 italic bg-slate-50 dark:bg-white/5 p-4 rounded-2xl">No action items assigned for this shift.</p>
                      )}
                    </div>
                  )}

                  {/* Stamp footer */}
                  <div className="mt-8 pt-5 border-t border-slate-100 dark:border-white/5 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-slate-200 dark:bg-white/10 flex items-center justify-center">
                        <User2 className="w-3 h-3 text-slate-500 dark:text-slate-400" />
                      </div>
                      <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                        {h.rn_name}
                      </span>
                    </div>
                    <span className="text-xs font-mono font-medium text-slate-400">
                      {new Date(h.approved_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
                )}
              </div>
            );
          })}
          </div>
        )}

        {/* Pagination Controls */}
        {!loading && filteredHandovers.length > 0 && (
          <div className="flex items-center justify-between mt-8 mb-4 border-t border-slate-200 dark:border-white/5 pt-6">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, filteredHandovers.length)} of {filteredHandovers.length}
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
