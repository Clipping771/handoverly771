'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { supabase } from '@/lib/supabase';

// ── Types ────────────────────────────────────────────────────────────────────

export interface Staff {
  id: string;           // staff table UUID (used as synthetic email prefix)
  auth_id: string;      // Supabase Auth UUID (session.user.id)
  facility_id: string;
  name: string;
  role: string;
}

export interface Facility {
  id: string;
  name?: string;
  code?: string;
}

interface AuthContextType {
  user: Staff | null;
  facility: Facility | null;
  isLoading: boolean;
  login: (username: string, password: string, portal?: 'clinical' | 'admin' | 'system-admin') => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  isCarer: boolean;
  isRN: boolean;
  isAdmin: boolean;
  isPlatformAdmin: boolean;
}

// ── Context ──────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// ── Role helpers ─────────────────────────────────────────────────────────────

function computeRoles(role: string | undefined) {
  if (!role) return { isCarer: false, isRN: false, isAdmin: false, isPlatformAdmin: false };

  const r = role.toLowerCase().trim();
  const isPlatformAdmin = r === 'platform_admin';
  const isAdmin = r === 'admin';
  const isCarer = r === 'carer';
  // RN = anything that isn't carer, admin, or platform admin
  const isRN = !isAdmin && !isPlatformAdmin && !isCarer;

  return { isCarer, isRN, isAdmin, isPlatformAdmin };
}

// ── Provider ─────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<Staff | null>(null);
  const [facility, setFacility] = useState<Facility | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  /**
   * Resolve a Supabase Auth session to a full Staff + Facility object.
   * Reads from user_metadata (no extra DB call needed — metadata is
   * set authoritatively when the user is created/updated via the admin API).
   */
  const resolveUser = useCallback((userObj: any | null) => {
    if (!userObj) {
      setUser(null);
      setFacility(null);
      return;
    }

    const meta = userObj.user_metadata ?? {};
    const role: string = meta.role ?? 'rn';
    const facilityId: string = meta.facility_id ?? '';
    const name: string = meta.name ?? 'Staff';

    const staffId: string = meta.staff_id ?? userObj.id;

    setUser(prev => {
      if (prev?.id === staffId && prev?.role === role && prev?.facility_id === facilityId) return prev;
      return {
        id: staffId,
        auth_id: userObj.id,
        facility_id: facilityId,
        name,
        role,
      };
    });

    if (facilityId) {
      setFacility(prev => prev?.id === facilityId ? prev : { id: facilityId });
    } else {
      setFacility(null);
    }
  }, []);

  // ── Session bootstrap ──────────────────────────────────────────────────────

  useEffect(() => {
    let mounted = true;

    const bootstrap = async () => {
      const { data: { user }, error } = await supabase.auth.getUser();
      if (mounted) {
        if (error || !user) {
          resolveUser(null);
        } else {
          resolveUser(user);
        }
        setIsLoading(false);
      }
    };

    bootstrap();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;

      if (event === 'SIGNED_OUT') {
        resolveUser(null);
        setIsLoading(false);
        return;
      }

      // To avoid infinite loops and the 'insecure session' warning, we only call getUser()
      // on major auth events, and ignore the getter on session.user.
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') {
        const { data: { user } } = await supabase.auth.getUser();
        resolveUser(user);
      }

      setIsLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [resolveUser]);

  // ── Login ──────────────────────────────────────────────────────────────────

  const login = useCallback(async (username: string, password: string, portal: 'clinical' | 'admin' | 'system-admin' = 'clinical') => {
    try {
      // Step 1: Resolve the synthetic email for this username
      const lookupRes = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, portal }),
      });

      const lookupData = await lookupRes.json();

      if (!lookupRes.ok || !lookupData.success) {
        return { success: false, error: lookupData.error ?? 'Authentication failed.' };
      }

      // Step 2: Sign in with the resolved synthetic email + password
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: lookupData.email,
        password,
      });

      if (signInError) {
        // Distinguish between wrong password and other errors
        if (signInError.message?.toLowerCase().includes('invalid')) {
          return { success: false, error: 'Incorrect password.' };
        }
        return { success: false, error: 'Login failed. Please try again.' };
      }

      return { success: true };
    } catch (err: any) {
      console.error('[AuthContext.login] Error:', err.message);
      return { success: false, error: 'Network error. Please try again.' };
    }
  }, []);

  // ── Logout ─────────────────────────────────────────────────────────────────

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
    setFacility(null);

    // Intelligently redirect to the correct login portal
    if (pathname?.startsWith('/admin')) {
      router.replace('/admin/login');
    } else if (pathname?.startsWith('/system-admin')) {
      router.replace('/system-admin/login');
    } else {
      router.replace('/login');
    }
  }, [router, pathname]);

  // ── Refresh (called after role/name updates) ───────────────────────────────

  const refreshUser = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    resolveUser(user);
  }, [resolveUser]);

  // ── Computed role flags ────────────────────────────────────────────────────

  const { isCarer, isRN, isAdmin, isPlatformAdmin } = computeRoles(user?.role);

  // Memoize the context value so consumers only re-render when something
  // actually changes, not on every AuthProvider render cycle.
  const contextValue = React.useMemo(() => ({
    user,
    facility,
    isLoading,
    login,
    logout,
    refreshUser,
    isCarer,
    isRN,
    isAdmin,
    isPlatformAdmin,
  }), [user, facility, isLoading, login, logout, refreshUser, isCarer, isRN, isAdmin, isPlatformAdmin]);

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
