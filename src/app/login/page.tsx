'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ShieldAlert, LogIn, User, Lock, Sun, Moon, Hexagon, UserPlus, Mail, BadgeCent, ChevronDown } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export default function Login() {
  const { login, user, isLoading } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const router = useRouter();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [registerName, setRegisterName] = useState('');
  const [registerEmail, setRegisterEmail] = useState('');
  const [registerEmpId, setRegisterEmpId] = useState('');
  const [registerRole, setRegisterRole] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [registerFacility, setRegisterFacility] = useState('');
  
  const [facilities, setFacilities] = useState<{id: string, name: string}[]>([]);
  const [rolesList, setRolesList] = useState<{id: string, name: string}[]>([]);

  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const fetchOptions = async () => {
      const [facRes, rolesRes] = await Promise.all([
        supabase.from('facilities').select('id, name'),
        supabase.from('roles').select('id, name').order('name')
      ]);
      
      if (facRes.data && facRes.data.length > 0) {
        setFacilities(facRes.data);
        setRegisterFacility(facRes.data[0].id);
      }
      
      if (rolesRes.data && rolesRes.data.length > 0) {
        setRolesList(rolesRes.data);
        setRegisterRole(rolesRes.data[0].name); // store the name as role
      }
    };
    fetchOptions();
  }, []);

  useEffect(() => {
    if (!isLoading && user) {
      if (user.role === 'carer') {
        router.push('/');
      } else if (user.role === 'admin') {
        router.push('/admin');
      } else {
        router.push('/shift');
      }
    }
  }, [user, isLoading, router]);

  // No facilities fetch needed for login

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      setError('Please enter both Employee ID and Password.');
      return;
    }
    setIsSubmitting(true);
    setError('');

    const res = await login(username, password);
    if (!res.success) {
      setError(res.error || 'Invalid credentials');
      setIsSubmitting(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!registerName || !registerEmail || !registerEmpId || !registerPassword || !registerFacility || !registerRole) {
      setError('Please fill all fields.');
      return;
    }
    setIsSubmitting(true);
    setError('');

    try {
      const res = await fetch('/api/auth/register-staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          facilityId: registerFacility,
          name: registerName,
          role: registerRole,
          employeeId: registerEmpId,
          email: registerEmail,
          password: registerPassword
        })
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Registration failed');
      
      const loginRes = await login(registerEmpId, registerPassword);
      if (!loginRes.success) setError(loginRes.error || 'Login failed after registration.');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#fafafa] dark:bg-black flex flex-col items-center justify-center">
        <div className="w-12 h-12 border-4 border-black/10 dark:border-white/10 border-t-black dark:border-t-white rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full relative flex items-center justify-center bg-slate-50 dark:bg-[#030712] overflow-hidden font-sans selection:bg-indigo-500/20 p-4">
      
      {/* Dynamic Animated Aurora Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[20%] -left-[10%] w-[70%] h-[70%] rounded-full bg-indigo-500/20 dark:bg-indigo-600/10 blur-[120px] animate-[pulse_8s_ease-in-out_infinite] mix-blend-multiply dark:mix-blend-screen"></div>
        <div className="absolute top-[20%] -right-[10%] w-[60%] h-[60%] rounded-full bg-blue-500/20 dark:bg-cyan-500/10 blur-[120px] animate-[pulse_10s_ease-in-out_infinite_1s] mix-blend-multiply dark:mix-blend-screen"></div>
        <div className="absolute -bottom-[20%] left-[20%] w-[80%] h-[60%] rounded-full bg-violet-500/20 dark:bg-violet-600/10 blur-[130px] animate-[pulse_12s_ease-in-out_infinite_2s] mix-blend-multiply dark:mix-blend-screen"></div>
      </div>

      {/* Theme Switcher */}
      <div className="absolute top-6 right-6 z-50">
        <button
          onClick={toggleTheme}
          className="p-3 rounded-full bg-white/40 dark:bg-black/40 backdrop-blur-md border border-white/40 dark:border-white/10 text-slate-700 dark:text-slate-300 shadow-lg transition-all hover:scale-110 active:scale-95 hover:bg-white/80 dark:hover:bg-white/10"
        >
          {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>
      </div>

      {/* Main Glass Card */}
      <div className="relative z-10 w-full max-w-[440px] animate-in fade-in slide-in-from-bottom-8 duration-700">
        
        {/* Floating Logo Badge */}
        <div className="flex justify-center mb-8">
           <div className="relative group">
             <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 to-blue-500 blur-xl rounded-full opacity-40 group-hover:opacity-70 transition-opacity duration-500"></div>
             <div className="w-16 h-16 rounded-[1.25rem] bg-white dark:bg-[#0a0a0a] p-[1px] relative shadow-2xl transform transition-transform group-hover:scale-105 duration-300 border border-white/50 dark:border-white/10">
               <div className="w-full h-full rounded-[1.25rem] bg-gradient-to-br from-white to-slate-50 dark:from-zinc-900 dark:to-black flex items-center justify-center overflow-hidden relative">
                  <div className="absolute top-0 left-[-100%] w-[50%] h-full bg-gradient-to-r from-transparent via-indigo-500/10 dark:via-white/10 to-transparent skew-x-[30deg] animate-[sheen_3s_infinite]"></div>
                  <Hexagon className="w-7 h-7 text-indigo-600 dark:text-white drop-shadow-md" />
               </div>
             </div>
           </div>
        </div>

        <div className="bg-white/60 dark:bg-[#0a0a0a]/60 backdrop-blur-2xl border border-white/50 dark:border-white/10 p-8 sm:p-10 rounded-[2.5rem] shadow-[0_40px_80px_-20px_rgba(0,0,0,0.1)] dark:shadow-[0_40px_80px_-20px_rgba(0,0,0,0.5)]">
          
          <div className="text-center mb-8">
            <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-br from-slate-900 to-slate-600 dark:from-white dark:to-slate-400 bg-clip-text text-transparent mb-2">
              Handoverly
            </h1>
            <p className="text-[11px] font-bold text-indigo-600/80 dark:text-indigo-400 uppercase tracking-[0.2em]">
              Clinical Operations
            </p>
          </div>

          {/* Pill Segmented Tabs */}
          <div className="flex p-1 bg-slate-200/50 dark:bg-white/5 rounded-2xl mb-8 backdrop-blur-md">
            <button
              onClick={() => { setIsLoginMode(true); setError(''); }}
              className={`flex-1 py-2.5 text-xs font-bold uppercase tracking-wider rounded-xl transition-all duration-300 ${
                isLoginMode
                  ? 'bg-white dark:bg-[#1a1a1a] text-indigo-600 dark:text-white shadow-sm scale-[1.02]'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
              }`}
            >
              Sign In
            </button>
            <button
              onClick={() => { setIsLoginMode(false); setError(''); }}
              className={`flex-1 py-2.5 text-xs font-bold uppercase tracking-wider rounded-xl transition-all duration-300 ${
                !isLoginMode
                  ? 'bg-white dark:bg-[#1a1a1a] text-indigo-600 dark:text-white shadow-sm scale-[1.02]'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
              }`}
            >
              Register
            </button>
          </div>

          {isLoginMode ? (
            <form onSubmit={handleLoginSubmit} className="space-y-5">
              <div className="space-y-2 relative group/input">
                <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider pl-1">
                  Employee ID / Email
                </label>
                <div className="relative flex items-center">
                  <User className="absolute left-4 w-4 h-4 text-slate-400 dark:text-slate-500 transition-colors group-focus-within/input:text-indigo-500" />
                  <input
                    type="text"
                    placeholder="e.g. EMP1001"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full h-12 bg-white/50 dark:bg-black/30 border border-slate-200 dark:border-white/5 rounded-2xl pl-11 pr-4 text-sm font-medium text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 dark:focus:border-indigo-500/50 transition-all"
                  />
                </div>
              </div>

              <div className="space-y-2 relative group/input">
                <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider pl-1">
                  Password
                </label>
                <div className="relative flex items-center">
                  <Lock className="absolute left-4 w-4 h-4 text-slate-400 dark:text-slate-500 transition-colors group-focus-within/input:text-indigo-500" />
                  <input
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full h-12 bg-white/50 dark:bg-black/30 border border-slate-200 dark:border-white/5 rounded-2xl pl-11 pr-4 text-sm font-medium tracking-wider text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 dark:focus:border-indigo-500/50 transition-all"
                  />
                </div>
              </div>

              {error && (
                <div className="p-3.5 rounded-2xl bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20 flex items-start gap-3 animate-in slide-in-from-top-2">
                  <ShieldAlert className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                  <span className="text-xs font-semibold text-red-600 dark:text-red-400 leading-relaxed">{error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full h-12 mt-4 rounded-2xl bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white font-bold text-sm tracking-wide shadow-lg shadow-indigo-500/25 transition-all active:scale-[0.98] disabled:opacity-70 disabled:pointer-events-none flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                ) : (
                  <>
                    Authenticate <LogIn className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          ) : (
            <form onSubmit={handleRegisterSubmit} className="space-y-4">
              <div className="space-y-1.5 group/input">
                <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider pl-1">Full Name</label>
                <div className="relative">
                  <User className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400 dark:text-slate-500 transition-colors group-focus-within/input:text-indigo-500" />
                  <input type="text" placeholder="Jane Doe" value={registerName} onChange={(e) => setRegisterName(e.target.value)} className="w-full h-11 bg-white/50 dark:bg-black/30 border border-slate-200 dark:border-white/5 rounded-xl pl-10 pr-3 text-xs font-medium text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5 group/input">
                  <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider pl-1">Emp ID</label>
                  <input type="text" placeholder="EMP100" value={registerEmpId} onChange={(e) => setRegisterEmpId(e.target.value)} className="w-full h-11 bg-white/50 dark:bg-black/30 border border-slate-200 dark:border-white/5 rounded-xl px-3 text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all" />
                </div>
                {rolesList.length > 0 && (
                  <div className="space-y-1.5 group/input">
                    <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider pl-1">Role</label>
                    <select value={registerRole} onChange={(e) => setRegisterRole(e.target.value)} className="w-full h-11 bg-white/50 dark:bg-black/30 border border-slate-200 dark:border-white/5 rounded-xl px-3 text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all">
                      {rolesList.map(r => <option key={r.id} value={r.name} className="dark:bg-slate-900">{r.name.charAt(0).toUpperCase() + r.name.slice(1)}</option>)}
                    </select>
                  </div>
                )}
              </div>
              <div className="space-y-1.5 group/input">
                <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider pl-1">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400 dark:text-slate-500 transition-colors group-focus-within/input:text-indigo-500" />
                  <input type="email" placeholder="jane@facility.com" value={registerEmail} onChange={(e) => setRegisterEmail(e.target.value)} className="w-full h-11 bg-white/50 dark:bg-black/30 border border-slate-200 dark:border-white/5 rounded-xl pl-10 pr-3 text-xs font-medium text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all" />
                </div>
              </div>
              <div className="space-y-1.5 group/input">
                <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider pl-1">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400 dark:text-slate-500 transition-colors group-focus-within/input:text-indigo-500" />
                  <input type="password" placeholder="••••••••" value={registerPassword} onChange={(e) => setRegisterPassword(e.target.value)} className="w-full h-11 bg-white/50 dark:bg-black/30 border border-slate-200 dark:border-white/5 rounded-xl pl-10 pr-3 text-xs font-medium text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all" />
                </div>
              </div>
              {facilities.length > 0 && (
                <div className="space-y-1.5 group/input">
                  <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider pl-1">Facility</label>
                  <select value={registerFacility} onChange={(e) => setRegisterFacility(e.target.value)} className="w-full h-11 bg-white/50 dark:bg-black/30 border border-slate-200 dark:border-white/5 rounded-xl px-3 text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all">
                    {facilities.map(f => <option key={f.id} value={f.id} className="dark:bg-slate-900">{f.name}</option>)}
                  </select>
                </div>
              )}
              {error && (
                <div className="p-3.5 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20 flex items-start gap-2">
                  <ShieldAlert className="w-3.5 h-3.5 text-red-500 shrink-0 mt-0.5" />
                  <span className="text-[11px] font-semibold text-red-600 dark:text-red-400 leading-relaxed">{error}</span>
                </div>
              )}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full h-11 mt-4 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white font-bold text-xs tracking-wide shadow-lg shadow-indigo-500/25 transition-all active:scale-[0.98] disabled:opacity-70 flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                ) : (
                  <>Create Account <UserPlus className="w-3.5 h-3.5" /></>
                )}
              </button>
            </form>
          )}

        </div>
        
        {/* Footer info */}
        <div className="mt-8 text-center flex items-center justify-center gap-3">
          <div className="px-3 py-1.5 rounded-full bg-white/40 dark:bg-black/40 backdrop-blur-md border border-white/50 dark:border-white/5 text-[9px] font-bold text-slate-600 dark:text-slate-400 tracking-[0.2em] uppercase flex items-center gap-2">
            <Lock className="w-3 h-3 text-indigo-500" />
            AES-256
          </div>
          <div className="px-3 py-1.5 rounded-full bg-white/40 dark:bg-black/40 backdrop-blur-md border border-white/50 dark:border-white/5 text-[9px] font-bold text-slate-600 dark:text-slate-400 tracking-[0.2em] uppercase flex items-center gap-2">
            <ShieldAlert className="w-3 h-3 text-emerald-500" />
            RLS Active
          </div>
          <Link href="/system-admin" className="px-3 py-1.5 rounded-full bg-white/40 dark:bg-black/40 backdrop-blur-md border border-white/50 dark:border-white/5 text-[9px] font-bold text-indigo-600 dark:text-indigo-400 tracking-[0.2em] uppercase hover:bg-white/60 dark:hover:bg-white/10 transition-colors">
            Setup
          </Link>
        </div>

      </div>

      <style dangerouslySetInnerHTML={{__html: `
        @keyframes sheen {
          100% { left: 200%; }
        }
      `}} />
    </div>
  );
}
