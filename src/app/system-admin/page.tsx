'use client';

import React, { useState, useEffect } from 'react';
import { useTheme } from '@/context/ThemeContext';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { ShieldCheck, Plus, Building, UserPlus, AlertCircle, RefreshCw, Sun, Moon, Lock } from 'lucide-react';
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
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [masterPassword, setMasterPassword] = useState('');

  // Facility Form
  const [newFacName, setNewFacName] = useState('');
  const [newFacCode, setNewFacCode] = useState('');

  // Admin Form
  const [adminName, setAdminName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminEmpId, setAdminEmpId] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [selectedFacilityId, setSelectedFacilityId] = useState('');

  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');

  const loadFacilities = async () => {
    try {
      setLoading(true);
      const { data, error: fetchErr } = await supabase
        .from('facilities')
        .select('id, name, code')
        .order('created_at', { ascending: false });
        
      if (fetchErr) throw fetchErr;
      setFacilities(data || []);
      
      if (data && data.length > 0 && !selectedFacilityId) {
        setSelectedFacilityId(data[0].id);
      }
    } catch (err) {
      console.error(err);
      setError('Failed to load facilities.');
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
    setError('');
    setFeedback('');
    if (!newFacName || !newFacCode) {
      setError('Please provide both Facility Name and Code.');
      return;
    }

    try {
      const { error: insertErr } = await supabase
        .from('facilities')
        .insert([{
          name: newFacName.trim(),
          code: newFacCode.trim()
        }]);

      if (insertErr) throw insertErr;

      setFeedback(`Facility "${newFacName}" created successfully.`);
      setNewFacName('');
      setNewFacCode('');
      loadFacilities();
    } catch (err: any) {
      setError(err.message || 'Failed to create facility. Ensure the code is unique.');
    }
  };

  const handleCreateAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setFeedback('');
    
    if (!selectedFacilityId || !adminName || !adminEmail || !adminEmpId || !adminPassword) {
      setError('Please fill in all fields to create an admin.');
      return;
    }

    try {
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

      setFeedback(`Admin account for "${adminName}" created successfully. They can now log in.`);
      setAdminName('');
      setAdminEmail('');
      setAdminEmpId('');
      setAdminPassword('');
    } catch (err: any) {
      setError(err.message || 'Failed to create admin.');
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-[#080b16] transition-colors duration-200 p-4">
        <div className="max-w-md w-full bg-white dark:bg-[#0d1226]/80 backdrop-blur-md p-8 rounded-3xl border border-slate-200 dark:border-[#1e295d] shadow-xl">
          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-indigo-600 mx-auto flex items-center justify-center mb-4 shadow-lg shadow-indigo-500/30">
              <ShieldCheck className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">System Setup</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">Enter master password to bootstrap facilities.</p>
          </div>
          
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <div className="relative flex items-center">
                <Lock className="absolute left-4 w-4 h-4 text-slate-400" />
                <input
                  type="password"
                  placeholder="Master Password"
                  value={masterPassword}
                  onChange={(e) => setMasterPassword(e.target.value)}
                  className="w-full h-12 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl pl-11 pr-4 text-sm font-medium text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 transition-colors"
                />
              </div>
            </div>
            {error && <p className="text-rose-500 text-xs font-semibold text-center">{error}</p>}
            <button
              type="submit"
              className="w-full h-12 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-sm transition-colors shadow-lg shadow-indigo-500/20"
            >
              Unlock Setup
            </button>
            <div className="text-center mt-4">
              <Link href="/" className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold hover:underline">
                Return to Login
              </Link>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#080b16] text-[#0f172a] dark:text-[#e2e8f0] flex flex-col pb-12 transition-colors duration-200 relative">
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#e2e8f0_1px,transparent_1px),linear-gradient(to_bottom,#e2e8f0_1px,transparent_1px)] dark:bg-[linear-gradient(to_right,#161b30_1px,transparent_1px),linear-gradient(to_bottom,#161b30_1px,transparent_1px)] bg-[size:4rem_4rem] opacity-20 pointer-events-none"></div>

      <header className="sticky top-0 z-40 bg-white/90 dark:bg-[#0d1226]/90 backdrop-blur-md border-b border-slate-200 dark:border-[#1e295d] px-4 py-4 sm:px-6 transition-colors duration-200 relative z-10">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center font-bold text-sm text-white shadow-lg shadow-indigo-500/30">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base font-bold text-slate-800 dark:text-white">System Admin Setup</h1>
              <p className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold">
                Superuser Bootstrap Panel
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={toggleTheme}
              className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 shadow-sm transition-all duration-100 dark:bg-[#141b3a] dark:hover:bg-[#1a234b] dark:border dark:border-[#1e295d] dark:text-slate-300"
            >
              {theme === 'dark' ? <Sun className="w-3.5 h-3.5 text-amber-400" /> : <Moon className="w-3.5 h-3.5 text-blue-600" />}
            </button>
            <Link
              href="/"
              className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 dark:border-slate-700 text-xs font-bold dark:text-slate-200 transition-colors"
            >
              Exit Setup
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto w-full px-4 mt-8 flex-1 relative z-10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Facility Bootstrap</h2>
            <p className="text-slate-500 dark:text-slate-400 text-xs mt-1">Create root facilities and initial admin accounts.</p>
          </div>
          <button 
            onClick={loadFacilities}
            className="p-2 bg-white border border-slate-200 hover:bg-slate-50 dark:bg-slate-900 dark:border-slate-800 dark:hover:bg-slate-800 text-slate-500 rounded-xl transition-colors shadow-sm"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

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

        <div className="grid gap-8 lg:grid-cols-2">
          
          {/* FACILITY CREATION */}
          <div className="space-y-6 bg-white dark:bg-[#0d1226]/30 border border-slate-200 dark:border-[#1e295d] p-6 rounded-3xl shadow-sm">
            <h3 className="text-lg font-bold flex items-center gap-2 border-b border-slate-100 dark:border-[#1e295d]/50 pb-3 text-slate-800 dark:text-slate-100">
              <Building className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              1. Register Facility
            </h3>

            <form onSubmit={handleAddFacility} className="grid gap-4 sm:grid-cols-2 items-end">
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Facility Name</label>
                <input
                  type="text"
                  placeholder="e.g. SunnyCare Sydney"
                  value={newFacName}
                  onChange={(e) => setNewFacName(e.target.value)}
                  className="w-full h-10 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 text-xs focus:outline-none focus:border-indigo-500 text-slate-800 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Facility Code</label>
                <input
                  type="text"
                  placeholder="e.g. SYD001"
                  value={newFacCode}
                  onChange={(e) => setNewFacCode(e.target.value)}
                  className="w-full h-10 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 text-xs focus:outline-none focus:border-indigo-500 text-slate-800 dark:text-slate-100"
                />
              </div>
              <button
                type="submit"
                className="h-10 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-lg text-xs transition-colors flex items-center justify-center gap-1.5 sm:col-span-2 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                Register Facility
              </button>
            </form>

            <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-slate-900/60 shadow-sm mt-4">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">
                    <th className="p-3">Facility Name</th>
                    <th className="p-3">Code</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {facilities.map((fac) => (
                    <tr key={fac.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/30">
                      <td className="p-3 font-semibold text-slate-800 dark:text-slate-200">{fac.name}</td>
                      <td className="p-3 font-mono text-slate-500 dark:text-slate-400">{fac.code}</td>
                    </tr>
                  ))}
                  {facilities.length === 0 && !loading && (
                    <tr><td colSpan={2} className="p-4 text-center text-slate-400">No facilities found.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* ADMIN CREATION */}
          <div className="space-y-6 bg-white dark:bg-[#0d1226]/30 border border-slate-200 dark:border-[#1e295d] p-6 rounded-3xl shadow-sm">
            <h3 className="text-lg font-bold flex items-center gap-2 border-b border-slate-100 dark:border-[#1e295d]/50 pb-3 text-slate-800 dark:text-slate-100">
              <UserPlus className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              2. Create Initial Admin
            </h3>

            <form onSubmit={handleCreateAdmin} className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Select Facility</label>
                <select
                  value={selectedFacilityId}
                  onChange={(e) => setSelectedFacilityId(e.target.value)}
                  className="w-full h-10 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2 text-xs focus:outline-none text-slate-800 dark:text-slate-100"
                >
                  <option value="">-- Choose Facility --</option>
                  {facilities.map(f => (
                    <option key={f.id} value={f.id}>{f.name} ({f.code})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Admin Full Name</label>
                <input
                  type="text"
                  placeholder="e.g. Master Admin"
                  value={adminName}
                  onChange={(e) => setAdminName(e.target.value)}
                  className="w-full h-10 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 text-xs focus:outline-none focus:border-indigo-500 text-slate-800 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Admin Email</label>
                <input
                  type="email"
                  placeholder="e.g. admin@handoverly.com"
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  className="w-full h-10 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 text-xs focus:outline-none focus:border-indigo-500 text-slate-800 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Employee ID (Login)</label>
                <input
                  type="text"
                  placeholder="e.g. ADMIN001"
                  value={adminEmpId}
                  onChange={(e) => setAdminEmpId(e.target.value)}
                  className="w-full h-10 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 text-xs focus:outline-none focus:border-indigo-500 text-slate-800 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Password</label>
                <input
                  type="password"
                  placeholder="Min 6 characters"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  className="w-full h-10 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 text-xs focus:outline-none focus:border-indigo-500 text-slate-800 dark:text-slate-100"
                />
              </div>

              <button
                type="submit"
                className="h-10 mt-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-lg text-xs transition-colors flex items-center justify-center gap-1.5 sm:col-span-2 cursor-pointer shadow-md"
              >
                <UserPlus className="w-4 h-4" />
                Create Admin Account
              </button>
            </form>
            
            <div className="mt-4 p-4 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 text-amber-800 dark:text-amber-400 text-xs rounded-xl flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <p>
                Once an admin is created, they can log in at the main screen using their Employee ID and Password. They will then have access to the Facility Admin Panel to manage staff, residents, and AI configuration.
              </p>
            </div>

          </div>
        </div>
      </main>
    </div>
  );
}
