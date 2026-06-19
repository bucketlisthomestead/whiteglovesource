import { Link, useLocation } from 'react-router-dom';
import { Pencil } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { PERMISSIONS } from '../lib/permissions';
import { contentKeyForPublicPath } from '../lib/siteContentPreview';

export function SiteContentEditButton() {
  const { pathname } = useLocation();
  const { user, loading: authLoading, hasPermission } = useAuth();

  if (authLoading || !user) return null;
  if (!hasPermission(PERMISSIONS.SITE_CONTENT_EDIT)) return null;

  const contentKey = contentKeyForPublicPath(pathname);
  if (!contentKey) return null;

  return (
    <Link
      to={`/admin/site-content?section=${contentKey}`}
      className="fixed bottom-20 md:bottom-6 right-4 z-40 flex items-center gap-2 px-4 py-2.5 bg-charcoal text-cream text-sm shadow-lg border border-gold/30 hover:bg-charcoal/90 transition-colors"
      aria-label="Edit this page"
    >
      <Pencil size={16} className="text-gold shrink-0" />
      <span className="uppercase tracking-wider text-xs font-medium">Edit this page</span>
    </Link>
  );
}
