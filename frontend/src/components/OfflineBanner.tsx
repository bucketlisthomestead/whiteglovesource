import { Wifi, WifiOff, CloudOff, RefreshCw } from 'lucide-react';
import { useOffline } from '../context/OfflineContext';
import { processSyncQueue } from '../offline/sync';
import { useState } from 'react';

export function OfflineBanner() {
  const { isOnline, pendingCount, refreshPending, lastSync } = useOffline();
  const [syncing, setSyncing] = useState(false);

  const handleSync = async () => {
    setSyncing(true);
    await processSyncQueue();
    await refreshPending();
    setSyncing(false);
  };

  if (isOnline && pendingCount === 0) return null;

  return (
    <div
      className={`app-chrome sticky top-16 md:top-20 z-40 px-4 py-2.5 text-sm flex items-center justify-between gap-3 ${
        isOnline ? 'bg-amber-50 text-amber-900 border-b border-amber-200' : 'bg-charcoal text-cream border-b border-charcoal-light'
      }`}
    >
      <div className="flex items-center gap-2 min-w-0">
        {isOnline ? (
          <CloudOff size={16} className="shrink-0" />
        ) : (
          <WifiOff size={16} className="shrink-0" />
        )}
        <span className="truncate">
          {!isOnline
            ? 'Offline — changes will sync when connected'
            : `${pendingCount} update${pendingCount !== 1 ? 's' : ''} waiting to sync`}
        </span>
      </div>

      {isOnline && pendingCount > 0 && (
        <button
          type="button"
          onClick={handleSync}
          disabled={syncing}
          className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-amber-200 hover:bg-amber-300 rounded text-xs uppercase tracking-wider font-medium transition-colors"
        >
          <RefreshCw size={12} className={syncing ? 'animate-spin' : ''} />
          Sync Now
        </button>
      )}

      {isOnline && lastSync && lastSync.synced > 0 && pendingCount === 0 && (
        <span className="text-xs text-emerald-700 flex items-center gap-1">
          <Wifi size={12} /> Synced {lastSync.synced}
        </span>
      )}
    </div>
  );
}
