import { Outlet } from 'react-router-dom';
import { Header } from './Header';
import { Footer } from './Footer';
import { BottomNav } from './BottomNav';
import { OfflineBanner } from './OfflineBanner';
import { SiteContentProvider } from '../context/SiteContentContext';
import { SiteMenuProvider } from '../context/SiteMenuContext';
import { SiteContentPreviewBanner } from './SiteContentPreviewBanner';
import { SiteContentEditButton } from './SiteContentEditButton';

export function PublicShell() {
  return (
    <SiteContentProvider>
      <SiteMenuProvider>
        <Header />
        <SiteContentPreviewBanner />
        <OfflineBanner />
        <main className="flex-1">
          <Outlet />
        </main>
        <Footer />
        <SiteContentEditButton />
        <BottomNav />
      </SiteMenuProvider>
    </SiteContentProvider>
  );
}
