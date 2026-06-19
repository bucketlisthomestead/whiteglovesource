import { useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  FolderOpen,
  Camera,
  FileText,
  Globe,
  LogOut,
  Menu,
  PencilLine,
  X,
  Shield,
  Users,
  Settings,
  Printer,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { NotificationBell } from './NotificationBell';
import { useOffline } from '../context/OfflineContext';
import { canUseFieldTool, portalEyebrow, portalHome, canAccessAdminArea } from '../lib/portalNav';
import { PERMISSIONS } from '../lib/permissions';

export function AdminLayout() {
  const { user, logout, hasPermission, hasAnyPermission } = useAuth();
  const { pendingCount } = useOffline();
  const { pathname } = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const showAdminNav = canAccessAdminArea(user!.role, user?.permissions);
  const showDashboard = hasPermission(PERMISSIONS.DASHBOARD_VIEW);
  const showUsers = hasAnyPermission([PERMISSIONS.USERS_VIEW, PERMISSIONS.USERS_MANAGE]);
  const showSettings = hasAnyPermission([PERMISSIONS.SETTINGS_MANAGE, PERMISSIONS.ROLES_MANAGE]);
  const showSiteContent = hasPermission(PERMISSIONS.SITE_CONTENT_EDIT);
  const showSiteMenu = hasPermission(PERMISSIONS.SITE_MENU_EDIT);
  const showQuotes = hasPermission(PERMISSIONS.QUOTES_VIEW);
  const showLabels = hasAnyPermission([PERMISSIONS.PROJECTS_MANAGE, PERMISSIONS.FIELD_USE]);

  const role = user!.role;
  const homeTo = portalHome(role, user?.permissions);
  const showField = canUseFieldTool(role, user?.permissions);

  const pageTitle = pathname.startsWith('/admin/users')
    ? 'Users & Roles'
    : pathname.startsWith('/admin/settings')
      ? 'Settings'
      : pathname.startsWith('/admin/site-menu')
        ? 'Site Menu'
        : pathname.startsWith('/admin/site-content')
          ? 'Site Content'
        : pathname === '/admin/quotes'
          ? 'Quotes'
          : pathname.startsWith('/admin/quotes/')
            ? 'Quote'
            : pathname.startsWith('/admin/labels')
              ? 'Labels'
            : pathname.startsWith('/project/')
      ? 'Project'
      : pathname.startsWith('/projects')
        ? 'Projects'
        : pathname.startsWith('/field')
          ? 'Field Tool'
          : pathname.startsWith('/admin')
            ? 'Dashboard'
            : 'Control Panel';

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 px-3 py-2.5 text-sm rounded transition-colors min-h-[44px] ${
      isActive
        ? 'bg-gold/15 text-gold border border-gold/25'
        : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/80 border border-transparent'
    }`;

  const sidebar = (
    <div className="flex flex-col h-full">
      <div className="px-4 py-5 border-b border-zinc-800">
        <Link to={homeTo} className="flex items-center gap-3" onClick={() => setSidebarOpen(false)}>
          <div className="w-9 h-9 rounded bg-gold/15 border border-gold/30 flex items-center justify-center shrink-0">
            <Shield size={18} className="text-gold" />
          </div>
          <div className="leading-tight min-w-0">
            <p className="text-[10px] uppercase tracking-[0.2em] text-gold">Portal</p>
            <p className="font-serif text-lg text-zinc-100 truncate">Control Panel</p>
          </div>
        </Link>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-6 overflow-y-auto">
        {showAdminNav && (
          <div>
            <p className="px-3 mb-2 text-[10px] uppercase tracking-[0.2em] text-zinc-600">Overview</p>
            <div className="space-y-1">
              {showDashboard && (
              <NavLink
                to="/admin"
                end
                className={navLinkClass}
                onClick={() => setSidebarOpen(false)}
              >
                <LayoutDashboard size={18} className="shrink-0" />
                Dashboard
              </NavLink>
              )}
              {showUsers && (
              <NavLink
                to="/admin/users"
                className={navLinkClass}
                onClick={() => setSidebarOpen(false)}
              >
                <Users size={18} className="shrink-0" />
                Users & Roles
              </NavLink>
              )}
              {showSettings && (
              <NavLink
                to="/admin/settings"
                className={navLinkClass}
                onClick={() => setSidebarOpen(false)}
              >
                <Settings size={18} className="shrink-0" />
                Settings
              </NavLink>
              )}
              {showSiteMenu && (
              <NavLink
                to="/admin/site-menu"
                className={navLinkClass}
                onClick={() => setSidebarOpen(false)}
              >
                <Menu size={18} className="shrink-0" />
                Site Menu
              </NavLink>
              )}
              {showSiteContent && (
              <NavLink
                to="/admin/site-content"
                className={navLinkClass}
                onClick={() => setSidebarOpen(false)}
              >
                <PencilLine size={18} className="shrink-0" />
                Site Content
              </NavLink>
              )}
            </div>
          </div>
        )}

        <div>
          <p className="px-3 mb-2 text-[10px] uppercase tracking-[0.2em] text-zinc-600">Workspace</p>
          <div className="space-y-1">
            <NavLink
              to="/projects"
              end
              className={navLinkClass}
              onClick={() => setSidebarOpen(false)}
            >
              <FolderOpen size={18} className="shrink-0" />
              Projects
            </NavLink>
            {showQuotes && (
              <NavLink
                to="/admin/quotes"
                className={navLinkClass}
                onClick={() => setSidebarOpen(false)}
              >
                <FileText size={18} className="shrink-0" />
                Quotes
              </NavLink>
            )}
            {showLabels && (
              <NavLink
                to="/admin/labels"
                className={navLinkClass}
                onClick={() => setSidebarOpen(false)}
              >
                <Printer size={18} className="shrink-0" />
                Labels
              </NavLink>
            )}
            {showField && (
              <NavLink
                to="/field"
                end
                className={navLinkClass}
                onClick={() => setSidebarOpen(false)}
              >
                <Camera size={18} className="shrink-0" />
                <span className="flex-1">Field Tool</span>
                {pendingCount > 0 && (
                  <span className="px-1.5 py-0.5 bg-amber-500 text-white text-[9px] rounded-full font-bold min-w-[18px] text-center">
                    {pendingCount > 9 ? '9+' : pendingCount}
                  </span>
                )}
              </NavLink>
            )}
          </div>
        </div>

        <div>
          <p className="px-3 mb-2 text-[10px] uppercase tracking-[0.2em] text-zinc-600">Site</p>
          <Link
            to="/"
            className="flex items-center gap-3 px-3 py-2.5 text-sm rounded text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/80 min-h-[44px] transition-colors"
            onClick={() => setSidebarOpen(false)}
          >
            <Globe size={18} className="shrink-0" />
            View Public Site
          </Link>
        </div>
      </nav>

      <div className="px-3 py-4 border-t border-zinc-800">
        <div className="px-3 py-2 mb-2">
          <p className="text-sm text-zinc-200 truncate">{user?.name}</p>
          <p className="text-[10px] text-zinc-500 truncate capitalize">{role} · {user?.email}</p>
        </div>
        <button
          type="button"
          onClick={logout}
          className="flex items-center gap-3 w-full px-3 py-2.5 text-sm text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/80 rounded min-h-[44px] transition-colors"
        >
          <LogOut size={18} />
          Sign Out
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex bg-zinc-950 text-zinc-100">
      <aside className="app-chrome hidden lg:flex w-64 shrink-0 border-r border-zinc-800 bg-zinc-900 flex-col fixed inset-y-0 left-0 z-40">
        {sidebar}
      </aside>

      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          <button
            type="button"
            className="absolute inset-0 bg-black/60"
            aria-label="Close menu"
            onClick={() => setSidebarOpen(false)}
          />
          <aside className="app-chrome absolute inset-y-0 left-0 w-72 max-w-[85vw] bg-zinc-900 border-r border-zinc-800 flex flex-col shadow-2xl">
            <button
              type="button"
              onClick={() => setSidebarOpen(false)}
              className="absolute top-4 right-4 p-2 text-zinc-400 min-h-[44px] min-w-[44px] flex items-center justify-center"
              aria-label="Close"
            >
              <X size={20} />
            </button>
            {sidebar}
          </aside>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0 lg:pl-64">
        <header className="app-chrome sticky top-0 z-30 flex items-center justify-between gap-4 px-4 h-14 border-b border-zinc-800 bg-zinc-900/95 backdrop-blur-md">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 -ml-2 text-zinc-400 hover:text-zinc-100 min-h-[44px] min-w-[44px] flex items-center justify-center"
              aria-label="Open menu"
            >
              <Menu size={22} />
            </button>
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-[0.2em] text-gold hidden sm:block">
                {portalEyebrow(role)}
              </p>
              <h1 className="font-serif text-xl text-zinc-100 truncate">{pageTitle}</h1>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <NotificationBell />
            <Link
              to="/"
              className="hidden sm:inline-flex items-center gap-2 px-3 py-2 text-xs uppercase tracking-wider text-zinc-400 hover:text-gold border border-zinc-700 hover:border-gold/40 rounded transition-colors min-h-[40px]"
            >
              <Globe size={14} />
              Public Site
            </Link>
          </div>
        </header>

        <main className="flex-1 bg-zinc-100 text-charcoal overflow-auto pb-20 lg:pb-6">
          <Outlet />
        </main>

        <nav className="app-chrome lg:hidden fixed bottom-0 inset-x-0 z-30 bg-zinc-900 border-t border-zinc-800 safe-area-pb">
          <div className="flex items-stretch justify-around">
            {showDashboard && (
              <NavLink
                to="/admin"
                end
                className={({ isActive }) =>
                  `flex flex-col items-center justify-center py-2 px-2 min-w-[64px] min-h-[56px] text-[10px] uppercase tracking-wider ${
                    isActive ? 'text-gold' : 'text-zinc-500'
                  }`
                }
              >
                <LayoutDashboard size={20} />
                Home
              </NavLink>
            )}
            <NavLink
              to="/projects"
              end
              className={({ isActive }) =>
                `flex flex-col items-center justify-center py-2 px-2 min-w-[64px] min-h-[56px] text-[10px] uppercase tracking-wider ${
                  isActive ? 'text-gold' : 'text-zinc-500'
                }`
              }
            >
              <FolderOpen size={20} />
              Projects
            </NavLink>
            {showField && (
              <NavLink
                to="/field"
                end
                className={({ isActive }) =>
                  `relative flex flex-col items-center justify-center py-2 px-2 min-w-[64px] min-h-[56px] text-[10px] uppercase tracking-wider ${
                    isActive ? 'text-gold' : 'text-zinc-500'
                  }`
                }
              >
                <Camera size={20} />
                Field
                {pendingCount > 0 && (
                  <span className="absolute top-1 right-2 w-4 h-4 bg-amber-500 text-white text-[9px] rounded-full flex items-center justify-center font-bold">
                    {pendingCount > 9 ? '9+' : pendingCount}
                  </span>
                )}
              </NavLink>
            )}
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="flex flex-col items-center justify-center py-2 px-2 min-w-[64px] min-h-[56px] text-[10px] uppercase tracking-wider text-zinc-500"
            >
              <Menu size={20} />
              More
            </button>
          </div>
        </nav>
      </div>
    </div>
  );
}
