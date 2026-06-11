'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export interface Staff {
  id: string;
  facility_id: string;
  name: string;
  role: string;
  is_active: boolean;
  created_at: string;
}

export interface Facility {
  id: string;
  name: string;
  code: string;
  created_at: string;
}

export interface Session {
  staff: Staff;
  facility: Facility;
  expiresAt: number;
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

  // Load session from cookie/localStorage on mount
  useEffect(() => {
    try {
      const storedSession = localStorage.getItem('carehandover_session');
      if (storedSession) {
        const sessionData: Session = JSON.parse(storedSession);
        
        // Check if session has expired
        if (Date.now() < sessionData.expiresAt) {
          setUser(sessionData.staff);
          setFacility(sessionData.facility);
        } else {
          // Session expired
          localStorage.removeItem('carehandover_session');
        }
      }
    } catch (err) {
      console.error('Failed to load session:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const login = async (username: string, password: string) => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        return { success: false, error: data.error || 'Authentication failed' };
      }

      // Save to state
      setUser(data.session.staff);
      setFacility(data.session.facility);
      
      // Save to localStorage
      localStorage.setItem('carehandover_session', JSON.stringify(data.session));

      return { success: true };
    } catch (err: any) {
      console.error('Auth context login error:', err);
      return { success: false, error: 'Network error occurred. Please try again.' };
    }
  };

  const logout = () => {
    setUser(null);
    setFacility(null);
    localStorage.removeItem('carehandover_session');
    
    // Clear cookie by setting past expiry
    document.cookie = 'carehandover_session=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT';
    
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
