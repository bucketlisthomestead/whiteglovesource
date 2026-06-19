import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  getNotificationUnreadCount,
  getNotifications,
  getToken,
  markAllNotificationsRead,
  markNotificationRead,
} from '../api/client';
import type { PortalNotification } from '../types';
import { useAuth } from './AuthContext';

interface NotificationContextValue {
  notifications: PortalNotification[];
  unreadCount: number;
  loading: boolean;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  refresh: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextValue | null>(null);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<PortalNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const sourceRef = useRef<EventSource | null>(null);

  const refresh = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [list, count] = await Promise.all([
        getNotifications(),
        getNotificationUnreadCount(),
      ]);
      setNotifications(list);
      setUnreadCount(count);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!user) {
      setNotifications([]);
      setUnreadCount(0);
      sourceRef.current?.close();
      sourceRef.current = null;
      return;
    }

    void refresh();

    const token = getToken();
    if (!token) return;

    const base = import.meta.env.VITE_API_URL || '/api';
    const url = `${base}/notifications/stream?token=${encodeURIComponent(token)}`;
    const source = new EventSource(url);
    sourceRef.current = source;

    source.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data) as
          | { type: 'notification'; notification: PortalNotification }
          | { type: 'unread_count'; count: number }
          | { type: 'heartbeat' };

        if (payload.type === 'notification') {
          setNotifications((prev) => {
            const exists = prev.some((n) => n.id === payload.notification.id);
            if (exists) return prev;
            return [payload.notification, ...prev].slice(0, 50);
          });
        } else if (payload.type === 'unread_count') {
          setUnreadCount(payload.count);
        }
      } catch {
        /* ignore malformed events */
      }
    };

    source.onerror = () => {
      source.close();
      sourceRef.current = null;
    };

    return () => {
      source.close();
      sourceRef.current = null;
    };
  }, [user, refresh]);

  const markRead = useCallback(async (id: string) => {
    await markNotificationRead(id);
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n)),
    );
    setUnreadCount((c) => Math.max(0, c - 1));
  }, []);

  const markAllRead = useCallback(async () => {
    await markAllNotificationsRead();
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
  }, []);

  return (
    <NotificationContext.Provider
      value={{ notifications, unreadCount, loading, markRead, markAllRead, refresh }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotifications must be used within NotificationProvider');
  return ctx;
}
