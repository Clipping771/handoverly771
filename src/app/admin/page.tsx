'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { ShieldCheck, Plus, Trash2, Building, Users, AlertCircle, RefreshCw, Sun, Moon, Search, ChevronDown, LogOut, UserPlus, Edit3, Save, X } from 'lucide-react';
import Link from 'next/link';

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
  const { user, facility, isLoading: authLoading, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const router = useRouter();

  // Seeding states
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [residents, setResidents] = useState<Resident[]>([]);
  const [wings, setWings] = useState<Wing[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Wings Form
  const [newWingName, setNewWingName] = useState('');
  const [selectedWingId, setSelectedWingId] = useState('');
  
  // Forms
  const [staffName, setStaffName] = useState('');
  const [staffRole, setStaffRole] = useState<'rn' | 'carer' | 'admin'>('carer');
  const [staffPin, setStaffPin] = useState('');
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
  const [openrouterModel, setOpenrouterModel] = useState('google/gemini-2.5-flash');
  const [ollamaUrl, setOllamaUrl] = useState('');
  const [ollamaModel, setOllamaModel] = useState('');
  const [groqKey, setGroqKey] = useState('');
  const [groqModel, setGroqModel] = useState('llama-3.3-70b-versatile');
  const [activeProvider, setActiveProvider] = useState<'auto' | 'anthropic' | 'openrouter' | 'groq' | 'ollama' | 'mock'>('auto');

  // OpenRouter live model search
  const [orModels, setOrModels] = useState<{id: string; name: string}[]>([]);
  const [orModelSearch, setOrModelSearch] = useState('');
  const [orModelsLoading, setOrModelsLoading] = useState(false);
  const [showOrModelList, setShowOrModelList] = useState(false);

  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');
  const [showToast, setShowToast] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/admin/login');
    }
  }, [user, authLoading, router]);

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
      const { error } = await supabase
        .from('roles')
        .update({ name: editRoleName.trim().toLowerCase() })
        .eq('id', id);
      if (error) throw error;
      setFeedback('Role updated successfully.');
      setEditingRoleId(null);
      loadData();
    } catch (err: any) {
      if (err.message.includes('unique')) {
        setError('That role already exists.');
      } else {
        setError(err.message || 'Failed to update role.');
      }
    }
  };

  const loadData = async () => {
    if (!facility) return;
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
        }
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
    try {
      const res = await fetch('/api/admin/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          facilityId: facility.id,
          activeProvider,
          userKeys: {
            anthropicKey,
            openrouterKey,
            openrouterModel,
            ollamaUrl,
            ollamaModel,
            groqKey,
            groqModel
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

  const fetchOrModels = async (key: string) => {
    if (!key) return;
    setOrModelsLoading(true);
    try {
      const res = await fetch(`/api/openrouter-models?apiKey=${encodeURIComponent(key)}`);
      const data = await res.json();
      if (data.models) setOrModels(data.models);
    } catch (e) {
      console.error('Failed to fetch OR models:', e);
    } finally {
      setOrModelsLoading(false);
    }
  };

  useEffect(() => {
    if (openrouterKey && openrouterKey.length > 10) {
      fetchOrModels(openrouterKey);
    }
  }, [openrouterKey]);

  // Loading guard re-enabled as system setup handles the bootstrapping now
  if (authLoading || !user || !facility) {
    return <div>Loading...</div>;
  }

  return (
    <>
    <div className="min-h-screen bg-slate-50 dark:bg-[#03040b] text-[#0f172a] dark:text-[#e2e8f0] flex flex-col pb-12 transition-colors duration-300 relative overflow-x-hidden">
      {/* Premium Background Gradients */}
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-slate-900/10 via-transparent to-transparent pointer-events-none z-0"></div>
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_bottom_left,_var(--tw-gradient-stops))] from-slate-800/10 via-transparent to-transparent pointer-events-none z-0"></div>
      
      {/* Subtle Grid */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#e2e8f0_1px,transparent_1px),linear-gradient(to_bottom,#e2e8f0_1px,transparent_1px)] dark:bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:4rem_4rem] opacity-30 pointer-events-none z-0"></div>

      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/70 dark:bg-[#0a0f1e]/60 backdrop-blur-2xl border-b border-slate-200/50 dark:border-white/5 px-4 py-4 sm:px-6 transition-all duration-300">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 dark:from-slate-700 dark:to-slate-800 flex items-center justify-center font-black text-sm text-white shadow-lg shadow-slate-500/20 dark:shadow-black/40 border border-white/10">
              ADM
            </div>
            <div>
              <h1 className="text-base font-bold text-slate-800 dark:text-white">{facility.name} Setup</h1>
              <p className="text-xs text-slate-600 dark:text-slate-400 flex items-center gap-1 font-semibold">
                <ShieldCheck className="w-3.5 h-3.5" />
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
            <h2 className="text-3xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-slate-900 to-slate-600 dark:from-white dark:to-slate-400">System Configuration</h2>
            <p className="text-slate-500 dark:text-slate-400 text-sm mt-1.5 font-medium">Manage facility settings, roles, and AI engines.</p>
          </div>
          <button 
            onClick={loadData}
            className="p-3 bg-white/80 dark:bg-[#111629]/80 backdrop-blur-md border border-slate-200/60 dark:border-white/5 hover:border-slate-400 dark:border-slate-500/30 dark:hover:border-slate-400 dark:border-slate-500/30 hover:shadow-[0_0_15px_rgba(0,0,0,0.1)] dark:shadow-[0_0_15px_rgba(255,255,255,0.05)] text-slate-500 hover:text-slate-800 dark:text-slate-300 dark:text-slate-400 dark:hover:text-slate-500 dark:text-slate-400 rounded-2xl transition-all duration-300 active:scale-95"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
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
          
          
          {/* STAFF MANAGEMENT */}
          <div className="space-y-8 bg-white/80 dark:bg-[#0d1326]/60 backdrop-blur-2xl border border-slate-200/50 dark:border-white/5 p-8 rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-slate-500/5 dark:from-slate-500/10 to-transparent pointer-events-none"></div>
            
            <h3 className="text-xl font-bold flex items-center gap-3 border-b border-slate-200/50 dark:border-white/5 pb-4 text-slate-800 dark:text-slate-100 relative">
              <div className="p-2 bg-slate-100 dark:bg-slate-1000/10 rounded-xl">
                <Users className="w-5 h-5 text-slate-800 dark:text-slate-300" />
              </div>
              Staff Management
            </h3>

            {/* Add Staff Form */}
            <div className="bg-slate-50/50 dark:bg-white/[0.02] p-6 rounded-2xl border border-slate-200/60 dark:border-white/5 shadow-inner">
              <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-6 border-b border-slate-200/50 dark:border-white/5 pb-2">Register New Staff</h4>
              <form onSubmit={handleAddStaff} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 items-end">
                <div>
                  <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest block pl-1 mb-2">Name</label>
                  <input type="text" value={staffName} onChange={(e) => setStaffName(e.target.value)} className="w-full h-11 bg-white dark:bg-[#070a14] border border-slate-200/80 dark:border-white/10 rounded-xl px-4 text-sm focus:outline-none focus:border-slate-400 dark:focus:border-slate-500/50" placeholder="John Doe" />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest block pl-1 mb-2">Employee ID</label>
                  <input type="text" value={staffEmployeeId} onChange={(e) => setStaffEmployeeId(e.target.value)} className="w-full h-11 bg-white dark:bg-[#070a14] border border-slate-200/80 dark:border-white/10 rounded-xl px-4 text-sm focus:outline-none focus:border-slate-400 dark:focus:border-slate-500/50" placeholder="EMP123" />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest block pl-1 mb-2">Email</label>
                  <input type="email" value={staffEmail} onChange={(e) => setStaffEmail(e.target.value)} className="w-full h-11 bg-white dark:bg-[#070a14] border border-slate-200/80 dark:border-white/10 rounded-xl px-4 text-sm focus:outline-none focus:border-slate-400 dark:focus:border-slate-500/50" placeholder="john@example.com" />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest block pl-1 mb-2">Password</label>
                  <input type="password" value={staffPin} onChange={(e) => setStaffPin(e.target.value)} className="w-full h-11 bg-white dark:bg-[#070a14] border border-slate-200/80 dark:border-white/10 rounded-xl px-4 text-sm focus:outline-none focus:border-slate-400 dark:focus:border-slate-500/50" placeholder="Min 6 chars" />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest block pl-1 mb-2">Role</label>
                  <select value={staffRole} onChange={(e) => setStaffRole(e.target.value as any)} className="w-full h-11 bg-white dark:bg-[#070a14] border border-slate-200/80 dark:border-white/10 rounded-xl px-4 text-sm focus:outline-none focus:border-slate-400 dark:focus:border-slate-500/50">
                    {rolesList.map(r => (
                      <option key={r.id} value={r.name}>{r.name}</option>
                    ))}
                  </select>
                </div>
                <div className="flex justify-end h-11 items-center">
                  <button type="submit" className="w-full sm:w-auto h-11 px-8 rounded-xl bg-gradient-to-r from-slate-900 to-slate-800 dark:from-slate-700 dark:to-slate-800 hover:from-slate-800 hover:to-slate-700 dark:hover:from-slate-600 dark:hover:to-slate-700 !text-white font-bold text-sm tracking-wide transition-all shadow-lg shadow-slate-500/20 dark:shadow-black/40 active:scale-[0.98] flex items-center justify-center gap-2">
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
                            <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
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

          {/* WINGS MANAGEMENT */}
          <div className="space-y-8 bg-white/80 dark:bg-[#0d1326]/60 backdrop-blur-2xl border border-slate-200/50 dark:border-white/5 p-8 rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-slate-500/5 dark:from-slate-500/10 to-transparent pointer-events-none"></div>
            
            <h3 className="text-xl font-bold flex items-center gap-3 border-b border-slate-200/50 dark:border-white/5 pb-4 text-slate-800 dark:text-slate-100 relative">
              <div className="p-2 bg-slate-100 dark:bg-slate-1000/10 rounded-xl">
                <Building className="w-5 h-5 text-slate-800 dark:text-slate-300 dark:text-slate-500 dark:text-slate-400" />
              </div>
              Wings Management
            </h3>

            <form onSubmit={handleAddWing} className="flex flex-col sm:flex-row gap-4 items-end max-w-lg relative z-10">
              <div className="flex-1 w-full space-y-2">
                <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest block pl-1">New Wing Name</label>
                <input type="text" value={newWingName} onChange={(e) => setNewWingName(e.target.value)} placeholder="e.g. North Wing" className="w-full h-12 bg-white dark:bg-[#070a14] border border-slate-200/80 dark:border-white/10 rounded-xl px-4 text-sm focus:outline-none focus:border-slate-400 dark:border-slate-500 dark:focus:border-slate-400 dark:border-slate-500/50 focus:ring-4 focus:ring-slate-500/10 dark:focus:ring-slate-500/20 text-slate-800 dark:text-slate-100 transition-all" />
              </div>
              <button type="submit" className="w-full sm:w-auto h-12 px-8 rounded-xl bg-gradient-to-r from-slate-900 to-slate-800 dark:from-slate-700 dark:to-slate-800 hover:from-slate-800 hover:to-slate-700 dark:hover:from-slate-600 dark:hover:to-slate-700 !text-white font-bold text-sm tracking-wide transition-all shadow-lg shadow-slate-500/20 dark:shadow-black/40 active:scale-[0.98]">
                Add Wing
              </button>
            </form>

            {wings.length > 0 && (
              <div className="mt-8 space-y-3 relative z-10 max-w-2xl">
                <h4 className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest pl-1 border-b border-slate-200/50 dark:border-white/5 pb-2 mb-4">Existing Wings</h4>
                <div className="grid gap-3 sm:grid-cols-2">
                  {wings.map(wing => (
                    <div key={wing.id} className="flex items-center justify-between p-3.5 bg-slate-50/50 dark:bg-white/[0.02] hover:bg-white dark:hover:bg-white/[0.04] rounded-2xl border border-slate-200/60 dark:border-white/5 transition-all group/wing">
                      <span className="text-sm font-bold text-slate-700 dark:text-slate-200 pl-1">{wing.name}</span>
                      <div className="flex gap-1.5 opacity-80 sm:opacity-0 sm:group-hover/wing:opacity-100 transition-opacity">
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

          {/* CUSTOM ROLES MANAGEMENT */}
          <div className="space-y-8 bg-white/80 dark:bg-[#0d1326]/60 backdrop-blur-2xl border border-slate-200/50 dark:border-white/5 p-8 rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none relative overflow-hidden group">
            {/* Subtle glow effect behind card title */}
            <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-slate-500/5 dark:from-slate-500/10 to-transparent pointer-events-none"></div>
            
            <h3 className="text-xl font-bold flex items-center gap-3 border-b border-slate-200/50 dark:border-white/5 pb-4 text-slate-800 dark:text-slate-100 relative">
              <div className="p-2 bg-slate-100 dark:bg-slate-1000/10 rounded-xl">
                <Plus className="w-5 h-5 text-slate-800 dark:text-slate-300 dark:text-slate-500 dark:text-slate-400" />
              </div>
              Custom Roles
            </h3>

            <form onSubmit={handleAddRole} className="flex flex-col sm:flex-row gap-4 items-end max-w-lg relative z-10">
              <div className="flex-1 w-full space-y-2">
                <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest block pl-1">New Role Name</label>
                <input type="text" value={newRoleName} onChange={(e) => setNewRoleName(e.target.value)} placeholder="e.g. Supervisor" className="w-full h-12 bg-white dark:bg-[#070a14] border border-slate-200/80 dark:border-white/10 rounded-xl px-4 text-sm focus:outline-none focus:border-slate-400 dark:border-slate-500 dark:focus:border-slate-400 dark:border-slate-500/50 focus:ring-4 focus:ring-slate-500/10 dark:focus:ring-slate-500/20 text-slate-800 dark:text-slate-100 transition-all" />
              </div>
              <button type="submit" className="w-full sm:w-auto h-12 px-8 rounded-xl bg-gradient-to-r from-slate-900 to-slate-800 dark:from-slate-700 dark:to-slate-800 hover:from-slate-800 hover:to-slate-700 dark:hover:from-slate-600 dark:hover:to-slate-700 !text-white font-bold text-sm tracking-wide transition-all shadow-lg shadow-slate-500/20 dark:shadow-black/40 active:scale-[0.98]">
                Add Role
              </button>
            </form>

            {rolesList.length > 0 && (
              <div className="mt-8 space-y-3 relative z-10 max-w-2xl">
                <h4 className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest pl-1 border-b border-slate-200/50 dark:border-white/5 pb-2 mb-4">Existing Roles</h4>
                <div className="grid gap-3 sm:grid-cols-2">
                  {rolesList.map(role => (
                    <div key={role.id} className="flex items-center justify-between p-3.5 bg-slate-50/50 dark:bg-white/[0.02] hover:bg-white dark:hover:bg-white/[0.04] rounded-2xl border border-slate-200/60 dark:border-white/5 transition-all group/role">
                      {editingRoleId === role.id ? (
                        <input 
                          type="text" 
                          value={editRoleName}
                          onChange={e => setEditRoleName(e.target.value)}
                          className="h-9 bg-white dark:bg-[#070a14] border border-slate-300 dark:border-white/10 rounded-lg px-3 text-sm flex-1 mr-3 focus:outline-none focus:border-slate-400 dark:border-slate-500 focus:ring-2 focus:ring-slate-500/20 transition-all shadow-inner"
                        />
                      ) : (
                        <span className="text-sm font-bold text-slate-700 dark:text-slate-200 capitalize pl-1">{role.name}</span>
                      )}
                    
                      <div className="flex gap-1.5 opacity-80 sm:opacity-0 sm:group-hover/role:opacity-100 transition-opacity">
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

          {/* AI CONFIGURATION MANAGEMENT */}
          <div className="space-y-8 bg-white/80 dark:bg-[#0d1326]/60 backdrop-blur-2xl border border-slate-200/50 dark:border-white/5 p-8 rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-full h-32 bg-gradient-to-b from-slate-500/5 dark:from-slate-500/10 to-transparent pointer-events-none"></div>
            
            <h3 className="text-xl font-bold flex items-center gap-3 border-b border-slate-200/50 dark:border-white/5 pb-4 text-slate-800 dark:text-slate-100 relative">
              <div className="p-2 bg-slate-100 dark:bg-slate-1000/10 rounded-xl">
                <ShieldCheck className="w-5 h-5 text-slate-800 dark:text-slate-300 dark:text-slate-500 dark:text-slate-400" />
              </div>
              AI Engine Configuration
            </h3>

            <form onSubmit={handleSaveApiKeys} className="grid gap-8 sm:grid-cols-2 relative z-10">
              {/* Active AI Engine Selector */}
              <div className="sm:col-span-2 bg-slate-50/50 dark:bg-white/[0.02] p-6 rounded-2xl border border-slate-200/60 dark:border-white/5 space-y-5 shadow-inner">
                <div>
                  <h4 className="text-base font-bold text-slate-800 dark:text-slate-200">Active AI Routing Policy</h4>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Select the primary AI engine or use auto-routing fallback.</p>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
                  {[
                    { id: 'auto', label: 'Auto', desc: 'Fallback' },
                    { id: 'anthropic', label: 'Anthropic', desc: 'Claude' },
                    { id: 'openrouter', label: 'OpenRouter', desc: 'Cloud API' },
                    { id: 'groq', label: 'Groq', desc: 'Ultra-fast' },
                    { id: 'ollama', label: 'Ollama', desc: 'Local' },
                    { id: 'mock', label: 'Demo', desc: 'Simulator' },
                  ].map((prov) => (
                    <button
                      key={prov.id}
                      type="button"
                      onClick={() => setActiveProvider(prov.id as any)}
                      className={`flex flex-col items-center justify-center text-center py-4 px-2 rounded-2xl border transition-all duration-300 cursor-pointer ${
                        activeProvider === prov.id
                          ? 'border-slate-400 dark:border-slate-500 bg-slate-100/80 dark:bg-slate-1000/10 text-slate-900 dark:text-slate-200 dark:text-slate-500 dark:text-slate-400 shadow-[0_0_15px_rgba(0,0,0,0.15)] dark:shadow-[0_0_15px_rgba(255,255,255,0.05)] scale-105'
                          : 'border-slate-200 dark:border-white/10 bg-white dark:bg-[#070a14] hover:border-slate-300 dark:hover:border-white/20 text-slate-600 dark:text-slate-400 hover:-translate-y-1'
                      }`}
                    >
                      <span className="font-bold text-sm">{prov.label}</span>
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 mt-1 font-medium tracking-wide uppercase">{prov.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300">Anthropic Claude (Official)</h4>
                <div>
                  <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest block mb-1.5 pl-1">API Key</label>
                  <input
                    type="password"
                    value={anthropicKey}
                    onChange={(e) => setAnthropicKey(e.target.value)}
                    placeholder="sk-ant-..."
                    className="w-full h-12 bg-white dark:bg-[#070a14] border border-slate-200/80 dark:border-white/10 rounded-xl px-4 text-sm focus:outline-none focus:border-slate-400 dark:border-slate-500 dark:focus:border-slate-400 dark:border-slate-500/50 focus:ring-4 focus:ring-slate-500/10 dark:focus:ring-slate-500/20 text-slate-800 dark:text-slate-100 transition-all"
                  />
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300">OpenRouter (Cloud Models)</h4>
                <div>
                  <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest block mb-1.5 pl-1">API Key</label>
                  <input
                    type="password"
                    value={openrouterKey}
                    onChange={(e) => setOpenrouterKey(e.target.value)}
                    placeholder="sk-or-v1-..."
                    className="w-full h-12 bg-white dark:bg-[#070a14] border border-slate-200/80 dark:border-white/10 rounded-xl px-4 text-sm focus:outline-none focus:border-slate-400 dark:border-slate-500 dark:focus:border-slate-400 dark:border-slate-500/50 focus:ring-4 focus:ring-slate-500/10 dark:focus:ring-slate-500/20 text-slate-800 dark:text-slate-100 transition-all"
                  />
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300">Groq (Llama 3 / Mixtral)</h4>
                <div>
                  <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest block mb-1.5 pl-1">API Key</label>
                  <input
                    type="password"
                    value={groqKey}
                    onChange={(e) => setGroqKey(e.target.value)}
                    placeholder="gsk_..."
                    className="w-full h-12 bg-white dark:bg-[#070a14] border border-slate-200/80 dark:border-white/10 rounded-xl px-4 text-sm focus:outline-none focus:border-slate-400 dark:border-slate-500 dark:focus:border-slate-400 dark:border-slate-500/50 focus:ring-4 focus:ring-slate-500/10 dark:focus:ring-slate-500/20 text-slate-800 dark:text-slate-100 transition-all mb-3"
                  />
                  <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest block mb-1.5 pl-1">Model</label>
                  <select
                    value={groqModel}
                    onChange={(e) => setGroqModel(e.target.value)}
                    className="w-full h-12 bg-white dark:bg-[#070a14] border border-slate-200/80 dark:border-white/10 rounded-xl px-4 text-sm focus:outline-none focus:border-slate-400 dark:border-slate-500 dark:focus:border-slate-400 dark:border-slate-500/50 focus:ring-4 focus:ring-slate-500/10 dark:focus:ring-slate-500/20 text-slate-800 dark:text-slate-100 transition-all"
                  >
                    <option value="llama-3.3-70b-versatile">Llama 3.3 70B (Recommended)</option>
                    <option value="llama-3.1-8b-instant">Llama 3.1 8B Instant</option>
                    <option value="gemma2-9b-it">Gemma 2 9B IT</option>
                    <option value="mixtral-8x7b-32768">Mixtral 8x7B</option>
                  </select>
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300">Ollama (Local Offline)</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest block mb-1.5 pl-1">Server URL</label>
                    <input
                      type="text"
                      value={ollamaUrl}
                      onChange={(e) => setOllamaUrl(e.target.value)}
                      placeholder="http://localhost:11434"
                      className="w-full h-12 bg-white dark:bg-[#070a14] border border-slate-200/80 dark:border-white/10 rounded-xl px-4 text-sm focus:outline-none focus:border-slate-400 dark:border-slate-500 dark:focus:border-slate-400 dark:border-slate-500/50 focus:ring-4 focus:ring-slate-500/10 dark:focus:ring-slate-500/20 text-slate-800 dark:text-slate-100 transition-all"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest block mb-1.5 pl-1">Model Name</label>
                    <input
                      type="text"
                      value={ollamaModel}
                      onChange={(e) => setOllamaModel(e.target.value)}
                      placeholder="llama3"
                      className="w-full h-12 bg-white dark:bg-[#070a14] border border-slate-200/80 dark:border-white/10 rounded-xl px-4 text-sm focus:outline-none focus:border-slate-400 dark:border-slate-500 dark:focus:border-slate-400 dark:border-slate-500/50 focus:ring-4 focus:ring-slate-500/10 dark:focus:ring-slate-500/20 text-slate-800 dark:text-slate-100 transition-all"
                    />
                  </div>
                </div>
              </div>

              <div className="sm:col-span-2 mt-2">
                <button
                  type="submit"
                  className="w-full h-12 bg-slate-800 hover:bg-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600 !text-white font-semibold rounded-xl text-sm transition-colors flex items-center justify-center gap-2 cursor-pointer"
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
