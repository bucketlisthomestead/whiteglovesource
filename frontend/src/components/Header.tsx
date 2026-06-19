import { Link, NavLink } from 'react-router-dom';
import { Menu, X, LogOut } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSiteContentSection } from '../context/SiteContentContext';
import { useSiteMenu } from '../context/SiteMenuContext';
import { isMenuItemVisible } from '../lib/filterMenuItems';
import { portalHome } from '../lib/portalNav';

export function Header() {
  const [open, setOpen] = useState(false);
  const { user, logout } = useAuth();
  const { data: header } = useSiteContentSection('header');
  const { menu } = useSiteMenu();

  const links = useMemo(() => {
    return menu.headerNav.filter((link) =>
      isMenuItemVisible(link.visibleWhen, Boolean(user)),
    );
  }, [menu.headerNav, user]);

  return (
    <header className="app-chrome sticky top-0 z-50 bg-cream/95 backdrop-blur-md border-b border-cream-dark">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14 md:h-20">
          <Link to="/" className="flex flex-col leading-tight" onClick={() => setOpen(false)}>
            <span className="font-serif text-lg md:text-2xl tracking-wide text-charcoal">
              {header.brandPrimary}
            </span>
            <span className="text-[9px] md:text-xs uppercase tracking-[0.25em] text-gold">
              {header.brandSecondary}
            </span>
          </Link>

          <nav className="hidden lg:flex items-center gap-6">
            {links.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                className={({ isActive }) =>
                  `text-sm uppercase tracking-wider transition-colors ${
                    isActive ? 'text-gold' : 'text-charcoal/70 hover:text-charcoal'
                  }`
                }
              >
                {link.label}
              </NavLink>
            ))}
            {user ? (
              <div className="flex items-center gap-3 ml-2">
                <Link
                  to={portalHome(user.role)}
                  className="px-4 py-2.5 bg-charcoal text-cream text-sm uppercase tracking-wider hover:bg-charcoal-light transition-colors"
                >
                  Portal
                </Link>
                <span className="text-xs text-charcoal/50 hidden xl:inline">{user.name}</span>
                <button
                  type="button"
                  onClick={logout}
                  className="p-2 text-charcoal/50 hover:text-charcoal"
                  aria-label="Sign out"
                >
                  <LogOut size={18} />
                </button>
              </div>
            ) : (
              <Link
                to="/login"
                className="ml-2 px-5 py-2.5 bg-charcoal text-cream text-sm uppercase tracking-wider hover:bg-charcoal-light transition-colors"
              >
                Sign In
              </Link>
            )}
          </nav>

          <button
            type="button"
            className="lg:hidden p-3 -mr-2 text-charcoal min-w-[44px] min-h-[44px] flex items-center justify-center"
            onClick={() => setOpen(!open)}
            aria-label="Toggle menu"
          >
            {open ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {open && (
        <nav className="lg:hidden border-t border-cream-dark bg-cream px-4 py-4 space-y-1 max-h-[70vh] overflow-y-auto">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                `block py-3.5 px-2 text-sm uppercase tracking-wider min-h-[44px] ${
                  isActive ? 'text-gold' : 'text-charcoal/70'
                }`
              }
            >
              {link.label}
            </NavLink>
          ))}
          {user ? (
            <>
              <Link
                to={portalHome(user.role)}
                onClick={() => setOpen(false)}
                className="block mt-2 text-center py-3.5 bg-charcoal text-cream text-sm uppercase tracking-wider min-h-[48px] flex items-center justify-center"
              >
                Open Portal
              </Link>
              <button
                type="button"
                onClick={() => { logout(); setOpen(false); }}
                className="flex items-center gap-2 w-full py-3.5 px-2 text-sm uppercase tracking-wider text-charcoal/70 min-h-[44px]"
              >
                <LogOut size={16} /> Sign Out ({user.name})
              </button>
            </>
          ) : (
            <Link
              to="/login"
              onClick={() => setOpen(false)}
              className="block mt-2 text-center py-3.5 bg-charcoal text-cream text-sm uppercase tracking-wider min-h-[48px] flex items-center justify-center"
            >
              Sign In
            </Link>
          )}
        </nav>
      )}
    </header>
  );
}
