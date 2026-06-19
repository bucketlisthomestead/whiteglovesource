import type { SiteMenuConfig } from './site-menu.types';

export const DEFAULT_SITE_MENU: SiteMenuConfig = {
  headerNav: [
    { to: '/', label: 'Home', visibleWhen: 'always' },
    { to: '/services', label: 'Services', visibleWhen: 'always' },
    { to: '/quote', label: 'Get a Quote', visibleWhen: 'always' },
    { to: '/contact', label: 'Contact', visibleWhen: 'always' },
    { to: '/demo', label: 'Demo', visibleWhen: 'loggedIn' },
    { to: '/projects', label: 'Projects', visibleWhen: 'loggedOut' },
  ],
  footerNav: [
    { to: '/services', label: 'Services' },
    { to: '/demo', label: 'Live Project Demo' },
    { to: '/quote', label: 'Request a Quote' },
    { to: '/contact', label: 'Contact Us' },
  ],
  mobileNav: [
    { to: '/', label: 'Home', icon: 'Home', visibleWhen: 'always' },
    { to: '/projects', label: 'Projects', icon: 'FolderOpen', visibleWhen: 'always' },
    { to: '/login', label: 'Login', icon: 'LogIn', visibleWhen: 'loggedOut' },
  ],
};
