import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import type { Permission, UserRole } from '../types';
import { portalFallback } from '../lib/portalNav';

interface ProtectedRouteProps {
  children: React.ReactNode;
  roles?: UserRole[];
  permissions?: Permission[];
  permissionMode?: 'any' | 'all';
}

export function ProtectedRoute({
  children,
  roles,
  permissions,
  permissionMode = 'any',
}: ProtectedRouteProps) {
  const { user, loading, hasPermission, hasAnyPermission } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="w-8 h-8 border-2 border-gold border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (roles && !roles.includes(user.role)) {
    return <Navigate to={portalFallback(user.role, user.permissions)} replace />;
  }

  if (permissions?.length) {
    const allowed =
      permissionMode === 'all'
        ? permissions.every((p) => hasPermission(p))
        : hasAnyPermission(permissions);
    if (!allowed) {
      return <Navigate to={portalFallback(user.role, user.permissions)} replace />;
    }
  }

  return <>{children}</>;
}
