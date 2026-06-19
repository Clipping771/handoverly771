'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContextProvider';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ShieldAlert, LogIn, User, Lock, Sun, Moon, HeartPulse, Eye, EyeOff } from 'lucide-react';

export default function Login() {
  // State lives here, above Suspense, so it survives any inner remount
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Context hooks here — so LoginContent never subscribes to context directly
  const { login, user, isLoading, isAdmin, isPlatformAdmin } = useAuth();
  const { theme, toggleTheme } = useTheme();

  return (
    <React.Suspense fallback={<div>Loading...</div>}>
      <LoginContent
        username={username} setUsername={setUsername}
        password={password} setPassword={setPassword}
        showPassword={showPassword} setShowPassword={setShowPassword}
        error={error} setError={setError}
        isSubmitting={isSubmitting} setIsSubmitting={setIsSubmitting}
        login={login} user={user} isLoading={isLoading}
        isAdmin={isAdmin} isPlatformAdmin={isPlatformAdmin}
        theme={theme} toggleTheme={toggleTheme}
      />
    </React.Suspense>
  );
}

interface LoginContentProps {
  username: string; setUsername: (v: string) => void;
  password: string; setPassword: (v: string) => void;
  showPassword: boolean; setShowPassword: React.Dispatch<React.SetStateAction<boolean>>;
  error: string; setError: (v: string) => void;
  isSubmitting: boolean; setIsSubmitting: (v: boolean) => void;
  login: ReturnType<typeof useAuth>['login'];
  user: ReturnType<typeof useAuth>['user'];
  isLoading: boolean;
  isAdmin: boolean;
  isPlatformAdmin: boolean;
  theme: string;
  toggleTheme: () => void;
}

function LoginContent({
  username, setUsername,
  password, setPassword,
  showPassword, setShowPassword,
  error, setError,
  isSubmitting, setIsSubmitting,
  login, user, isLoading, isAdmin, isPlatformAdmin,
  theme, toggleTheme,
}: LoginContentProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Redirect already-authenticated users to their appropriate home
  useEffect(() => {
    if (!isLoading && user) {
      const redirectTo = searchParams.get('redirect');
      if (redirectTo && redirectTo !== '/login') {
        router.replace(redirectTo);
        return;
      }
      if (isPlatformAdmin) {
        router.replace('/system-admin?_cb=' + Date.now());
      } else if (isAdmin) {
        router.replace('/admin?_cb=' + Date.now());
      } else {
        router.replace('/');
      }
    }
  }, [user, isLoading, router, isAdmin, isPlatformAdmin, searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError('Please enter your Employee ID and password.');
      return;
    }
    setIsSubmitting(true);
    setError('');

    const res = await login(username.trim(), password, 'clinical');
    if (!res.success) {
      setError(res.error ?? 'Invalid credentials. Please try again.');
      setIsSubmitting(false);
    }
    // On success the onAuthStateChange → useEffect above handles redirect
  };

  return (
    <div className="min-h-screen w-full relative flex items-center justify-center bg-background overflow-hidden font-sans p-4">

      {/* Loading overlay — form stays mounted underneath to preserve state */}
      {isLoading && (
        <div className="fixed inset-0 z-[100] bg-background/80 backdrop-blur-sm flex items-center justify-center">
          <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
        </div>
      )}

      {/* Ambient gradient (layout mesh shines through) */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[20%] -left-[10%] w-[70%] h-[70%] rounded-full bg-blue-100 dark:bg-blue-900/20 blur-[120px] animate-[pulse_8s_ease-in-out_infinite] mix-blend-multiply dark:mix-blend-screen" />
        <div className="absolute top-[20%] -right-[10%] w-[60%] h-[60%] rounded-full bg-slate-200 dark:bg-slate-800/30 blur-[120px] animate-[pulse_10s_ease-in-out_infinite_1s] mix-blend-multiply dark:mix-blend-screen" />
      </div>

      {/* Theme toggle */}
      <div className="absolute top-6 right-6 z-50">
        <button
          onClick={toggleTheme}
          className="p-3 rounded-full bg-white/40 dark:bg-black/40 backdrop-blur-md border border-black/5 dark:border-white/10 text-text-primary shadow-lg transition-all hover:scale-110 active:scale-95"
          aria-label="Toggle theme"
        >
          {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>
      </div>

      <div className="w-full max-w-md relative z-10">

        {/* Logo */}
        <div className="flex justify-center mb-10">
          <div className="w-20 h-20 rounded-[24px] bg-white dark:bg-slate-800 shadow-[0_8px_30px_rgb(0,0,0,0.06)] border border-white/80 dark:border-white/10 flex items-center justify-center hover:scale-105 transition-transform duration-300">
            <HeartPulse className="w-9 h-9 text-primary" strokeWidth={1.5} />
          </div>
        </div>

        {/* Card */}
        <div className="bg-white/80 dark:bg-slate-900/60 backdrop-blur-3xl border border-white/60 dark:border-white/10 p-6 sm:p-8 rounded-3xl shadow-[0_8px_32px_rgba(0,0,0,0.04)]">

          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold tracking-tight text-text-primary mb-1.5">Handoverly</h1>
            <p className="text-[11px] font-bold text-primary uppercase tracking-[0.22em]">Nurses & Carers Portal</p>
          </div>

          <div className="flex bg-slate-100 dark:bg-slate-800/50 p-1 rounded-full mb-6">
            <Link
              href="/login"
              className="flex-1 py-2 text-center text-sm font-bold rounded-full transition-all bg-white dark:bg-slate-700 text-primary shadow-sm"
            >
              Login
            </Link>
            <Link
              href="/register"
              className="flex-1 py-2 text-center text-sm font-bold rounded-full transition-all text-text-secondary hover:text-text-primary"
            >
              Register
            </Link>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">

            <div className="space-y-1.5 group/input">
              <label className="text-[10px] font-bold text-text-secondary uppercase tracking-widest pl-1">
                Employee ID
              </label>
              <div className="relative flex items-center">
                <User className="absolute left-4 w-4 h-4 text-slate-400 group-focus-within/input:text-primary transition-colors z-10" />
                <input
                  type="text"
                  placeholder="e.g. EMP1001"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  name="employeeId"
                  autoComplete="off"
                  className="w-full h-12 bg-white/60 dark:bg-slate-800/60 border border-white/60 dark:border-white/10 rounded-full pl-11 pr-4 text-sm font-medium text-text-primary placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all shadow-inner"
                />
              </div>
            </div>

            <div className="space-y-1.5 group/input">
              <label className="text-[10px] font-bold text-text-secondary uppercase tracking-widest pl-1">
                Password
              </label>
              <div className="relative flex items-center">
                <Lock className="absolute left-4 w-4 h-4 text-slate-400 group-focus-within/input:text-primary transition-colors z-10" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  name="userPassword"
                  autoComplete="new-password"
                  className="w-full h-12 bg-white/60 dark:bg-slate-800/60 border border-white/60 dark:border-white/10 rounded-full pl-11 pr-11 text-sm font-medium tracking-wider text-text-primary placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all shadow-inner"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-4 p-1 text-slate-400 hover:text-text-secondary transition-colors"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
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
              className="w-full h-12 mt-2 rounded-full bg-primary hover:opacity-90 text-white font-semibold text-sm tracking-wide transition-all active:scale-[0.98] disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>Authenticate <LogIn className="w-3.5 h-3.5" /></>
              )}
            </button>

          </form>
        </div>

        {/* Footer */}
        <div className="mt-6 text-center flex items-center justify-center gap-3">
          <div className="px-3 py-1.5 rounded-full bg-white/40 dark:bg-black/40 backdrop-blur-md border border-black/5 dark:border-white/5 text-[9px] font-bold text-text-secondary tracking-[0.2em] uppercase flex items-center gap-1.5">
            <Lock className="w-3 h-3" />
            Secured
          </div>
          <div className="px-3 py-1.5 rounded-full bg-white/40 dark:bg-black/40 backdrop-blur-md border border-black/5 dark:border-white/5 text-[9px] font-bold text-text-secondary tracking-[0.2em] uppercase flex items-center gap-1.5">
            <ShieldAlert className="w-3 h-3" />
            RLS Active
          </div>
        </div>

      </div>
    </div>
  );
}
