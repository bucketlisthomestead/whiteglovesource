import { Link, useLocation } from 'react-router-dom';
import { useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSiteMenu } from '../context/SiteMenuContext';
import { isMenuItemVisible } from '../lib/filterMenuItems';
import { resolveSiteMenuIcon } from '../lib/siteMenuIcons';

export function BottomNav() {
  const { pathname } = useLocation();
  const { user } = useAuth();
  const { menu } = useSiteMenu();

  const links = useMemo(
    () =>
      menu.mobileNav.filter((link) =>
        isMenuItemVisible(link.visibleWhen, Boolean(user)),
      ),
    [menu.mobileNav, user],
  );

  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-50 bg-cream border-t border-cream-dark safe-area-pb">
      <div className="flex items-stretch justify-around">
        {links.map(({ to, label, icon }) => {
          const Icon = resolveSiteMenuIcon(icon);
          const active = pathname === to || (to !== '/' && pathname.startsWith(to));
          return (
            <Link
              key={to}
              to={to}
              className={`relative flex flex-col items-center justify-center py-2.5 px-3 min-w-[64px] min-h-[56px] transition-colors ${
                active ? 'text-gold' : 'text-charcoal/50'
              }`}
            >
              <Icon size={22} strokeWidth={active ? 2 : 1.5} />
              <span className="text-[10px] mt-0.5 uppercase tracking-wider">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
