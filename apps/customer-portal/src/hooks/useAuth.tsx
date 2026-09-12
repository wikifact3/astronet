'use client';

import {
  createContext, useCallback, useContext, useEffect, useMemo, useState,
} from 'react';
import {
  api, setAccessToken, setUnauthorizedHandler,
  type AuthUser, type VerifyOtpResponse,
} from '@/lib/api';

interface AuthContextValue {
  user: AuthUser | null;
  ready: boolean;
  login: (result: VerifyOtpResponse) => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const USER_KEY = 'powerlink.user';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [ready, setReady] = useState(false);

  const clear = useCallback(() => {
    setAccessToken(null);
    setUser(null);
    if (typeof window !== 'undefined') {
      localStorage.removeItem(USER_KEY);
    }
  }, []);

  const login = useCallback((result: VerifyOtpResponse) => {
    setAccessToken(result.accessToken);
    setUser(result.user);
    if (typeof window !== 'undefined') {
      localStorage.setItem(USER_KEY, JSON.stringify(result.user));
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.auth.logout();
    } catch {
      /* ignore network errors on logout */
    }
    clear();
  }, [clear]);

  // Wire 401 handler: any authenticated request that 401s logs us out
  useEffect(() => {
    setUnauthorizedHandler(() => {
      clear();
    });
    return () => setUnauthorizedHandler(null);
  }, [clear]);

  // On mount, try to restore session from the refresh cookie
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const { accessToken } = await api.auth.refresh();
        if (cancelled) return;
        setAccessToken(accessToken);

        const cachedUser =
          typeof window !== 'undefined'
            ? localStorage.getItem(USER_KEY)
            : null;
        if (cachedUser) {
          setUser(JSON.parse(cachedUser) as AuthUser);
        } else {
          const me = await api.me.get();
          if (cancelled) return;
          const u: AuthUser = {
            id: me.id,
            phone: me.phone,
            fullName: me.fullName,
            preferredLanguage: me.preferredLanguage,
          };
          setUser(u);
          localStorage.setItem(USER_KEY, JSON.stringify(u));
        }
      } catch {
        // No valid session — leave user null
      } finally {
        if (!cancelled) setReady(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ user, ready, login, logout }),
    [user, ready, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
