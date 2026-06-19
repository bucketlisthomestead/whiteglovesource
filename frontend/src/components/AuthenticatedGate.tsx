import { Outlet } from 'react-router-dom';
import { Header } from './Header';
import { Footer } from './Footer';
import { BottomNav } from './BottomNav';
import { OfflineBanner } from './OfflineBanner';
import { AdminLayout } from './AdminLayout';
import { useAuth } from '../context/AuthContext';
import { Loader2 } from 'lucide-react';

/** Routes app pages through the control panel when signed in, public chrome when not. */
export function AuthenticatedGate() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="animate-spin text-gold" size={32} />
      </div>
    );
  }

  if (user) {
    return <AdminLayout />;
  }

  return (
    <>
      <Header />
      <OfflineBanner />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
      <BottomNav />
    </>
  );
}
