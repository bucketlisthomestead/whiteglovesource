export type SiteMenuNavItem = {
  to: string;
  label: string;
  visibleWhen?: 'always' | 'loggedIn' | 'loggedOut';
};

export type SiteMenuMobileNavItem = {
  to: string;
  label: string;
  icon?: string;
  visibleWhen?: 'always' | 'loggedIn' | 'loggedOut';
};

export type SiteMenuConfig = {
  headerNav: SiteMenuNavItem[];
  footerNav: SiteMenuNavItem[];
  mobileNav: SiteMenuMobileNavItem[];
};
