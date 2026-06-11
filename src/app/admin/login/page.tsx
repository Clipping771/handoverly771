'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { useRouter } from 'next/navigation';
import { ShieldAlert, LogIn, User, Lock, Sun, Moon, Hexagon, ShieldCheck, Eye, EyeOff } from 'lucide-react';

export default function AdminLogin() {
  const { login, user, isLoading, logout, isAdmin } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const router = useRouter();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isLoading && user) {
      if (isAdmin) {
        router.push('/admin');
      } else {
        // If a non-admin accidentally logged in here, sign them out and show error.
        logout();
        setError('Unauthorized: This portal is for Administrators only.');
      }
    }
  }, [user, isLoading, router, logout, isAdmin]);

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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-[#080b16] flex flex-col items-center justify-center">
        <div className="w-12 h-12 border-4 border-indigo-600/20 dark:border-indigo-400/20 border-t-indigo-600 dark:border-t-indigo-400 rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full relative flex items-center justify-center bg-slate-50 dark:bg-[#080b16] transition-colors duration-700 overflow-hidden font-sans p-4">
      
      {/* Cinematic Spotlight Lighting - Admin Violet Theme */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none flex items-center justify-center">
        <div className="absolute -top-[20%] w-[120%] sm:w-[80%] h-[60%] rounded-[100%] bg-indigo-400/20 dark:bg-indigo-600/10 blur-[130px] animate-pulse duration-[8000ms]"></div>
        <div className="absolute w-[60%] h-[60%] rounded-full bg-violet-300/30 dark:bg-violet-900/20 blur-[140px] mix-blend-screen dark:mix-blend-lighten"></div>
      </div>

      {/* Theme Switcher */}
      <div className="absolute top-6 right-6 z-50">
        <button
          onClick={toggleTheme}
          className="p-3.5 rounded-full bg-white/60 dark:bg-[#111]/60 backdrop-blur-xl border border-indigo-100 dark:border-indigo-900/30 text-indigo-600 dark:text-indigo-400 shadow-xl transition-all duration-300 hover:bg-white dark:hover:bg-[#1a1a2e] hover:scale-105 active:scale-95"
          title={theme === 'dark' ? "Switch to Light Mode" : "Switch to Dark Mode"}
        >
          {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.5)]" /> : <Moon className="w-4 h-4 text-indigo-800 drop-shadow-[0_0_8px_rgba(55,48,163,0.3)]" />}
        </button>
      </div>

      {/* Main Container */}
      <div className="relative z-10 w-full max-w-[420px]">
        
        {/* Illuminated Logo Badge */}
        <div className="flex justify-center mb-8 relative">
           <div className="absolute inset-0 bg-indigo-500/20 dark:bg-indigo-400/20 blur-2xl rounded-full scale-[1.8] animate-pulse duration-3000"></div>
           <div className="w-16 h-16 rounded-2xl bg-indigo-600 dark:bg-indigo-500 p-[1px] relative shadow-[0_10px_30px_-10px_rgba(79,70,229,0.5)] transform transition-transform hover:scale-105 duration-300">
             <div className="w-full h-full rounded-2xl bg-white dark:bg-[#0f172a] flex items-center justify-center relative overflow-hidden">
                <div className="absolute top-0 left-[-100%] w-[50%] h-full bg-gradient-to-r from-transparent via-indigo-500/10 dark:via-indigo-400/20 to-transparent skew-x-[30deg] group-hover:animate-[sheen_1.5s_infinite]"></div>
                <ShieldCheck className="w-7 h-7 text-indigo-600 dark:text-indigo-400 drop-shadow-md" />
             </div>
           </div>
        </div>

        {/* The Glass Card */}
        <div className="bg-white/80 dark:bg-[#0d1226]/80 backdrop-blur-3xl border border-indigo-100 dark:border-indigo-900/50 p-8 sm:p-10 rounded-[2rem] shadow-[0_20px_60px_-15px_rgba(79,70,229,0.1)] dark:shadow-[0_20px_60px_-15px_rgba(0,0,0,0.5)] relative overflow-hidden transition-all duration-500">
          
          <div className="text-center mb-8 relative">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white mb-1.5 font-sans drop-shadow-sm">
              Admin Gateway
            </h1>
            <p className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">
              Authorized Personnel Only
            </p>
          </div>

          <form onSubmit={handleLoginSubmit} className="space-y-4 relative">
            
            <div className="space-y-1.5 relative group/input">
              <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest pl-1">
                Admin Employee ID / Email
              </label>
              <div className="relative flex items-center">
                <User className="absolute left-4 w-4 h-4 text-slate-400 group-focus-within/input:text-indigo-600 dark:group-focus-within/input:text-indigo-400 transition-all" />
                <input
                  type="text"
                  placeholder="e.g. ADMIN001"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full h-11 bg-slate-50 dark:bg-[#080b16] border border-slate-200 dark:border-indigo-900/30 rounded-xl pl-11 pr-4 text-xs font-semibold text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 dark:focus:ring-indigo-400/10 focus:border-indigo-500 dark:focus:border-indigo-500 transition-all shadow-inner"
                />
              </div>
            </div>

            <div className="space-y-1.5 relative group/input">
              <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest pl-1">
                Password
              </label>
              <div className="relative flex items-center">
                <Lock className="absolute left-4 w-4 h-4 text-slate-400 group-focus-within/input:text-indigo-600 dark:group-focus-within/input:text-indigo-400 transition-all" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full h-11 bg-slate-50 dark:bg-[#080b16] border border-slate-200 dark:border-indigo-900/30 rounded-xl pl-11 pr-11 text-xs font-semibold tracking-wider text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 dark:focus:ring-indigo-400/10 focus:border-indigo-500 dark:focus:border-indigo-500 transition-all shadow-inner"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 focus:outline-none transition-colors cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 flex items-start gap-2 animate-in fade-in zoom-in-95">
                <ShieldAlert className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                <span className="text-[11px] font-semibold text-rose-700 dark:text-rose-400 leading-tight">{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="relative w-full h-11 mt-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs tracking-wide overflow-hidden group/btn transition-all active:scale-[0.98] shadow-lg shadow-indigo-500/20 disabled:opacity-70 disabled:pointer-events-none"
            >
              <div className="absolute inset-0 bg-indigo-700 opacity-0 group-hover/btn:opacity-100 transition-opacity duration-300"></div>
              <div className="absolute top-0 -left-[100%] w-[30%] h-full bg-gradient-to-r from-transparent via-white/20 to-transparent skew-x-[30deg] group-hover/btn:animate-[sheen_1.5s_infinite]"></div>
              
              <div className="relative flex items-center justify-center gap-2">
                {isSubmitting ? (
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <>
                    Admin Login
                    <LogIn className="w-3.5 h-3.5 transition-transform duration-300 group-hover/btn:translate-x-1" />
                  </>
                )}
              </div>
            </button>
          </form>
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
