import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, CheckCheck, Loader2 } from 'lucide-react';
import { useNotifications } from '../context/NotificationContext';
import type { PortalNotification } from '../types';

function formatWhen(iso: string) {
  const date = new Date(iso);
  const diff = Date.now() - date.getTime();
  if (diff < 60_000) return 'Just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function notificationLink(n: PortalNotification) {
  if (n.quoteId) return `/admin/quotes/${n.quoteId}`;
  if (n.link) return n.link;
  if (n.projectId) return `/project/${n.projectId}`;
  return '/admin';
}

export function NotificationBell() {
  const { notifications, unreadCount, loading, markRead, markAllRead } = useNotifications();
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  const handleOpen = async (n: PortalNotification) => {
    if (!n.read) await markRead(n.id);
    setOpen(false);
  };

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative inline-flex items-center justify-center p-2 rounded border border-zinc-700 text-zinc-400 hover:text-gold hover:border-gold/40 transition-colors min-h-[40px] min-w-[40px]"
        aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ''}`}
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-gold text-zinc-950 text-[10px] font-bold rounded-full flex items-center justify-center">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-[min(22rem,calc(100vw-2rem))] bg-zinc-900 border border-zinc-700 rounded-lg shadow-2xl z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
            <p className="text-sm font-medium text-zinc-100">Notifications</p>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={() => void markAllRead()}
                className="inline-flex items-center gap-1 text-[11px] uppercase tracking-wider text-gold hover:text-gold/80"
              >
                <CheckCheck size={14} />
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {loading && notifications.length === 0 ? (
              <div className="flex justify-center py-8 text-zinc-500">
                <Loader2 size={20} className="animate-spin" />
              </div>
            ) : notifications.length === 0 ? (
              <p className="px-4 py-8 text-sm text-zinc-500 text-center">No notifications yet</p>
            ) : (
              <ul className="divide-y divide-zinc-800">
                {notifications.map((n) => (
                  <li key={n.id}>
                    <Link
                      to={notificationLink(n)}
                      onClick={() => void handleOpen(n)}
                      className={`block px-4 py-3 hover:bg-zinc-800/80 transition-colors ${
                        n.read ? 'opacity-70' : 'bg-gold/5'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium text-zinc-100 leading-snug">{n.title}</p>
                        {!n.read && (
                          <span className="mt-1.5 w-2 h-2 rounded-full bg-gold shrink-0" />
                        )}
                      </div>
                      <p className="mt-1 text-xs text-zinc-400 line-clamp-2">{n.body}</p>
                      <p className="mt-1.5 text-[10px] uppercase tracking-wider text-zinc-600">
                        {formatWhen(n.createdAt)}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
