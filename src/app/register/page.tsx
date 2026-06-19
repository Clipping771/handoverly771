'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContextProvider';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ShieldAlert, UserPlus, User, Lock, Sun, Moon, HeartPulse, Eye, EyeOff, Building, Hash, Mail, BadgeCheck, ChevronDown } from 'lucide-react';

export default function Register() {
  // ALL state lives here, above Suspense, so nothing resets on inner remount
  const [facilities, setFacilities] = useState<{ id: string; name: string }[]>([]);
  const [facilityId, setFacilityId] = useState('');
  const [name, setName] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'rn' | 'carer' | 'admin'>('carer');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Context hooks here — so RegisterContent never subscribes to context directly
  const { user, isLoading, isPlatformAdmin, isAdmin } = useAuth();
  const { theme, toggleTheme } = useTheme();

  // Fetch facilities here so it never re-runs due to inner component remounts
  useEffect(() => {
    fetch('/api/public/facilities')
      .then(res => res.json())
      .then(data => {
        if (data.facilities) {
          setFacilities(data.facilities);
          if (data.facilities.length > 0) {
            setFacilityId(data.facilities[0].id);
          }
        }
      })
      .catch(err => console.error('Failed to fetch facilities', err));
  }, []);

  return (
    <React.Suspense fallback={<div>Loading...</div>}>
      <RegisterContent
        facilities={facilities}
        facilityId={facilityId} setFacilityId={setFacilityId}
        name={name} setName={setName}
        employeeId={employeeId} setEmployeeId={setEmployeeId}
        email={email} setEmail={setEmail}
        role={role} setRole={setRole}
        password={password} setPassword={setPassword}
        showPassword={showPassword} setShowPassword={setShowPassword}
        error={error} setError={setError}
        success={success} setSuccess={setSuccess}
        isSubmitting={isSubmitting} setIsSubmitting={setIsSubmitting}
        user={user} isLoading={isLoading}
        isPlatformAdmin={isPlatformAdmin} isAdmin={isAdmin}
        theme={theme} toggleTheme={toggleTheme}
      />
    </React.Suspense>
  );
}

interface RegisterContentProps {
  facilities: { id: string; name: string }[];
  facilityId: string; setFacilityId: (v: string) => void;
  name: string; setName: (v: string) => void;
  employeeId: string; setEmployeeId: (v: string) => void;
  email: string; setEmail: (v: string) => void;
  role: 'rn' | 'carer' | 'admin'; setRole: (v: 'rn' | 'carer' | 'admin') => void;
  password: string; setPassword: (v: string) => void;
  showPassword: boolean; setShowPassword: React.Dispatch<React.SetStateAction<boolean>>;
  error: string; setError: (v: string) => void;
  success: string; setSuccess: (v: string) => void;
  isSubmitting: boolean; setIsSubmitting: (v: boolean) => void;
  user: ReturnType<typeof useAuth>['user'];
  isLoading: boolean;
  isPlatformAdmin: boolean;
  isAdmin: boolean;
  theme: string;
  toggleTheme: () => void;
}

function RegisterContent({
  facilities,
  facilityId, setFacilityId,
  name, setName,
  employeeId, setEmployeeId,
  email, setEmail,
  role, setRole,
  password, setPassword,
  showPassword, setShowPassword,
  error, setError,
  success, setSuccess,
  isSubmitting, setIsSubmitting,
  user, isLoading, isPlatformAdmin, isAdmin,
  theme, toggleTheme,
}: RegisterContentProps) {
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && user) {
      if (isPlatformAdmin) {
        router.replace('/system-admin');
      } else if (isAdmin) {
        router.replace('/admin');
      } else {
        router.replace('/');
      }
    }
  }, [user, isLoading, router, isAdmin, isPlatformAdmin]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!facilityId) {
      setError('Please select a facility.');
      return;
    }
    if (!name.trim() || !employeeId.trim() || !email.trim() || !password.trim()) {
      setError('Please fill in all personal details.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await fetch('/api/auth/register-public', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'join_facility',
          facilityId,
          name,
          employeeId,
          email,
          role,
          password
        })
      });

      let data: any = {};
      try {
        data = await res.json();
      } catch {
        // API returned non-JSON (e.g. server crash HTML page)
        console.error('[register] API returned non-JSON, status:', res.status);
        setError(`Server error (${res.status}). Please try again.`);
        setIsSubmitting(false);
        return;
      }

      if (!res.ok) {
        setError(data.error || `Registration failed (${res.status}).`);
      } else {
        setSuccess('Registration successful! Redirecting to login...');
        setTimeout(() => {
          router.push('/login');
        }, 2000);
      }
    } catch (err: any) {
      console.error('[register] Fetch error:', err.message);
      setError('Network error. Please check your connection and try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen w-full relative flex items-center justify-center bg-background overflow-hidden font-sans p-4 py-12">

      {/* Loading overlay — form stays mounted underneath to preserve state */}
      {isLoading && (
        <div className="fixed inset-0 z-[100] bg-background/80 backdrop-blur-sm flex items-center justify-center">
          <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
        </div>
      )}

      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[20%] -left-[10%] w-[70%] h-[70%] rounded-full bg-blue-100 dark:bg-blue-900/20 blur-[120px] animate-[pulse_8s_ease-in-out_infinite] mix-blend-multiply dark:mix-blend-screen" />
        <div className="absolute top-[20%] -right-[10%] w-[60%] h-[60%] rounded-full bg-slate-200 dark:bg-slate-800/30 blur-[120px] animate-[pulse_10s_ease-in-out_infinite_1s] mix-blend-multiply dark:mix-blend-screen" />
      </div>

      <div className="absolute top-6 right-6 z-50">
        <button
          onClick={toggleTheme}
          className="p-3 rounded-full bg-white/40 dark:bg-black/40 backdrop-blur-md border border-black/5 dark:border-white/10 text-text-primary shadow-lg transition-all hover:scale-110 active:scale-95"
          aria-label="Toggle theme"
        >
          {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>
      </div>

      <div className="w-full max-w-xl relative z-10">

        <div className="flex justify-center mb-8">
          <div className="w-20 h-20 rounded-[24px] bg-white dark:bg-slate-800 shadow-[0_8px_30px_rgb(0,0,0,0.06)] border border-white/80 dark:border-white/10 flex items-center justify-center hover:scale-105 transition-transform duration-300">
            <HeartPulse className="w-9 h-9 text-primary" strokeWidth={1.5} />
          </div>
        </div>

        <div className="bg-white/80 dark:bg-slate-900/60 backdrop-blur-3xl border border-white/60 dark:border-white/10 p-6 sm:p-8 rounded-3xl shadow-[0_8px_32px_rgba(0,0,0,0.04)]">

          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold tracking-tight text-text-primary mb-1.5">Register for Handoverly</h1>
            <p className="text-[11px] font-bold text-primary uppercase tracking-[0.22em]">Join the Portal</p>
          </div>

          <div className="flex bg-slate-100 dark:bg-slate-800/50 p-1 rounded-full mb-6">
            <Link
              href="/login"
              className="flex-1 py-2 text-center text-sm font-bold rounded-full transition-all text-text-secondary hover:text-text-primary"
            >
              Login
            </Link>
            <Link
              href="/register"
              className="flex-1 py-2 text-center text-sm font-bold rounded-full transition-all bg-white dark:bg-slate-700 text-primary shadow-sm"
            >
              Register
            </Link>
          </div>



          <form onSubmit={handleSubmit} className="space-y-4">

            <div className="space-y-1.5 group/input">
              <label className="text-[10px] font-bold text-text-secondary uppercase tracking-widest pl-1">
                Facility
              </label>
              <div className="relative flex items-center">
                <Building className="absolute left-4 w-4 h-4 text-slate-400 group-focus-within/input:text-primary transition-colors z-10" />
                <select
                  value={facilityId}
                  onChange={e => setFacilityId(e.target.value)}
                  className="w-full h-12 bg-white/60 dark:bg-slate-800/60 border border-white/60 dark:border-white/10 rounded-full pl-11 pr-4 text-sm font-medium text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all shadow-inner appearance-none"
                >
                  <option value="" disabled>Select a facility</option>
                  {facilities.map(f => (
                    <option key={f.id} value={f.id}>{f.name}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-4 w-4 h-4 text-slate-400 pointer-events-none transition-colors" />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5 group/input">
                <label className="text-[10px] font-bold text-text-secondary uppercase tracking-widest pl-1">
                  Full Name
                </label>
                <div className="relative flex items-center">
                  <User className="absolute left-4 w-4 h-4 text-slate-400 group-focus-within/input:text-primary transition-colors z-10" />
                  <input
                    type="text"
                    placeholder="e.g. Jane Doe"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    name="registerFullName"
                    autoComplete="off"
                    className="w-full h-12 bg-white/60 dark:bg-slate-800/60 border border-white/60 dark:border-white/10 rounded-full pl-11 pr-4 text-sm font-medium text-text-primary placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all shadow-inner"
                  />
                </div>
              </div>

              <div className="space-y-1.5 group/input">
                <label className="text-[10px] font-bold text-text-secondary uppercase tracking-widest pl-1">
                  Employee ID
                </label>
                <div className="relative flex items-center">
                  <BadgeCheck className="absolute left-4 w-4 h-4 text-slate-400 group-focus-within/input:text-primary transition-colors z-10" />
                  <input
                    type="text"
                    placeholder="e.g. EMP1001"
                    value={employeeId}
                    onChange={e => setEmployeeId(e.target.value)}
                    name="registerEmployeeId"
                    autoComplete="off"
                    className="w-full h-12 bg-white/60 dark:bg-slate-800/60 border border-white/60 dark:border-white/10 rounded-full pl-11 pr-4 text-sm font-medium text-text-primary placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all shadow-inner"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5 group/input">
                <label className="text-[10px] font-bold text-text-secondary uppercase tracking-widest pl-1">
                  Email
                </label>
                <div className="relative flex items-center">
                  <Mail className="absolute left-4 w-4 h-4 text-slate-400 group-focus-within/input:text-primary transition-colors z-10" />
                  <input
                    type="email"
                    placeholder="jane@example.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    name="registerEmail"
                    autoComplete="off"
                    className="w-full h-12 bg-white/60 dark:bg-slate-800/60 border border-white/60 dark:border-white/10 rounded-full pl-11 pr-4 text-sm font-medium text-text-primary placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all shadow-inner"
                  />
                </div>
              </div>

              <div className="space-y-1.5 group/input">
                <label className="text-[10px] font-bold text-text-secondary uppercase tracking-widest pl-1">
                  Role
                </label>
                <div className="relative flex items-center">
                  <select
                    value={role}
                    onChange={e => setRole(e.target.value as any)}
                    className="w-full h-12 bg-white/60 dark:bg-slate-800/60 border border-white/60 dark:border-white/10 rounded-full px-4 text-sm font-medium text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all shadow-inner appearance-none"
                  >
                    <option value="carer">Carer</option>
                    <option value="rn">Registered Nurse (RN)</option>
                  </select>
                  <ChevronDown className="absolute right-4 w-4 h-4 text-slate-400 pointer-events-none transition-colors" />
                </div>
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
                  name="registerPassword"
                  autoComplete="new-password"
                  className="w-full h-12 bg-white/60 dark:bg-slate-800/60 border border-white/60 dark:border-white/10 rounded-full pl-11 pr-11 text-sm font-medium tracking-wider text-text-primary placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all shadow-inner"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-4 p-1 text-slate-400 hover:text-text-secondary transition-colors"
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

            {success && (
              <div className="p-3 rounded-xl bg-green-50 dark:bg-green-500/10 border border-green-100 dark:border-green-500/20 flex items-start gap-2.5 animate-in slide-in-from-top-2">
                <ShieldAlert className="w-3.5 h-3.5 text-green-500 shrink-0 mt-0.5" />
                <span className="text-[11px] font-semibold text-green-600 dark:text-green-400 leading-relaxed">{success}</span>
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
                <>Register <UserPlus className="w-3.5 h-3.5" /></>
              )}
            </button>

          </form>
        </div>
      </div>
    </div>
  );
}
