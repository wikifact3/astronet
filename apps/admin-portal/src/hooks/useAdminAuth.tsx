'use client';

import {
  createContext, useCallback, useContext, useEffect, useMemo, useState,
} from 'react';
import {
  api, setAccessToken, setUnauthorizedHandler,
  type AdminLoginResponse, type AdminStaff,
} from '@/lib/api';

interface AdminAuthContextValue {
  staff: AdminStaff | null;
  ready: boolean;
  login: (result: AdminLoginResponse) => void;
  logout: () => Promise<void>;
}

const AdminAuthContext = createContext<AdminAuthContextValue | null>(null);

const STAFF_KEY = 'powerlink.admin.staff';

export function AdminAuthProvider({ children }: { children: React.ReactNode }) {
  const [staff, setStaff] = useState<AdminStaff | null>(null);
  const [ready, setReady] = useState(false);

  const clear = useCallback(() => {
    setAccessToken(null);
    setStaff(null);
    if (typeof window !== 'undefined') {
      localStorage.removeItem(STAFF_KEY);
    }
  }, []);

  const login = useCallback((result: AdminLoginResponse) => {
    setAccessToken(result.accessToken);
    setStaff(result.staff);
    if (typeof window !== 'undefined') {
      localStorage.setItem(STAFF_KEY, JSON.stringify(result.staff));
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.adminAuth.logout();
    } catch {
      /* ignore */
    }
    clear();
  }, [clear]);

  // 401 handler → clear
  useEffect(() => {
    setUnauthorizedHandler(() => {
      clear();
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('powerlink:session-expired'));
      }
    });
    return () => setUnauthorizedHandler(null);
  }, [clear]);

  // On mount, try to restore admin session from the admin refresh cookie
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const { accessToken } = await api.adminAuth.refresh();
        if (cancelled) return;
        setAccessToken(accessToken);

        const cached =
          typeof window !== 'undefined'
            ? localStorage.getItem(STAFF_KEY)
            : null;
        if (cached) {
          setStaff(JSON.parse(cached) as AdminStaff);
        } else {
          // Refresh succeeded but we don't have the staff profile cached.
          // We could call a "me" endpoint, but there isn't one yet — so
          // leave staff as null and let the login page handle it. This
          // only happens if the user cleared localStorage mid-session.
          clear();
        }
      } catch {
        /* no valid session */
      } finally {
        if (!cancelled) setReady(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [clear]);

  const value = useMemo<AdminAuthContextValue>(
    () => ({ staff, ready, login, logout }),
    [staff, ready, login, logout],
  );

  return (
    <AdminAuthContext.Provider value={value}>
      {children}
    </AdminAuthContext.Provider>
  );
}

export function useAdminAuth(): AdminAuthContextValue {
  const ctx = useContext(AdminAuthContext);
  if (!ctx) throw new Error('useAdminAuth must be used inside <AdminAuthProvider>');
  return ctx;
}
