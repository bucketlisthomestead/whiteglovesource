export type SiteMenuVisibility = 'always' | 'loggedIn' | 'loggedOut';

export type SiteMenuNavItem = {
  to: string;
  label: string;
  visibleWhen?: SiteMenuVisibility;
};

export type SiteMenuMobileNavItem = {
  to: string;
  label: string;
  icon?: string;
  visibleWhen?: SiteMenuVisibility;
};

export type SiteMenuConfig = {
  headerNav: SiteMenuNavItem[];
  footerNav: SiteMenuNavItem[];
  mobileNav: SiteMenuMobileNavItem[];
};

export type SiteMenuVersionSummary = {
  id: string;
  changedByUserId: string;
  changedByName: string;
  changeNote: string | null;
  isRestore: boolean;
  restoredFromVersionId: string | null;
  createdAt: string;
};

export type SiteMenuVersionDetail = SiteMenuVersionSummary & {
  content: string;
  parsedContent: SiteMenuConfig;
};

export type SiteMenuAdminState = {
  menu: SiteMenuConfig;
  publishedMenu: SiteMenuConfig;
  hasChanges: boolean;
};
