import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import { startAutoSync, stopAutoSync } from '../offline/sync';
import { getPendingSyncCount } from '../offline/db';
import { useAuth } from './AuthContext';

interface OfflineContextValue {
  isOnline: boolean;
  pendingCount: number;
  refreshPending: () => Promise<void>;
  lastSync: { synced: number; failed: number } | null;
}

const OfflineContext = createContext<OfflineContextValue | null>(null);

export function OfflineProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);
  const [lastSync, setLastSync] = useState<{ synced: number; failed: number } | null>(null);

  const refreshPending = useCallback(async () => {
    const count = await getPendingSyncCount();
    setPendingCount(count);
  }, []);

  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    refreshPending();
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, [refreshPending]);

  useEffect(() => {
    if (!user || (user.role !== 'admin' && user.role !== 'designer')) return;

    startAutoSync((result) => {
      setLastSync(result);
      refreshPending();
    });
    return () => stopAutoSync();
  }, [user, refreshPending]);

  return (
    <OfflineContext.Provider value={{ isOnline, pendingCount, refreshPending, lastSync }}>
      {children}
    </OfflineContext.Provider>
  );
}

export function useOffline() {
  const ctx = useContext(OfflineContext);
  if (!ctx) throw new Error('useOffline must be used within OfflineProvider');
  return ctx;
}
