'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContextProvider';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ShieldAlert, LogIn, User, Lock, Sun, Moon, HeartPulse, UserPlus, Mail, BadgeCent, ChevronDown, Eye, EyeOff } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import toast from 'react-hot-toast';

export default function Login() {
  const { login, user, isLoading, isCarer, isAdmin } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const router = useRouter();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [registerName, setRegisterName] = useState('');
  const [registerEmail, setRegisterEmail] = useState('');
  const [registerEmpId, setRegisterEmpId] = useState('');
  const [registerRole, setRegisterRole] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);
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
      if (isCarer) {
        router.push('/');
      } else if (isAdmin) {
        router.push('/admin');
      } else {
        router.push('/shift');
      }
    }
  }, [user, isLoading, router, isCarer, isAdmin]);

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
      <div className="min-h-screen bg-[#030712] flex flex-col items-center justify-center">
        <div className="w-12 h-12 border-4 border-white/10 border-t-indigo-500 rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full relative flex items-center justify-center bg-background overflow-hidden font-sans p-4">
      
      {/* Soft Apple-style Ambient Gradient */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[20%] -left-[10%] w-[70%] h-[70%] rounded-full bg-blue-100 dark:bg-blue-900/20 blur-[120px] animate-[pulse_8s_ease-in-out_infinite] mix-blend-multiply dark:mix-blend-screen"></div>
        <div className="absolute top-[20%] -right-[10%] w-[60%] h-[60%] rounded-full bg-slate-200 dark:bg-slate-800/30 blur-[120px] animate-[pulse_10s_ease-in-out_infinite_1s] mix-blend-multiply dark:mix-blend-screen"></div>
      </div>

      {/* Theme Switcher */}
      <div className="absolute top-6 right-6 z-50">
        <button
          onClick={toggleTheme}
          className="p-3 rounded-full bg-white/40 dark:bg-black/40 backdrop-blur-md border border-black/5 dark:border-white/10 text-text-primary shadow-lg transition-all hover:scale-110 active:scale-95"
        >
          {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>
      </div>

      <div className="w-full max-w-md relative z-10 animate-fade-in-up">
        
        {/* Clean Circular Handover Logo */}
        <div className="flex justify-center mb-10">
           <div className="w-20 h-20 rounded-[24px] bg-white dark:bg-slate-800 shadow-[0_8px_30px_rgb(0,0,0,0.06)] border border-white/80 dark:border-white/10 flex items-center justify-center transform transition-transform hover:scale-105 duration-300 z-10">
              <HeartPulse className="w-9 h-9 text-slate-700 dark:text-slate-300" strokeWidth={1.5} />
           </div>
        </div>

        <div className="bg-white/80 dark:bg-slate-900/60 backdrop-blur-3xl border border-white/60 dark:border-white/10 p-6 sm:p-8 rounded-3xl shadow-[0_8px_32px_rgba(0,0,0,0.04)]">
          
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold tracking-tight text-text-primary mb-1.5">
              Handoverly
            </h1>
            <p className="text-[11px] font-bold text-primary uppercase tracking-[0.22em]">
              Clinical Operations
            </p>
          </div>

          {/* Pill Segmented Tabs */}
          <div className="flex p-1 glass-pill rounded-full mb-6 border-white/60">
            <button
              onClick={() => { setIsLoginMode(true); setError(''); }}
              className={`flex-1 py-2 text-xs font-bold rounded-full transition-transform active:scale-[0.98] tracking-widest uppercase focus:outline-none ${
                isLoginMode
                  ? 'bg-primary text-white shadow-md'
                  : 'text-text-secondary hover:text-text-primary hover:bg-white/50 dark:hover:bg-white/10'
              }`}
            >
              Sign In
            </button>
            <button
              onClick={() => { setIsLoginMode(false); setError(''); }}
              className={`flex-1 py-2 text-xs font-bold rounded-full transition-transform active:scale-[0.98] tracking-widest uppercase focus:outline-none ${
                !isLoginMode
                  ? 'bg-primary text-white shadow-md'
                  : 'text-text-secondary hover:text-text-primary hover:bg-white/50 dark:hover:bg-white/10'
              }`}
            >
              Register
            </button>
          </div>

          {isLoginMode ? (
            <form onSubmit={handleLoginSubmit} className="space-y-3.5">
              <div className="space-y-1 relative group/input">
                <label className="text-[10px] font-bold text-text-secondary uppercase tracking-widest pl-1">
                  Employee ID / Email
                </label>
                <div className="relative flex items-center">
                  <User className="absolute left-4 w-4 h-4 text-slate-400 group-focus-within/input:text-slate-700 dark:group-focus-within/input:text-slate-300 transition-colors z-10" />
                  <input
                    type="text"
                    placeholder="e.g. EMP1001"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full h-11 glass-pill border-white/60 rounded-full pl-10 pr-4 text-sm font-medium text-text-primary placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:bg-white/80 transition-all shadow-inner"
                  />
                </div>
              </div>

              <div className="space-y-1 relative group/input">
                <label className="text-[10px] font-bold text-text-secondary uppercase tracking-widest pl-1">
                  Password
                </label>
                <div className="relative flex items-center">
                  <Lock className="absolute left-4 w-4 h-4 text-slate-400 group-focus-within/input:text-slate-700 dark:group-focus-within/input:text-slate-300 transition-colors z-10" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full h-11 glass-pill border-white/60 rounded-full pl-10 pr-10 text-sm font-medium tracking-wider text-text-primary placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:bg-white/80 transition-all shadow-inner"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 p-1 text-slate-400 hover:text-text-secondary focus:outline-none transition-colors cursor-pointer z-10"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="flex justify-end mt-1.5">
                <button
                  type="button"
                  onClick={() => toast('Password reset is disabled in this environment. Please contact your system administrator.', { icon: 'ℹ️' })}
                  className="text-[10px] font-bold text-primary hover:text-primary/80 transition-colors cursor-pointer"
                >
                  Forgot Password?
                </button>
              </div>

              {error && (
                <div className="p-3 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20 flex items-start gap-2.5 animate-in slide-in-from-top-2">
                  <ShieldAlert className="w-3.5 h-3.5 text-red-500 shrink-0 mt-0.5" />
                  <span className="text-[11px] font-semibold text-red-600 dark:text-red-400 leading-relaxed">{error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full h-11 mt-2 rounded-full bg-primary hover:opacity-90 text-white font-semibold text-sm tracking-wide transition-opacity active:scale-[0.98] disabled:opacity-70 flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                ) : (
                  <>
                    Authenticate <LogIn className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </form>
          ) : (
            <form onSubmit={handleRegisterSubmit} className="space-y-4">
              <div className="space-y-1.5 group/input">
                <label className="text-[10px] font-bold text-text-secondary uppercase tracking-widest pl-1">Full Name</label>
                <div className="relative">
                  <User className="absolute left-4 top-4 w-4 h-4 text-slate-400 transition-colors group-focus-within/input:text-slate-700 dark:group-focus-within/input:text-slate-300" />
                  <input type="text" placeholder="Jane Doe" value={registerName} onChange={(e) => setRegisterName(e.target.value)} className="w-full h-12 bg-[#F5F5F7] dark:bg-[#2C2C2E] rounded-[14px] pl-11 pr-4 text-sm font-medium text-text-primary placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all border-none" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5 group/input">
                  <label className="text-[10px] font-bold text-text-secondary uppercase tracking-widest pl-1">Emp ID</label>
                  <input type="text" placeholder="EMP100" value={registerEmpId} onChange={(e) => setRegisterEmpId(e.target.value)} className="w-full h-12 bg-[#F5F5F7] dark:bg-[#2C2C2E] rounded-[14px] px-4 text-sm font-medium text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all border-none" />
                </div>
                {rolesList.length > 0 && (
                  <div className="space-y-1.5 group/input">
                    <label className="text-[10px] font-bold text-text-secondary uppercase tracking-widest pl-1">Role</label>
                    <select value={registerRole} onChange={(e) => setRegisterRole(e.target.value)} className="w-full h-12 bg-[#F5F5F7] dark:bg-[#2C2C2E] rounded-[14px] px-4 text-sm font-medium text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all border-none">
                      {rolesList.map(r => <option key={r.id} value={r.name}>{r.name.charAt(0).toUpperCase() + r.name.slice(1)}</option>)}
                    </select>
                  </div>
                )}
              </div>
              <div className="space-y-1.5 group/input">
                <label className="text-[10px] font-bold text-text-secondary uppercase tracking-widest pl-1">Email</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-4 w-4 h-4 text-slate-400 transition-colors group-focus-within/input:text-slate-700 dark:group-focus-within/input:text-slate-300" />
                  <input type="email" placeholder="jane@facility.com" value={registerEmail} onChange={(e) => setRegisterEmail(e.target.value)} className="w-full h-12 bg-[#F5F5F7] dark:bg-[#2C2C2E] rounded-[14px] pl-11 pr-4 text-sm font-medium text-text-primary placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all border-none" />
                </div>
              </div>
              <div className="space-y-1.5 group/input">
                <label className="text-[10px] font-bold text-text-secondary uppercase tracking-widest pl-1">Password</label>
                <div className="relative flex items-center">
                  <Lock className="absolute left-4 top-4 w-4 h-4 text-slate-400 transition-colors group-focus-within/input:text-slate-700 dark:group-focus-within/input:text-slate-300" />
                  <input type={showRegisterPassword ? 'text' : 'password'} placeholder="••••••••" value={registerPassword} onChange={(e) => setRegisterPassword(e.target.value)} className="w-full h-12 bg-[#F5F5F7] dark:bg-[#2C2C2E] rounded-[14px] pl-11 pr-11 text-sm font-medium text-text-primary placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all border-none" />
                  <button
                    type="button"
                    onClick={() => setShowRegisterPassword(!showRegisterPassword)}
                    className="absolute right-4 p-1 text-slate-400 hover:text-text-secondary focus:outline-none transition-colors cursor-pointer"
                  >
                    {showRegisterPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              {facilities.length > 0 && (
                <div className="space-y-1.5 group/input">
                  <label className="text-[10px] font-bold text-text-secondary uppercase tracking-widest pl-1">Facility</label>
                  <select value={registerFacility} onChange={(e) => setRegisterFacility(e.target.value)} className="w-full h-12 bg-[#F5F5F7] dark:bg-[#2C2C2E] rounded-[14px] px-4 text-sm font-medium text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all border-none">
                    {facilities.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
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
                className="w-full h-12 mt-4 rounded-full bg-primary hover:opacity-90 text-white font-semibold text-sm tracking-wide transition-opacity active:scale-[0.98] disabled:opacity-70 flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                ) : (
                  <>Create Account <UserPlus className="w-4 h-4" /></>
                )}
              </button>
            </form>
          )}

        </div>
        
        {/* Footer info */}
        <div className="mt-8 text-center flex items-center justify-center gap-3">
          <div className="px-3 py-1.5 rounded-full bg-white/40 dark:bg-black/40 backdrop-blur-md border border-black/5 dark:border-white/5 text-[9px] font-bold text-text-secondary tracking-[0.2em] uppercase flex items-center gap-2">
            <Lock className="w-3 h-3 text-slate-500 dark:text-slate-400" />
            AES-256
          </div>
          <div className="px-3 py-1.5 rounded-full bg-white/40 dark:bg-black/40 backdrop-blur-md border border-black/5 dark:border-white/5 text-[9px] font-bold text-text-secondary tracking-[0.2em] uppercase flex items-center gap-2">
            <ShieldAlert className="w-3 h-3 text-slate-500 dark:text-slate-400" />
            RLS Active
          </div>
          <Link href="/system-admin" className="px-3 py-1.5 rounded-full bg-white/40 dark:bg-black/40 backdrop-blur-md border border-black/5 dark:border-white/5 text-[9px] font-bold text-slate-600 dark:text-slate-400 tracking-[0.2em] uppercase hover:bg-white/60 dark:hover:bg-white/10 transition-colors">
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
