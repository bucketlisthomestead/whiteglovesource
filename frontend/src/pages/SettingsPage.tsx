import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, Save, Settings, Shield, Building2, DollarSign } from 'lucide-react';
import { Button, FormField, inputClass } from '../components/Layout';
import { RoleManager } from '../components/RoleManager';
import { getAdminSettings, updateAdminSettings } from '../api/client';
import type { AppSettings } from '../types';
import { formatCurrency } from '../lib/labels';
import { useAuth } from '../context/AuthContext';
import { PERMISSIONS } from '../lib/permissions';

type SettingsTab = 'business' | 'pricing' | 'roles';

const TAB_META: Record<SettingsTab, { label: string; icon: typeof Building2 }> = {
  business: { label: 'Business', icon: Building2 },
  pricing: { label: 'Quote & pricing', icon: DollarSign },
  roles: { label: 'Roles & permissions', icon: Shield },
};

export function SettingsPage() {
  const { hasPermission } = useAuth();
  const canEditSettings = hasPermission(PERMISSIONS.SETTINGS_MANAGE);
  const canManageRoles = hasPermission(PERMISSIONS.ROLES_MANAGE);

  const availableTabs = useMemo(() => {
    const tabs: SettingsTab[] = [];
    if (canEditSettings) {
      tabs.push('business', 'pricing');
    }
    if (canManageRoles) {
      tabs.push('roles');
    }
    return tabs;
  }, [canEditSettings, canManageRoles]);

  const [activeTab, setActiveTab] = useState<SettingsTab>(() =>
    canEditSettings ? 'business' : 'roles',
  );
  const [form, setForm] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (availableTabs.length > 0 && !availableTabs.includes(activeTab)) {
      setActiveTab(availableTabs[0]);
    }
  }, [availableTabs, activeTab]);

  useEffect(() => {
    if (!canEditSettings) {
      setLoading(false);
      return;
    }
    getAdminSettings()
      .then(setForm)
      .catch(() => setError('Unable to load settings'))
      .finally(() => setLoading(false));
  }, [canEditSettings]);

  const update = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  const handleSave = async () => {
    if (!form) return;
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const saved = await updateAdminSettings({
        businessName: form.businessName,
        businessEmail: form.businessEmail,
        businessPhone: form.businessPhone,
        businessAddress: form.businessAddress,
        businessCity: form.businessCity ?? undefined,
        businessState: form.businessState ?? undefined,
        businessZip: form.businessZip ?? undefined,
        mileRate: form.mileRate,
        projectBaseFee: form.projectBaseFee,
        additionalPickupSurcharge: form.additionalPickupSurcharge,
        minimumQuote: form.minimumQuote,
        allowDigitalSignatures: form.allowDigitalSignatures,
      });
      setForm(saved);
      setNotice('Settings saved.');
    } catch {
      setError('Save failed. Check your values and try again.');
    } finally {
      setSaving(false);
    }
  };

  const showSaveButton = canEditSettings && form && (activeTab === 'business' || activeTab === 'pricing');

  if (loading && canEditSettings) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="animate-spin text-gold" size={32} />
      </div>
    );
  }

  if (availableTabs.length === 0) {
    return <p className="text-center py-20 text-charcoal/50">You do not have access to settings.</p>;
  }

  if (canEditSettings && !form) {
    return <p className="text-center py-20 text-charcoal/50">{error || 'Settings unavailable'}</p>;
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 pb-24">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <Link to="/admin" className="text-sm text-gold hover:underline mb-2 inline-block">
            ← Dashboard
          </Link>
          <h1 className="font-serif text-2xl md:text-3xl text-charcoal flex items-center gap-2">
            <Settings size={24} className="text-gold" />
            Settings
          </h1>
          <p className="text-sm text-charcoal/50 mt-1">
            Business defaults and user role permissions.
          </p>
        </div>
        {showSaveButton && (
          <Button onClick={() => void handleSave()} loading={saving} className="min-h-[48px] shrink-0">
            <Save size={16} className="mr-2" />
            Save Settings
          </Button>
        )}
      </div>

      {notice && (
        <p className="mb-4 px-4 py-3 bg-emerald-50 text-emerald-800 text-sm border border-emerald-200">
          {notice}
        </p>
      )}
      {error && (
        <p className="mb-4 px-4 py-3 bg-red-50 text-red-800 text-sm border border-red-200">{error}</p>
      )}

      <div className="flex gap-1 overflow-x-auto mb-6 -mx-4 px-4 scrollbar-hide border-b border-cream-dark">
        {availableTabs.map((tab) => {
          const { label, icon: Icon } = TAB_META[tab];
          return (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`shrink-0 flex items-center gap-2 px-4 py-3 text-xs uppercase tracking-wider min-h-[44px] border-b-2 transition-colors ${
                activeTab === tab
                  ? 'border-gold text-charcoal font-medium'
                  : 'border-transparent text-charcoal/50'
              }`}
            >
              <Icon size={14} className="shrink-0" />
              {label}
            </button>
          );
        })}
      </div>

      {activeTab === 'business' && canEditSettings && form && (
        <section className="bg-white border border-cream-dark p-5 md:p-6">
          <h2 className="text-sm uppercase tracking-wider font-medium text-charcoal mb-4">Business profile</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField label="Business name">
              <input
                className={inputClass}
                value={form.businessName}
                onChange={(e) => update('businessName', e.target.value)}
              />
            </FormField>
            <FormField label="Email">
              <input
                type="email"
                className={inputClass}
                value={form.businessEmail}
                onChange={(e) => update('businessEmail', e.target.value)}
              />
            </FormField>
            <FormField label="Phone">
              <input
                className={inputClass}
                value={form.businessPhone}
                onChange={(e) => update('businessPhone', e.target.value)}
              />
            </FormField>
            <FormField label="Street address">
              <input
                className={inputClass}
                value={form.businessAddress}
                onChange={(e) => update('businessAddress', e.target.value)}
              />
            </FormField>
            <FormField label="City">
              <input
                className={inputClass}
                value={form.businessCity ?? ''}
                onChange={(e) => update('businessCity', e.target.value || null)}
              />
            </FormField>
            <div className="grid grid-cols-2 gap-4">
              <FormField label="State">
                <input
                  className={inputClass}
                  value={form.businessState ?? ''}
                  onChange={(e) => update('businessState', e.target.value || null)}
                />
              </FormField>
              <FormField label="ZIP">
                <input
                  className={inputClass}
                  value={form.businessZip ?? ''}
                  onChange={(e) => update('businessZip', e.target.value || null)}
                />
              </FormField>
            </div>
          </div>
          <div className="mt-6 pt-4 border-t border-cream-dark">
            <h3 className="text-xs uppercase tracking-wider font-medium text-charcoal mb-3">Contracts</h3>
            <label className="flex items-start gap-3 cursor-pointer min-h-[44px]">
              <input
                type="checkbox"
                checked={form.allowDigitalSignatures}
                onChange={(e) => update('allowDigitalSignatures', e.target.checked)}
                className="mt-1 w-4 h-4 accent-charcoal"
              />
              <span>
                <span className="text-sm text-charcoal block">Allow digital signatures on contracts</span>
                <span className="text-xs text-charcoal/50">
                  When enabled, admin/designer and client can sign proposals in the project portal via signature pad.
                </span>
              </span>
            </label>
          </div>
          <p className="mt-4 text-xs text-charcoal/40">
            Last updated {new Date(form.updatedAt).toLocaleString()}
          </p>
        </section>
      )}

      {activeTab === 'pricing' && canEditSettings && form && (
        <section className="bg-white border border-cream-dark p-5 md:p-6">
          <h2 className="text-sm uppercase tracking-wider font-medium text-charcoal mb-1">
            Quote & mileage defaults
          </h2>
          <p className="text-xs text-charcoal/50 mb-4">
            Default rates for new quotes. Individual quotes can override these until a project is created.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField label="Mileage rate ($/mi)">
              <input
                type="number"
                min="0"
                step="0.01"
                className={inputClass}
                value={form.mileRate}
                onChange={(e) => update('mileRate', parseFloat(e.target.value) || 0)}
              />
            </FormField>
            <FormField label="Project coordination fee ($)">
              <input
                type="number"
                min="0"
                step="1"
                className={inputClass}
                value={form.projectBaseFee}
                onChange={(e) => update('projectBaseFee', parseFloat(e.target.value) || 0)}
              />
            </FormField>
            <FormField label="Extra pickup location surcharge ($)">
              <input
                type="number"
                min="0"
                step="1"
                className={inputClass}
                value={form.additionalPickupSurcharge}
                onChange={(e) => update('additionalPickupSurcharge', parseFloat(e.target.value) || 0)}
              />
            </FormField>
            <FormField label="Minimum quote ($)">
              <input
                type="number"
                min="0"
                step="1"
                className={inputClass}
                value={form.minimumQuote}
                onChange={(e) => update('minimumQuote', parseFloat(e.target.value) || 0)}
              />
            </FormField>
          </div>
          <p className="mt-4 text-xs text-charcoal/40">
            Preview: {formatCurrency(form.mileRate)}/mi · coordination {formatCurrency(form.projectBaseFee)} · min quote{' '}
            {formatCurrency(form.minimumQuote)}
          </p>
          <p className="mt-2 text-xs text-charcoal/40">
            Last updated {new Date(form.updatedAt).toLocaleString()}
          </p>
        </section>
      )}

      {activeTab === 'roles' && canManageRoles && <RoleManager />}
    </div>
  );
}
