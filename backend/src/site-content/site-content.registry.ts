export type SiteContentFileMeta = {
  key: string;
  label: string;
  description: string;
  group: string;
};

export const SITE_CONTENT_FILES: Record<string, SiteContentFileMeta> = {
  'home.json': {
    key: 'home',
    label: 'Home Page',
    description: 'Hero, services grid, portal section, and call-to-action',
    group: 'Pages',
  },
  'services.json': {
    key: 'services',
    label: 'Services Page',
    description: 'Page header and detailed service sections',
    group: 'Pages',
  },
  'contact.json': {
    key: 'contact',
    label: 'Contact Page',
    description: 'Contact page header and form intro copy',
    group: 'Pages',
  },
  'header.json': {
    key: 'header',
    label: 'Site Header',
    description: 'Brand name shown in the site header',
    group: 'Global',
  },
  'footer.json': {
    key: 'footer',
    label: 'Site Footer',
    description: 'Tagline, contact info, and copyright copy',
    group: 'Global',
  },
};

export const ALLOWED_CONTENT_EXTENSIONS = ['.json'] as const;

export const SITE_CONTENT_KEYS = Object.values(SITE_CONTENT_FILES).map((f) => f.key);
