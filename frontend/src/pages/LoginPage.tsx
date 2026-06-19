import { useEffect, useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { PageHeader, FormField, Button, inputClass } from '../components/Layout';
import { useAuth } from '../context/AuthContext';
import { portalHome } from '../lib/portalNav';
import { AlertCircle } from 'lucide-react';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: { pathname: string } })?.from?.pathname;

  useEffect(() => {
    if (user) {
      navigate(from || portalHome(user.role, user.permissions), { replace: true });
    }
  }, [user, from, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const loggedIn = await login(email, password);
      navigate(from || portalHome(loggedIn.role, loggedIn.permissions), { replace: true });
    } catch {
      setError('Invalid email or password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <PageHeader
        eyebrow="Portal Access"
        title="Sign In"
        subtitle="Designers, clients, and admin — access your projects and field tools."
      />

      <section className="max-w-sm mx-auto px-4 py-8 md:py-12 pb-24">
        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 text-sm">
              <AlertCircle size={16} /> {error}
            </div>
          )}

          <FormField label="Email" required>
            <input
              type="email"
              className={inputClass}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
          </FormField>

          <FormField label="Password" required>
            <input
              type="password"
              className={inputClass}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </FormField>

          <Button type="submit" loading={loading} className="w-full min-h-[48px]">
            Sign In
          </Button>
        </form>

        <div className="mt-8 p-4 bg-cream-dark/50 text-xs text-charcoal/50 space-y-1">
          <p className="font-medium text-charcoal/70">Demo accounts (password: password123)</p>
          <p>Admin: admin@whiteglovedeliverync.com</p>
          <p>Designer: sarah@whitfieldinteriors.com</p>
          <p>Client: morrison@example.com</p>
        </div>

        <p className="mt-6 text-center text-sm text-charcoal/50">
          <Link to="/demo" className="text-gold hover:underline">View public demo</Link> without signing in
        </p>
      </section>
    </>
  );
}
