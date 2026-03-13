import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { api, setCurrentUserId } from '../api/client';
import { useSession } from './SessionContext';
import type { User } from '@req-tracker/shared';

interface AuthContextType {
  currentUser: User | null;
  allUsers: User[];
  switchUser: (userId: number) => void;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({
  currentUser: null,
  allUsers: [],
  switchUser: () => {},
  loading: true,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const { user: sessionUser } = useSession();
  const [currentUser, setCurrentUser] = useState<User | null>(sessionUser);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const isDev = import.meta.env.DEV;

  useEffect(() => {
    if (isDev) {
      // In dev, load all users for DevToolbar switching
      loadUsers();
    } else {
      // In production, use the session user directly
      if (sessionUser) {
        setCurrentUser(sessionUser);
        setCurrentUserId(sessionUser.id);
      }
      setLoading(false);
    }
  }, [sessionUser, isDev]);

  async function loadUsers() {
    try {
      const res = await api.get('/users');
      setAllUsers(res.data.data);
      if (res.data.data.length > 0) {
        // Restore dev user selection from localStorage, fall back to user 1
        const savedId = localStorage.getItem('dev_user_id');
        const savedUser = savedId ? res.data.data.find((u: User) => u.id === Number(savedId)) : null;
        const defaultUser = savedUser || sessionUser || res.data.data[0];
        setCurrentUser(defaultUser);
        setCurrentUserId(defaultUser.id);
      }
    } catch (err) {
      console.error('Failed to load users:', err);
    } finally {
      setLoading(false);
    }
  }

  function switchUser(userId: number) {
    const user = allUsers.find(u => u.id === userId);
    if (user) {
      setCurrentUser(user);
      setCurrentUserId(user.id);
      if (isDev) localStorage.setItem('dev_user_id', String(userId));
    }
  }

  return (
    <AuthContext.Provider value={{ currentUser, allUsers, switchUser, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
