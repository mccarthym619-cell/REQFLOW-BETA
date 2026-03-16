import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { api } from '../api/client';
import type { User } from '@req-tracker/shared';

type SessionStatus = 'loading' | 'authenticated' | 'unauthenticated';

interface SessionContextType {
  user: User | null;
  status: SessionStatus;
  checkAuth: () => Promise<void>;
  logout: () => Promise<void>;
  setUser: (user: User) => void;
}

const SessionContext = createContext<SessionContextType>({
  user: null,
  status: 'loading',
  checkAuth: async () => {},
  logout: async () => {},
  setUser: () => {},
});

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState<SessionStatus>('loading');

  const checkAuth = useCallback(async () => {
    try {
      const res = await api.get('/auth/check');
      if (res.data.data.authenticated && res.data.data.user) {
        const userData = res.data.data.user;
        setUser(userData);
        setStatus('authenticated');

        // Auto-detect browser timezone for users still on UTC default
        if (userData.timezone === 'UTC') {
          const browserTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
          if (browserTz && browserTz !== 'UTC') {
            api.put('/users/me/timezone', { timezone: browserTz }).then(() => {
              setUser({ ...userData, timezone: browserTz });
            }).catch(() => {});
          }
        }
      } else {
        setUser(null);
        setStatus('unauthenticated');
      }
    } catch {
      setUser(null);
      setStatus('unauthenticated');
    }
  }, []);

  const handleSetUser = useCallback((u: User) => {
    setUser(u);
    setStatus('authenticated');
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // ignore
    }
    setUser(null);
    setStatus('unauthenticated');
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  return (
    <SessionContext.Provider value={{ user, status, checkAuth, logout, setUser: handleSetUser }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  return useContext(SessionContext);
}
