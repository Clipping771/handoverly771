'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContextProvider';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { ShieldCheck, ShieldAlert, Plus, Trash2, Building, Users, AlertCircle, AlertOctagon, RefreshCw, Sun, Moon, Search, ChevronDown, LogOut, UserPlus, Edit3, Save, X, Eye, EyeOff, Key, Server, Cpu, Activity } from 'lucide-react';
import Link from 'next/link';
import CustomModelSelector from '@/components/CustomModelSelector';

interface Staff {
  id: string;
  name: string;
  role: string;
  is_active: boolean;
  employee_id?: string;
  email?: string;
}

interface Wing {
  id: string;
  name: string;
}

interface Resident {
  id: string;
  name: string;
  room_number: string;
  dob: string;
  care_level: string;
  wing_id?: string;
  wings?: {
    name: string;
  } | {
    name: string;
  }[] | null;
}

export default function AdminSetup() {
  const { user, facility, isLoading: authLoading, logout, isAdmin, isPlatformAdmin } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const router = useRouter();

  // Role boundaries enforcement
  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        router.replace('/admin/login');
      } else if (isPlatformAdmin) {
        router.replace('/system-admin');
      } else if (!isAdmin) {
        router.replace('/admin/login');
      }
    }
  }, [authLoading, user, isPlatformAdmin, isAdmin, router]);

  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [residents, setResidents] = useState<Resident[]>([]);
  const [wings, setWings] = useState<Wing[]>([]);
  const [sirsReports, setSirsReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'analytics' | 'staff' | 'residents' | 'ai'>('analytics');
  
  // Analytics State
  const [metrics, setMetrics] = useState({
    totalHandovers: 0,
    activeTasks: 0,
    sirsCount: 0,
    highRiskFlags: 0,
  });
  
  // Wings Form
  const [newWingName, setNewWingName] = useState('');
  const [selectedWingId, setSelectedWingId] = useState('');
  
  // Forms
  const [staffName, setStaffName] = useState('');
  const [staffRole, setStaffRole] = useState<'rn' | 'carer' | 'admin'>('carer');
  const [staffPin, setStaffPin] = useState('');
  const [showStaffPin, setShowStaffPin] = useState(false);
  const [staffEmployeeId, setStaffEmployeeId] = useState('');
  const [staffEmail, setStaffEmail] = useState('');
  const [editingStaffId, setEditingStaffId] = useState<string | null>(null);
  const [editStaffName, setEditStaffName] = useState('');
  const [editStaffRole, setEditStaffRole] = useState<'rn' | 'carer' | 'admin'>('carer');
  const [editStaffEmployeeId, setEditStaffEmployeeId] = useState('');
  const [editStaffEmail, setEditStaffEmail] = useState('');


  // Roles states
  const [newRoleName, setNewRoleName] = useState('');
  const [rolesList, setRolesList] = useState<{id: string, name: string}[]>([]);
  const [editingRoleId, setEditingRoleId] = useState<string | null>(null);
  const [editRoleName, setEditRoleName] = useState('');
  
  const [resName, setResName] = useState('');
  const [resRoom, setResRoom] = useState('');
  const [resDob, setResDob] = useState('');
  const [resCare, setResCare] = useState('High');

  const [anthropicKey, setAnthropicKey] = useState('');
  const [openrouterKey, setOpenrouterKey] = useState('');
  const [openrouterModel, setOpenrouterModel] = useState('google/gemini-1.5-flash');
  const [ollamaUrl, setOllamaUrl] = useState('');
  const [ollamaModel, setOllamaModel] = useState('');
  const [groqKey, setGroqKey] = useState('');
  const [groqModel, setGroqModel] = useState('llama-3.3-70b-versatile');
  const [activeProvider, setActiveProvider] = useState<'auto' | 'anthropic' | 'openrouter' | 'groq' | 'ollama' | 'mock' | 'openai' | 'gemini'>('auto');
  
  const [showAnthropic, setShowAnthropic] = useState(false);
  const [showOpenrouter, setShowOpenrouter] = useState(false);
  const [showGroq, setShowGroq] = useState(false);
  const [showOpenai, setShowOpenai] = useState(false);
  const [showGemini, setShowGemini] = useState(false);

  const [testingConnection, setTestingConnection] = useState<Record<string, boolean>>({});
  const [connectionStatus, setConnectionStatus] = useState<Record<string, 'success' | 'error' | null>>({});

  const testConnection = async (provider: string, apiKey: string) => {
    if (!apiKey) {
      setError(`Please enter an API Key for ${provider} first.`);
      return;
    }
    setTestingConnection(prev => ({ ...prev, [provider]: true }));
    setError('');
    setFeedback('');
    try {
      const res = await fetch('/api/admin/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, apiKey })
      });
      const data = await res.json();
      if (data.success) {
        setConnectionStatus(prev => ({ ...prev, [provider]: 'success' }));
        setFeedback(data.message || 'Connection successful!');
      } else {
        setConnectionStatus(prev => ({ ...prev, [provider]: 'error' }));
        setError(data.error || 'Connection failed.');
      }
    } catch (err) {
      setConnectionStatus(prev => ({ ...prev, [provider]: 'error' }));
      setError('Network error while testing connection.');
    } finally {
      setTestingConnection(prev => ({ ...prev, [provider]: false }));
    }
  };

  const [openaiKey, setOpenaiKey] = useState('');
  const [openaiModel, setOpenaiModel] = useState('gpt-4o-mini');
  const [geminiKey, setGeminiKey] = useState('');
  const [geminiModel, setGeminiModel] = useState('gemini-1.5-flash');
  
  // Module Feature Flags
  const [sentinelEnabled, setSentinelEnabled] = useState(true);
  const [chronicleEnabled, setChronicleEnabled] = useState(true);
  const [ariaEnabled, setAriaEnabled] = useState(true);

  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');
  const [showToast, setShowToast] = useState(false);
  const [showSirsReports, setShowSirsReports] = useState(true);



  const handleLogout = () => {
    logout();
  };

  const handleAddRole = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setFeedback('');
    if (!newRoleName.trim()) {
      setError('Please enter a role name.');
      return;
    }

    try {
      const { error: insertErr } = await supabase
        .from('roles')
        .insert([{ name: newRoleName.trim().toLowerCase() }]);

      if (insertErr) throw insertErr;

      setFeedback(`Role "${newRoleName}" added successfully.`);
      setNewRoleName('');
      loadData(); // refresh roles
    } catch (err: any) {
      if (err.message.includes('unique')) {
        setError('That role already exists.');
      } else {
        setError(err.message || 'Failed to add role.');
      }
    }
  };

  const handleDeleteRole = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete the role "${name}"?`)) return;
    try {
      const { error } = await supabase.from('roles').delete().eq('id', id);
      if (error) throw error;
      setFeedback(`Role "${name}" deleted successfully.`);
      loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to delete role.');
    }
  };

  const handleUpdateRole = async (id: string) => {
    if (!editRoleName.trim()) return;
    try {
      const res = await fetch('/api/roles/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, name: editRoleName })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update role.');
      
      setFeedback('Role updated successfully.');
      setEditingRoleId(null);
      loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to update role.');
    }
  };


  const loadData = async () => {
    if (!facility) {
      setLoading(false);
      return;
    }
    try {
      const [residentsRes, wingsRes, rolesRes] = await Promise.all([
        supabase.from('residents').select('*').eq('facility_id', facility.id).order('name'),
        supabase.from('wings').select('*').eq('facility_id', facility.id).order('name'),
        supabase.from('roles').select('*').order('name')
      ]);

      if (residentsRes.data) setResidents(residentsRes.data);
      if (wingsRes.data) setWings(wingsRes.data);
      if (rolesRes.data) {
        setRolesList(rolesRes.data);
        if (rolesRes.data.length > 0 && !staffRole) {
          setStaffRole(rolesRes.data[0].name);
        }
      }

      // Fetch staff
      const { data: staffData } = await supabase
        .from('staff')
        .select('id, name, role, is_active, employee_id, email')
        .eq('facility_id', facility.id);
      setStaffList(staffData || []);

      // Fetch wings
      const { data: wingsData } = await supabase
        .from('wings')
        .select('id, name')
        .eq('facility_id', facility.id)
        .order('name', { ascending: true });
      setWings(wingsData || []);

      // Fetch residents
      const { data: resData } = await supabase
        .from('residents')
        .select('id, name, room_number, dob, care_level, wing_id, wings(name)')
        .eq('facility_id', facility.id)
        .eq('is_active', true);
      setResidents(resData || []);

      // Fetch SIRS Reports
      const { data: sirsData } = await supabase
        .from('sirs_reports')
        .select('id, incident_type, description, priority, status, created_at, resident_id, reporter_id')
        .eq('facility_id', facility.id)
        .order('created_at', { ascending: false });
      setSirsReports(sirsData || []);

      // Fetch AI Config
      const { data: facilityData } = await supabase
        .from('facilities')
        .select('ai_config')
        .eq('id', facility.id)
        .single();
        
      if (facilityData?.ai_config) {
        const conf = facilityData.ai_config;
        if (conf.activeProvider) setActiveProvider(conf.activeProvider);
        if (conf.keys) {
          setAnthropicKey(conf.keys.anthropicKey || '');
          setOpenrouterKey(conf.keys.openrouterKey || '');
          setOpenrouterModel(conf.keys.openrouterModel || 'google/gemini-2.5-flash');
          setOllamaUrl(conf.keys.ollamaUrl || 'http://127.0.0.1:11434');
          setOllamaModel(conf.keys.ollamaModel || 'llama3');
          setGroqKey(conf.keys.groqKey || '');
          setGroqModel(conf.keys.groqModel || 'llama-3.3-70b-versatile');
          setOpenaiKey(conf.keys.openaiKey || '');
          setOpenaiModel(conf.keys.openaiModel || 'gpt-4o-mini');
          setGeminiKey(conf.keys.geminiKey || '');
          setGeminiModel(conf.keys.geminiModel || 'gemini-2.0-flash');
        }
        const flags = conf.featureFlags || {};
        setSentinelEnabled(flags.sentinelEnabled !== false);
        setChronicleEnabled(flags.chronicleEnabled !== false);
        setAriaEnabled(flags.ariaEnabled !== false);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };



  useEffect(() => {
    loadData();
  }, [facility]);

  
  const handleDeleteStaff = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete ${name}? This will revoke their access.`)) return;
    try {
      const res = await fetch('/api/auth/delete-staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });
      if (!res.ok) throw new Error('Failed to delete staff member');
      setFeedback(`Staff member ${name} deleted successfully.`);
      loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to delete staff member');
    }
  };

  const handleUpdateStaff = async (id: string) => {
    try {
      const res = await fetch('/api/auth/update-staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          name: editStaffName,
          role: editStaffRole,
          employeeId: editStaffEmployeeId,
          email: editStaffEmail
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update staff member');
      setFeedback('Staff member updated successfully.');
      setEditingStaffId(null);
      loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to update staff member');
    }
  };

  const handleAddStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setFeedback('');
    if (!staffName || !staffPin || !staffEmployeeId || !staffEmail) {
      setError('Please fill in all staff fields (Name, Employee ID, Email, and Password).');
      return;
    }

    try {
      const res = await fetch('/api/auth/register-staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          facilityId: facility?.id,
          name: staffName,
          role: staffRole,
          employeeId: staffEmployeeId,
          email: staffEmail,
          password: staffPin
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to add staff');
      }

      setFeedback(`Staff member "${staffName}" added successfully.`);
      setStaffName('');
      setStaffPin('');
      setStaffEmployeeId('');
      setStaffEmail('');
      loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to register staff.');
    }
  };

  const handleAddResident = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setFeedback('');
    if (!resName || !resRoom || !resDob) {
      setError('Please fill in all resident fields.');
      return;
    }

    try {
      const { error: insertErr } = await supabase
        .from('residents')
        .insert([{
          facility_id: facility?.id,
          wing_id: selectedWingId || null,
          name: resName,
          room_number: resRoom,
          dob: resDob,
          care_level: resCare
        }]);

      if (insertErr) throw insertErr;

      setFeedback(`Resident "${resName}" registered successfully.`);
      setResName('');
      setResRoom('');
      setResDob('');
      setSelectedWingId('');
      loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to add resident.');
    }
  };

  const handleAddWing = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setFeedback('');
    if (!newWingName.trim()) {
      setError('Please enter a wing name.');
      return;
    }

    try {
      const { error: insertErr } = await supabase
        .from('wings')
        .insert([{
          facility_id: facility?.id,
          name: newWingName.trim()
        }]);

      if (insertErr) throw insertErr;

      setFeedback(`Wing "${newWingName}" added successfully.`);
      setNewWingName('');
      loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to add wing.');
    }
  };

  const handleDeleteWing = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete the wing "${name}"? Residents assigned to this wing will become unassigned.`)) return;
    try {
      const { error: deleteErr } = await supabase
        .from('wings')
        .delete()
        .eq('id', id);

      if (deleteErr) throw deleteErr;

      setFeedback(`Wing "${name}" deleted successfully.`);
      loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to delete wing.');
    }
  };

  const handleDeleteResident = async (id: string) => {
    if (!confirm('Are you sure you want to deactivate this resident?')) return;
    try {
      const res = await fetch('/api/resident/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to delete resident');
      }
      loadData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveApiKeys = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!facility) return;
    
    try {
      const res = await fetch('/api/admin/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          facilityId: facility.id,
          activeProvider,
          featureFlags: {
            sentinelEnabled,
            chronicleEnabled,
            ariaEnabled
          },
          userKeys: {
            anthropicKey,
            openrouterKey,
            openrouterModel,
            ollamaUrl,
            ollamaModel,
            groqKey,
            groqModel,
            openaiKey,
            openaiModel,
            geminiKey,
            geminiModel
          }
        })
      });
      if (!res.ok) throw new Error('Failed to save config');
      
      setError('');
      setFeedback('');
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to save configuration');
    }
  };



  if (authLoading || !user || (!isAdmin && !isPlatformAdmin)) {
    return (
      <div className="min-h-screen bg-transparent flex flex-col items-center justify-center">
        <div className="w-12 h-12 border-4 border-slate-200 border-t-indigo-500 rounded-full animate-spin"></div>
        <p className="mt-6 text-slate-500 font-medium text-sm tracking-wide">Authenticating...</p>
      </div>
    );
  }

  // Platform admin visiting /admin → useEffect handles redirect, just show spinner
  if (user.role === 'platform_admin') {
    return (
      <div className="min-h-screen bg-transparent flex flex-col items-center justify-center">
        <div className="w-10 h-10 border-4 border-slate-200 border-t-indigo-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!facility) {
    return (
      <div className="min-h-screen bg-transparent flex flex-col items-center justify-center">
        <div className="w-12 h-12 border-4 border-slate-200 border-t-indigo-500 rounded-full animate-spin"></div>
        <p className="mt-6 text-slate-500 font-medium text-sm tracking-wide">Loading Facility Workspace...</p>
      </div>
    );
  }

  return (
    <>
    <div className="min-h-screen bg-transparent text-[#0f172a] dark:text-[#e2e8f0] flex flex-col pb-12 transition-colors duration-300 relative overflow-x-hidden">
      {/* Background is handled globally by layout.tsx */}

      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/40 dark:bg-slate-900/40 backdrop-blur-3xl border-b border-white/60 dark:border-white/5 px-4 py-4 sm:px-6 transition-all duration-300">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-[20px] bg-white dark:bg-slate-800 flex items-center justify-center font-bold text-sm shadow-[0_8px_30px_rgb(0,0,0,0.06)] border border-white/80 dark:border-white/10">
              <ShieldCheck className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-base font-bold text-slate-800 dark:text-white">{facility.name} Setup</h1>
              <p className="text-[10px] font-bold text-text-secondary uppercase tracking-widest mt-0.5">
                Administrator Workspace
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Theme Toggle Button */}
            <button
              onClick={toggleTheme}
              className="p-2.5 rounded-xl bg-white/50 hover:bg-white dark:bg-[#111629]/50 dark:hover:bg-[#1a2139] border border-slate-200/50 dark:border-white/5 shadow-sm text-slate-700 dark:text-slate-300 transition-all duration-200 hover:scale-105 active:scale-95"
              title={theme === 'dark' ? "Switch to Day Mode" : "Switch to Night Mode"}
            >
              {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-800 dark:text-slate-300" />}
            </button>
            <button
              onClick={handleLogout}
              className="p-2.5 rounded-xl bg-rose-50/50 hover:bg-rose-100/80 dark:bg-rose-500/10 dark:hover:bg-rose-500/20 border border-rose-100 dark:border-rose-500/10 text-rose-600 dark:text-rose-400 transition-all duration-200 hover:scale-105 active:scale-95"
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-6xl mx-auto w-full px-4 mt-10 flex-1 relative z-10">
        {/* Title */}
        <div className="flex items-center justify-between mb-10">
          <div>
            <h2 className="text-3xl font-bold tracking-tight text-slate-800 dark:text-white">System Configuration</h2>
            <p className="text-sm font-semibold text-text-secondary mt-1">Manage facility settings, roles, and AI engines.</p>
          </div>
          <button 
            onClick={loadData}
            className="p-3 bg-white/60 dark:bg-black/40 backdrop-blur-md border border-white/40 dark:border-white/5 text-text-secondary rounded-full hover:bg-white/80 dark:hover:bg-white/10 transition-all shadow-sm active:scale-95"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {/* Tabs Navigation */}
        <div className="flex p-1 bg-white/40 dark:bg-slate-800/40 backdrop-blur-md rounded-full border border-white/60 dark:border-white/5 relative w-full max-w-2xl mx-auto shadow-sm mb-10 overflow-hidden">
          {['analytics', 'staff', 'residents', 'ai'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab as any)}
              className={`flex-1 py-3 px-4 text-xs font-bold rounded-full relative transition-all duration-300 tracking-wider uppercase z-20 text-center ${
                activeTab === tab 
                  ? '!text-white bg-primary shadow-[0_4px_14px_rgba(45,212,191,0.4)] scale-105' 
                  : 'text-slate-500 hover:text-slate-850 dark:text-slate-450 dark:hover:text-white hover:bg-white/10 dark:hover:bg-slate-800/10'
              }`}
            >
              {tab === 'ai' ? 'AI Engines' : tab}
            </button>
          ))}
        </div>

        {/* Feedback alerts */}
        {feedback && (
          <div className="mb-6 p-4 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 text-emerald-800 dark:text-emerald-400 text-sm rounded-xl">
            {feedback}
          </div>
        )}
        {error && (
          <div className="mb-6 p-4 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 text-rose-800 dark:text-rose-400 text-sm rounded-xl flex items-center gap-2">
            <AlertCircle className="w-4.5 h-4.5 text-rose-600 dark:text-rose-400" />
            {error}
          </div>
        )}

        {/* Grid Setup Panels */}
        <div className="grid gap-8">
          
          {activeTab === 'analytics' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <div className="bg-white/40 dark:bg-slate-800/40 backdrop-blur-md p-6 rounded-[24px] border border-white/60 dark:border-white/10 shadow-sm">
                  <h4 className="text-[10px] font-bold text-text-secondary uppercase tracking-widest mb-2">Total Handovers</h4>
                  <div className="text-3xl font-black text-slate-800 dark:text-white">{metrics.totalHandovers}</div>
                </div>
                <div className="bg-white/40 dark:bg-slate-800/40 backdrop-blur-md p-6 rounded-[24px] border border-white/60 dark:border-white/10 shadow-sm">
                  <h4 className="text-[10px] font-bold text-text-secondary uppercase tracking-widest mb-2">Active Tasks</h4>
                  <div className="text-3xl font-black text-slate-800 dark:text-white">{metrics.activeTasks}</div>
                </div>
                <div className="bg-white/40 dark:bg-slate-800/40 backdrop-blur-md p-6 rounded-[24px] border border-white/60 dark:border-white/10 shadow-sm">
                  <h4 className="text-[10px] font-bold text-text-secondary uppercase tracking-widest mb-2">High Risk Flags</h4>
                  <div className="text-3xl font-black text-rose-500">{metrics.highRiskFlags}</div>
                </div>
                <div className="bg-white/40 dark:bg-slate-800/40 backdrop-blur-md p-6 rounded-[24px] border border-white/60 dark:border-white/10 shadow-sm">
                  <h4 className="text-[10px] font-bold text-text-secondary uppercase tracking-widest mb-2">SIRS Reports</h4>
                  <div className="text-3xl font-black text-amber-500">{sirsReports.length}</div>
                </div>
              </div>

              {/* SIRS INCIDENT REPORTS (Moved here) */}
          {/* SIRS INCIDENT REPORTS */}
          <div className="space-y-6 bg-white/40 dark:bg-slate-800/40 backdrop-blur-3xl p-8 rounded-[32px] border border-white/60 dark:border-white/10 shadow-[0_8px_30px_rgb(0,0,0,0.06)] relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-rose-500/10 dark:from-rose-500/5 to-transparent pointer-events-none"></div>
            
            <button 
              onClick={() => setShowSirsReports(!showSirsReports)}
              className="w-full text-left text-xl font-bold flex items-center gap-3 border-b border-rose-200/50 dark:border-rose-900/30 pb-4 text-slate-800 dark:text-white relative hover:opacity-80 transition-opacity"
            >
              <div className="w-10 h-10 rounded-[14px] bg-rose-50 dark:bg-rose-500/10 shadow-sm border border-rose-100 dark:border-rose-500/20 flex items-center justify-center shrink-0">
                <AlertOctagon className="w-5 h-5 text-rose-600 dark:text-rose-400" />
              </div>
              SIRS Incident Reports
              <div className="ml-auto flex items-center gap-3">
                <span className="px-3 py-1 bg-rose-100 dark:bg-rose-500/20 text-rose-700 dark:text-rose-400 text-xs font-bold rounded-full">
                  {sirsReports.length} Reports
                </span>
                {showSirsReports ? <ChevronDown className="w-5 h-5 text-slate-400 transition-transform" /> : <ChevronDown className="w-5 h-5 text-slate-400 -rotate-90 transition-transform" />}
              </div>
            </button>

            {showSirsReports && (
              <>
                {sirsReports.length === 0 ? (
              <div className="p-8 text-center bg-white/30 dark:bg-black/10 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700">
                <AlertOctagon className="w-8 h-8 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500 font-medium">No SIRS reports have been submitted yet.</p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-[24px] border border-white/45 dark:border-white/5 shadow-inner bg-white/30 dark:bg-black/10">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-white/40 dark:bg-white/5 border-b border-white/50 dark:border-white/10">
                      <th className="py-4 px-6 text-[10px] font-bold uppercase tracking-widest text-slate-500">Date/Time</th>
                      <th className="py-4 px-6 text-[10px] font-bold uppercase tracking-widest text-slate-500">Category</th>
                      <th className="py-4 px-6 text-[10px] font-bold uppercase tracking-widest text-slate-500">Priority</th>
                      <th className="py-4 px-6 text-[10px] font-bold uppercase tracking-widest text-slate-500">Description</th>
                      <th className="py-4 px-6 text-[10px] font-bold uppercase tracking-widest text-slate-500">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/40 dark:divide-white/5">
                    {sirsReports.map((report) => (
                      <tr key={report.id} className="hover:bg-white/50 dark:hover:bg-white/5 transition-colors">
                        <td className="py-4 px-6 text-sm text-slate-600 dark:text-slate-400 font-medium whitespace-nowrap">
                          {new Date(report.created_at).toLocaleString()}
                        </td>
                        <td className="py-4 px-6 text-sm font-bold text-slate-800 dark:text-slate-200">
                          {report.incident_type}
                        </td>
                        <td className="py-4 px-6">
                          <span className={`px-3 py-1 text-[10px] font-bold uppercase tracking-widest rounded-full ${
                            report.priority === 'critical' ? 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-400 border border-rose-200 dark:border-rose-500/30' : 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400 border border-amber-200 dark:border-amber-500/30'
                          }`}>
                            {report.priority === 'critical' ? 'Critical (24h)' : 'High (30d)'}
                          </span>
                        </td>
                        <td className="py-4 px-6 text-sm text-slate-600 dark:text-slate-400 max-w-xs truncate" title={report.description}>
                          {report.description}
                        </td>
                        <td className="py-4 px-6">
                          <span className="px-3 py-1 text-[10px] font-bold uppercase tracking-widest rounded-full bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                            {report.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            </>
          )}
          </div>
            </div>
          )}

          

          {/* STAFF TAB */}
          {activeTab === 'staff' && (
            <div className="space-y-8">
              {/* STAFF MANAGEMENT */}
              <div className="space-y-8 bg-white/40 dark:bg-slate-800/40 backdrop-blur-3xl p-8 rounded-[32px] border border-white/60 dark:border-white/10 shadow-[0_8px_30px_rgb(0,0,0,0.06)] relative overflow-hidden group">
                <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-white/20 dark:from-white/5 to-transparent pointer-events-none"></div>
                
                <h3 className="text-xl font-bold flex items-center gap-3 border-b border-white/50 dark:border-white/5 pb-4 text-slate-800 dark:text-white relative">
                  <div className="w-10 h-10 rounded-[14px] bg-white dark:bg-slate-800 shadow-sm border border-white/80 dark:border-white/10 flex items-center justify-center">
                    <Users className="w-5 h-5 text-primary" />
                  </div>
                  Staff Management
                </h3>
     
                {/* Add Staff Form */}
                <div className="bg-white/30 dark:bg-black/10 p-6 rounded-[24px] border border-white/45 dark:border-white/5 shadow-inner">
                  <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-6 border-b border-white/50 dark:border-white/5 pb-2">Register New Staff</h4>
                  <form onSubmit={handleAddStaff} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 items-end">
                    <div>
                      <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest block pl-1 mb-2">Name</label>
                      <input type="text" value={staffName} onChange={(e) => setStaffName(e.target.value)} className="w-full h-12 bg-white/60 dark:bg-black/20 backdrop-blur-md border border-white/40 dark:border-white/5 rounded-[16px] px-4 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all text-text-primary shadow-inner" placeholder="John Doe" />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest block pl-1 mb-2">Employee ID</label>
                      <input type="text" value={staffEmployeeId} onChange={(e) => setStaffEmployeeId(e.target.value)} className="w-full h-12 bg-white/60 dark:bg-black/20 backdrop-blur-md border border-white/40 dark:border-white/5 rounded-[16px] px-4 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all text-text-primary shadow-inner" placeholder="EMP123" />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest block pl-1 mb-2">Email</label>
                      <input type="email" value={staffEmail} onChange={(e) => setStaffEmail(e.target.value)} className="w-full h-12 bg-white/60 dark:bg-black/20 backdrop-blur-md border border-white/40 dark:border-white/5 rounded-[16px] px-4 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all text-text-primary shadow-inner" placeholder="john@example.com" />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest block pl-1 mb-2">Password</label>
                      <div className="relative flex items-center">
                        <input type={showStaffPin ? 'text' : 'password'} value={staffPin} onChange={(e) => setStaffPin(e.target.value)} className="w-full h-12 bg-white/60 dark:bg-black/20 backdrop-blur-md border border-white/40 dark:border-white/5 rounded-[16px] pl-4 pr-10 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all text-text-primary shadow-inner" placeholder="Min 6 chars" />
                        <button
                          type="button"
                          onClick={() => setShowStaffPin(!showStaffPin)}
                          className="absolute right-3.5 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 focus:outline-none transition-colors cursor-pointer"
                        >
                          {showStaffPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest block pl-1 mb-2">Role</label>
                      <select value={staffRole} onChange={(e) => setStaffRole(e.target.value as any)} className="w-full h-12 bg-white/60 dark:bg-black/20 backdrop-blur-md border border-white/40 dark:border-white/5 rounded-[16px] px-4 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all text-text-primary shadow-inner">
                        {rolesList.map(r => (
                          <option key={r.id} value={r.name}>{r.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="flex justify-end h-12 items-center">
                      <button type="submit" className="w-full sm:w-auto h-12 px-8 rounded-[16px] bg-primary hover:opacity-90 text-white font-bold text-sm tracking-wide transition-all shadow-lg shadow-primary/20 active:scale-[0.98] flex items-center justify-center gap-2">
                        <UserPlus className="w-4 h-4 !text-white" strokeWidth={2.5} />
                        <span>Add Staff</span>
                      </button>
                    </div>
                  </form>
                </div>
    
                {/* Staff List */}
                {staffList.length > 0 && (
                  <div className="mt-6">
                    <h4 className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest pl-1 border-b border-slate-200/50 dark:border-white/5 pb-2 mb-4">Active Staff</h4>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm text-slate-600 dark:text-slate-300">
                        <thead className="bg-slate-50 dark:bg-white/[0.02]">
                          <tr>
                            <th className="px-4 py-3 font-semibold rounded-tl-xl">Name</th>
                            <th className="px-4 py-3 font-semibold">Employee ID</th>
                            <th className="px-4 py-3 font-semibold">Email</th>
                            <th className="px-4 py-3 font-semibold">Role</th>
                            <th className="px-4 py-3 font-semibold rounded-tr-xl text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                          {staffList.map(member => (
                            <tr key={member.id} className="hover:bg-slate-50/50 dark:hover:bg-white/[0.02] transition-colors group">
                              <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-200">
                                {editingStaffId === member.id ? (
                                  <input type="text" value={editStaffName} onChange={e => setEditStaffName(e.target.value)} className="w-full h-8 bg-white dark:bg-[#070a14] border border-slate-300 dark:border-white/10 rounded px-2 text-sm focus:outline-none" />
                                ) : member.name}
                              </td>
                              <td className="px-4 py-3">
                                {editingStaffId === member.id ? (
                                  <input type="text" value={editStaffEmployeeId} onChange={e => setEditStaffEmployeeId(e.target.value)} className="w-full h-8 bg-white dark:bg-[#070a14] border border-slate-300 dark:border-white/10 rounded px-2 text-sm focus:outline-none" />
                                ) : member.employee_id}
                              </td>
                              <td className="px-4 py-3">
                                {editingStaffId === member.id ? (
                                  <input type="email" value={editStaffEmail} onChange={e => setEditStaffEmail(e.target.value)} className="w-full h-8 bg-white dark:bg-[#070a14] border border-slate-300 dark:border-white/10 rounded px-2 text-sm focus:outline-none" />
                                ) : member.email}
                              </td>
                              <td className="px-4 py-3 capitalize">
                                {editingStaffId === member.id ? (
                                  <select value={editStaffRole} onChange={e => setEditStaffRole(e.target.value as any)} className="w-full h-8 bg-white dark:bg-[#070a14] border border-slate-300 dark:border-white/10 rounded px-2 text-sm focus:outline-none">
                                    {rolesList.map(r => <option key={r.id} value={r.name}>{r.name}</option>)}
                                  </select>
                                ) : (
                                  <span className="px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 text-xs font-semibold">{member.role}</span>
                                )}
                              </td>
                              <td className="px-4 py-3 text-right">
                                <div className="flex justify-end gap-2 transition-opacity">
                                  {editingStaffId === member.id ? (
                                    <>
                                      <button onClick={() => handleUpdateStaff(member.id)} className="p-1.5 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 rounded-lg">
                                        <Save className="w-4 h-4" />
                                      </button>
                                      <button onClick={() => setEditingStaffId(null)} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg">
                                        <X className="w-4 h-4" />
                                      </button>
                                    </>
                                  ) : (
                                    <>
                                      <button onClick={() => { setEditingStaffId(member.id); setEditStaffName(member.name); setEditStaffRole(member.role as any); setEditStaffEmployeeId(member.employee_id || ''); setEditStaffEmail(member.email || ''); }} className="p-1.5 text-slate-500 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg">
                                        <Edit3 className="w-4 h-4" />
                                      </button>
                                      <button onClick={() => handleDeleteStaff(member.id, member.name)} className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-lg">
                                        <Trash2 className="w-4 h-4" />
                                      </button>
                                    </>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
    
              {/* CUSTOM ROLES MANAGEMENT */}
              <div className="space-y-8 bg-white/40 dark:bg-slate-800/40 backdrop-blur-3xl p-8 rounded-[32px] border border-white/60 dark:border-white/10 shadow-[0_8px_30px_rgb(0,0,0,0.06)] relative overflow-hidden group">
                <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-white/20 dark:from-white/5 to-transparent pointer-events-none"></div>
                
                <h3 className="text-xl font-bold flex items-center gap-3 border-b border-white/50 dark:border-white/5 pb-4 text-slate-800 dark:text-white relative">
                  <div className="w-10 h-10 rounded-[14px] bg-white dark:bg-slate-800 shadow-sm border border-white/80 dark:border-white/10 flex items-center justify-center">
                    <Plus className="w-5 h-5 text-primary" />
                  </div>
                  Custom Roles
                </h3>
    
                <form onSubmit={handleAddRole} className="flex flex-col sm:flex-row gap-4 items-end max-w-lg relative z-10">
                  <div className="flex-1 w-full space-y-2">
                    <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest block pl-1">New Role Name</label>
                    <input type="text" value={newRoleName} onChange={(e) => setNewRoleName(e.target.value)} placeholder="e.g. Supervisor" className="w-full h-12 bg-white/60 dark:bg-black/20 backdrop-blur-md border border-white/40 dark:border-white/5 rounded-[16px] px-4 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all text-text-primary shadow-inner" />
                  </div>
                  <button type="submit" className="w-full sm:w-auto h-12 px-8 rounded-[16px] bg-primary hover:opacity-90 text-white font-bold text-sm tracking-wide transition-all shadow-lg shadow-primary/20 active:scale-[0.98]">
                    Add Role
                  </button>
                </form>
    
                {rolesList.length > 0 && (
                  <div className="mt-8 space-y-3 relative z-10 max-w-2xl">
                    <h4 className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest pl-1 border-b border-white/50 dark:border-white/5 pb-2 mb-4">Existing Roles</h4>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {rolesList.map(role => (
                        <div key={role.id} className="flex items-center justify-between p-3.5 bg-white/30 dark:bg-black/25 hover:bg-white/50 dark:hover:bg-black/40 rounded-2xl border border-white/40 dark:border-white/5 transition-all group/role">
                          {editingRoleId === role.id ? (
                            <input 
                              type="text" 
                              value={editRoleName}
                              onChange={e => setEditRoleName(e.target.value)}
                              className="h-9 bg-white/85 dark:bg-black/40 border border-white/45 dark:border-white/10 rounded-lg px-3 text-sm flex-1 mr-3 focus:outline-none"
                            />
                          ) : (
                            <span className="text-sm font-bold text-slate-700 dark:text-slate-200 capitalize pl-1">{role.name}</span>
                          )}
                        
                          <div className="flex gap-1.5 transition-opacity">
                            {editingRoleId === role.id ? (
                              <>
                                <button onClick={() => handleUpdateRole(role.id)} className="p-2 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 rounded-lg transition-colors">
                                  <ShieldCheck className="w-4 h-4" />
                                </button>
                                <button onClick={() => setEditingRoleId(null)} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg transition-colors">
                                  <Plus className="w-4 h-4 rotate-45" />
                                </button>
                              </>
                            ) : (
                              <>
                                <button onClick={() => { setEditingRoleId(role.id); setEditRoleName(role.name); }} className="p-2 text-slate-800 dark:text-slate-300 dark:text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-1000/10 rounded-lg transition-colors">
                                  <span className="sr-only">Edit</span>
                                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                </button>
                                <button onClick={() => handleDeleteRole(role.id, role.name)} className="p-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-lg transition-colors">
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* RESIDENTS TAB */}
          {activeTab === 'residents' && (
            <div className="space-y-8">
              {/* WINGS MANAGEMENT */}
              <div className="space-y-8 bg-white/40 dark:bg-slate-800/40 backdrop-blur-3xl p-8 rounded-[32px] border border-white/60 dark:border-white/10 shadow-[0_8px_30px_rgb(0,0,0,0.06)] relative overflow-hidden group">
                <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-white/20 dark:from-white/5 to-transparent pointer-events-none"></div>
                
                <h3 className="text-xl font-bold flex items-center gap-3 border-b border-white/50 dark:border-white/5 pb-4 text-slate-800 dark:text-white relative">
                  <div className="w-10 h-10 rounded-[14px] bg-white dark:bg-slate-800 shadow-sm border border-white/80 dark:border-white/10 flex items-center justify-center">
                    <Building className="w-5 h-5 text-primary" />
                  </div>
                  Wings Management
                </h3>
    
                <form onSubmit={handleAddWing} className="flex flex-col sm:flex-row gap-4 items-end max-w-lg relative z-10">
                  <div className="flex-1 w-full space-y-2">
                    <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest block pl-1">New Wing Name</label>
                    <input type="text" value={newWingName} onChange={(e) => setNewWingName(e.target.value)} placeholder="e.g. North Wing" className="w-full h-12 bg-white/60 dark:bg-black/20 backdrop-blur-md border border-white/40 dark:border-white/5 rounded-[16px] px-4 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all text-text-primary shadow-inner" />
                  </div>
                  <button type="submit" className="w-full sm:w-auto h-12 px-8 rounded-[16px] bg-primary hover:opacity-90 text-white font-bold text-sm tracking-wide transition-all shadow-lg shadow-primary/20 active:scale-[0.98]">
                    Add Wing
                  </button>
                </form>
    
                {wings.length > 0 && (
                  <div className="mt-8 space-y-3 relative z-10 max-w-2xl">
                    <h4 className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest pl-1 border-b border-white/50 dark:border-white/5 pb-2 mb-4">Existing Wings</h4>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {wings.map(wing => (
                        <div key={wing.id} className="flex items-center justify-between p-3.5 bg-white/30 dark:bg-black/25 hover:bg-white/50 dark:hover:bg-black/40 rounded-2xl border border-white/40 dark:border-white/5 transition-all group/wing">
                          <span className="text-sm font-bold text-slate-700 dark:text-slate-200 pl-1">{wing.name}</span>
                          <div className="flex gap-1.5 transition-opacity">
                            <button onClick={() => handleDeleteWing(wing.id, wing.name)} className="p-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-lg transition-colors">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* AI TAB */}
          {activeTab === 'ai' && (
            <div className="space-y-8">
              {/* AI CONFIGURATION MANAGEMENT */}
              <div className="space-y-8 bg-white/40 dark:bg-slate-800/40 backdrop-blur-3xl p-8 rounded-[32px] border border-white/60 dark:border-white/10 shadow-[0_8px_30px_rgb(0,0,0,0.06)] relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-full h-32 bg-gradient-to-b from-white/20 dark:from-white/5 to-transparent pointer-events-none"></div>
                
                <h3 className="text-xl font-bold flex items-center gap-3 border-b border-white/50 dark:border-white/5 pb-4 text-slate-800 dark:text-white relative">
                  <div className="w-10 h-10 rounded-[14px] bg-white dark:bg-slate-800 shadow-sm border border-white/80 dark:border-white/10 flex items-center justify-center">
                    <ShieldCheck className="w-5 h-5 text-primary" />
                  </div>
                  AI Engine Configuration
                </h3>
    
                <form onSubmit={handleSaveApiKeys} className="grid gap-8 sm:grid-cols-2 relative z-10">
                  {/* Active AI Engine Selector */}
                  <div className="sm:col-span-2 bg-white/30 dark:bg-black/10 p-6 rounded-[24px] border border-white/40 dark:border-white/5 space-y-5 shadow-inner">
                    <div>
                      <h4 className="text-base font-bold text-slate-800 dark:text-slate-200">Active AI Routing Policy</h4>
                      <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Select the primary AI engine or use auto-routing fallback.</p>
                    </div>
    
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
                      {[
                        { id: 'auto', label: 'Auto', desc: 'Fallback' },
                        { id: 'anthropic', label: 'Anthropic', desc: 'Claude' },
                        { id: 'openai', label: 'OpenAI', desc: 'GPT-4' },
                        { id: 'gemini', label: 'Gemini', desc: 'Google' },
                        { id: 'openrouter', label: 'OpenRouter', desc: 'Cloud API' },
                        { id: 'groq', label: 'Groq', desc: 'Ultra-fast' },
                        { id: 'ollama', label: 'Ollama', desc: 'Local' },
                        { id: 'mock', label: 'Demo', desc: 'Simulator' },
                      ].map((prov) => (
                        <button
                          key={prov.id}
                          type="button"
                          onClick={() => setActiveProvider(prov.id as any)}
                          className={`flex flex-col items-center justify-center text-center py-4 px-2 rounded-[20px] border transition-all duration-300 cursor-pointer ${
                            activeProvider === prov.id
                              ? 'border-primary bg-primary/10 dark:bg-primary/20 shadow-[0_4px_20px_rgba(13,148,136,0.15)] ring-1 ring-primary scale-105'
                              : 'border-white/40 dark:border-white/5 bg-white/40 dark:bg-black/20 hover:bg-white/60 dark:hover:bg-black/30 hover:-translate-y-1'
                          }`}
                        >
                          <span className={`font-bold text-sm ${activeProvider === prov.id ? 'text-primary' : 'text-slate-700 dark:text-slate-300'}`}>{prov.label}</span>
                          <span className={`text-[10px] mt-1 font-medium tracking-wide uppercase ${activeProvider === prov.id ? 'text-primary/80' : 'text-slate-500 dark:text-slate-400'}`}>{prov.desc}</span>
                        </button>
                      ))}
                    </div>
                    {/* Feature Flags Module Enablement */}
                    <div className="pt-4 border-t border-white/50 dark:border-white/5 space-y-4">
                      <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">Module Enablement (Feature Flags)</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <label className="flex items-center gap-3 p-3 bg-white/45 dark:bg-black/20 border border-white/40 dark:border-white/5 rounded-xl cursor-pointer hover:bg-white/60 dark:hover:bg-black/30 select-none">
                          <input
                            type="checkbox"
                            checked={sentinelEnabled}
                            onChange={(e) => setSentinelEnabled(e.target.checked)}
                            className="w-4 h-4 rounded text-primary focus:ring-primary border-white/40"
                          />
                          <div>
                            <span className="text-xs font-bold block text-slate-800 dark:text-slate-200">Sentinel Core</span>
                            <span className="text-[10px] text-text-secondary block">Compliance & Escalations</span>
                          </div>
                        </label>
    
                        <label className="flex items-center gap-3 p-3 bg-white/45 dark:bg-black/20 border border-white/40 dark:border-white/5 rounded-xl cursor-pointer hover:bg-white/60 dark:hover:bg-black/30 select-none">
                          <input
                            type="checkbox"
                            checked={chronicleEnabled}
                            onChange={(e) => setChronicleEnabled(e.target.checked)}
                            className="w-4 h-4 rounded text-primary focus:ring-primary border-white/40"
                          />
                          <div>
                            <span className="text-xs font-bold block text-slate-800 dark:text-slate-200">Chronicle NLP</span>
                            <span className="text-[10px] text-text-secondary block">Outbreak Cluster Tracking</span>
                          </div>
                        </label>
    
                        <label className="flex items-center gap-3 p-3 bg-white/45 dark:bg-black/20 border border-white/40 dark:border-white/5 rounded-xl cursor-pointer hover:bg-white/60 dark:hover:bg-black/30 select-none">
                          <input
                            type="checkbox"
                            checked={ariaEnabled}
                            onChange={(e) => setAriaEnabled(e.target.checked)}
                            className="w-4 h-4 rounded text-primary focus:ring-primary border-white/40"
                          />
                          <div>
                            <span className="text-xs font-bold block text-slate-800 dark:text-slate-200">Aria Voice</span>
                            <span className="text-[10px] text-text-secondary block">Speech-to-Vitals Parser</span>
                          </div>
                        </label>
                      </div>
                    </div>
                  </div>
    
                  <div className="space-y-3 bg-white/30 dark:bg-black/10 p-6 rounded-[24px] border border-white/40 dark:border-white/5 shadow-inner">
                    <div className="flex items-center gap-2 mb-2 border-b border-white/50 dark:border-white/5 pb-2">
                      <Key className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                      <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">Anthropic Claude (Official)</h4>
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest block pl-1">API Key</label>
                        <button type="button" onClick={() => testConnection('anthropic', anthropicKey)} disabled={testingConnection['anthropic'] || !anthropicKey} className="text-[10px] font-bold bg-white/50 dark:bg-black/30 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 px-3 py-1 rounded-full transition-all flex items-center gap-1 border border-slate-200/50 dark:border-white/5 disabled:opacity-50">
                          {testingConnection['anthropic'] ? <div className="w-3 h-3 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div> : connectionStatus['anthropic'] === 'success' ? <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)] animate-pulse"></div> : connectionStatus['anthropic'] === 'error' ? <div className="w-2 h-2 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)] animate-pulse"></div> : <Activity className="w-3 h-3" />}
                          Verify
                        </button>
                      </div>
                      <div className="relative">
                        <input
                          type={showAnthropic ? "text" : "password"}
                          value={anthropicKey}
                          onChange={(e) => setAnthropicKey(e.target.value)}
                          placeholder="sk-ant-..."
                          className="w-full h-12 bg-white/60 dark:bg-black/20 backdrop-blur-md border border-white/40 dark:border-white/5 rounded-[16px] pl-4 pr-10 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all text-text-primary shadow-inner font-mono"
                        />
                        <button
                          type="button"
                          onClick={() => setShowAnthropic(!showAnthropic)}
                          className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-650 dark:hover:text-slate-200 cursor-pointer outline-none focus:outline-none"
                        >
                          {showAnthropic ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  </div>
    
                  <div className="space-y-3 bg-white/30 dark:bg-black/10 p-6 rounded-[24px] border border-white/40 dark:border-white/5 shadow-inner">
                    <div className="flex items-center gap-2 mb-2 border-b border-white/50 dark:border-white/5 pb-2">
                      <Key className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                      <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">OpenAI (GPT-4 / O1)</h4>
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest block pl-1">API Key</label>
                        <button type="button" onClick={() => testConnection('openai', openaiKey)} disabled={testingConnection['openai'] || !openaiKey} className="text-[10px] font-bold bg-white/50 dark:bg-black/30 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 px-3 py-1 rounded-full transition-all flex items-center gap-1 border border-slate-200/50 dark:border-white/5 disabled:opacity-50">
                          {testingConnection['openai'] ? <div className="w-3 h-3 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div> : connectionStatus['openai'] === 'success' ? <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)] animate-pulse"></div> : connectionStatus['openai'] === 'error' ? <div className="w-2 h-2 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)] animate-pulse"></div> : <Activity className="w-3 h-3" />}
                          Verify
                        </button>
                      </div>
                      <div className="relative mb-3">
                        <input
                          type={showOpenai ? "text" : "password"}
                          value={openaiKey}
                          onChange={(e) => setOpenaiKey(e.target.value)}
                          placeholder="sk-proj-..."
                          className="w-full h-12 bg-white/60 dark:bg-black/20 backdrop-blur-md border border-white/40 dark:border-white/5 rounded-[16px] pl-4 pr-10 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all text-text-primary shadow-inner font-mono"
                        />
                        <button
                          type="button"
                          onClick={() => setShowOpenai(!showOpenai)}
                          className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-650 dark:hover:text-slate-200 cursor-pointer outline-none focus:outline-none"
                        >
                          {showOpenai ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                      <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest block mb-1.5 pl-1">Model</label>
                      <CustomModelSelector
                        value={openaiModel}
                        onChange={setOpenaiModel}
                        apiKey={openaiKey}
                        provider="openai"
                      />
                    </div>
                  </div>
    
                  <div className="space-y-3 bg-white/30 dark:bg-black/10 p-6 rounded-[24px] border border-white/40 dark:border-white/5 shadow-inner">
                    <div className="flex items-center gap-2 mb-2 border-b border-white/50 dark:border-white/5 pb-2">
                      <Key className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                      <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">Google Gemini</h4>
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest block pl-1">API Key</label>
                        <button type="button" onClick={() => testConnection('gemini', geminiKey)} disabled={testingConnection['gemini'] || !geminiKey} className="text-[10px] font-bold bg-white/50 dark:bg-black/30 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 px-3 py-1 rounded-full transition-all flex items-center gap-1 border border-slate-200/50 dark:border-white/5 disabled:opacity-50">
                          {testingConnection['gemini'] ? <div className="w-3 h-3 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div> : connectionStatus['gemini'] === 'success' ? <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)] animate-pulse"></div> : connectionStatus['gemini'] === 'error' ? <div className="w-2 h-2 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)] animate-pulse"></div> : <Activity className="w-3 h-3" />}
                          Verify
                        </button>
                      </div>
                      <div className="relative mb-3">
                        <input
                          type={showGemini ? "text" : "password"}
                          value={geminiKey}
                          onChange={(e) => setGeminiKey(e.target.value)}
                          placeholder="AIzaSy..."
                          className="w-full h-12 bg-white/60 dark:bg-black/20 backdrop-blur-md border border-white/40 dark:border-white/5 rounded-[16px] pl-4 pr-10 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all text-text-primary shadow-inner font-mono"
                        />
                        <button
                          type="button"
                          onClick={() => setShowGemini(!showGemini)}
                          className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-650 dark:hover:text-slate-200 cursor-pointer outline-none focus:outline-none"
                        >
                          {showGemini ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                      <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest block mb-1.5 pl-1">Model</label>
                      <CustomModelSelector
                        value={geminiModel}
                        onChange={setGeminiModel}
                        apiKey={geminiKey}
                        provider="gemini"
                      />
                    </div>
                  </div>
    
                  <div className="space-y-3 bg-white/30 dark:bg-black/10 p-6 rounded-[24px] border border-white/40 dark:border-white/5 shadow-inner">
                    <div className="flex items-center gap-2 mb-2 border-b border-white/50 dark:border-white/5 pb-2">
                      <Server className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                      <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">OpenRouter (Cloud Models)</h4>
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest block pl-1">API Key</label>
                        <button type="button" onClick={() => testConnection('openrouter', openrouterKey)} disabled={testingConnection['openrouter'] || !openrouterKey} className="text-[10px] font-bold bg-white/50 dark:bg-black/30 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 px-3 py-1 rounded-full transition-all flex items-center gap-1 border border-slate-200/50 dark:border-white/5 disabled:opacity-50">
                          {testingConnection['openrouter'] ? <div className="w-3 h-3 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div> : connectionStatus['openrouter'] === 'success' ? <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)] animate-pulse"></div> : connectionStatus['openrouter'] === 'error' ? <div className="w-2 h-2 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)] animate-pulse"></div> : <Activity className="w-3 h-3" />}
                          Verify
                        </button>
                      </div>
                      <div className="relative mb-3">
                        <input
                          type={showOpenrouter ? "text" : "password"}
                          value={openrouterKey}
                          onChange={(e) => setOpenrouterKey(e.target.value)}
                          placeholder="sk-or-v1-..."
                          className="w-full h-12 bg-white/60 dark:bg-black/20 backdrop-blur-md border border-white/40 dark:border-white/5 rounded-[16px] pl-4 pr-10 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all text-text-primary shadow-inner font-mono"
                        />
                        <button
                          type="button"
                          onClick={() => setShowOpenrouter(!showOpenrouter)}
                          className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-650 dark:hover:text-slate-200 cursor-pointer outline-none focus:outline-none"
                        >
                          {showOpenrouter ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                      <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest block mb-1.5 pl-1">Model</label>
                      <CustomModelSelector
                        value={openrouterModel}
                        onChange={setOpenrouterModel}
                        apiKey={openrouterKey}
                        provider="openrouter"
                      />
                    </div>
                  </div>
    
                  <div className="space-y-3 bg-white/30 dark:bg-black/10 p-6 rounded-[24px] border border-white/40 dark:border-white/5 shadow-inner">
                    <div className="flex items-center gap-2 mb-2 border-b border-white/50 dark:border-white/5 pb-2">
                      <Cpu className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                      <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">Groq (Llama 3 / Mixtral)</h4>
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest block pl-1">API Key</label>
                        <button type="button" onClick={() => testConnection('groq', groqKey)} disabled={testingConnection['groq'] || !groqKey} className="text-[10px] font-bold bg-white/50 dark:bg-black/30 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 px-3 py-1 rounded-full transition-all flex items-center gap-1 border border-slate-200/50 dark:border-white/5 disabled:opacity-50">
                          {testingConnection['groq'] ? <div className="w-3 h-3 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div> : connectionStatus['groq'] === 'success' ? <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)] animate-pulse"></div> : connectionStatus['groq'] === 'error' ? <div className="w-2 h-2 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)] animate-pulse"></div> : <Activity className="w-3 h-3" />}
                          Verify
                        </button>
                      </div>
                      <div className="relative mb-3">
                        <input
                          type={showGroq ? "text" : "password"}
                          value={groqKey}
                          onChange={(e) => setGroqKey(e.target.value)}
                          placeholder="gsk_..."
                          className="w-full h-12 bg-white/60 dark:bg-black/20 backdrop-blur-md border border-white/40 dark:border-white/5 rounded-[16px] pl-4 pr-10 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all text-text-primary shadow-inner font-mono"
                        />
                        <button
                          type="button"
                          onClick={() => setShowGroq(!showGroq)}
                          className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-650 dark:hover:text-slate-200 cursor-pointer outline-none focus:outline-none"
                        >
                          {showGroq ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                      <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest block mb-1.5 pl-1">Model</label>
                      <CustomModelSelector
                        value={groqModel}
                        onChange={setGroqModel}
                        apiKey={groqKey}
                        provider="groq"
                      />
                    </div>
                  </div>
    
                  <div className="space-y-3 bg-white/30 dark:bg-black/10 p-6 rounded-[24px] border border-white/40 dark:border-white/5 shadow-inner">
                    <div className="flex items-center gap-2 mb-2 border-b border-white/50 dark:border-white/5 pb-2">
                      <Server className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                      <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">Ollama (Local Offline)</h4>
                    </div>
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
                      <div>
                        <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest block mb-1.5 pl-1">Server URL</label>
                        <input
                          type="text"
                          value={ollamaUrl}
                          onChange={(e) => setOllamaUrl(e.target.value)}
                          placeholder="http://localhost:11434"
                          className="w-full h-12 bg-white/60 dark:bg-black/20 backdrop-blur-md border border-white/40 dark:border-white/5 rounded-[16px] px-4 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all text-text-primary shadow-inner font-mono"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest block mb-1.5 pl-1">Model Name</label>
                        <input
                          type="text"
                          value={ollamaModel}
                          onChange={(e) => setOllamaModel(e.target.value)}
                          placeholder="llama3"
                          className="w-full h-12 bg-white/60 dark:bg-black/20 backdrop-blur-md border border-white/40 dark:border-white/5 rounded-[16px] px-4 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all text-text-primary shadow-inner font-mono"
                        />
                      </div>
                    </div>
                  </div>
    
                  <div className="sm:col-span-2 mt-2">
                    <button
                      type="submit"
                      className="w-full h-12 bg-primary hover:opacity-90 text-white font-bold rounded-[16px] text-sm tracking-wide transition-all shadow-lg shadow-primary/20 active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <ShieldCheck className="w-4.5 h-4.5" />
                      Save AI Configuration
                    </button>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 text-center mt-3">
                      Keys are stored securely in your browser's local storage to prevent exposure.
                    </p>
                  </div>
                </form>
              </div>
            </div>
          )}

        </div>
      </main>
    </div>

      {/* Toast Notification */}
      {showToast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 bg-emerald-600 text-white px-5 py-3.5 rounded-2xl shadow-2xl shadow-emerald-600/30 animate-in slide-in-from-bottom-4 duration-300">
          <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center shrink-0">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-bold">Configuration Saved!</p>
            <p className="text-[11px] text-emerald-100">AI engine settings updated successfully.</p>
          </div>
        </div>
      )}
    </>
  );
}
