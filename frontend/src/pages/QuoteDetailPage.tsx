import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  ExternalLink,
  Eye,
  FolderPlus,
  Loader2,
  Pencil,
  Save,
  Send,
  Trash2,
} from 'lucide-react';
import { QuoteAuditPanel } from '../components/QuoteAuditPanel';
import { Button, FormField, inputClass, selectClass, textareaClass } from '../components/Layout';
import {
  DesignerAssignFields,
  ClientAssignFields,
  emptyNewDesigner,
  emptyNewClient,
} from '../components/AdminPartyFields';
import {
  createProjectFromQuote,
  getAdminClients,
  getAdminDesigners,
  getAdminQuote,
  getAdminSettings,
  sendQuote,
  updateQuote,
} from '../api/client';
import type {
  AppSettings,
  Client,
  CreateClientInput,
  CreateDesignerInput,
  Designer,
  QuoteRequest,
  QuoteStatus,
  StorageType,
  UpdateAdminQuoteForm,
} from '../types';
import {
  formatCurrency,
  formatDate,
  QUOTE_STATUS_LABELS,
  SERVICE_TYPES,
  STORAGE_TYPE_LABELS,
} from '../lib/labels';

const QUOTE_STATUSES: QuoteStatus[] = [
  'lead',
  'pending',
  'reviewing',
  'quoted',
  'accepted',
  'declined',
];

const STORAGE_TYPES: StorageType[] = ['standard_climate', 'premium_climate', 'short_term'];

function ViewField({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-charcoal/40">{label}</p>
      <p className="text-sm text-charcoal/80 mt-1 whitespace-pre-wrap">{value?.trim() || '—'}</p>
    </div>
  );
}

function formatPricingValue(value: number | null | undefined, defaultValue?: number) {
  if (value != null) return formatCurrency(value);
  if (defaultValue != null) return `${formatCurrency(defaultValue)} (default)`;
  return '—';
}

function quoteToForm(quote: QuoteRequest): UpdateAdminQuoteForm {
  return {
    contactName: quote.contactName,
    email: quote.email,
    phone: quote.phone ?? '',
    company: quote.company ?? '',
    serviceType: quote.serviceType,
    projectDescription: quote.projectDescription,
    propertyAddress: quote.propertyAddress ?? '',
    pickupAddress: quote.pickupAddress ?? '',
    preferredDate: quote.preferredDate ?? '',
    estimatedPieces: quote.estimatedPieces ?? undefined,
    quotedAmount: quote.quotedAmount != null ? Number(quote.quotedAmount) : undefined,
    internalNotes: quote.internalNotes ?? '',
    status: quote.status,
    milesToStorage: quote.milesToStorage ?? 0,
    milesToInstall: quote.milesToInstall ?? 0,
    storageMonths: quote.storageMonths ?? 1,
    storageType: quote.storageType ?? 'standard_climate',
    pickupLocationCount: quote.pickupLocationCount ?? 1,
    mileRate: quote.mileRate != null ? Number(quote.mileRate) : null,
    projectBaseFee: quote.projectBaseFee != null ? Number(quote.projectBaseFee) : null,
    additionalPickupSurcharge:
      quote.additionalPickupSurcharge != null ? Number(quote.additionalPickupSurcharge) : null,
    minimumQuote: quote.minimumQuote != null ? Number(quote.minimumQuote) : null,
    isActive: quote.isActive !== false,
  };
}

export function QuoteDetailPage() {
  const { quoteId } = useParams<{ quoteId: string }>();
  const navigate = useNavigate();
  const [quote, setQuote] = useState<QuoteRequest | null>(null);
  const [form, setForm] = useState<UpdateAdminQuoteForm>({});
  const [designers, setDesigners] = useState<Designer[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [mode, setMode] = useState<'view' | 'edit'>('view');
  const [auditRefreshKey, setAuditRefreshKey] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [fromQuote, setFromQuote] = useState({ designerId: '', name: '', clientId: '' });
  const [quoteDesignerMode, setQuoteDesignerMode] = useState<'existing' | 'new'>('existing');
  const [quoteClientMode, setQuoteClientMode] = useState<'existing' | 'auto' | 'new'>('auto');
  const [quoteNewDesigner, setQuoteNewDesigner] = useState<CreateDesignerInput>(emptyNewDesigner());
  const [quoteNewClient, setQuoteNewClient] = useState<CreateClientInput>(emptyNewClient());
  const [pricingDefaults, setPricingDefaults] = useState<AppSettings | null>(null);
  const pricingLocked = !!quote?.projectId;

  const loadQuote = useCallback(async () => {
    if (!quoteId) return;
    setLoading(true);
    setError(null);
    try {
      const [q, d, c, settings] = await Promise.all([
        getAdminQuote(quoteId),
        getAdminDesigners(),
        getAdminClients(),
        getAdminSettings().catch(() => null),
      ]);
      setQuote(q);
      setForm(quoteToForm(q));
      setDesigners(d);
      setClients(c);
      setPricingDefaults(settings);

      const matchedClient = c.find((client) => client.email === q.email);
      setFromQuote({
        designerId: d[0]?.id || '',
        name: `${q.contactName}${q.propertyAddress ? ` — ${q.propertyAddress.split(',')[0]}` : ''}`,
        clientId: matchedClient?.id || '',
      });
      setQuoteDesignerMode('existing');
      setQuoteClientMode(matchedClient ? 'existing' : 'auto');
      setQuoteNewClient({
        ...emptyNewClient(),
        name: q.contactName,
        email: q.email,
        phone: q.phone || '',
        address: q.propertyAddress || '',
      });
    } catch {
      setError('Unable to load quote');
    } finally {
      setLoading(false);
    }
  }, [quoteId]);

  useEffect(() => {
    void loadQuote();
  }, [loadQuote]);

  const patchField = <K extends keyof UpdateAdminQuoteForm>(
    key: K,
    value: UpdateAdminQuoteForm[K],
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setNotice(null);
  };

  const buildPayload = (): UpdateAdminQuoteForm => ({
    ...form,
    phone: form.phone?.trim() || undefined,
    company: form.company?.trim() || undefined,
    propertyAddress: form.propertyAddress?.trim() || undefined,
    pickupAddress: form.pickupAddress?.trim() || undefined,
    preferredDate: form.preferredDate?.trim() || undefined,
    internalNotes: form.internalNotes?.trim() || undefined,
    quotedAmount:
      form.quotedAmount != null && form.quotedAmount !== ('' as unknown as number)
        ? Number(form.quotedAmount)
        : undefined,
  });

  const handleSave = async () => {
    if (!quoteId) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await updateQuote(quoteId, buildPayload());
      setQuote(updated);
      setForm(quoteToForm(updated));
      setNotice('Quote saved');
      setAuditRefreshKey((k) => k + 1);
      setMode('view');
    } catch {
      setError('Unable to save quote');
    } finally {
      setSaving(false);
    }
  };

  const handleSend = async () => {
    if (!quoteId) return;
    const amount = buildPayload().quotedAmount;
    if (!amount || amount <= 0) {
      setError('Enter a quoted amount before sending to the client');
      return;
    }
    if (!form.email?.trim()) {
      setError('Client email is required to send the quote');
      return;
    }
    if (
      !window.confirm(
        'Save and email this quote to the client for approval?',
      )
    ) {
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const updated = await sendQuote(quoteId, buildPayload());
      setQuote(updated);
      setForm(quoteToForm(updated));
      setNotice('Quote sent to client for approval');
      setAuditRefreshKey((k) => k + 1);
      setMode('view');
    } catch {
      setError('Unable to send quote — check amount and email');
    } finally {
      setSaving(false);
    }
  };

  const handleArchive = async () => {
    if (!quoteId || !quote) return;
    const nextActive = quote.isActive === false;
    setSaving(true);
    try {
      const updated = await updateQuote(quoteId, { isActive: !nextActive });
      setQuote(updated);
      setForm(quoteToForm(updated));
      setNotice(updated.isActive === false ? 'Quote archived' : 'Quote restored');
    } finally {
      setSaving(false);
    }
  };

  const isQuoteDesignerReady =
    quoteDesignerMode === 'existing'
      ? !!fromQuote.designerId
      : !!(
          quoteNewDesigner.name &&
          quoteNewDesigner.firm &&
          quoteNewDesigner.email &&
          quoteNewDesigner.password.length >= 6
        );

  const isQuoteClientReady =
    quoteClientMode === 'auto' ||
    (quoteClientMode === 'existing'
      ? !!fromQuote.clientId
      : !!(
          quoteNewClient.name &&
          quoteNewClient.email &&
          quoteNewClient.password.length >= 6
        ));

  const handleCreateProject = async () => {
    if (!quote || !isQuoteDesignerReady || !isQuoteClientReady) return;
    setSaving(true);
    try {
      const project = await createProjectFromQuote(quote.id, {
        name: fromQuote.name || undefined,
        ...(quoteDesignerMode === 'existing'
          ? { designerId: fromQuote.designerId }
          : { newDesigner: quoteNewDesigner }),
        ...(quoteClientMode === 'existing'
          ? { clientId: fromQuote.clientId }
          : quoteClientMode === 'new'
            ? { newClient: quoteNewClient }
            : {}),
      });
      navigate(`/project/${project.id}`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="animate-spin text-gold" size={32} />
      </div>
    );
  }

  if (!quote || !quoteId) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center">
        <p className="text-charcoal/60 mb-6">{error || 'Quote not found'}</p>
        <Link to="/admin" className="text-gold hover:underline">
          Back to dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 pb-24">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between mb-8">
        <div>
          <Link
            to="/admin"
            className="inline-flex items-center gap-2 text-sm text-charcoal/50 hover:text-gold mb-3"
          >
            <ArrowLeft size={16} />
            Dashboard
          </Link>
          <h1 className="font-serif text-2xl md:text-3xl text-charcoal">
            Quote — {quote.contactName}
          </h1>
          <p className="text-sm text-charcoal/60 mt-1">
            {QUOTE_STATUS_LABELS[quote.status] || quote.status}
            {' · '}
            Created {formatDate(quote.createdAt)}
            {quote.isActive === false && (
              <span className="ml-2 text-[10px] uppercase tracking-wider border border-cream-dark px-1.5 py-0.5">
                Archived
              </span>
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {mode === 'view' ? (
            <Button variant="outline" onClick={() => setMode('edit')} className="min-h-[44px]">
              <Pencil size={14} className="mr-2" />
              Edit
            </Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => { setForm(quoteToForm(quote)); setMode('view'); }} className="min-h-[44px]">
                <Eye size={14} className="mr-2" />
                View
              </Button>
              <Button variant="outline" onClick={() => void handleSave()} loading={saving} className="min-h-[44px]">
                <Save size={14} className="mr-2" />
                Save
              </Button>
              <Button onClick={() => void handleSend()} loading={saving} className="min-h-[44px]">
                <Send size={14} className="mr-2" />
                Send for approval
              </Button>
            </>
          )}
        </div>
      </div>

      {notice && (
        <p className="mb-4 px-4 py-3 bg-emerald-50 text-emerald-800 text-sm border border-emerald-200">
          {notice}
        </p>
      )}
      {error && (
        <p className="mb-4 px-4 py-3 bg-red-50 text-red-800 text-sm border border-red-200">{error}</p>
      )}

      {quote.projectId && (
        <Link
          to={`/project/${quote.projectId}`}
          className="flex items-center gap-2 p-4 bg-emerald-50 text-emerald-800 text-sm mb-6 border border-emerald-200"
        >
          <ExternalLink size={16} />
          View project created from this quote
        </Link>
      )}

      <div className="space-y-6">
        {mode === 'view' ? (
          <>
            <section className="bg-white border border-cream-dark p-6">
              <h2 className="text-sm uppercase tracking-wider text-charcoal/50 mb-4">Contact</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <ViewField label="Name" value={quote.contactName} />
                <ViewField label="Email" value={quote.email} />
                <ViewField label="Phone" value={quote.phone} />
                <ViewField label="Company" value={quote.company} />
                <ViewField label="Service type" value={quote.serviceType} />
                <ViewField label="Status" value={QUOTE_STATUS_LABELS[quote.status] || quote.status} />
              </div>
            </section>

            <section className="bg-white border border-cream-dark p-6">
              <h2 className="text-sm uppercase tracking-wider text-charcoal/50 mb-4">Project & addresses</h2>
              <div className="space-y-4">
                <ViewField label="Project description" value={quote.projectDescription} />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <ViewField label="Pickup address" value={quote.pickupAddress} />
                  <ViewField label="Install / property address" value={quote.propertyAddress} />
                  <ViewField label="Preferred install date" value={quote.preferredDate ? formatDate(quote.preferredDate) : null} />
                  <ViewField label="Estimated pieces" value={quote.estimatedPieces?.toString()} />
                </div>
              </div>
            </section>

            <section className="bg-white border border-cream-dark p-6">
              <h2 className="text-sm uppercase tracking-wider text-charcoal/50 mb-4">Logistics</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <ViewField label="Miles to warehouse" value={String(quote.milesToStorage ?? 0)} />
                <ViewField label="Miles to install" value={String(quote.milesToInstall ?? 0)} />
                <ViewField label="Storage months" value={String(quote.storageMonths ?? 1)} />
                <ViewField label="Storage type" value={quote.storageType ? STORAGE_TYPE_LABELS[quote.storageType] : null} />
                <ViewField label="Pickup locations" value={String(quote.pickupLocationCount ?? 1)} />
              </div>
              {quote.storageLocationName && (
                <p className="text-xs text-charcoal/50 mt-3">Nearest warehouse: {quote.storageLocationName}</p>
              )}
            </section>

            <section className="bg-white border border-cream-dark p-6">
              <h2 className="text-sm uppercase tracking-wider text-charcoal/50 mb-1">Pricing settings</h2>
              {pricingLocked && (
                <p className="text-xs text-charcoal/50 mb-4">
                  Locked — pricing was fixed when the project was created.
                </p>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <ViewField
                  label="Mile rate ($/mi)"
                  value={formatPricingValue(quote.mileRate, pricingDefaults?.mileRate)}
                />
                <ViewField
                  label="Coordination fee ($)"
                  value={formatPricingValue(quote.projectBaseFee, pricingDefaults?.projectBaseFee)}
                />
                <ViewField
                  label="Extra pickup surcharge ($)"
                  value={formatPricingValue(
                    quote.additionalPickupSurcharge,
                    pricingDefaults?.additionalPickupSurcharge,
                  )}
                />
                <ViewField
                  label="Minimum quote ($)"
                  value={formatPricingValue(quote.minimumQuote, pricingDefaults?.minimumQuote)}
                />
              </div>
            </section>

            {(quote.estimatedTotal != null || quote.lineItems?.length) && (
              <section className="bg-white border border-cream-dark p-6">
                <h2 className="text-sm uppercase tracking-wider text-charcoal/50 mb-4">Estimate summary</h2>
                {quote.estimatedTotal != null && (
                  <p className="text-gold font-medium mb-3">
                    Client estimate: {formatCurrency(Number(quote.estimatedTotal))}
                  </p>
                )}
                {quote.lineItems && quote.lineItems.length > 0 && (
                  <div className="border border-cream-dark divide-y divide-cream-dark text-sm">
                    {quote.lineItems.map((li, i) => (
                      <div key={i} className="flex justify-between gap-4 px-3 py-2">
                        <span className="text-charcoal/70">{li.description}</span>
                        <span className="shrink-0">{formatCurrency(li.amount)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )}

            <section className="bg-white border border-cream-dark p-6">
              <h2 className="text-sm uppercase tracking-wider text-charcoal/50 mb-4">Pricing & notes</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <ViewField
                  label="Quoted amount"
                  value={quote.quotedAmount != null ? formatCurrency(Number(quote.quotedAmount)) : null}
                />
              </div>
              <ViewField label="Internal notes" value={quote.internalNotes} />
            </section>

            <QuoteAuditPanel quoteId={quoteId} refreshKey={auditRefreshKey} />
          </>
        ) : (
          <>
        <section className="bg-white border border-cream-dark p-6">
          <h2 className="text-sm uppercase tracking-wider text-charcoal/50 mb-4">Contact</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField label="Name">
              <input
                className={inputClass}
                value={form.contactName ?? ''}
                onChange={(e) => patchField('contactName', e.target.value)}
              />
            </FormField>
            <FormField label="Email">
              <input
                type="email"
                className={inputClass}
                value={form.email ?? ''}
                onChange={(e) => patchField('email', e.target.value)}
              />
            </FormField>
            <FormField label="Phone">
              <input
                className={inputClass}
                value={form.phone ?? ''}
                onChange={(e) => patchField('phone', e.target.value)}
              />
            </FormField>
            <FormField label="Company">
              <input
                className={inputClass}
                value={form.company ?? ''}
                onChange={(e) => patchField('company', e.target.value)}
              />
            </FormField>
            <FormField label="Service type">
              <select
                className={selectClass}
                value={form.serviceType ?? ''}
                onChange={(e) => patchField('serviceType', e.target.value)}
              >
                {SERVICE_TYPES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
                {!SERVICE_TYPES.includes(form.serviceType ?? '') && form.serviceType && (
                  <option value={form.serviceType}>{form.serviceType}</option>
                )}
              </select>
            </FormField>
            <FormField label="Status">
              <select
                className={selectClass}
                value={form.status ?? quote.status}
                onChange={(e) => patchField('status', e.target.value as QuoteStatus)}
              >
                {QUOTE_STATUSES.map((s) => (
                  <option key={s} value={s}>{QUOTE_STATUS_LABELS[s]}</option>
                ))}
              </select>
            </FormField>
          </div>
        </section>

        <section className="bg-white border border-cream-dark p-6">
          <h2 className="text-sm uppercase tracking-wider text-charcoal/50 mb-4">Project & addresses</h2>
          <div className="space-y-4">
            <FormField label="Project description">
              <textarea
                className={textareaClass}
                rows={4}
                value={form.projectDescription ?? ''}
                onChange={(e) => patchField('projectDescription', e.target.value)}
              />
            </FormField>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField label="Pickup address">
                <input
                  className={inputClass}
                  value={form.pickupAddress ?? ''}
                  onChange={(e) => patchField('pickupAddress', e.target.value)}
                />
              </FormField>
              <FormField label="Install / property address">
                <input
                  className={inputClass}
                  value={form.propertyAddress ?? ''}
                  onChange={(e) => patchField('propertyAddress', e.target.value)}
                />
              </FormField>
              <FormField label="Preferred install date">
                <input
                  type="date"
                  className={inputClass}
                  value={form.preferredDate ?? ''}
                  onChange={(e) => patchField('preferredDate', e.target.value)}
                />
              </FormField>
              <FormField label="Estimated pieces">
                <input
                  type="number"
                  min={0}
                  className={inputClass}
                  value={form.estimatedPieces ?? ''}
                  onChange={(e) =>
                    patchField(
                      'estimatedPieces',
                      e.target.value ? parseInt(e.target.value, 10) : undefined,
                    )
                  }
                />
              </FormField>
            </div>
          </div>
        </section>

        <section className="bg-white border border-cream-dark p-6">
          <h2 className="text-sm uppercase tracking-wider text-charcoal/50 mb-4">Logistics</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField label="Miles to warehouse">
              <input
                type="number"
                min={0}
                className={inputClass}
                value={form.milesToStorage ?? 0}
                onChange={(e) => patchField('milesToStorage', parseInt(e.target.value, 10) || 0)}
              />
            </FormField>
            <FormField label="Miles to install">
              <input
                type="number"
                min={0}
                className={inputClass}
                value={form.milesToInstall ?? 0}
                onChange={(e) => patchField('milesToInstall', parseInt(e.target.value, 10) || 0)}
              />
            </FormField>
            <FormField label="Storage months">
              <input
                type="number"
                min={0}
                className={inputClass}
                value={form.storageMonths ?? 1}
                onChange={(e) => patchField('storageMonths', parseInt(e.target.value, 10) || 1)}
              />
            </FormField>
            <FormField label="Storage type">
              <select
                className={selectClass}
                value={form.storageType ?? 'standard_climate'}
                onChange={(e) => patchField('storageType', e.target.value as StorageType)}
              >
                {STORAGE_TYPES.map((t) => (
                  <option key={t} value={t}>{STORAGE_TYPE_LABELS[t]}</option>
                ))}
              </select>
            </FormField>
            <FormField label="Pickup locations">
              <input
                type="number"
                min={1}
                className={inputClass}
                value={form.pickupLocationCount ?? 1}
                onChange={(e) =>
                  patchField('pickupLocationCount', parseInt(e.target.value, 10) || 1)
                }
              />
            </FormField>
          </div>
          {quote.storageLocationName && (
            <p className="text-xs text-charcoal/50 mt-3">
              Nearest warehouse: {quote.storageLocationName}
            </p>
          )}
        </section>

        <section className="bg-white border border-cream-dark p-6">
          <h2 className="text-sm uppercase tracking-wider text-charcoal/50 mb-1">Pricing settings</h2>
          {pricingLocked ? (
            <p className="text-xs text-charcoal/50">
              Pricing cannot be changed after a project is created.
            </p>
          ) : (
            <>
              <p className="text-xs text-charcoal/50 mb-4">
                Leave a field blank to use the business default from Settings.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField label="Mile rate ($/mi)">
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    className={inputClass}
                    placeholder={pricingDefaults ? String(pricingDefaults.mileRate) : '3.5'}
                    value={form.mileRate ?? ''}
                    onChange={(e) =>
                      patchField(
                        'mileRate',
                        e.target.value === '' ? null : parseFloat(e.target.value) || 0,
                      )
                    }
                  />
                </FormField>
                <FormField label="Coordination fee ($)">
                  <input
                    type="number"
                    min={0}
                    step={1}
                    className={inputClass}
                    placeholder={pricingDefaults ? String(pricingDefaults.projectBaseFee) : '350'}
                    value={form.projectBaseFee ?? ''}
                    onChange={(e) =>
                      patchField(
                        'projectBaseFee',
                        e.target.value === '' ? null : parseFloat(e.target.value) || 0,
                      )
                    }
                  />
                </FormField>
                <FormField label="Extra pickup surcharge ($)">
                  <input
                    type="number"
                    min={0}
                    step={1}
                    className={inputClass}
                    placeholder={
                      pricingDefaults ? String(pricingDefaults.additionalPickupSurcharge) : '175'
                    }
                    value={form.additionalPickupSurcharge ?? ''}
                    onChange={(e) =>
                      patchField(
                        'additionalPickupSurcharge',
                        e.target.value === '' ? null : parseFloat(e.target.value) || 0,
                      )
                    }
                  />
                </FormField>
                <FormField label="Minimum quote ($)">
                  <input
                    type="number"
                    min={0}
                    step={1}
                    className={inputClass}
                    placeholder={pricingDefaults ? String(pricingDefaults.minimumQuote) : '750'}
                    value={form.minimumQuote ?? ''}
                    onChange={(e) =>
                      patchField(
                        'minimumQuote',
                        e.target.value === '' ? null : parseFloat(e.target.value) || 0,
                      )
                    }
                  />
                </FormField>
              </div>
            </>
          )}
        </section>

        {(quote.estimatedTotal != null || quote.lineItems?.length) && (
          <section className="bg-white border border-cream-dark p-6">
            <h2 className="text-sm uppercase tracking-wider text-charcoal/50 mb-4">Estimate summary</h2>
            {quote.estimatedTotal != null && (
              <p className="text-gold font-medium mb-3">
                Client estimate: {formatCurrency(Number(quote.estimatedTotal))}
              </p>
            )}
            {quote.rooms?.length ? (
              <p className="text-sm text-charcoal/60 mb-3">
                {quote.rooms.length} room(s) · {quote.estimatedPieces ?? '—'} pieces catalogued
              </p>
            ) : null}
            {quote.lineItems && quote.lineItems.length > 0 && (
              <div className="border border-cream-dark divide-y divide-cream-dark text-sm">
                {quote.lineItems.map((li, i) => (
                  <div key={i} className="flex justify-between gap-4 px-3 py-2">
                    <span className="text-charcoal/70">{li.description}</span>
                    <span className="shrink-0">{formatCurrency(li.amount)}</span>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        <section className="bg-white border border-cream-dark p-6">
          <h2 className="text-sm uppercase tracking-wider text-charcoal/50 mb-4">Pricing & notes</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField label="Quoted amount ($)">
              <input
                type="number"
                min={0}
                step={0.01}
                className={inputClass}
                value={form.quotedAmount ?? ''}
                placeholder={quote.estimatedTotal?.toString() || ''}
                onChange={(e) =>
                  patchField(
                    'quotedAmount',
                    e.target.value ? parseFloat(e.target.value) : undefined,
                  )
                }
              />
            </FormField>
          </div>
          <FormField label="Internal notes (not sent to client)">
            <textarea
              className={textareaClass}
              rows={4}
              value={form.internalNotes ?? ''}
              onChange={(e) => patchField('internalNotes', e.target.value)}
            />
          </FormField>
        </section>

        {!quote.projectId && (
          <section className="bg-white border border-cream-dark p-6">
            <h2 className="text-sm uppercase tracking-wider text-charcoal/50 mb-2">Initialize project</h2>
            <p className="text-sm text-charcoal/60 mb-4">
              Assign or create designer and client accounts, then seed rooms and pieces from the quote catalogue.
            </p>
            <div className="space-y-4">
              <DesignerAssignFields
                mode={quoteDesignerMode}
                onModeChange={setQuoteDesignerMode}
                designerId={fromQuote.designerId}
                onDesignerIdChange={(id) => setFromQuote((p) => ({ ...p, designerId: id }))}
                designers={designers}
                newDesigner={quoteNewDesigner}
                onNewDesignerChange={setQuoteNewDesigner}
              />
              <FormField label="Project name">
                <input
                  className={inputClass}
                  value={fromQuote.name}
                  onChange={(e) => setFromQuote((p) => ({ ...p, name: e.target.value }))}
                />
              </FormField>
              <ClientAssignFields
                mode={quoteClientMode}
                onModeChange={setQuoteClientMode}
                clientId={fromQuote.clientId}
                onClientIdChange={(id) => setFromQuote((p) => ({ ...p, clientId: id }))}
                clients={clients}
                newClient={quoteNewClient}
                onNewClientChange={setQuoteNewClient}
                autoLabel={`Match or create client from quote: ${quote.contactName} (${quote.email})`}
              />
              <Button
                onClick={() => void handleCreateProject()}
                loading={saving}
                disabled={!isQuoteDesignerReady || !isQuoteClientReady}
                className="w-full min-h-[48px]"
              >
                <FolderPlus size={14} className="mr-2" />
                Create project from quote
              </Button>
            </div>
          </section>
        )}

        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <Button variant="outline" onClick={() => { setForm(quoteToForm(quote)); setMode('view'); }} className="flex-1 min-h-[48px]">
            Cancel
          </Button>
          <Button variant="outline" onClick={() => void handleSave()} loading={saving} className="flex-1 min-h-[48px]">
            <Save size={14} className="mr-2" />
            Save changes
          </Button>
          <Button onClick={() => void handleSend()} loading={saving} className="flex-1 min-h-[48px]">
            <Send size={14} className="mr-2" />
            Send to client for approval
          </Button>
          <Button
            variant="outline"
            onClick={() => void handleArchive()}
            loading={saving}
            className="flex-1 min-h-[48px]"
          >
            <Trash2 size={14} className="mr-2" />
            {quote.isActive === false ? 'Restore quote' : 'Archive quote'}
          </Button>
        </div>
          </>
        )}
      </div>
    </div>
  );
}
