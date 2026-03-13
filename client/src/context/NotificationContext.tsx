import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { api } from '../api/client';
import { useAuth } from './AuthContext';
import type { Notification } from '@req-tracker/shared';

interface NotificationContextType {
  unreadCount: number;
  notifications: Notification[];
  refreshNotifications: () => void;
  markAsRead: (id: number) => void;
  markAllAsRead: () => void;
}

const NotificationContext = createContext<NotificationContextType>({
  unreadCount: 0,
  notifications: [],
  refreshNotifications: () => {},
  markAsRead: () => {},
  markAllAsRead: () => {},
});

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { currentUser } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const refreshNotifications = useCallback(async () => {
    if (!currentUser) return;
    try {
      const [countRes, listRes] = await Promise.all([
        api.get('/notifications/unread-count'),
        api.get('/notifications?per_page=10'),
      ]);
      setUnreadCount(countRes.data.data.count);
      setNotifications(listRes.data.data);
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
    }
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser) return;
    refreshNotifications();

    // SSE connection
    const evtSource = new EventSource(`/api/notifications/stream?userId=${currentUser.id}`);

    evtSource.addEventListener('notification', () => {
      refreshNotifications();
    });

    evtSource.onerror = () => {
      evtSource.close();
      // Reconnect after 5s
      setTimeout(() => {
        refreshNotifications();
      }, 5000);
    };

    // Poll as fallback every 30s
    const interval = setInterval(refreshNotifications, 30000);

    return () => {
      evtSource.close();
      clearInterval(interval);
    };
  }, [currentUser, refreshNotifications]);

  async function markAsRead(id: number) {
    await api.put(`/notifications/${id}/read`);
    refreshNotifications();
  }

  async function markAllAsRead() {
    await api.put('/notifications/read-all');
    refreshNotifications();
  }

  return (
    <NotificationContext.Provider value={{ unreadCount, notifications, refreshNotifications, markAsRead, markAllAsRead }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  return useContext(NotificationContext);
}
