import type { Permission, UserRole } from '../types';
import { PERMISSIONS, hasAnyPermission, hasPermission } from './permissions';

export function portalHome(role: UserRole, permissions?: Permission[]) {
  if (hasPermission(permissions, PERMISSIONS.DASHBOARD_VIEW, role)) return '/admin';
  if (hasAnyPermission(permissions, [PERMISSIONS.QUOTES_VIEW, PERMISSIONS.USERS_VIEW], role)) {
    return '/admin/quotes';
  }
  return '/projects';
}

export function portalEyebrow(role: UserRole) {
  if (role === 'admin') return 'White Glove · Admin';
  if (role === 'designer') return 'White Glove · Designer';
  if (role === 'operations') return 'White Glove · Operations';
  return 'White Glove · Client';
}

export function canUseFieldTool(role: UserRole, permissions?: Permission[]) {
  return hasPermission(permissions, PERMISSIONS.FIELD_USE, role);
}

export function portalFallback(role: UserRole, permissions?: Permission[]) {
  return portalHome(role, permissions);
}

export function canAccessAdminArea(role: UserRole, permissions?: Permission[]) {
  return hasAnyPermission(
    permissions,
    [
      PERMISSIONS.DASHBOARD_VIEW,
      PERMISSIONS.QUOTES_VIEW,
      PERMISSIONS.USERS_VIEW,
      PERMISSIONS.SETTINGS_MANAGE,
      PERMISSIONS.ROLES_MANAGE,
    ],
    role,
  );
}
