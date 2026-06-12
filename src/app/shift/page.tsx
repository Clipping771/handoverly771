'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Settings, FileCheck, Users, Search, Plus, X, Sun, Moon, LogOut, ArrowRight, Activity, Trash2, ShieldAlert, FileWarning, AlertCircle, ListTodo, Clock, RotateCcw, Pencil } from 'lucide-react';
import Link from 'next/link';
import SettingsModal from '@/components/SettingsModal';
import OnboardingTour from '@/components/OnboardingTour';
import { motion, AnimatePresence } from 'framer-motion';
import SentinelBadge from '@/components/SentinelBadge';
import toast from 'react-hot-toast';
import AriaFloatingButton from '@/components/AriaFloatingButton';
import { Check } from 'lucide-react';
import { getPendingQueue } from '@/lib/db';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';


interface Resident {
  id: string;
  name: string;
  room_number: string;
  care_level: string;
  dob?: string;
  wing_id?: string;
  is_active?: boolean;
  status_reason?: string;
}

interface Wing {
  id: string;
  name: string;
}

interface HandoverStatus {
  resident_id: string;
  is_approved: boolean;
  urgency: 'critical' | 'attention' | 'routine' | 'urgent';
  shift_type?: 'morning' | 'afternoon' | 'night';
  updated_at?: string;
  raw_input?: string;
  rn_summary?: any;
}

export default function MyShift() {
  const { user, facility, logout, isLoading: authLoading, isAdmin, isRN } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const router = useRouter();

  const [residents, setResidents] = useState<Resident[]>([]);
  const [archivedResidents, setArchivedResidents] = useState<Resident[]>([]);
  const [wings, setWings] = useState<Wing[]>([]);
  const [selectedWingFilter, setSelectedWingFilter] = useState('all');
  const [handovers, setHandovers] = useState<Record<string, HandoverStatus>>({});
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'completed'>('all');
  const [showArchive, setShowArchive] = useState(false);
  const [selectedResidentId, setSelectedResidentId] = useState<string | null>(null);
  const [selectedResidentTasks, setSelectedResidentTasks] = useState<any[]>([]);
  const [selectedResidentTimeline, setSelectedResidentTimeline] = useState<any[]>([]);
  const [loadingRightPane, setLoadingRightPane] = useState(false);

  useEffect(() => {
    if (!selectedResidentId) {
      setSelectedResidentTasks([]);
      setSelectedResidentTimeline([]);
      return;
    }

    const fetchRightPaneData = async () => {
      setLoadingRightPane(true);
      try {
        // Fetch tasks
        const { data: tasksData } = await supabase
          .from('tasks')
          .select('*')
          .eq('resident_id', selectedResidentId)
          .order('created_at', { ascending: false });

        setSelectedResidentTasks(tasksData || []);

        // Fetch timeline
        const { data: timelineData } = await supabase
          .from('activity_timeline')
          .select('*')
          .eq('resident_id', selectedResidentId)
          .order('created_at', { ascending: false });

        setSelectedResidentTimeline(timelineData || []);
      } catch (e) {
        console.error('Error fetching resident details for right pane:', e);
      } finally {
        setLoadingRightPane(false);
      }
    };

    fetchRightPaneData();
  }, [selectedResidentId]);

  const filteredResidents = residents.filter((res) => {
    const matchesSearch = res.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          res.room_number.includes(searchQuery);

    let matchesWing = true;
    if (selectedWingFilter === 'unassigned') {
      matchesWing = !res.wing_id;
    } else if (selectedWingFilter && selectedWingFilter !== 'all') {
      matchesWing = res.wing_id === selectedWingFilter;
    }

    const hasHandover = handovers[res.id]?.is_approved;

    let matchesTab = true;
    if (activeTab === 'pending') {
      matchesTab = !hasHandover;
    } else if (activeTab === 'completed') {
      matchesTab = hasHandover;
    }

    return matchesSearch && matchesWing && matchesTab;
  });

  // GSAP Animations
  useGSAP(() => {
    // Stagger load resident cards
    if (filteredResidents.length > 0) {
      gsap.fromTo('.resident-card', 
        { y: 24, opacity: 0 }, 
        { y: 0, opacity: 1, stagger: 0.07, ease: 'power3.out', duration: 0.5 }
      );
    }

    // GSAP Hover on apple cards
    const cards = gsap.utils.toArray('.apple-card');
    cards.forEach((card: any) => {
      // Remove any existing event listeners to avoid dupes
      const enter = () => gsap.to(card, { boxShadow: '0 10px 40px -10px rgba(15,118,110,0.08)', y: -2, duration: 0.25 });
      const leave = () => gsap.to(card, { boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05), 0 10px 30px -10px rgba(0, 0, 0, 0.02)', y: 0, duration: 0.25 });
      
      card.addEventListener('mouseenter', enter);
      card.addEventListener('mouseleave', leave);
      
      return () => {
        card.removeEventListener('mouseenter', enter);
        card.removeEventListener('mouseleave', leave);
      };
    });
  }, { dependencies: [filteredResidents, activeTab] });


  // Sentinel Alert state variables
  const [facilityUnacknowledgedTasks, setFacilityUnacknowledgedTasks] = useState<any[]>([]);
  const [facilityProactiveAlerts, setFacilityProactiveAlerts] = useState<any[]>([]);
  const [facilityTrends, setFacilityTrends] = useState<{ date: string, count: number }[]>([]);

  // Modal States for Dynamic Resident Insertion
  const [showAddModal, setShowAddModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  // Soft Delete and Permanent Delete Modal States
  const [deletingResident, setDeletingResident] = useState<Resident | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [permanentDeletingResident, setPermanentDeletingResident] = useState<Resident | null>(null);
  const [showPermanentDeleteModal, setShowPermanentDeleteModal] = useState(false);

  // Edit Resident Modal States
  const [editingResident, setEditingResident] = useState<Resident | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);

  const handleEditResidentSuccess = (updatedResident: Resident) => {
    if (updatedResident.is_active !== false) {
      setResidents((prev) =>
        prev.map(r => r.id === updatedResident.id ? { ...r, ...updatedResident } : r)
            .sort((a, b) => a.room_number.localeCompare(b.room_number))
      );
    } else {
      setArchivedResidents((prev) =>
        prev.map(r => r.id === updatedResident.id ? { ...r, ...updatedResident } : r)
            .sort((a, b) => a.room_number.localeCompare(b.room_number))
      );
    }
  };

  const handleDeleteResident = (res: Resident) => {
    setDeletingResident(res);
    setShowDeleteModal(true);
  };

  const handleSoftDeleteSuccess = (deletedId: string, reason: string) => {
    const deleted = residents.find(r => r.id === deletedId);
    if (deleted) {
      setResidents((prev) => prev.filter((r) => r.id !== deletedId));
      setArchivedResidents((prev) => [
        ...prev,
        { ...deleted, is_active: false, status_reason: reason }
      ].sort((a, b) => a.room_number.localeCompare(b.room_number)));
      setFacilityProactiveAlerts((prev) => prev.filter((a) => a.residentId !== deletedId));
    }
  };

  const handleReadmitResident = async (res: Resident) => {
    try {
      const confirmReadmit = window.confirm(`Are you sure you want to readmit ${res.name} to Room ${res.room_number}?`);
      if (!confirmReadmit) return;

      const response = await fetch('/api/resident/readmit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: res.id })
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to readmit resident');
      }

      // Move from archived to active
      setArchivedResidents((prev) => prev.filter((r) => r.id !== res.id));
      setResidents((prev) => [
        ...prev,
        { ...res, is_active: true, status_reason: undefined }
      ].sort((a, b) => a.room_number.localeCompare(b.room_number)));
    } catch (err: any) {
      console.error('Failed to readmit resident:', err);
      alert(err.message || 'Failed to readmit resident.');
    }
  };

  const handlePermanentDeleteSuccess = (deletedId: string) => {
    setResidents((prev) => prev.filter((r) => r.id !== deletedId));
    setArchivedResidents((prev) => prev.filter((r) => r.id !== deletedId));
    setFacilityProactiveAlerts((prev) => prev.filter((a) => a.residentId !== deletedId));
  };

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  const fetchData = async () => {
    if (!facility) return;
    try {
      setLoading(true);
      // Fetch wings
      const { data: wingsData, error: wingsError } = await supabase
        .from('wings')
        .select('id, name')
        .eq('facility_id', facility.id)
        .order('name', { ascending: true });

      if (wingsError) throw wingsError;
      setWings(wingsData || []);

      // Fetch residents
      const { data: resData, error: resError } = await supabase
        .from('residents')
        .select('id, name, room_number, care_level, wing_id, is_active, status_reason, dob')
        .eq('facility_id', facility.id)
        .order('room_number', { ascending: true });

      if (resError) throw resError;
      const allResidents = resData || [];
      setResidents(allResidents.filter(r => r.is_active !== false));
      setArchivedResidents(allResidents.filter(r => r.is_active === false));

      const now = new Date();
      const localHour = now.getHours();
      const targetDate = new Date(now);
      if (localHour >= 0 && localHour < 12) {
        targetDate.setDate(targetDate.getDate() - 1);
      }
      const todayStr = `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, '0')}-${String(targetDate.getDate()).padStart(2, '0')}`;

      const { data: handData, error: handError } = await supabase
        .from('handovers')
        .select('resident_id, is_approved, urgency, shift_type, created_at, raw_input, rn_summary')
        .eq('facility_id', facility.id)
        .eq('shift_date', todayStr);

      if (handError) throw handError;

      const statusMap: Record<string, HandoverStatus> = {};
      
      // 1. Fetch offline queue items first
      try {
        const pendingQueue = await getPendingQueue();
        pendingQueue.forEach(item => {
          if (item.payload?.body?.handoverRecord) {
            const hr = item.payload.body.handoverRecord;
            statusMap[hr.resident_id] = {
              resident_id: hr.resident_id,
              is_approved: true,
              urgency: hr.urgency || 'routine',
              shift_type: hr.shift_type || 'morning',
              updated_at: new Date(item.created_at).toISOString(),
              raw_input: hr.raw_input || '',
              rn_summary: hr.rn_summary || {}
            };
          }
        });
      } catch (e) {
        console.error('Failed to read local queue:', e);
      }

      // 2. Override with server data
      (handData || []).forEach((h) => {
        statusMap[h.resident_id] = {
          resident_id: h.resident_id,
          is_approved: h.is_approved,
          urgency: h.urgency as any,
          shift_type: h.shift_type as any,
          updated_at: h.created_at,
          raw_input: h.raw_input || '',
          rn_summary: h.rn_summary || {}
        };
      });
      setHandovers(statusMap);

      // 3. Fetch Sentinel Alert Data: facility-wide unacknowledged tasks (>2 hours old)
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
      const { data: facilityTasks } = await supabase
        .from('tasks')
        .select(`
          id, title, description, tags, created_at, resident_id, assigned_role, facility_id,
          resident:residents(name, room_number, is_active),
          handover:handovers(urgency)
        `)
        .eq('facility_id', facility.id)
        .or('is_completed.is.null,is_completed.eq.false')
        .lt('created_at', twoHoursAgo);

      const filteredTasks = (facilityTasks || []).filter((t: any) => {
        const resObj = Array.isArray(t.resident) ? t.resident[0] : t.resident;
        if (!resObj || !resObj.is_active) return false;
        
        const urgency = t.handover?.urgency || 'routine';
        const hasPriorityTag = t.tags?.includes('medication') || t.tags?.includes('incidents');
        return urgency === 'critical' || urgency === 'attention' || hasPriorityTag;
      });
      setFacilityUnacknowledgedTasks(filteredTasks);

      // 4. Fetch Sentinel Alert Data: facility-wide proactive alerts from cached insights
      const { data: cachedInsights } = await supabase
        .from('resident_insights')
        .select('resident_id, insights, residents:residents(name, room_number, is_active)')
        .eq('facility_id', facility.id);
        
      const allAlerts: any[] = [];
      (cachedInsights || []).forEach((row: any) => {
        const resObj = Array.isArray(row.residents) ? row.residents[0] : row.residents;
        // Only show alerts for active residents
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

      // 5. Fetch Facility Trends (7 days) for Fall Incidents Notice Board
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const { data: recentIncidents } = await supabase
        .from('tasks')
        .select('created_at, tags')
        .eq('facility_id', facility.id)
        .gte('created_at', sevenDaysAgo)
        .contains('tags', ['incidents']);

      // Aggregate by day
      const trendMap: Record<string, number> = {};
      // Initialize last 7 days to 0
      for (let i = 6; i >= 0; i--) {
        const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
        const dayStr = `${d.getMonth() + 1}/${d.getDate()}`;
        trendMap[dayStr] = 0;
      }

      (recentIncidents || []).forEach((task: any) => {
        const taskDate = new Date(task.created_at);
        const dayStr = `${taskDate.getMonth() + 1}/${taskDate.getDate()}`;
        if (trendMap[dayStr] !== undefined) {
          trendMap[dayStr]++;
        }
      });
      
      const trendsArray = Object.keys(trendMap).map(k => ({ date: k, count: trendMap[k] }));
      setFacilityTrends(trendsArray);

    } catch (err) {
      console.error('Error fetching shift data:', err);
    } finally {
      setLoading(false);
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
          metadata: {
            alert_id: alertId
          }
        });

      if (error) throw error;
      
      toast.success('Alert acknowledged and muted.');
      
      // Invalidate insights cache row so it updates
      await fetch('/api/generate-insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ residentId, userKeys: {}, forceRefresh: true })
      });

      fetchData();
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
        .update({ is_completed: true, outcome: 'Completed via Sentinel Panel' })
        .eq('id', taskId);

      if (error) throw error;
      
      toast.success('Task marked as completed.');
      fetchData();
    } catch (e: any) {
      console.error('Failed to complete task:', e);
      toast.error('Failed to complete task.');
    }
  };

  useEffect(() => {
    fetchData();
    // Poll alerts every 30 seconds
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [facility]);

  const handleLogout = async () => {
    try {
      await logout();
      router.push('/login');
    } catch (err) {
      console.error('Logout failed:', err);
    }
  };

function parseVitalsFromHandover(status: any) {
  let temp: number | null = null;
  let systolic: number | null = null;
  let diastolic: number | null = null;
  let spo2: number | null = null;
  let hr: number | null = null;
  let rr: number | null = null;

  if (!status) return { temp, systolic, diastolic, spo2, hr, rr };

  // Try parsing from rn_summary object first if it's there
  if (status.rn_summary) {
    const s = status.rn_summary;
    const v = s.vitals || s.clinical_vitals;
    if (v) {
      if (v.temperature?.value !== undefined && v.temperature?.value !== null) temp = parseFloat(v.temperature.value);
      else if (v.temperature !== undefined && v.temperature !== null) temp = typeof v.temperature === 'object' ? parseFloat(v.temperature.value) : parseFloat(v.temperature);

      if (v.bp) {
        if (v.bp.systolic && v.bp.diastolic) {
          systolic = parseInt(v.bp.systolic);
          diastolic = parseInt(v.bp.diastolic);
        }
      }
      if (v.spo2 !== undefined && v.spo2 !== null) spo2 = typeof v.spo2 === 'object' ? parseInt(v.spo2.value) : parseInt(v.spo2);
      if (v.hr !== undefined && v.hr !== null) hr = typeof v.hr === 'object' ? parseInt(v.hr.value) : parseInt(v.hr);
      if (v.rr !== undefined && v.rr !== null) rr = typeof v.rr === 'object' ? parseInt(v.rr.value) : parseInt(v.rr);
    }
  }

  // Fallback regex parsing from raw_input or summary description if values not found
  const textToSearch = `${status.raw_input || ''} ${typeof status.rn_summary === 'string' ? status.rn_summary : JSON.stringify(status.rn_summary || '')}`;

  if (temp === null) {
    const tempMatch = textToSearch.match(/(?:temp|temperature)(?:\s+is|\s+of|\s+was)?\s*(\d{2}(?:\.\d)?)/i) ||
                      textToSearch.match(/(\d{2}\.\d)\s*(?:degrees|celsius|c|deg\b)/i);
    if (tempMatch) temp = parseFloat(tempMatch[1]);
  }
  if (systolic === null || diastolic === null) {
    const bpSlashMatch = textToSearch.match(/(\d{2,3})\s*\/\s*(\d{2,3})/);
    const bpOverMatch = textToSearch.match(/(?:bp|blood\s+pressure)(?:\s+is|\s+of|\s+was)?\s*(\d{2,3})\s+over\s+(\d{2,3})/i) ||
                        textToSearch.match(/(\d{2,3})\s+over\s+(\d{2,3})/i);
    if (bpSlashMatch) {
      systolic = parseInt(bpSlashMatch[1]);
      diastolic = parseInt(bpSlashMatch[2]);
    } else if (bpOverMatch) {
      systolic = parseInt(bpOverMatch[1]);
      diastolic = parseInt(bpOverMatch[2]);
    }
  }
  if (spo2 === null) {
    const spo2Match = textToSearch.match(/(?:spo2|pulse\s+ox|oxygen|o2\s+sat(?:uration)?)(?:\s+is|\s+of|\s+was)?\s*(\d{2,3})/i) ||
                      textToSearch.match(/(\d{2,3})\s*(?:%|\s+percent)\s*(?:spo2|o2|oxygen)/i);
    if (spo2Match) spo2 = parseInt(spo2Match[1]);
  }
  if (hr === null) {
    const hrMatch = textToSearch.match(/(?:hr|pulse|heart\s+rate)(?:\s+is|\s+of|\s+was)?\s*(\d{2,3})/i);
    if (hrMatch) hr = parseInt(hrMatch[1]);
  }
  if (rr === null) {
    const rrMatch = textToSearch.match(/(?:rr|resp|respiratory\s+rate)(?:\s+is|\s+of|\s+was)?\s*(\d{2,3})/i);
    if (rrMatch) rr = parseInt(rrMatch[1]);
  }

  return { temp, systolic, diastolic, spo2, hr, rr };
}

function formatHandoverTime(dateStr?: string) {
  if (!dateStr) return '';
  try {
    const date = new Date(dateStr);
    return new Intl.DateTimeFormat('en-AU', {
      timeZone: 'Australia/Adelaide',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      timeZoneName: 'short'
    }).format(date);
  } catch (e) {
    return '';
  }
}




  if (authLoading || !user || !facility) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center">
        <div className="w-10 h-10 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="mt-4 text-slate-500 dark:text-slate-400 font-mono text-xs tracking-widest uppercase">Loading Shift Registry...</p>
      </div>
    );
  }

  // filteredResidents defined above before hooks

  return (
    <div className="min-h-screen bg-background text-text-primary flex transition-colors duration-300 font-sans relative z-10">
      <OnboardingTour />
      
      {/* 1. Left Sidebar - Desktop (w-64) */}
      <aside className="hidden lg:flex w-64 apple-card flex-col justify-between p-6 shrink-0 z-20 m-4 rounded-[32px]">
        <div className="space-y-8">
          {/* Brand Logo */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center font-bold text-lg text-primary border border-primary/20">
              H
            </div>
            <div>
              <span className="font-bold text-[18px] tracking-tight text-text-primary block">
                Handoverly
              </span>
              <span className="text-[10px] text-text-secondary uppercase tracking-widest font-mono font-bold">
                Clinical Suite
              </span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1.5">
            <Link href="/" className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold text-text-secondary hover:bg-primary/10 hover:text-primary transition-all">
              <Activity className="w-4 h-4 text-text-secondary group-hover:text-primary" />
              <span>Home Dashboard</span>
            </Link>
            <Link href="/shift" className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold bg-primary/15 text-primary transition-all border-l-4 border-l-primary shadow-sm border border-primary/10">
              <Users className="w-4 h-4 text-primary" />
              <span>Shift Registry</span>
            </Link>
            <Link href="/tasks" className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold text-text-secondary hover:bg-primary/10 hover:text-primary transition-all">
              <ListTodo className="w-4 h-4 text-text-secondary" />
              <span>Shift Tasks</span>
            </Link>
            <button 
              onClick={() => setShowSettingsModal(true)}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold text-text-secondary hover:bg-primary/10 hover:text-primary transition-all text-left cursor-pointer"
            >
              <Settings className="w-4 h-4 text-text-secondary" />
              <span>AI Settings</span>
            </button>
          </nav>
        </div>

        {/* User profile & Logout */}
        <div className="border-t border-border pt-4 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center font-bold text-xs text-primary border border-primary/15">
              {user.name.charAt(0)}
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-bold text-text-primary leading-tight">{user.name}</span>
              <span className="text-[10px] text-text-secondary capitalize">{user.role}</span>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full h-10 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-500 text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer border border-red-500/25"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* 2. Left Sidebar - Tablet Mini (w-20) */}
      <aside className="hidden md:flex lg:hidden w-20 bg-white/40 dark:bg-slate-800/40 backdrop-blur-3xl border border-white/60 dark:border-white/10 flex-col justify-between py-6 items-center shrink-0 z-20 m-4 rounded-[32px] shadow-sm">
        <div className="flex flex-col items-center gap-8 w-full">
          <div className="w-10 h-10 rounded-full bg-white dark:bg-slate-800 shadow-sm border border-white/80 flex items-center justify-center font-bold text-lg text-primary">
            H
          </div>
          <nav className="flex flex-col gap-3 w-full px-2">
            <Link href="/" title="Home Dashboard" className="w-12 h-12 mx-auto rounded-full glass-pill hover:bg-white/80 text-text-secondary transition-all flex items-center justify-center">
              <Activity className="w-5 h-5" />
            </Link>
            <Link href="/shift" title="Shift Registry" className="w-12 h-12 mx-auto rounded-full bg-white shadow-md border border-white/50 text-primary transition-all flex items-center justify-center">
              <Users className="w-5 h-5" />
            </Link>
            <Link href="/tasks" title="Shift Tasks" className="w-12 h-12 mx-auto rounded-full glass-pill hover:bg-white/80 text-text-secondary transition-all flex items-center justify-center">
              <ListTodo className="w-5 h-5" />
            </Link>
            <button 
              onClick={() => setShowSettingsModal(true)}
              title="AI Settings" 
              className="w-12 h-12 mx-auto rounded-full glass-pill hover:bg-white/80 text-text-secondary transition-all flex items-center justify-center cursor-pointer"
            >
              <Settings className="w-5 h-5" />
            </button>
          </nav>
        </div>

        <button
          onClick={handleLogout}
          className="w-12 h-12 rounded-full glass-pill hover:bg-red-50 text-text-secondary hover:text-red-500 transition-colors cursor-pointer flex items-center justify-center"
          title="Logout"
        >
          <LogOut className="w-5 h-5" />
        </button>
      </aside>

      {/* Main Layout Area */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        {/* Header - Sticky on Mobile & Tablet */}
        <header className="flex-none sticky top-0 z-40 bg-surface/80 backdrop-blur-xl border-b border-border px-6 py-3.5 transition-colors duration-200 lg:hidden">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-[17px] tracking-tight text-[#1f1f1f] dark:text-[#ffffff]">
                Handoverly
              </span>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={toggleTheme}
                className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-900 text-slate-600 dark:text-slate-400 transition-colors cursor-pointer"
              >
                {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-500" /> : <Moon className="w-4 h-4 text-[#1f1f1f]" />}
              </button>

              <SentinelBadge
                unacknowledgedTasks={facilityUnacknowledgedTasks}
                proactiveAlerts={facilityProactiveAlerts}
                onAcknowledgeAlert={handleAcknowledgeAlert}
                onAcknowledgeTask={handleAcknowledgeTask}
              />
            </div>
          </div>
        </header>

        {/* 3-Pane Layout Main Area */}
        <main className="flex-1 flex flex-col lg:flex-row min-h-0 bg-transparent p-4 lg:p-6 gap-6">
          {/* Center Pane: Resident Registry */}
          <div className="flex-1 overflow-y-auto bg-white/40 dark:bg-[#0f172a]/40 backdrop-blur-3xl rounded-[32px] border border-white/60 dark:border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.04)] p-6 relative z-10 custom-scrollbar">
            
            {/* Header Area */}
            <div className="flex justify-between items-end mb-8">
              <div>
                <h2 className="text-3xl font-bold tracking-tight text-text-primary font-sans">Shift Registry</h2>
                <p className="text-sm font-medium text-text-secondary mt-1">Manage and record handovers for all residents</p>
              </div>
              <button
                id="tour-register-resident"
                onClick={() => setShowAddModal(true)}
                className="px-6 py-3 rounded-full bg-white dark:bg-slate-800 text-primary font-bold text-xs tracking-widest uppercase transition-all duration-300 cursor-pointer flex items-center gap-2 shadow-md border border-white/50 hover:shadow-lg"
              >
                <Plus className="w-4 h-4" />
                Register Resident
              </button>
            </div>

            {/* Facility Pulse / Clinical Notice Board */}
            <div className="mb-8 apple-card rounded-[24px] p-6 flex flex-col gap-5">
              <div className="flex justify-between items-center border-b border-border pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-teal-accent/10 flex items-center justify-center text-teal-accent">
                    <Activity className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-text-primary uppercase tracking-widest">Facility Pulse & Trends</h2>
                    <p className="text-[11px] text-text-secondary mt-0.5">Real-time clinical intelligence (Last 7 days)</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  {(() => {
                    const emergingCount = facilityProactiveAlerts.filter(a => a.severity === 'critical' || a.severity === 'warning').length;
                    return emergingCount > 0 ? (
                      <span className="px-3 py-1 bg-red-accent/10 text-red-accent text-[11px] font-bold rounded-lg flex items-center gap-1.5 border border-red-accent/20 shadow-sm animate-pulse">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-accent"></span>
                        {emergingCount} Emerging Risk{emergingCount === 1 ? '' : 's'}
                      </span>
                    ) : (
                      <span className="px-3 py-1 bg-green-accent/10 text-green-accent text-[11px] font-bold rounded-lg flex items-center gap-1.5 border border-green-accent/20 shadow-sm">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-accent"></span>
                        0 Emerging Risks
                      </span>
                    );
                  })()}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Trend 1: Falls */}
                <div className="apple-card-inner rounded-xl p-4 shadow-sm">
                  <h3 className="text-[10px] font-black text-text-secondary uppercase tracking-widest mb-3">Fall Incidents (7 Days)</h3>
                  <div className="flex items-end gap-1.5 h-10 mb-3 px-1">
                    {facilityTrends.length > 0 ? facilityTrends.map((t, idx) => {
                      const maxCount = Math.max(...facilityTrends.map(x => x.count), 1);
                      const heightPercent = Math.max(10, (t.count / maxCount) * 100);
                      const isSpike = t.count > 0 && t.count === maxCount;
                      return (
                        <div key={idx} className={`w-full rounded-t-sm relative group cursor-help ${isSpike ? 'bg-red-accent/80 shadow-[0_0_8px_rgba(232,68,90,0.5)]' : 'bg-teal-accent/30'}`} style={{ height: `${heightPercent}%` }}>
                          <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-surface text-text-primary text-[9px] font-bold py-0.5 px-1.5 rounded opacity-0 group-hover:opacity-100 transition-opacity border border-border whitespace-nowrap z-10">
                            {t.count} Incidents on {t.date}
                          </div>
                        </div>
                      );
                    }) : (
                      <div className="w-full h-full flex items-center justify-center text-[10px] text-text-secondary">No recent incidents.</div>
                    )}
                  </div>
                  {facilityTrends.some(t => t.count > 0) ? (
                    <p className="text-[11px] text-text-secondary leading-tight">
                      <span className="font-bold text-red-accent">Active tracking:</span> {facilityTrends.reduce((sum, t) => sum + t.count, 0)} total incidents recorded in the last 7 days.
                    </p>
                  ) : (
                    <p className="text-[11px] text-text-secondary leading-tight">
                      <span className="font-bold text-teal-accent">All clear:</span> No incidents recorded recently.
                    </p>
                  )}
                </div>

                {/* Trend 2: Infection / Vitals */}
                <div className="apple-card-inner rounded-xl p-4 shadow-sm">
                  <h3 className="text-[10px] font-black text-text-secondary uppercase tracking-widest mb-3">Emerging Risks</h3>
                  <div className="space-y-3.5 overflow-y-auto max-h-[80px] custom-scrollbar">
                    {facilityProactiveAlerts.filter(a => a.severity === 'critical' || a.severity === 'warning').length > 0 ? (
                      facilityProactiveAlerts.filter(a => a.severity === 'critical' || a.severity === 'warning').slice(0, 3).map((alert, idx) => (
                        <div key={idx} className="flex items-start gap-2">
                          <div className={`w-1.5 h-1.5 rounded-full mt-1 shrink-0 ${alert.severity === 'critical' ? 'bg-red-accent shadow-[0_0_5px_rgba(232,68,90,0.5)]' : 'bg-amber-accent shadow-[0_0_5px_rgba(245,166,35,0.5)]'}`}></div>
                          <p className="text-[11px] text-text-primary leading-tight">
                            <span className={`font-bold capitalize ${alert.severity === 'critical' ? 'text-red-accent' : 'text-amber-accent'}`}>{(alert.type || 'Alert').replace('_', ' ')}:</span> {alert.message} ({alert.residentName})
                          </p>
                        </div>
                      ))
                    ) : (
                      <p className="text-[11px] text-text-secondary italic">No emerging risks detected across the facility.</p>
                    )}
                  </div>
                </div>

                {/* Critical Directives */}
                <div className="apple-card-inner rounded-xl p-4 shadow-sm border border-teal-accent/20">
                  <h3 className="text-[10px] font-black text-teal-accent uppercase tracking-widest mb-3 flex items-center gap-1.5">
                    <ListTodo className="w-3.5 h-3.5" />
                    Shift Directives
                  </h3>
                  <div className="space-y-3 overflow-y-auto max-h-[80px] custom-scrollbar">
                    {facilityProactiveAlerts.some(a => a.type === 'infection_risk') && (
                      <div className="flex items-start gap-2">
                        <span className="text-[10px] font-bold text-teal-accent mt-0.5">1.</span>
                        <p className="text-[11px] text-text-primary font-medium leading-relaxed">
                          Enforce strict PPE protocols due to active infection risks.
                        </p>
                      </div>
                    )}
                    {facilityUnacknowledgedTasks.length > 0 && (
                      <div className="flex items-start gap-2">
                        <span className="text-[10px] font-bold text-teal-accent mt-0.5">•</span>
                        <p className="text-[11px] text-text-primary font-medium leading-relaxed">
                          Review {facilityUnacknowledgedTasks.length} unacknowledged critical tasks from previous shifts immediately.
                        </p>
                      </div>
                    )}
                    {(!facilityProactiveAlerts.some(a => a.type === 'infection_risk') && facilityUnacknowledgedTasks.length === 0) && (
                      <div className="flex items-start gap-2">
                        <span className="text-[10px] font-bold text-teal-accent mt-0.5">✓</span>
                        <p className="text-[11px] text-text-primary font-medium leading-relaxed">
                          No critical facility-wide directives active. Proceed with standard care plans.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {filteredResidents.map((res) => {
                const wingName = wings.find((w) => w.id === res.wing_id)?.name;
                const status = handovers[res.id];
                const hasHandover = status?.is_approved;
                const isUrgent = status?.urgency === 'urgent' || status?.urgency === 'critical';
                const vitals = parseVitalsFromHandover(status);
                
                return (
                  <div
                    key={res.id}
                    onClick={() => { setSelectedResidentId(res.id); }}
                    className={`resident-card group relative overflow-hidden rounded-[24px] p-5 cursor-pointer transition-all duration-300 border backdrop-blur-md ${
                      selectedResidentId === res.id 
                        ? 'border-teal-accent bg-teal-accent/5 shadow-[0_0_20px_rgba(45,212,191,0.15)] ring-1 ring-teal-accent/20' 
                        : 'bg-surface border-border hover:border-teal-accent/40 hover:bg-surface-hover shadow-sm'
                    }`}
                  >
                    {/* Top Section: Room, Badges, and Trash */}
                    <div className="flex items-start justify-between mb-3 gap-2">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-surface-solid border border-border text-text-secondary uppercase tracking-widest shadow-sm whitespace-nowrap">
                          RM {res.room_number}
                        </span>
                        {isUrgent && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-red-accent/10 border border-red-accent/30 text-red-accent uppercase tracking-widest animate-pulse shadow-sm flex items-center gap-1 whitespace-nowrap">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-accent shrink-0"></span>
                            CRITICAL
                          </span>
                        )}
                      </div>
                      
                      {user?.role !== 'carer' && (
                        <>
                          <button
                            onClick={(e) => { 
                              e.stopPropagation(); 
                              setEditingResident(res);
                              setShowEditModal(true);
                            }}
                            className="p-1 rounded-lg text-text-tertiary hover:text-teal-accent hover:bg-teal-accent/10 transition-all cursor-pointer z-10 shrink-0"
                            title={`Edit ${res.name}`}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDeleteResident(res); }}
                            className="p-1 rounded-lg text-text-tertiary hover:text-red-accent hover:bg-red-accent/10 transition-all cursor-pointer z-10 shrink-0"
                            title={`Delete ${res.name}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                    </div>

                    {/* Middle Section: Name & Details */}
                    <div className="mb-4 pr-2">
                      <h3 className="text-lg font-bold text-text-primary leading-tight tracking-tight truncate">{res.name}</h3>
                      <p className="text-[11px] font-medium text-text-secondary mt-1 flex items-center gap-1.5 truncate">
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 shrink-0"></span>
                        {res.care_level} Care {wingName ? `• ${wingName}` : ''}
                      </p>
                    </div>

                    {/* Bottom Section: Status & Actions */}
                    <div className="pt-3 border-t border-border flex items-center justify-between gap-2">
                       <div className="flex flex-wrap items-center gap-1.5">
                         {hasHandover ? (
                           <div className="flex items-center gap-1 text-teal-accent bg-teal-accent/10 px-1.5 py-0.5 rounded border border-teal-accent/20 shrink-0">
                             <Check className="w-3 h-3" />
                             <span className="text-[9px] font-bold uppercase tracking-wider">Logged</span>
                           </div>
                         ) : (
                           <div className="flex items-center gap-1 text-amber-accent bg-amber-accent/10 px-1.5 py-0.5 rounded border border-amber-accent/20 shrink-0">
                             <Activity className="w-3 h-3" />
                             <span className="text-[9px] font-bold uppercase tracking-wider">Pending</span>
                           </div>
                         )}
                         {vitals.temp && (
                           <div className="font-mono text-[9px] font-bold text-text-primary bg-surface-solid border border-border px-1.5 py-0.5 rounded shadow-sm shrink-0">
                             {vitals.temp}°C
                           </div>
                         )}
                       </div>

                       {/* Update Button */}
                       {user?.role !== 'carer' && (
                         <Link
                           onClick={(e) => e.stopPropagation()}
                           href={`/resident/${res.id}/input`}
                           className={`px-3 py-1.5 rounded-xl text-[10px] font-bold tracking-wide transition-all duration-300 flex items-center gap-1 cursor-pointer z-10 border shrink-0 ${
                             hasHandover 
                               ? 'bg-surface-solid border-border text-text-primary hover:border-teal-accent/50 hover:text-teal-accent shadow-sm' 
                               : 'bg-teal-accent hover:bg-teal-accent/90 border-transparent text-white shadow-sm hover:shadow-md'
                           }`}
                         >
                           {hasHandover ? 'Update' : 'Start'}
                           <ArrowRight className="w-3 h-3" />
                         </Link>
                       )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Archived Residents Toggle */}
            <div className="mt-8 pt-6 border-t border-[#e3e3e3] dark:border-[#202024]">
              <button
                onClick={() => setShowArchive(!showArchive)}
                className="w-full flex items-center justify-between p-4 bg-slate-50 dark:bg-[#121214] border border-[#e3e3e3] dark:border-[#202024] rounded-2xl hover:bg-slate-100 dark:hover:bg-[#1a1a1f] transition-all duration-200 cursor-pointer"
                type="button"
              >
                <div className="flex items-center gap-2.5">
                  <Users className="w-5 h-5 text-slate-500 dark:text-slate-400" />
                  <span className="font-semibold text-sm text-slate-700 dark:text-slate-200">
                    Discharged & Archived ({archivedResidents.length})
                  </span>
                </div>
                <span className="text-xs text-slate-400 font-medium">
                  {showArchive ? 'Collapse' : 'Expand'}
                </span>
              </button>

              {showArchive && (
                <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {archivedResidents.map((res) => (
                    <div key={res.id} className="border border-[#e3e3e3] dark:border-[#202024] bg-white dark:bg-[#121214] rounded-[20px] p-5 opacity-75">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-[#1c1c21] text-slate-700 dark:text-slate-300">RM {res.room_number}</span>
                        <span className="text-[9px] uppercase tracking-wider font-semibold text-rose-500">{res.status_reason || 'Discharged'}</span>
                      </div>
                      <h3 className="text-[15px] font-semibold text-[#1f1f1f] dark:text-[#ffffff]">{res.name}</h3>
                      <div className="mt-4 flex gap-2">
                        <button onClick={() => handleReadmitResident(res)} className="text-xs px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-[#1c1c21] dark:hover:bg-[#25252b] text-slate-800 dark:text-slate-200 rounded-md font-semibold cursor-pointer">Re-admit</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right Pane: Details & Timeline */}
          <div className="hidden lg:flex flex-col w-[380px] xl:w-[420px] bg-white/40 dark:bg-[#0f172a]/40 backdrop-blur-3xl rounded-[32px] border border-white/60 dark:border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.04)] overflow-y-auto shrink-0 relative z-10 custom-scrollbar">
            {selectedResidentId ? (
              <div className="p-6">
                {loadingRightPane ? (
                  <div className="flex justify-center py-10">
                    <div className="w-8 h-8 border-[3px] border-primary border-t-transparent rounded-full animate-spin"></div>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Header */}
                    <div>
                      <h2 className="text-xl font-bold text-[#1f1f1f] dark:text-white tracking-tight">
                        {residents.find(r => r.id === selectedResidentId)?.name}
                      </h2>
                      <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                        Room {residents.find(r => r.id === selectedResidentId)?.room_number}
                      </p>
                    </div>

                    {/* Vitals Summary */}
                    <div className="bg-white/70 dark:bg-slate-800/60 backdrop-blur-md rounded-[24px] p-6 shadow-sm border border-white/80 dark:border-white/5">
                      <h3 className="text-[11px] font-bold uppercase tracking-widest text-text-secondary mb-5">Latest Vitals</h3>
                      <div className="grid grid-cols-2 gap-y-6 gap-x-4">
                        {(() => {
                           const status = handovers[selectedResidentId];
                           const v = parseVitalsFromHandover(status);
                           return (
                             <>
                               <div>
                                 <div className="text-[10px] text-text-secondary uppercase tracking-widest font-bold mb-1">Temp</div>
                                 <div className={`font-mono text-2xl font-bold ${v.temp && v.temp > 38 ? 'text-red-500' : 'text-text-primary'}`}>{v.temp ? `${v.temp}°C` : '--'}</div>
                               </div>
                               <div>
                                 <div className="text-[10px] text-text-secondary uppercase tracking-widest font-bold mb-1">BP</div>
                                 <div className={`font-mono text-2xl font-bold ${(v.systolic && v.systolic > 140) ? 'text-red-500' : 'text-text-primary'}`}>{v.systolic ? `${v.systolic}/${v.diastolic}` : '--'}</div>
                               </div>
                               <div>
                                 <div className="text-[10px] text-text-secondary uppercase tracking-widest font-bold mb-1">HR</div>
                                 <div className="font-mono text-2xl font-bold text-text-primary">{v.hr ? `${v.hr} bpm` : '--'}</div>
                               </div>
                               <div>
                                 <div className="text-[10px] text-text-secondary uppercase tracking-widest font-bold mb-1">SpO2</div>
                                 <div className={`font-mono text-2xl font-bold ${(v.spo2 && v.spo2 < 92) ? 'text-amber-500' : 'text-text-primary'}`}>{v.spo2 ? `${v.spo2}%` : '--'}</div>
                               </div>
                             </>
                           );
                        })()}
                      </div>
                    </div>

                    {/* Timeline */}
                    <div className="bg-white/70 dark:bg-slate-800/60 backdrop-blur-md rounded-[24px] p-6 shadow-sm border border-white/80 dark:border-white/5">
                      <h3 className="text-[11px] font-bold uppercase tracking-widest text-text-secondary mb-5">Clinical Timeline</h3>
                      {selectedResidentTimeline.length === 0 ? (
                        <p className="text-xs text-text-secondary">No recent activity.</p>
                      ) : (
                        <div className="space-y-5">
                          {selectedResidentTimeline.map(item => (
                            <div key={item.id} className="flex gap-3 text-sm relative">
                              <div className="w-2.5 h-2.5 mt-1 rounded-full bg-teal-accent shrink-0 shadow-[0_0_8px_rgba(0,201,167,0.4)]"></div>
                              <div className="absolute left-[4px] top-4 bottom-[-16px] w-[1px] bg-border/50"></div>
                              <div>
                                <p className="text-text-primary leading-snug">{item.description}</p>
                                <p className="font-mono text-[10px] text-text-secondary mt-1">{new Date(item.created_at).toLocaleTimeString()}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-500">
                <Activity className="w-12 h-12 mb-4 opacity-20" />
                <p className="font-medium text-sm text-slate-600 dark:text-slate-400">Select a resident</p>
                <p className="text-xs mt-1">View vitals, timeline, and handover details.</p>
              </div>
            )}
          </div>
        </main>
      </div>

      <AriaFloatingButton 
        selectedResidentId={selectedResidentId} 
        residents={residents.map(r => ({ id: r.id, name: r.name }))}
        facilityId={facility.id}
        onVitalsRecorded={() => fetchData()}
      />

      <AddResidentModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        wings={wings}
        facilityId={facility.id}
        theme={theme}
        onAddSuccess={(newResident) => {
          setResidents((prev) => [...prev, newResident].sort((a, b) => a.room_number.localeCompare(b.room_number)));
        }}
      />

      <SettingsModal isOpen={showSettingsModal} onClose={() => setShowSettingsModal(false)} />

      <SoftDeleteModal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
          setDeletingResident(null);
        }}
        resident={deletingResident}
        theme={theme}
        canPermanentDelete={isAdmin || isRN}
        staffId={user.id}
        onDeleteSuccess={handleSoftDeleteSuccess}
        onPermanentDeleteSuccess={handlePermanentDeleteSuccess}
      />

      <PermanentDeleteModal
        isOpen={showPermanentDeleteModal}
        onClose={() => {
          setShowPermanentDeleteModal(false);
          setPermanentDeletingResident(null);
        }}
        resident={permanentDeletingResident}
        staffId={user.id}
        theme={theme}
        onDeleteSuccess={handlePermanentDeleteSuccess}
      />

      <EditResidentModal
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setEditingResident(null);
        }}
        resident={editingResident}
        wings={wings}
        theme={theme}
        onEditSuccess={handleEditResidentSuccess}
      />
    </div>
  );
}

interface EditResidentModalProps {
  isOpen: boolean;
  onClose: () => void;
  resident: Resident | null;
  wings: Wing[];
  theme: string;
  onEditSuccess: (updatedResident: Resident) => void;
}

function EditResidentModal({ isOpen, onClose, resident, wings, theme, onEditSuccess }: EditResidentModalProps) {
  const [name, setName] = useState('');
  const [roomNumber, setRoomNumber] = useState('');
  const [dob, setDob] = useState('');
  const [careLevel, setCareLevel] = useState('High');
  const [wingId, setWingId] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (resident) {
      setName(resident.name || '');
      setRoomNumber(resident.room_number || '');
      setDob(resident.dob || '');
      setCareLevel(resident.care_level || 'High');
      setWingId(resident.wing_id || '');
      setError('');
    }
  }, [resident, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resident) return;
    if (!name || !roomNumber) {
      setError('Name and room number are required.');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      const { data, error: updateError } = await supabase
        .from('residents')
        .update({
          name: name.trim(),
          room_number: roomNumber.trim(),
          dob: dob || null,
          care_level: careLevel,
          wing_id: wingId || null
        })
        .eq('id', resident.id)
        .select()
        .single();

      if (updateError) throw updateError;
      onEditSuccess(data);
      onClose();
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to update resident.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && resident && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md px-4"
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 20 }}
            className="w-full max-w-[400px] bg-surface-solid border border-border p-7 rounded-[28px] shadow-2xl relative z-50 flex flex-col"
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-border pb-4.5 mb-6">
              <div>
                <h3 className="text-lg font-bold tracking-tight text-text-primary">Edit Resident</h3>
                <p className="text-[11px] text-text-secondary mt-0.5">Update profile details for {resident.name}.</p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-full hover:bg-surface-hover text-text-tertiary hover:text-text-primary transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Error */}
            {error && (
              <div className="mb-4.5 p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs flex items-center gap-2.5">
                <AlertCircle className="w-4.5 h-4.5 shrink-0" />
                <span className="font-semibold">{error}</span>
              </div>
            )}

            {/* Modal Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-[10px] font-bold text-text-secondary uppercase tracking-wider block mb-1.5">Full Name</label>
                <input
                  type="text"
                  placeholder="e.g. Sarah Jenkins"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full h-11 bg-surface border border-border rounded-xl px-3.5 text-xs focus:outline-none focus:ring-2 focus:ring-teal-accent/20 focus:border-teal-accent text-text-primary font-medium transition-all"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-text-secondary uppercase tracking-wider block mb-1.5">Room No.</label>
                  <input
                    type="text"
                    placeholder="e.g. 204"
                    value={roomNumber}
                    onChange={e => setRoomNumber(e.target.value)}
                    className="w-full h-11 bg-surface border border-border rounded-xl px-3.5 text-xs focus:outline-none focus:ring-2 focus:ring-teal-accent/20 focus:border-teal-accent text-text-primary font-bold transition-all"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-text-secondary uppercase tracking-wider block mb-1.5">DOB</label>
                  <input
                    type="date"
                    value={dob}
                    onChange={e => setDob(e.target.value)}
                    className="w-full h-11 bg-surface border border-border rounded-xl px-3 text-xs focus:outline-none focus:ring-2 focus:ring-teal-accent/20 focus:border-teal-accent text-text-primary transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-text-secondary uppercase tracking-wider block mb-1.5">Care Level</label>
                <select
                  value={careLevel}
                  onChange={e => setCareLevel(e.target.value)}
                  className="w-full h-11 bg-surface border border-border rounded-xl px-3.5 text-xs focus:outline-none focus:ring-2 focus:ring-teal-accent/20 focus:border-teal-accent text-text-primary transition-all"
                >
                  <option value="High">High Care</option>
                  <option value="Low">Low Care</option>
                  <option value="Dementia">Dementia Care</option>
                </select>
              </div>

              {wings.length > 0 && (
                <div>
                  <label className="text-[10px] font-bold text-text-secondary uppercase tracking-wider block mb-1.5">Wing</label>
                  <select
                    value={wingId}
                    onChange={e => setWingId(e.target.value)}
                    className="w-full h-11 bg-surface border border-border rounded-xl px-3.5 text-xs focus:outline-none focus:ring-2 focus:ring-teal-accent/20 focus:border-teal-accent text-text-primary transition-all"
                  >
                    <option value="">No Wing (Unassigned)</option>
                    {wings.map(w => (
                      <option key={w.id} value={w.id}>{w.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Modal Actions */}
              <div className="flex gap-3 pt-5 border-t border-border mt-6">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 h-11 rounded-xl bg-surface hover:bg-surface-hover border border-border text-text-secondary text-[11px] font-bold tracking-wider uppercase transition-all duration-200 cursor-pointer hover:text-text-primary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 h-11 rounded-xl bg-teal-accent hover:bg-teal-accent/90 text-white text-[11px] font-bold tracking-wider uppercase transition-all duration-300 shadow-md hover:shadow-lg flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 border border-transparent"
                >
                  {submitting ? (
                    <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  ) : 'Save Changes'}
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

interface AddResidentModalProps {
  isOpen: boolean;
  onClose: () => void;
  wings: Wing[];
  facilityId: string;
  theme: string;
  onAddSuccess: (newResident: Resident) => void;
}

function AddResidentModal({ isOpen, onClose, wings, facilityId, theme, onAddSuccess }: AddResidentModalProps) {
  const [newResName, setNewResName] = useState('');
  const [newResRoom, setNewResRoom] = useState('');
  const [newResDob, setNewResDob] = useState('');
  const [newResCare, setNewResCare] = useState('High');
  const [newResWingId, setNewResWingId] = useState('');
  const [modalError, setModalError] = useState('');
  const [submittingModal, setSubmittingModal] = useState(false);

  const handleAddResidentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError('');
    if (!newResName || !newResRoom || !newResDob) {
      setModalError('Please fill in all fields.');
      return;
    }

    setSubmittingModal(true);
    try {
      const { data, error } = await supabase
        .from('residents')
        .insert([{
          facility_id: facilityId,
          wing_id: newResWingId || null,
          name: newResName,
          room_number: newResRoom,
          dob: newResDob,
          care_level: newResCare
        }])
        .select()
        .single();

      if (error) throw error;

      onAddSuccess(data);
      
      // Close and reset
      onClose();
      setNewResName('');
      setNewResRoom('');
      setNewResDob('');
      setNewResCare('High');
      setNewResWingId('');
    } catch (err: any) {
      console.error(err);
      setModalError(err.message || 'Failed to register resident.');
    } finally {
      setSubmittingModal(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md px-4"
        >
          <motion.div 
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 20 }}
            className="w-full max-w-[400px] bg-surface-solid border border-border p-7 rounded-[28px] shadow-2xl relative z-50 flex flex-col"
          >
            
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-border pb-4.5 mb-6">
              <div>
                <h3 className="text-lg font-bold tracking-tight text-text-primary">Register Resident</h3>
                <p className="text-[11px] text-text-secondary mt-0.5">Add a new admission profile to this facility.</p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-full hover:bg-surface-hover text-text-tertiary hover:text-text-primary transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Error */}
            {modalError && (
              <div className="mb-4.5 p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs flex items-center gap-2.5">
                <AlertCircle className="w-4.5 h-4.5 shrink-0" />
                <span className="font-semibold">{modalError}</span>
              </div>
            )}

            {/* Modal Form */}
            <form onSubmit={handleAddResidentSubmit} className="space-y-4">
              <div>
                <label className="text-[10px] font-bold text-text-secondary uppercase tracking-wider block mb-1.5">Full Name</label>
                <input
                  type="text"
                  placeholder="e.g. Sarah Jenkins"
                  value={newResName}
                  onChange={(e) => setNewResName(e.target.value)}
                  className="w-full h-11 bg-surface border border-border rounded-xl px-3.5 text-xs focus:outline-none focus:ring-2 focus:ring-teal-accent/20 focus:border-teal-accent text-text-primary font-medium transition-all"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-text-secondary uppercase tracking-wider block mb-1.5">Room No.</label>
                  <input
                    type="text"
                    placeholder="e.g. 204"
                    value={newResRoom}
                    onChange={(e) => setNewResRoom(e.target.value)}
                    className="w-full h-11 bg-surface border border-border rounded-xl px-3.5 text-xs focus:outline-none focus:ring-2 focus:ring-teal-accent/20 focus:border-teal-accent text-text-primary font-bold transition-all"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-text-secondary uppercase tracking-wider block mb-1.5">DOB</label>
                  <input
                    type="date"
                    value={newResDob}
                    onChange={(e) => setNewResDob(e.target.value)}
                    className="w-full h-11 bg-surface border border-border rounded-xl px-3 text-xs focus:outline-none focus:ring-2 focus:ring-teal-accent/20 focus:border-teal-accent text-text-primary transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-text-secondary uppercase tracking-wider block mb-1.5">Care Level</label>
                <select
                  value={newResCare}
                  onChange={(e) => setNewResCare(e.target.value)}
                  className="w-full h-11 bg-surface border border-border rounded-xl px-3.5 text-xs focus:outline-none focus:ring-2 focus:ring-teal-accent/20 focus:border-teal-accent text-text-primary transition-all"
                >
                  <option value="High">High Care</option>
                  <option value="Low">Low Care</option>
                  <option value="Dementia">Dementia Care</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] font-bold text-text-secondary uppercase tracking-wider block mb-1.5">Assign Wing</label>
                <select
                  value={newResWingId}
                  onChange={(e) => setNewResWingId(e.target.value)}
                  className="w-full h-11 bg-surface border border-border rounded-xl px-3.5 text-xs focus:outline-none focus:ring-2 focus:ring-teal-accent/20 focus:border-teal-accent text-text-primary transition-all"
                >
                  <option value="">No Wing (Unassigned)</option>
                  {wings.map((w) => (
                    <option key={w.id} value={w.id}>{w.name}</option>
                  ))}
                </select>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-6 border-t border-border mt-6">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 h-11 rounded-xl bg-surface hover:bg-surface-hover border border-border text-text-secondary text-xs font-bold tracking-wider uppercase transition-all duration-150 cursor-pointer hover:text-text-primary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingModal}
                  className="flex-1 h-11 rounded-xl bg-teal-accent hover:bg-teal-accent/90 text-white border border-transparent text-xs font-bold tracking-wider uppercase transition-all duration-300 shadow-md hover:shadow-lg flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {submittingModal ? (
                    <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <>
                      <Plus className="w-4 h-4" />
                      Register
                    </>
                  )}
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

interface SoftDeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  resident: Resident | null;
  theme: string;
  canPermanentDelete: boolean;
  staffId: string;
  onDeleteSuccess: (deletedId: string, reason: string) => void;
  onPermanentDeleteSuccess: (deletedId: string) => void;
}

function SoftDeleteModal({ isOpen, onClose, resident, theme, canPermanentDelete, staffId, onDeleteSuccess, onPermanentDeleteSuccess }: SoftDeleteModalProps) {
  const [reason, setReason] = useState('Discharged');
  const [customReason, setCustomReason] = useState('');
  const [confirmName, setConfirmName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const isPermanent = reason === 'PermanentDelete';

  // Reset state whenever modal closes
  const handleClose = () => {
    setReason('Discharged');
    setCustomReason('');
    setConfirmName('');
    setError('');
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resident) return;
    setError('');

    if (isPermanent) {
      // Permanent delete flow
      if (confirmName !== resident.name) {
        setError('Confirmation name does not match.');
        return;
      }
      setSubmitting(true);
      try {
        const res = await fetch('/api/resident/permanent-delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: resident.id, staffId })
        });
        const data = await res.json();
        if (!res.ok || !data.success) throw new Error(data.error || 'Failed to permanently delete resident');
        onPermanentDeleteSuccess(resident.id);
        handleClose();
      } catch (err: any) {
        setError(err.message || 'Failed to permanently delete resident.');
      } finally {
        setSubmitting(false);
      }
      return;
    }

    // Soft delete / archive flow
    const finalReason = reason === 'Other' ? customReason.trim() : reason;
    if (reason === 'Other' && !finalReason) {
      setError('Please specify the reason.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/resident/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: resident.id, reason: finalReason })
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to archive resident');
      onDeleteSuccess(resident.id, finalReason);
      handleClose();
    } catch (err: any) {
      setError(err.message || 'Failed to archive resident.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && resident && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md px-4"
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 20 }}
            className="w-full max-w-[400px] bg-white dark:bg-[#121214] border border-[#e3e3e3] dark:border-[#202024] p-7 rounded-[28px] shadow-2xl relative z-50 flex flex-col"
          >
            <div className="flex items-center justify-between border-b border-[#e3e3e3] dark:border-[#202024] pb-4.5 mb-6">
              <div>
                <h3 className={`text-lg font-normal tracking-tight ${
                  isPermanent ? 'text-rose-600 dark:text-rose-400' : 'text-slate-900 dark:text-white'
                }`}>
                  {isPermanent ? 'Permanently Delete' : 'Archive Resident'}
                </h3>
                <p className="text-[11px] text-slate-550 dark:text-slate-400 mt-0.5">
                  {isPermanent
                    ? 'This action is irreversible and cannot be undone.'
                    : `Please specify a reason for archiving ${resident.name}.`
                  }
                </p>
              </div>
              <button
                type="button"
                onClick={handleClose}
                className="p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-900 text-slate-400 hover:text-slate-650 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Critical warning banner shown only for permanent delete */}
            {isPermanent && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-5 p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 dark:bg-rose-950/40 dark:border-rose-500/30 dark:text-rose-200 text-xs flex flex-col gap-2"
              >
                <div className="flex items-center gap-2">
                  <ShieldAlert className="w-4.5 h-4.5 text-rose-600 dark:text-rose-450 shrink-0" />
                  <span className="font-bold uppercase tracking-wide">Critical Warning</span>
                </div>
                <p className="leading-relaxed">
                  All clinical records, handovers, and tasks for <strong>{resident.name}</strong> will be permanently erased.
                </p>
              </motion.div>
            )}

            {error && (
              <div className="mb-4.5 p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 dark:bg-rose-950/40 dark:border-rose-500/30 dark:text-rose-200 text-xs flex items-center gap-2.5">
                <AlertCircle className="w-4.5 h-4.5 text-rose-600 dark:text-rose-400 shrink-0" />
                <span className="font-semibold">{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-[10px] font-bold text-slate-455 dark:text-slate-500 uppercase tracking-wider block mb-1">Status / Reason</label>
                <select
                  value={reason}
                  onChange={(e) => { setReason(e.target.value); setError(''); setConfirmName(''); }}
                  className={`w-full h-11 bg-slate-50 dark:bg-slate-900/60 border rounded-xl px-3.5 text-xs focus:outline-none transition-colors ${
                    isPermanent
                      ? 'border-rose-300 dark:border-rose-700/60 text-rose-700 dark:text-rose-300'
                      : 'border-[#e3e3e3] dark:border-[#202024] text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <option value="Discharged">Discharged</option>
                  <option value="Transferred">Transferred to another facility</option>
                  <option value="Passed Away">Passed Away</option>
                  <option value="Other">Other (Specify below)</option>
                  {canPermanentDelete && (
                    <option value="PermanentDelete">⚠ Permanently Delete Record</option>
                  )}
                </select>
              </div>

              {reason === 'Other' && (
                <div>
                  <label className="text-[10px] font-bold text-slate-455 dark:text-slate-500 uppercase tracking-wider block mb-1">Specify Reason</label>
                  <input
                    type="text"
                    placeholder="e.g. Relocated to another wing/state"
                    value={customReason}
                    onChange={(e) => setCustomReason(e.target.value)}
                    className="w-full h-11 bg-slate-50 dark:bg-slate-900/60 border border-[#e3e3e3] dark:border-[#202024] rounded-xl px-3.5 text-xs focus:outline-none focus:border-[#1f1f1f] dark:focus:border-[#e3e3e3] text-slate-800 dark:text-slate-100 font-medium"
                  />
                </div>
              )}

              {/* Name confirmation field — only for permanent delete */}
              {isPermanent && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <label className="text-[10px] font-bold text-slate-455 dark:text-slate-500 uppercase tracking-wider block mb-1">
                    Type resident name to confirm: <span className="text-[#1f1f1f] dark:text-[#ffffff] font-bold">{resident.name}</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Enter exact name..."
                    value={confirmName}
                    onChange={(e) => setConfirmName(e.target.value)}
                    className="w-full h-11 bg-slate-50 dark:bg-slate-900/60 border border-rose-300 dark:border-rose-700/60 rounded-xl px-3.5 text-xs focus:outline-none focus:border-rose-500 text-slate-800 dark:text-slate-100 font-medium"
                  />
                </motion.div>
              )}

              <div className="flex gap-3 pt-5 border-t border-[#e3e3e3] dark:border-[#202024] mt-6">
                <button
                  type="button"
                  onClick={handleClose}
                  className="flex-1 h-11 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-[#1c1c21] dark:hover:bg-[#25252b] text-slate-700 dark:text-slate-250 text-xs font-semibold tracking-wider uppercase transition-all duration-150 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || (isPermanent && confirmName !== resident.name)}
                  className={`flex-1 h-11 rounded-full text-xs font-semibold tracking-wider uppercase transition-all duration-300 shadow-md flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 ${
                    isPermanent
                      ? 'bg-rose-600 hover:bg-rose-700 text-white'
                      : 'bg-slate-800 hover:bg-slate-700 dark:bg-slate-100 dark:hover:bg-[#ffffff] text-[#ffffff] dark:text-[#0b0b0d]'
                  }`}
                  style={isPermanent ? undefined : { color: theme === 'dark' ? '#0b0b0d' : '#ffffff' }}
                >
                  {submitting ? (
                    <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                  ) : isPermanent ? (
                    'Delete Forever'
                  ) : (
                    'Archive'
                  )}
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

interface PermanentDeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  resident: Resident | null;
  staffId: string;
  theme: string;
  onDeleteSuccess: (deletedId: string) => void;
}

function PermanentDeleteModal({ isOpen, onClose, resident, staffId, theme, onDeleteSuccess }: PermanentDeleteModalProps) {
  const [confirmName, setConfirmName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resident) return;

    if (confirmName !== resident.name) {
      setError('Confirmation name does not match.');
      return;
    }

    setError('');
    setSubmitting(true);
    try {
      const res = await fetch('/api/resident/permanent-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: resident.id, staffId })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to permanently delete resident');
      }

      onDeleteSuccess(resident.id);
      onClose();
      setConfirmName('');
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to permanently delete resident.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && resident && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md px-4"
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 20 }}
            className="w-full max-w-[400px] bg-white dark:bg-[#121214] border border-[#e3e3e3] dark:border-[#202024] p-7 rounded-[28px] shadow-2xl relative z-50 flex flex-col"
          >
            <div className="flex items-center justify-between border-b border-[#e3e3e3] dark:border-[#202024] pb-4.5 mb-6">
              <div>
                <h3 className="text-lg font-normal tracking-tight text-rose-655 dark:text-rose-455">Permanent Delete</h3>
                <p className="text-[11px] text-slate-550 dark:text-slate-400 mt-0.5">This action is permanent and cannot be undone.</p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-900 text-slate-400 hover:text-slate-650 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mb-6 p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 dark:bg-rose-950/40 dark:border-rose-500/30 dark:text-rose-200 text-xs flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-rose-600 dark:text-rose-450 shrink-0" />
                <span className="font-bold">CRITICAL WARNING</span>
              </div>
              <p className="leading-relaxed">
                All clinical records, task checklists, and handover history for <strong>{resident.name}</strong> will be permanently erased from the database.
              </p>
            </div>

            {error && (
              <div className="mb-4.5 p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 dark:bg-rose-950/40 dark:border-rose-500/30 dark:text-rose-200 text-xs flex items-center gap-2.5">
                <AlertCircle className="w-4.5 h-4.5 text-rose-600 dark:text-rose-400 shrink-0" />
                <span className="font-semibold">{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-[10px] font-bold text-slate-455 dark:text-slate-500 uppercase tracking-wider block mb-1">
                  Type resident name to confirm: <span className="font-bold select-all text-[#1f1f1f] dark:text-[#ffffff]">{resident.name}</span>
                </label>
                <input
                  type="text"
                  placeholder="Enter exact name..."
                  value={confirmName}
                  onChange={(e) => setConfirmName(e.target.value)}
                  className="w-full h-11 bg-slate-50 dark:bg-slate-900/60 border border-[#e3e3e3] dark:border-[#202024] rounded-xl px-3.5 text-xs focus:outline-none focus:border-[#1f1f1f] dark:focus:border-[#e3e3e3] text-slate-800 dark:text-slate-100 font-medium"
                />
              </div>

              <div className="flex gap-3 pt-5 border-t border-[#e3e3e3] dark:border-[#202024] mt-6">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 h-11 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-[#1c1c21] dark:hover:bg-[#25252b] text-slate-700 dark:text-slate-250 text-xs font-semibold tracking-wider uppercase transition-all duration-150 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || confirmName !== resident.name}
                  className="flex-1 h-11 rounded-full bg-rose-600 hover:bg-rose-700 dark:bg-rose-600 dark:hover:bg-rose-700 text-white text-xs font-semibold tracking-wider uppercase transition-all duration-300 shadow-md flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {submitting ? (
                    <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    'Delete Forever'
                  )}
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
