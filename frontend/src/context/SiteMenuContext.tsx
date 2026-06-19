import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { getPublicSiteMenu } from '../api/client';
import { SITE_MENU_DEFAULTS } from '../lib/siteMenuDefaults';
import type { SiteMenuConfig } from '../types/siteMenu';

type SiteMenuContextValue = {
  menu: SiteMenuConfig;
  loading: boolean;
};

const SiteMenuContext = createContext<SiteMenuContextValue>({
  menu: SITE_MENU_DEFAULTS,
  loading: true,
});

function mergeMenu(partial: Partial<SiteMenuConfig>): SiteMenuConfig {
  return {
    headerNav: partial.headerNav ?? SITE_MENU_DEFAULTS.headerNav,
    footerNav: partial.footerNav ?? SITE_MENU_DEFAULTS.footerNav,
    mobileNav: partial.mobileNav ?? SITE_MENU_DEFAULTS.mobileNav,
  };
}

export function SiteMenuProvider({ children }: { children: ReactNode }) {
  const [menu, setMenu] = useState<SiteMenuConfig>(SITE_MENU_DEFAULTS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);

    getPublicSiteMenu()
      .then((data) => {
        if (!active) return;
        setMenu(mergeMenu(data));
      })
      .catch(() => {
        if (!active) return;
        setMenu(SITE_MENU_DEFAULTS);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const value = useMemo(() => ({ menu, loading }), [menu, loading]);

  return (
    <SiteMenuContext.Provider value={value}>{children}</SiteMenuContext.Provider>
  );
}

export function useSiteMenu() {
  return useContext(SiteMenuContext);
}
