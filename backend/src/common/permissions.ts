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

export const ALL_PERMISSIONS: Permission[] = Object.values(PERMISSIONS);

export type PermissionDefinition = {
  key: Permission;
  label: string;
  description: string;
  group: string;
};

export const PERMISSION_DEFINITIONS: PermissionDefinition[] = [
  {
    key: PERMISSIONS.DASHBOARD_VIEW,
    label: 'View dashboard',
    description: 'Operations dashboard and pipeline stats',
    group: 'Operations',
  },
  {
    key: PERMISSIONS.QUOTES_VIEW,
    label: 'View quotes',
    description: 'Browse quote requests and details',
    group: 'Quotes',
  },
  {
    key: PERMISSIONS.QUOTES_MANAGE,
    label: 'Manage quotes',
    description: 'Edit quotes, send to clients, archive',
    group: 'Quotes',
  },
  {
    key: PERMISSIONS.PROJECTS_VIEW,
    label: 'View projects',
    description: 'Open project portals and inventory',
    group: 'Projects',
  },
  {
    key: PERMISSIONS.PROJECTS_MANAGE,
    label: 'Manage projects',
    description: 'Edit project settings, pieces, and documents',
    group: 'Projects',
  },
  {
    key: PERMISSIONS.PROJECTS_ADVANCE,
    label: 'Advance project phases',
    description: 'Move projects to the next workflow phase',
    group: 'Projects',
  },
  {
    key: PERMISSIONS.USERS_VIEW,
    label: 'View users',
    description: 'See team members and assignments',
    group: 'Team',
  },
  {
    key: PERMISSIONS.USERS_MANAGE,
    label: 'Manage users',
    description: 'Create, edit, and deactivate user accounts',
    group: 'Team',
  },
  {
    key: PERMISSIONS.ROLES_MANAGE,
    label: 'Manage roles & permissions',
    description: 'Create roles and assign capabilities',
    group: 'Team',
  },
  {
    key: PERMISSIONS.SETTINGS_MANAGE,
    label: 'Manage business settings',
    description: 'Pricing, business profile, and defaults',
    group: 'Administration',
  },
  {
    key: PERMISSIONS.WAREHOUSES_MANAGE,
    label: 'Manage warehouses',
    description: 'Add and edit storage locations',
    group: 'Administration',
  },
  {
    key: PERMISSIONS.FIELD_USE,
    label: 'Use field tool',
    description: 'Mobile piece updates and photo capture',
    group: 'Field',
  },
  {
    key: PERMISSIONS.SITE_CONTENT_EDIT,
    label: 'Edit site content',
    description: 'Create and update pending site content drafts',
    group: 'Administration',
  },
  {
    key: PERMISSIONS.SITE_CONTENT_PREVIEW,
    label: 'Preview site content drafts',
    description: 'View unpublished marketing copy on public pages',
    group: 'Administration',
  },
  {
    key: PERMISSIONS.SITE_CONTENT_FEEDBACK,
    label: 'Comment on site content drafts',
    description: 'Leave feedback on pending site content changes',
    group: 'Administration',
  },
  {
    key: PERMISSIONS.SITE_CONTENT_PUBLISH,
    label: 'Publish site content',
    description: 'Write approved drafts to the live site',
    group: 'Administration',
  },
  {
    key: PERMISSIONS.SITE_MENU_EDIT,
    label: 'Edit site menu',
    description: 'Manage public site navigation links',
    group: 'Administration',
  },
];

export const DEFAULT_ROLE_PERMISSIONS: Record<string, Permission[]> = {
  admin: [...ALL_PERMISSIONS],
  designer: [
    PERMISSIONS.PROJECTS_VIEW,
    PERMISSIONS.PROJECTS_MANAGE,
    PERMISSIONS.FIELD_USE,
  ],
  client: [PERMISSIONS.PROJECTS_VIEW],
  operations: [
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.QUOTES_VIEW,
    PERMISSIONS.QUOTES_MANAGE,
    PERMISSIONS.PROJECTS_VIEW,
    PERMISSIONS.PROJECTS_MANAGE,
    PERMISSIONS.PROJECTS_ADVANCE,
    PERMISSIONS.USERS_VIEW,
    PERMISSIONS.WAREHOUSES_MANAGE,
  ],
};

export const SYSTEM_ROLE_SLUGS = ['admin', 'designer', 'client'] as const;
