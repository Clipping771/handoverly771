'use client';

import React, { useState, useEffect } from 'react';
import { useTheme } from '@/context/ThemeContextProvider';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { ShieldCheck, Plus, Building, UserPlus, AlertCircle, RefreshCw, Sun, Moon, Lock, Eye, EyeOff, Edit3, Trash2, Save, X } from 'lucide-react';
import Link from 'next/link';

interface Facility {
  id: string;
  name: string;
  code: string;
}

export default function SystemAdminSetup() {
  const { theme, toggleTheme } = useTheme();
  const router = useRouter();

  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [admins, setAdmins] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [masterPassword, setMasterPassword] = useState('');
  const [showMasterPassword, setShowMasterPassword] = useState(false);

  // Facility Form
  const [newFacName, setNewFacName] = useState('');
  const [newFacCode, setNewFacCode] = useState('');
  const [editingFacilityId, setEditingFacilityId] = useState<string | null>(null);
  const [editFacName, setEditFacName] = useState('');
  const [editFacCode, setEditFacCode] = useState('');

  // Admin Form
  const [adminName, setAdminName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminEmpId, setAdminEmpId] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [showAdminPassword, setShowAdminPassword] = useState(false);
  const [selectedFacilityId, setSelectedFacilityId] = useState('');

  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');
  const [facFeedback, setFacFeedback] = useState('');
  const [facError, setFacError] = useState('');
  const [adminFeedback, setAdminFeedback] = useState('');
  const [adminError, setAdminError] = useState('');

  const loadFacilities = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/auth/create-admin');
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to fetch bootstrap data');
      
      const facData = json.facilities || [];
      const adminData = json.admins || [];
      setFacilities(facData);
      setAdmins(adminData);
      
      if (facData.length > 0 && !selectedFacilityId) {
        setSelectedFacilityId(facData[0].id);
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to load facilities.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      loadFacilities();
    }
  }, [isAuthenticated]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    // For MVP, simple master password check or open access.
    // Replace 'admin123' with environment variable or more secure check if desired.
    if (masterPassword === 'admin123' || masterPassword === 'handoverly') {
      setIsAuthenticated(true);
      setError('');
    } else {
      setError('Invalid master password.');
    }
  };

  const handleAddFacility = async (e: React.FormEvent) => {
    e.preventDefault();
    setFacError('');
    setFacFeedback('');
    try {
      if (!newFacName || !newFacCode) {
        throw new Error('Please provide both Facility Name and Code.');
      }

      const res = await fetch('/api/facilities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newFacName.trim(),
          code: newFacCode.trim()
        })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to create facility');

      setFacFeedback(`Facility "${newFacName}" created successfully.`);
      setNewFacName('');
      setNewFacCode('');
      loadFacilities();
    } catch (err: any) {
      setFacError(err.message || 'Failed to create facility. Ensure the code is unique.');
    }
  };

  const handleDeleteFacility = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete the facility "${name}"? This action cannot be undone.`)) return;
    setFacError('');
    setFacFeedback('');
    try {
      const res = await fetch('/api/facilities', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to delete facility');

      setFacFeedback(`Facility "${name}" deleted successfully.`);
      if (selectedFacilityId === id) setSelectedFacilityId('');
      loadFacilities();
    } catch (err: any) {
      setFacError(err.message || 'Failed to delete facility.');
    }
  };

  const handleUpdateFacility = async (id: string) => {
    setFacError('');
    setFacFeedback('');
    try {
      const res = await fetch('/api/facilities', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          name: editFacName.trim(),
          code: editFacCode.trim()
        })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to update facility');

      setFacFeedback(`Facility updated successfully.`);
      setEditingFacilityId(null);
      loadFacilities();
    } catch (err: any) {
      setFacError(err.message || 'Failed to update facility.');
    }
  };

  const handleCreateAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminError('');
    setAdminFeedback('');
    try {
      if (!selectedFacilityId || !adminName || !adminEmail || !adminEmpId || !adminPassword) {
        throw new Error('Please fill in all fields to create an admin.');
      }

      const res = await fetch('/api/auth/create-admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          facilityId: selectedFacilityId,
          name: adminName,
          email: adminEmail,
          employeeId: adminEmpId,
          password: adminPassword
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to create admin account');
      }

      setAdminFeedback(`Admin account for "${adminName}" created successfully. They can now log in.`);
      setAdminName('');
      setAdminEmail('');
      setAdminEmpId('');
      setAdminPassword('');
      loadFacilities();
    } catch (err: any) {
      setAdminError(err.message || 'Failed to create admin.');
    }
  };

  const handleDeleteAdmin = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete the admin account for "${name}"?`)) return;
    setAdminError('');
    setAdminFeedback('');
    try {
      const res = await fetch('/api/auth/delete-staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to delete admin');
      setAdminFeedback(`Admin "${name}" deleted successfully.`);
      loadFacilities();
    } catch (err: any) {
      setAdminError(err.message || 'Failed to delete admin.');
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-transparent transition-colors duration-700 p-4 relative font-sans">
        
        {/* The global ambient mesh from layout.tsx shines through */}

        <div className="max-w-md w-full bg-white/40 dark:bg-[#0f172a]/40 backdrop-blur-3xl p-10 rounded-[40px] border border-white/60 dark:border-white/10 shadow-[0_8px_30px_rgb(0,0,0,0.08)]">
          <div className="text-center mb-10">
            <div className="w-20 h-20 rounded-[24px] bg-white dark:bg-slate-800 shadow-md border border-white/80 dark:border-white/10 mx-auto flex items-center justify-center mb-6">
              <ShieldCheck className="w-9 h-9 text-primary" strokeWidth={1.5} />
            </div>
            <h1 className="text-2xl font-bold text-slate-800 dark:text-white">System Setup</h1>
            <p className="text-[10px] font-bold text-text-secondary uppercase tracking-widest mt-2">Enter master password to bootstrap facilities</p>
          </div>
          
          <form onSubmit={handleLogin} className="space-y-6 mt-8">
            <div className="space-y-2 group/input">
              <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest pl-1">Master Password</label>
              <div className="relative flex items-center">
                <Lock className="absolute left-4 w-5 h-5 text-slate-400 group-focus-within/input:text-indigo-500 transition-colors z-10" />
                <input
                  type={showMasterPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={masterPassword}
                  onChange={(e) => setMasterPassword(e.target.value)}
                  className="w-full h-14 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl pl-12 pr-12 text-sm font-medium tracking-wider text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-all shadow-sm hover:border-indigo-500/50"
                />
                <button
                  type="button"
                  onClick={() => setShowMasterPassword(!showMasterPassword)}
                  className="absolute right-4 p-1 text-slate-400 hover:text-indigo-500 focus:outline-none transition-colors cursor-pointer z-10"
                >
                  {showMasterPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>
            {error && (
              <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-500/10 border border-rose-100 dark:border-rose-500/20 text-[12px] font-bold text-rose-600 dark:text-rose-400 text-center shadow-sm">
                {error}
              </div>
            )}
            <button
              type="submit"
              className="w-full h-14 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white font-bold rounded-2xl text-sm tracking-wide transition-all shadow-xl shadow-indigo-500/25 active:scale-[0.98] overflow-hidden relative group"
            >
              <div className="absolute inset-0 w-[200%] h-full bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-[150%] hover:animate-[sheen_1.5s_infinite]"></div>
              <span className="relative z-10">Unlock Setup</span>
            </button>
            <div className="text-center mt-6">
              <Link href="/" className="text-[10px] font-bold text-text-secondary uppercase tracking-widest hover:text-primary transition-colors flex items-center justify-center gap-1">
                &larr; Return to Login
              </Link>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-transparent text-[#0f172a] dark:text-[#e2e8f0] flex flex-col pb-12 transition-colors duration-700 relative font-sans">
      
      {/* Global layout.tsx Mesh Gradient shines through */}

      <header className="sticky top-0 z-40 bg-white/40 dark:bg-slate-900/40 backdrop-blur-3xl border-b border-white/60 dark:border-white/5 px-4 py-4 sm:px-6 transition-colors duration-300">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-[20px] bg-white dark:bg-slate-800 flex items-center justify-center font-bold text-sm shadow-[0_8px_30px_rgb(0,0,0,0.06)] border border-white/80 dark:border-white/10">
              <ShieldCheck className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-800 dark:text-white tracking-wide">System Admin Setup</h1>
              <p className="text-[10px] font-bold text-text-secondary uppercase tracking-widest mt-0.5">
                Superuser Bootstrap Panel
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={toggleTheme}
              className="p-3 rounded-full bg-white/60 dark:bg-black/40 backdrop-blur-md border border-white/40 dark:border-white/5 text-text-secondary shadow-sm transition-all duration-200 hover:bg-white/80 dark:hover:bg-white/10 hover:scale-105"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-primary" />}
            </button>
            <Link
              href="/"
              className="px-5 py-2.5 rounded-full bg-white/60 dark:bg-black/40 backdrop-blur-md border border-white/40 dark:border-white/5 text-[11px] font-bold text-text-primary uppercase tracking-widest hover:bg-white/80 dark:hover:bg-white/10 transition-colors shadow-sm"
            >
              Exit Setup
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-[1200px] mx-auto w-full px-4 mt-12 flex-1 relative z-10">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-12 gap-4">
          <div>
            <h2 className="text-4xl font-black tracking-tight bg-gradient-to-br from-slate-900 to-slate-500 dark:from-white dark:to-slate-400 bg-clip-text text-transparent">
              Facility Bootstrap
            </h2>
            <p className="text-[13px] font-bold text-text-secondary mt-1.5 uppercase tracking-widest">
              Initialize core infrastructure & administrators
            </p>
          </div>
          <button 
            onClick={loadFacilities}
            className="p-3 bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl border border-slate-200/60 dark:border-white/10 text-slate-600 dark:text-slate-300 rounded-full hover:bg-white dark:hover:bg-slate-700 transition-all shadow-sm hover:shadow-md active:scale-95 group"
            title="Refresh Facilities"
          >
            <RefreshCw className="w-5 h-5 group-hover:rotate-180 transition-transform duration-500" />
          </button>
        </div>



        <div className="grid gap-8 lg:grid-cols-2">
          
          {/* FACILITY CREATION */}
          <div className="bg-white/90 dark:bg-[#111827]/80 backdrop-blur-3xl p-8 sm:p-10 rounded-[32px] border border-white dark:border-white/5 shadow-2xl shadow-indigo-500/5 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 dark:bg-indigo-500/20 blur-[80px] rounded-full pointer-events-none -z-10 translate-x-1/2 -translate-y-1/2"></div>
            
            <h3 className="text-2xl font-black flex items-center gap-4 mb-8 text-slate-800 dark:text-white relative">
              <div className="w-12 h-12 rounded-[16px] bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-indigo-500/20 dark:to-blue-500/20 shadow-inner border border-indigo-100 dark:border-indigo-500/30 flex items-center justify-center">
                <Building className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
              </div>
              <span className="bg-gradient-to-r from-slate-900 to-slate-700 dark:from-white dark:to-slate-300 bg-clip-text text-transparent">1. Register Facility</span>
            </h3>

            <form onSubmit={handleAddFacility} className="grid gap-5 sm:grid-cols-2 items-end">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest pl-1">Facility Name</label>
                <input
                  type="text"
                  placeholder="e.g. SunnyCare Sydney"
                  value={newFacName}
                  onChange={(e) => setNewFacName(e.target.value)}
                  className="w-full h-12 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl px-4 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-all text-slate-900 dark:text-white shadow-sm hover:border-indigo-500/50"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest pl-1">Facility Code</label>
                <input
                  type="text"
                  placeholder="e.g. SYD001"
                  value={newFacCode}
                  onChange={(e) => setNewFacCode(e.target.value)}
                  className="w-full h-12 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl px-4 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-all text-slate-900 dark:text-white shadow-sm hover:border-indigo-500/50"
                />
              </div>
              <button
                type="submit"
                className="h-12 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white font-bold rounded-2xl text-sm tracking-wide transition-all shadow-lg shadow-indigo-500/25 flex items-center justify-center gap-2 sm:col-span-2 active:scale-[0.98] overflow-hidden relative"
              >
                <div className="absolute inset-0 w-[200%] h-full bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-[150%] hover:animate-[sheen_1.5s_infinite]"></div>
                <Plus className="w-5 h-5 relative z-10" />
                <span className="relative z-10">Register Facility</span>
              </button>
            </form>

            {facFeedback && (
              <div className="mt-4 p-3.5 rounded-2xl bg-green-50/80 dark:bg-green-500/10 border border-green-100 dark:border-green-500/20 text-[11px] font-bold text-green-700 dark:text-green-400 backdrop-blur-md shadow-sm text-center">
                {facFeedback}
              </div>
            )}
            {facError && (
              <div className="mt-4 p-3.5 rounded-2xl bg-red-50/80 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20 text-[11px] font-bold text-red-600 dark:text-red-400 flex items-center gap-2 backdrop-blur-md shadow-sm justify-center">
                <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                <span>{facError}</span>
              </div>
            )}

            <div className="border border-white/50 dark:border-white/5 rounded-[24px] overflow-hidden bg-white/30 dark:bg-black/20 backdrop-blur-md shadow-sm mt-8">
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="bg-white/40 dark:bg-white/5 border-b border-white/50 dark:border-white/5 text-[10px] font-bold uppercase tracking-widest text-text-secondary">
                    <th className="p-4">Facility Name</th>
                    <th className="p-4">Code</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/40 dark:divide-white/5">
                  {facilities.map((fac) => (
                    <tr key={fac.id} className="hover:bg-white/50 dark:hover:bg-white/10 transition-colors group/row">
                      <td className="p-4 font-semibold text-slate-800 dark:text-slate-200">
                        {editingFacilityId === fac.id ? (
                          <input type="text" value={editFacName} onChange={e => setEditFacName(e.target.value)} className="w-full h-8 bg-white/80 dark:bg-black/40 border border-white/60 dark:border-white/10 rounded px-2 text-sm focus:outline-none" />
                        ) : fac.name}
                      </td>
                      <td className="p-4 font-mono font-medium text-text-secondary">
                        {editingFacilityId === fac.id ? (
                          <input type="text" value={editFacCode} onChange={e => setEditFacCode(e.target.value)} className="w-full h-8 bg-white/80 dark:bg-black/40 border border-white/60 dark:border-white/10 rounded px-2 text-sm focus:outline-none" />
                        ) : fac.code}
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex justify-end gap-2 transition-opacity">
                          {editingFacilityId === fac.id ? (
                            <>
                              <button onClick={() => handleUpdateFacility(fac.id)} className="p-2.5 text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10 rounded-xl hover:bg-emerald-100 dark:hover:bg-emerald-500/20 transition-colors shadow-sm">
                                <Save className="w-4 h-4" />
                              </button>
                              <button onClick={() => setEditingFacilityId(null)} className="p-2.5 text-slate-500 bg-slate-100 dark:bg-slate-800 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors shadow-sm">
                                <X className="w-4 h-4" />
                              </button>
                            </>
                          ) : (
                            <>
                              <button onClick={() => { setEditingFacilityId(fac.id); setEditFacName(fac.name); setEditFacCode(fac.code); }} className="p-2.5 text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors shadow-sm">
                                <Edit3 className="w-4 h-4" />
                              </button>
                              <button onClick={() => handleDeleteFacility(fac.id, fac.name)} className="p-2.5 text-rose-500 bg-rose-50 dark:bg-rose-500/10 rounded-xl hover:bg-rose-100 dark:hover:bg-rose-500/20 transition-colors shadow-sm">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {facilities.length === 0 && !loading && (
                    <tr><td colSpan={3} className="p-6 text-center text-text-secondary font-semibold">No facilities found.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* ADMIN CREATION */}
          <div className="bg-white/90 dark:bg-[#111827]/80 backdrop-blur-3xl p-8 sm:p-10 rounded-[32px] border border-white dark:border-white/5 shadow-2xl shadow-emerald-500/5 relative overflow-hidden group">
            <div className="absolute bottom-0 right-0 w-64 h-64 bg-emerald-500/10 dark:bg-emerald-500/20 blur-[80px] rounded-full pointer-events-none -z-10 translate-x-1/3 translate-y-1/3"></div>

            <h3 className="text-2xl font-black flex items-center gap-4 mb-8 text-slate-800 dark:text-white relative">
              <div className="w-12 h-12 rounded-[16px] bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-500/20 dark:to-teal-500/20 shadow-inner border border-emerald-100 dark:border-emerald-500/30 flex items-center justify-center">
                <UserPlus className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
              </div>
              <span className="bg-gradient-to-r from-slate-900 to-slate-700 dark:from-white dark:to-slate-300 bg-clip-text text-transparent">2. Create Initial Admin</span>
            </h3>

            <form onSubmit={handleCreateAdmin} className="grid gap-5 sm:grid-cols-2">
              <div className="sm:col-span-2 space-y-2">
                <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest pl-1">Select Facility</label>
                <select
                  value={selectedFacilityId}
                  onChange={(e) => setSelectedFacilityId(e.target.value)}
                  className="w-full h-12 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl px-4 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition-all text-slate-900 dark:text-white shadow-sm hover:border-emerald-500/50"
                >
                  <option value="">-- Choose Facility --</option>
                  {facilities.map(f => (
                    <option key={f.id} value={f.id}>{f.name} ({f.code})</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest pl-1">Admin Full Name</label>
                <input
                  type="text"
                  placeholder="e.g. Master Admin"
                  value={adminName}
                  onChange={(e) => setAdminName(e.target.value)}
                  className="w-full h-12 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl px-4 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition-all text-slate-900 dark:text-white shadow-sm hover:border-emerald-500/50"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest pl-1">Admin Email</label>
                <input
                  type="email"
                  placeholder="e.g. admin@handoverly.com"
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  className="w-full h-12 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl px-4 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition-all text-slate-900 dark:text-white shadow-sm hover:border-emerald-500/50"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest pl-1">Employee ID (Login)</label>
                <input
                  type="text"
                  placeholder="e.g. ADMIN001"
                  value={adminEmpId}
                  onChange={(e) => setAdminEmpId(e.target.value)}
                  className="w-full h-12 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl px-4 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition-all text-slate-900 dark:text-white shadow-sm hover:border-emerald-500/50"
                />
              </div>
              <div className="space-y-2 group/input">
                <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest pl-1">Password</label>
                <div className="relative flex items-center">
                  <input
                    type={showAdminPassword ? 'text' : 'password'}
                    placeholder="Min 6 characters"
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    className="w-full h-12 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl pl-4 pr-11 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition-all text-slate-900 dark:text-white shadow-sm hover:border-emerald-500/50"
                  />
                  <button
                    type="button"
                    onClick={() => setShowAdminPassword(!showAdminPassword)}
                    className="absolute right-4 p-1 text-slate-400 hover:text-emerald-500 focus:outline-none transition-colors cursor-pointer"
                  >
                    {showAdminPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                className="h-12 mt-2 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white font-bold rounded-2xl text-sm tracking-wide transition-all shadow-lg shadow-emerald-500/25 flex items-center justify-center gap-2 sm:col-span-2 active:scale-[0.98] overflow-hidden relative group"
              >
                <div className="absolute inset-0 w-[200%] h-full bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-[150%] hover:animate-[sheen_1.5s_infinite]"></div>
                <UserPlus className="w-5 h-5 relative z-10" />
                <span className="relative z-10">Create Admin Account</span>
              </button>
            </form>

            {adminFeedback && (
              <div className="mt-4 p-3.5 rounded-2xl bg-green-50/80 dark:bg-green-500/10 border border-green-100 dark:border-green-500/20 text-[11px] font-bold text-green-700 dark:text-green-400 backdrop-blur-md shadow-sm text-center">
                {adminFeedback}
              </div>
            )}
            {adminError && (
              <div className="mt-4 p-3.5 rounded-2xl bg-red-50/80 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20 text-[11px] font-bold text-red-600 dark:text-red-400 flex items-center gap-2 backdrop-blur-md shadow-sm justify-center">
                <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                <span>{adminError}</span>
              </div>
            )}
            
            <div className="mt-6 p-4 bg-amber-50/80 dark:bg-amber-500/10 border border-amber-100 dark:border-amber-500/20 text-amber-800 dark:text-amber-400 text-xs font-semibold rounded-2xl flex items-start gap-2 backdrop-blur-md shadow-sm">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <p className="leading-relaxed">
                Once an admin is created, they can log in at the main screen using their Employee ID and Password. They will then have access to the Facility Admin Panel to manage staff, residents, and AI configuration.
              </p>
            </div>

            <div className="border border-white/50 dark:border-white/5 rounded-[24px] overflow-hidden bg-white/30 dark:bg-black/20 backdrop-blur-md shadow-sm mt-8">
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="bg-white/40 dark:bg-white/5 border-b border-white/50 dark:border-white/5 text-[10px] font-bold uppercase tracking-widest text-text-secondary">
                    <th className="p-4">Admin Name</th>
                    <th className="p-4">Emp ID / Facility</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/40 dark:divide-white/5">
                  {admins.map((adm) => (
                    <tr key={adm.id} className="hover:bg-white/50 dark:hover:bg-white/10 transition-colors">
                      <td className="p-4 font-semibold text-slate-800 dark:text-slate-200">
                        <div>{adm.name}</div>
                        <div className="text-[10px] text-text-secondary font-medium">{adm.email}</div>
                      </td>
                      <td className="p-4 font-medium text-text-secondary">
                        <div className="font-mono text-xs text-primary">{adm.employee_id}</div>
                        <div className="text-[10px]">{adm.facilities?.name || 'Unknown'}</div>
                      </td>
                      <td className="p-4 text-right">
                        <button onClick={() => handleDeleteAdmin(adm.id, adm.name)} className="p-2 text-red-500 bg-white/60 dark:bg-white/5 rounded-xl hover:bg-white dark:hover:bg-white/10 transition-colors shadow-sm">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {admins.length === 0 && !loading && (
                    <tr><td colSpan={3} className="p-6 text-center text-text-secondary font-semibold">No admin accounts created yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>

          </div>
        </div>
      </main>
    </div>
  );
}
