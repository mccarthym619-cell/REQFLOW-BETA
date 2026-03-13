import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { api } from '../api/client';

interface AccessGateContextType {
  isAuthenticated: boolean | null; // null = loading
  checkAccess: () => Promise<void>;
  logout: () => Promise<void>;
}

const AccessGateContext = createContext<AccessGateContextType>({
  isAuthenticated: null,
  checkAccess: async () => {},
  logout: async () => {},
});

export function AccessGateProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  const checkAccess = useCallback(async () => {
    try {
      await api.get('/auth/check');
      setIsAuthenticated(true);
    } catch {
      setIsAuthenticated(false);
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // ignore
    }
    setIsAuthenticated(false);
  }, []);

  useEffect(() => {
    checkAccess();
  }, [checkAccess]);

  return (
    <AccessGateContext.Provider value={{ isAuthenticated, checkAccess, logout }}>
      {children}
    </AccessGateContext.Provider>
  );
}

export function useAccessGate() {
  return useContext(AccessGateContext);
}
