'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export interface Staff {
  id: string;
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
  login: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  isCarer: boolean;
  isRN: boolean;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<Staff | null>(null);
  const [facility, setFacility] = useState<Facility | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    // Check active sessions and sets up a listener
    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setupUserFromSession(session);
      }
      setIsLoading(false);
    };

    getSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        setupUserFromSession(session);
      } else {
        setUser(null);
        setFacility(null);
      }
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const setupUserFromSession = (session: any) => {
    const meta = session.user.user_metadata;
    if (meta && meta.facility_id) {
      setUser({
        id: session.user.id, // we don't know the exact staff.id anymore on client easily, but user.id is what RLS checks now!
        facility_id: meta.facility_id,
        name: meta.name || 'Staff',
        role: meta.role || 'rn'
      });
      setFacility({ id: meta.facility_id });
    }
  };

  const login = async (username: string, pin: string) => {
    try {
      // 1. Map Name to Synthetic Email
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username })
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        return { success: false, error: data.error || 'Authentication failed' };
      }

      // 2. Perform Native Supabase Sign In
      const { error } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: pin
      });

      if (error) {
        console.error('Supabase auth error:', error);
        return { success: false, error: 'Invalid PIN or credentials' };
      }

      return { success: true };
    } catch (err: any) {
      console.error('Auth context login error:', err);
      return { success: false, error: 'Network error occurred. Please try again.' };
    }
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setFacility(null);
    router.push('/login');
  };

  // Smart Role / Access Permission Mapping
  const getRoleAccess = (role?: string) => {
    if (!role) return { isCarer: false, isRN: false, isAdmin: false };
    const r = role.toLowerCase().trim();
    
    const isAdmin = r === 'admin' || r.includes('admin') || r.includes('manager') || r.includes('coordinator');
    const isCarer = r === 'carer' || r.includes('carer') || r.includes('assistant') || r.includes('helper') || r.includes('aide') || r.includes('support');
    const isRN = r === 'rn' || r.includes('rn') || r.includes('nurse') || r.includes('clinical') || (!isAdmin && !isCarer);
    
    return { isCarer, isRN, isAdmin };
  };

  const { isCarer, isRN, isAdmin } = getRoleAccess(user?.role);

  return (
    <AuthContext.Provider value={{ user, facility, isLoading, login, logout, isCarer, isRN, isAdmin }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
