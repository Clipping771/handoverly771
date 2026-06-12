'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { useRouter } from 'next/navigation';
import { ShieldAlert, LogIn, User, Lock, Sun, Moon, HeartPulse, Eye, EyeOff } from 'lucide-react';

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
    <div className="min-h-screen w-full relative flex items-center justify-center transition-colors duration-700 overflow-hidden font-sans p-4 bg-transparent">
      
      {/* Global Mesh from layout.tsx will shine through here */}

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
      <div className="relative z-10 w-full max-w-[420px] animate-fade-in-up">
        
        {/* Clean Circular Handover Logo */}
        <div className="flex justify-center mb-10">
           <div className="w-20 h-20 rounded-[24px] bg-white dark:bg-slate-800 shadow-[0_8px_30px_rgb(0,0,0,0.06)] border border-white/80 dark:border-white/10 flex items-center justify-center transform transition-transform hover:scale-105 duration-300 z-10">
              <HeartPulse className="w-9 h-9 text-primary" strokeWidth={1.5} />
           </div>
        </div>

        {/* The Glass Card */}
        <div className="bg-white/40 dark:bg-slate-900/40 backdrop-blur-3xl border border-white/60 dark:border-white/10 p-8 sm:p-10 rounded-[40px] shadow-[0_8px_32px_rgba(0,0,0,0.04)] relative overflow-hidden transition-all duration-500">
          
          <div className="text-center mb-8 relative">
            <h1 className="text-2xl font-bold tracking-tight text-text-primary mb-1.5 font-sans">
              Admin Gateway
            </h1>
            <p className="text-[10px] font-bold text-primary uppercase tracking-widest">
              Authorized Personnel Only
            </p>
          </div>

          <form onSubmit={handleLoginSubmit} className="space-y-4 relative">
            
            <div className="space-y-1.5 relative group/input">
              <label className="text-[10px] font-bold text-text-secondary uppercase tracking-widest pl-1">
                Admin Employee ID / Email
              </label>
              <div className="relative flex items-center">
                <User className="absolute left-5 w-4 h-4 text-slate-400 group-focus-within/input:text-primary transition-all z-10" />
                <input
                  type="text"
                  placeholder="e.g. ADMIN001"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full h-14 glass-pill border-white/60 rounded-full pl-12 pr-4 text-sm font-medium text-text-primary placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:bg-white/80 transition-all shadow-inner"
                />
              </div>
            </div>

            <div className="space-y-1.5 relative group/input">
              <label className="text-[10px] font-bold text-text-secondary uppercase tracking-widest pl-1">
                Password
              </label>
              <div className="relative flex items-center">
                <Lock className="absolute left-5 w-4 h-4 text-slate-400 group-focus-within/input:text-primary transition-all z-10" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full h-14 glass-pill border-white/60 rounded-full pl-12 pr-12 text-sm font-medium tracking-wider text-text-primary placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:bg-white/80 transition-all shadow-inner"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-5 p-1 text-slate-400 hover:text-text-secondary focus:outline-none transition-colors cursor-pointer z-10"
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
              className="relative w-full h-12 mt-4 rounded-full bg-primary hover:opacity-90 text-white font-semibold text-sm tracking-wide overflow-hidden transition-opacity active:scale-[0.98] disabled:opacity-70 flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <>
                  Admin Login
                  <LogIn className="w-4 h-4" />
                </>
              )}
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
