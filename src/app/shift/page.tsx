'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Settings, FileCheck, Users, Search, Plus, X, Sun, Moon, LogOut, ArrowRight, Activity, Trash2, ShieldAlert, FileWarning, AlertCircle, ListTodo, Clock } from 'lucide-react';
import Link from 'next/link';
import SettingsModal from '@/components/SettingsModal';
import OnboardingTour from '@/components/OnboardingTour';
import { motion, AnimatePresence } from 'framer-motion';

interface Resident {
  id: string;
  name: string;
  room_number: string;
  care_level: string;
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
  urgency: 'critical' | 'attention' | 'routine';
  shift_type?: 'morning' | 'afternoon' | 'night';
  updated_at?: string;
}

export default function MyShift() {
  const { user, facility, logout, isLoading: authLoading } = useAuth();
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

  // Modal States for Dynamic Resident Insertion
  const [showAddModal, setShowAddModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  // Soft Delete and Permanent Delete Modal States
  const [deletingResident, setDeletingResident] = useState<Resident | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [permanentDeletingResident, setPermanentDeletingResident] = useState<Resident | null>(null);
  const [showPermanentDeleteModal, setShowPermanentDeleteModal] = useState(false);

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
    setArchivedResidents((prev) => prev.filter((r) => r.id !== deletedId));
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
        .select('id, name, room_number, care_level, wing_id, is_active, status_reason')
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
        .select('resident_id, is_approved, urgency, shift_type, created_at')
        .eq('facility_id', facility.id)
        .eq('shift_date', todayStr);

      if (handError) throw handError;

      const statusMap: Record<string, HandoverStatus> = {};
      
      // 1. Fetch offline queue items first
      try {
        const { getPendingQueue } = await import('@/lib/db');
        const pendingQueue = await getPendingQueue();
        pendingQueue.forEach(item => {
          if (item.payload?.body?.handoverRecord) {
            const hr = item.payload.body.handoverRecord;
            statusMap[hr.resident_id] = {
              resident_id: hr.resident_id,
              is_approved: true,
              urgency: hr.urgency || 'routine',
              shift_type: hr.shift_type || 'morning',
              updated_at: new Date(item.created_at).toISOString()
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
          updated_at: h.created_at
        };
      });
      setHandovers(statusMap);

    } catch (err) {
      console.error('Error fetching shift data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [facility]);

  const handleLogout = () => {
    logout();
  };



  if (authLoading || !user || !facility) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-[#080b16] flex flex-col items-center justify-center">
        <div className="w-10 h-10 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="mt-4 text-slate-500 dark:text-slate-400 font-mono text-xs tracking-widest uppercase">Loading Shift Registry...</p>
      </div>
    );
  }

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

  return (
    <div className="min-h-screen bg-[#ffffff] dark:bg-[#0b0b0d] text-[#1f1f1f] dark:text-[#e3e3e3] flex flex-col pb-16 transition-colors duration-300 font-sans">
      <OnboardingTour />
      
      {/* Header (Google NotebookLM Style) */}
      <header className="sticky top-0 z-40 bg-[#ffffff]/80 dark:bg-[#0b0b0d]/80 backdrop-blur-md border-b border-[#e3e3e3] dark:border-[#202024] px-6 py-3.5 transition-colors duration-200">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          {/* Brand Logo */}
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#1f1f1f] dark:bg-[#e3e3e3] flex items-center justify-center font-bold text-sm text-[#ffffff] dark:text-[#0b0b0d]">
              C
            </div>
            <span className="font-semibold text-[17px] tracking-tight text-[#1f1f1f] dark:text-[#ffffff]">
              Handoverly
            </span>
          </div>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center gap-6 text-[13px] font-medium text-slate-500 dark:text-slate-400">
            <span id="tour-nav-registry" className="text-[#1f1f1f] dark:text-[#ffffff] border-b-2 border-[#1f1f1f] dark:border-[#ffffff] pb-1 cursor-default">
              Shift Registry
            </span>
            <Link id="tour-nav-tasks" href="/tasks" className="hover:text-[#1f1f1f] dark:hover:text-[#ffffff] transition-colors pb-1">
              Shift Tasks
            </Link>
            <Link id="tour-nav-dashboard" href="/" className="hover:text-[#1f1f1f] dark:hover:text-[#ffffff] transition-colors pb-1">
              Live Dashboard
            </Link>
          </nav>
          
          {/* Actions */}
          <div className="flex items-center gap-3">
            {/* Theme Toggle Button */}
            <button
              onClick={toggleTheme}
              className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-900 text-slate-600 dark:text-slate-400 transition-colors cursor-pointer"
              title={theme === 'dark' ? "Switch to Day Mode" : "Switch to Night Mode"}
            >
              {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-500" /> : <Moon className="w-4 h-4 text-[#1f1f1f]" />}
            </button>

            {/* Settings Button */}
            <button
              onClick={() => setShowSettingsModal(true)}
              className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-900 text-slate-600 dark:text-slate-400 transition-colors cursor-pointer"
              title="Configure AI API Keys"
              type="button"
            >
              <Settings className="w-4 h-4" />
            </button>

            {/* User Info & Logout */}
            <div className="hidden sm:flex flex-col text-right">
              <span className="text-xs font-bold text-[#1f1f1f] dark:text-[#ffffff]">{user.name}</span>
              <span className="text-[10px] text-slate-450 dark:text-slate-500 font-medium capitalize">{user.role}</span>
            </div>

            <button
              onClick={handleLogout}
              className="p-2 rounded-full hover:bg-red-50 dark:hover:bg-red-950/20 text-slate-400 hover:text-red-650 transition-colors cursor-pointer"
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-5xl mx-auto w-full px-6 mt-12 flex-1 flex flex-col">
        {/* Title Section */}
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-10">
          <div className="space-y-1.5">
            <h2 className="text-3xl font-normal tracking-tight text-[#1f1f1f] dark:text-[#ffffff]">
              Your Shift Registry
            </h2>
            <p className="text-slate-550 dark:text-slate-400 text-xs font-normal max-w-xl">
              Select a resident to record voice notes and extract structured ISBAR summaries, or create a new profile instantly.
            </p>
          </div>

          <button
            id="tour-register-resident"
            onClick={() => setShowAddModal(true)}
            className="px-5 py-2.5 rounded-full bg-slate-800 hover:bg-slate-700 dark:bg-slate-100 dark:hover:bg-[#ffffff] text-[#ffffff] dark:text-[#0b0b0d] font-semibold text-xs tracking-wide transition-all duration-300 cursor-pointer flex items-center gap-1.5 self-start shadow-md shadow-slate-200/50 dark:shadow-none"
            style={{ color: theme === 'dark' ? '#0b0b0d' : '#ffffff' }}
          >
            <Plus className="w-4 h-4" />
            Register Resident
          </button>
        </div>

        {/* Search & Tabs Controls */}
        <div className="space-y-6 mb-10">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500" />
              <input
                id="tour-resident-search"
                type="text"
                placeholder="Search residents by name or room number..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-12 bg-white dark:bg-[#121214] border border-[#e3e3e3] dark:border-[#202024] rounded-full pl-11 pr-4 text-xs focus:outline-none focus:border-[#1f1f1f] dark:focus:border-[#e3e3e3] text-[#1f1f1f] dark:text-[#ffffff] transition-all"
              />
            </div>

            <select
              id="tour-wing-filter"
              value={selectedWingFilter}
              onChange={(e) => setSelectedWingFilter(e.target.value)}
              className="h-12 bg-white dark:bg-[#121214] border border-[#e3e3e3] dark:border-[#202024] rounded-full px-5 text-xs focus:outline-none focus:border-[#1f1f1f] dark:focus:border-[#e3e3e3] text-[#1f1f1f] dark:text-[#ffffff] transition-all cursor-pointer font-medium min-w-[160px]"
            >
              <option value="all">All Wings</option>
              {wings.map((w) => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
              <option value="unassigned">Unassigned</option>
            </select>
          </div>

          {/* Underlined Navigation Tabs (Google style) */}
          <div id="tour-shift-tabs" className="flex border-b border-[#e3e3e3] dark:border-[#202024] gap-6 text-[13px] font-semibold text-slate-400 dark:text-slate-500">
            {(['all', 'pending', 'completed'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`pb-2.5 transition-all capitalize border-b-2 cursor-pointer ${
                  activeTab === tab 
                    ? 'border-[#1f1f1f] dark:border-[#ffffff] text-[#1f1f1f] dark:text-[#ffffff]' 
                    : 'border-transparent hover:text-slate-700 dark:hover:text-slate-300'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {/* Resident Cards Grid */}
        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center py-20">
            <div className="w-6 h-6 border-2 border-slate-400 border-t-transparent rounded-full animate-spin mb-4"></div>
            <p className="text-xs text-slate-400 font-mono">Retrieving registry...</p>
          </div>
        ) : filteredResidents.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center py-20 border border-[#e3e3e3] dark:border-[#202024] border-dashed rounded-[20px] bg-transparent text-center">
            <Clock className="w-8 h-8 text-slate-300 dark:text-slate-750 mb-3" />
            <p className="text-sm font-semibold text-slate-550 dark:text-slate-400">No residents found</p>
            <p className="text-xs text-slate-400 dark:text-slate-600 mt-1">Refine your search filters or add a new resident profile.</p>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {filteredResidents.map((res) => {
              const status = handovers[res.id];
              const isDone = status?.is_approved;
              
              let borderClass = 'border-[#e3e3e3] dark:border-[#202024] bg-white dark:bg-[#121214] hover:shadow-md';
              let badgeText = 'Awaiting updates';
              let badgeColor = 'bg-slate-50 text-slate-500 dark:bg-slate-900/40 dark:text-slate-500';
 
              if (isDone) {
                if (status.urgency === 'critical') {
                  borderClass = 'border-red-200 dark:border-red-950/40 bg-white dark:bg-[#121214] hover:shadow-md';
                  badgeText = 'Done • Critical';
                  badgeColor = 'bg-red-50 text-red-750 dark:bg-red-500/10 dark:text-red-400';
                } else if (status.urgency === 'attention') {
                  borderClass = 'border-amber-200 dark:border-amber-950/40 bg-white dark:bg-[#121214] hover:shadow-md';
                  badgeText = 'Done • Monitor';
                  badgeColor = 'bg-amber-50 text-amber-750 dark:bg-amber-500/10 dark:text-amber-400';
                } else {
                  borderClass = 'border-emerald-200 dark:border-emerald-950/40 bg-white dark:bg-[#121214] hover:shadow-md';
                  badgeText = 'Done • Routine';
                  badgeColor = 'bg-emerald-50 text-emerald-750 dark:bg-emerald-500/10 dark:text-emerald-400';
                }
              }

              const wingName = wings.find((w) => w.id === res.wing_id)?.name;

              return (
                <div 
                  key={res.id} 
                  className={`border rounded-[20px] p-6 transition-all duration-300 flex flex-col justify-between ${borderClass}`}
                >
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 dark:bg-[#1c1c21] dark:text-slate-300">
                        Room {res.room_number}
                      </span>
                      <span className={`text-[9px] uppercase tracking-wider font-semibold px-2.5 py-0.5 rounded-full ${badgeColor}`}>
                        {badgeText}
                      </span>
                    </div>
                    
                    <div className="space-y-1">
                      <Link href={`/resident/${res.id}`} className="hover:underline">
                        <h3 className="text-[17px] font-semibold text-[#1f1f1f] dark:text-[#ffffff]">{res.name}</h3>
                      </Link>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Care Level: {res.care_level}{wingName ? ` • ${wingName}` : ''}</p>
                    </div>
                  </div>

                  <div className="mt-6 pt-5 border-t border-[#f5f5f5] dark:border-[#1c1c1f] flex items-center justify-between">
                    {isDone ? (
                      <span className="text-[10px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5 font-semibold">
                        <FileCheck className="w-4 h-4" />
                        Submitted
                      </span>
                    ) : (
                      <span className="text-[10px] text-slate-440 dark:text-slate-500 flex items-center gap-1.5 font-medium">
                        <FileWarning className="w-4 h-4" />
                        Awaiting
                      </span>
                    )}

                    <div className="flex items-center gap-2">
                      {user?.role !== 'carer' && (
                        <>
                          <button
                            onClick={() => handleDeleteResident(res)}
                            className="p-2 rounded-full text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 dark:text-slate-500 dark:hover:text-rose-405 transition-all cursor-pointer shrink-0"
                            title={`Delete ${res.name}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>

                          <Link
                            href={`/resident/${res.id}/input`}
                            className={`px-4.5 py-2 rounded-full text-xs font-semibold tracking-wide transition-all duration-300 flex items-center gap-1 cursor-pointer ${
                              isDone 
                                ? 'bg-slate-100 hover:bg-slate-200 dark:bg-[#1c1c21] dark:hover:bg-[#25252b] text-slate-800 dark:text-slate-200' 
                                : 'bg-slate-800 hover:bg-slate-700 dark:bg-slate-100 dark:hover:bg-[#ffffff] text-[#ffffff] dark:text-[#0b0b0d] shadow-md shadow-slate-200/50 dark:shadow-none'
                            }`}
                            style={{ color: isDone ? undefined : (theme === 'dark' ? '#0b0b0d' : '#ffffff') }}
                          >
                            {isDone ? 'Update' : 'Start'}
                            <ArrowRight className="w-3.5 h-3.5" />
                          </Link>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Archived / Discharged Residents Section */}
        <div className="mt-12 pt-8 border-t border-[#e3e3e3] dark:border-[#202024]">
          <button
            onClick={() => setShowArchive(!showArchive)}
            className="w-full flex items-center justify-between p-4 bg-slate-50 dark:bg-[#121214] border border-[#e3e3e3] dark:border-[#202024] rounded-2xl hover:bg-slate-100 dark:hover:bg-[#1a1a1f] transition-all duration-200 cursor-pointer"
            type="button"
          >
            <div className="flex items-center gap-2.5">
              <Users className="w-5 h-5 text-slate-500 dark:text-slate-400" />
              <span className="font-semibold text-sm text-slate-700 dark:text-slate-200">
                Discharged & Archived Residents ({archivedResidents.length})
              </span>
            </div>
            <span className="text-xs text-slate-400 font-medium">
              {showArchive ? 'Collapse' : 'Expand'}
            </span>
          </button>

          {showArchive && (
            <div className="mt-6">
              {archivedResidents.length === 0 ? (
                <div className="py-10 text-center border border-[#e3e3e3] dark:border-[#202024] border-dashed rounded-[20px] bg-transparent text-slate-450 dark:text-slate-500 text-xs">
                  No archived residents found.
                </div>
              ) : (
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {archivedResidents.map((res) => {
                    const wingName = wings.find((w) => w.id === res.wing_id)?.name;
                    return (
                      <div
                        key={res.id}
                        className="border border-[#e3e3e3] dark:border-[#202024] bg-white dark:bg-[#121214] rounded-[20px] p-6 transition-all duration-300 flex flex-col justify-between"
                      >
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 dark:bg-[#1c1c21] dark:text-slate-300">
                              Room {res.room_number}
                            </span>
                            <span className="text-[9px] uppercase tracking-wider font-semibold px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-750 dark:bg-rose-500/10 dark:text-rose-400">
                              {res.status_reason || 'Discharged'}
                            </span>
                          </div>

                          <div className="space-y-1">
                            <Link href={`/resident/${res.id}`} className="hover:underline">
                              <h3 className="text-[17px] font-semibold text-[#1f1f1f] dark:text-[#ffffff]">{res.name}</h3>
                            </Link>
                            <p className="text-xs text-slate-500 dark:text-slate-400">Care Level: {res.care_level}{wingName ? ` • ${wingName}` : ''}</p>
                          </div>
                        </div>

                        <div className="mt-6 pt-5 border-t border-[#f5f5f5] dark:border-[#1c1c1f] flex items-center justify-between">
                          <span className="text-[10px] text-slate-440 dark:text-slate-500 flex items-center gap-1.5 font-medium">
                            <Clock className="w-4 h-4" />
                            Inactive profile
                          </span>

                          <div className="flex items-center gap-2">
                            {/* Readmit Button */}
                            <button
                              onClick={() => handleReadmitResident(res)}
                              className="px-4.5 py-2 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-[#1c1c21] dark:hover:bg-[#25252b] text-slate-850 dark:text-slate-200 text-xs font-semibold tracking-wide transition-all duration-300 cursor-pointer"
                              type="button"
                            >
                              Re-admit
                            </button>

                            {/* Permanently Delete Button for Admin and RN roles */}
                            {user && ['admin', 'rn'].includes(user.role) && (
                              <button
                                onClick={() => {
                                  setPermanentDeletingResident(res);
                                  setShowPermanentDeleteModal(true);
                                }}
                                className="p-2 rounded-full text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 dark:text-slate-500 dark:hover:text-rose-405 transition-all cursor-pointer shrink-0"
                                title={`Permanently Delete ${res.name}`}
                                type="button"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </main>

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
        onDeleteSuccess={handleSoftDeleteSuccess}
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
    </div>
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
            className="w-full max-w-[400px] bg-white dark:bg-[#121214] border border-[#e3e3e3] dark:border-[#202024] p-7 rounded-[28px] shadow-2xl relative z-50 flex flex-col"
          >
            
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-[#e3e3e3] dark:border-[#202024] pb-4.5 mb-6">
              <div>
                <h3 className="text-lg font-normal tracking-tight text-slate-900 dark:text-white">Register Resident</h3>
                <p className="text-[11px] text-slate-550 dark:text-slate-400 mt-0.5">Add a new admission profile to this facility.</p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-900 text-slate-400 hover:text-slate-650 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Error */}
            {modalError && (
              <div className="mb-4.5 p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 dark:bg-rose-950/40 dark:border-rose-500/30 dark:text-rose-200 text-xs flex items-center gap-2.5">
                <AlertCircle className="w-4.5 h-4.5 text-rose-600 dark:text-rose-400 shrink-0" />
                <span className="font-semibold">{modalError}</span>
              </div>
            )}

            {/* Modal Form */}
            <form onSubmit={handleAddResidentSubmit} className="space-y-4">
              <div>
                <label className="text-[10px] font-bold text-slate-450 dark:text-slate-500 uppercase tracking-wider block mb-1">Full Name</label>
                <input
                  type="text"
                  placeholder="e.g. Sarah Jenkins"
                  value={newResName}
                  onChange={(e) => setNewResName(e.target.value)}
                  className="w-full h-11 bg-slate-50 dark:bg-slate-900/60 border border-[#e3e3e3] dark:border-[#202024] rounded-xl px-3.5 text-xs focus:outline-none focus:border-[#1f1f1f] dark:focus:border-[#e3e3e3] text-slate-800 dark:text-slate-100 font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-450 dark:text-slate-500 uppercase tracking-wider block mb-1">Room No.</label>
                  <input
                    type="text"
                    placeholder="e.g. 204"
                    value={newResRoom}
                    onChange={(e) => setNewResRoom(e.target.value)}
                    className="w-full h-11 bg-slate-50 dark:bg-slate-900/60 border border-[#e3e3e3] dark:border-[#202024] rounded-xl px-3.5 text-xs focus:outline-none focus:border-[#1f1f1f] dark:focus:border-[#e3e3e3] text-slate-800 dark:text-slate-100 font-bold"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-450 dark:text-slate-500 uppercase tracking-wider block mb-1">DOB</label>
                  <input
                    type="date"
                    value={newResDob}
                    onChange={(e) => setNewResDob(e.target.value)}
                    className="w-full h-11 bg-slate-50 dark:bg-slate-900/60 border border-[#e3e3e3] dark:border-[#202024] rounded-xl px-3 text-xs focus:outline-none text-slate-700 dark:text-slate-300"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-450 dark:text-slate-500 uppercase tracking-wider block mb-1">Care Level</label>
                <select
                  value={newResCare}
                  onChange={(e) => setNewResCare(e.target.value)}
                  className="w-full h-11 bg-slate-50 dark:bg-slate-900/60 border border-[#e3e3e3] dark:border-[#202024] rounded-xl px-3.5 text-xs focus:outline-none text-slate-700 dark:text-slate-300"
                >
                  <option value="High">High Care</option>
                  <option value="Low">Low Care</option>
                  <option value="Dementia">Dementia Care</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-450 dark:text-slate-500 uppercase tracking-wider block mb-1">Assign Wing</label>
                <select
                  value={newResWingId}
                  onChange={(e) => setNewResWingId(e.target.value)}
                  className="w-full h-11 bg-slate-50 dark:bg-slate-900/60 border border-[#e3e3e3] dark:border-[#202024] rounded-xl px-3.5 text-xs focus:outline-none text-slate-700 dark:text-slate-300"
                >
                  <option value="">No Wing (Unassigned)</option>
                  {wings.map((w) => (
                    <option key={w.id} value={w.id}>{w.name}</option>
                  ))}
                </select>
              </div>

              {/* Action Buttons */}
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
                  disabled={submittingModal}
                  className="flex-1 h-11 rounded-full bg-slate-800 hover:bg-slate-700 dark:bg-slate-100 dark:hover:bg-[#ffffff] text-[#ffffff] dark:text-[#0b0b0d] text-xs font-semibold tracking-wider uppercase transition-all duration-300 shadow-md shadow-slate-200/50 dark:shadow-none flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                  style={{ color: theme === 'dark' ? '#0b0b0d' : '#ffffff' }}
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
  onDeleteSuccess: (deletedId: string, reason: string) => void;
}

function SoftDeleteModal({ isOpen, onClose, resident, theme, onDeleteSuccess }: SoftDeleteModalProps) {
  const [reason, setReason] = useState('Discharged');
  const [customReason, setCustomReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resident) return;

    setError('');
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
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to archive resident');
      }

      onDeleteSuccess(resident.id, finalReason);
      onClose();
      // Reset state
      setReason('Discharged');
      setCustomReason('');
    } catch (err: any) {
      console.error(err);
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
                <h3 className="text-lg font-normal tracking-tight text-slate-900 dark:text-white">Archive Resident</h3>
                <p className="text-[11px] text-slate-550 dark:text-slate-400 mt-0.5">Please specify a reason for archiving {resident.name}.</p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-900 text-slate-400 hover:text-slate-650 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

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
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full h-11 bg-slate-50 dark:bg-slate-900/60 border border-[#e3e3e3] dark:border-[#202024] rounded-xl px-3.5 text-xs focus:outline-none text-slate-700 dark:text-slate-300"
                >
                  <option value="Discharged">Discharged</option>
                  <option value="Transferred">Transferred to another facility</option>
                  <option value="Passed Away">Passed Away</option>
                  <option value="Other">Other (Specify below)</option>
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
                  disabled={submitting}
                  className="flex-1 h-11 rounded-full bg-slate-800 hover:bg-slate-700 dark:bg-slate-100 dark:hover:bg-[#ffffff] text-[#ffffff] dark:text-[#0b0b0d] text-xs font-semibold tracking-wider uppercase transition-all duration-300 shadow-md flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                  style={{ color: theme === 'dark' ? '#0b0b0d' : '#ffffff' }}
                >
                  {submitting ? (
                    <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
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
