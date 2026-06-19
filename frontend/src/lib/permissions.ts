export const PERMISSIONS = {
  DASHBOARD_VIEW: 'dashboard.view',
  QUOTES_VIEW: 'quotes.view',
  QUOTES_MANAGE: 'quotes.manage',
  PROJECTS_VIEW: 'projects.view',
  PROJECTS_MANAGE: 'projects.manage',
  PROJECTS_ADVANCE: 'projects.advance',
  USERS_VIEW: 'users.view',
  USERS_MANAGE: 'users.manage',
  ROLES_MANAGE: 'roles.manage',
  SETTINGS_MANAGE: 'settings.manage',
  WAREHOUSES_MANAGE: 'warehouses.manage',
  FIELD_USE: 'field.use',
  SITE_CONTENT_EDIT: 'site.content.edit',
  SITE_CONTENT_PREVIEW: 'site.content.preview',
  SITE_CONTENT_FEEDBACK: 'site.content.feedback',
  SITE_CONTENT_PUBLISH: 'site.content.publish',
  SITE_MENU_EDIT: 'site.menu.edit',
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export function hasPermission(
  permissions: Permission[] | undefined,
  permission: Permission,
  role?: string,
) {
  if (role === 'admin') return true;
  return permissions?.includes(permission) ?? false;
}

export function hasAnyPermission(
  permissions: Permission[] | undefined,
  required: Permission[],
  role?: string,
) {
  if (role === 'admin') return true;
  if (!permissions?.length) return false;
  return required.some((p) => permissions.includes(p));
}
