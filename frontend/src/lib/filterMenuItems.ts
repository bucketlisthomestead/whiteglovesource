import type { SiteMenuVisibility } from '../types/siteMenu';

export function isMenuItemVisible(
  visibleWhen: SiteMenuVisibility | undefined,
  isLoggedIn: boolean,
): boolean {
  if (!visibleWhen || visibleWhen === 'always') return true;
  if (visibleWhen === 'loggedIn') return isLoggedIn;
  return !isLoggedIn;
}
