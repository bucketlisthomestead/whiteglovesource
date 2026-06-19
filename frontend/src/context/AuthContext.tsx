import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { login as apiLogin, setToken } from '../api/client';
import type { AuthUser, Permission } from '../types';
import { hasAnyPermission, hasPermission as checkPermission } from '../lib/permissions';

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<AuthUser>;
  logout: () => void;
  isAdmin: boolean;
  isDesigner: boolean;
  isClient: boolean;
  hasPermission: (permission: Permission) => boolean;
  hasAnyPermission: (permissions: Permission[]) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem('wgds_user');
    if (stored) {
      try { setUser(JSON.parse(stored)); } catch { /* ignore */ }
    }
    setLoading(false);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await apiLogin(email, password);
    setToken(res.accessToken);
    localStorage.setItem('wgds_user', JSON.stringify(res.user));
    setUser(res.user);
    return res.user;
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    localStorage.removeItem('wgds_user');
    setUser(null);
  }, []);

  const hasPermission = useCallback(
    (permission: Permission) => checkPermission(user?.permissions, permission, user?.role),
    [user],
  );

  const hasAnyPermissionFn = useCallback(
    (permissions: Permission[]) => hasAnyPermission(user?.permissions, permissions, user?.role),
    [user],
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        logout,
        isAdmin: user?.role === 'admin',
        isDesigner: user?.role === 'designer',
        isClient: user?.role === 'client',
        hasPermission,
        hasAnyPermission: hasAnyPermissionFn,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
