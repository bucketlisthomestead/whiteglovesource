/** Maps public routes to site content section keys. */
export const PUBLIC_PATH_CONTENT_KEYS: Record<string, string> = {
  '/': 'home',
  '/services': 'services',
  '/contact': 'contact',
};

/** Maps section keys to the public page where draft content is visible. */
export const CONTENT_KEY_PUBLIC_PATH: Record<string, string> = {
  home: '/',
  services: '/services',
  contact: '/contact',
  header: '/',
  footer: '/',
};

export const PAGE_CONTENT_SECTION_KEYS = ['home', 'services', 'contact'] as const;

export function contentKeyForPublicPath(pathname: string): string | null {
  return PUBLIC_PATH_CONTENT_KEYS[pathname] ?? null;
}

export function publicPathForContentKey(key: string | null): string {
  if (!key) return '/';
  return CONTENT_KEY_PUBLIC_PATH[key] ?? '/';
}

export function adminEditorPathForContentKey(key: string | null): string {
  if (!key) return '/admin/site-content';
  return `/admin/site-content?section=${encodeURIComponent(key)}`;
}

/** Append ?live=1 so preview users see published content only. */
export function publicPathWithLiveOverride(path: string): string {
  const [pathname, search = ''] = path.split('?');
  const params = new URLSearchParams(search);
  params.set('live', '1');
  const qs = params.toString();
  return `${pathname}?${qs}`;
}

/** Remove live override from the current public URL (back to draft preview). */
export function publicPathWithoutLiveOverride(pathname: string, search: string): string {
  const params = new URLSearchParams(search);
  params.delete('live');
  const qs = params.toString();
  return pathname + (qs ? `?${qs}` : '');
}
