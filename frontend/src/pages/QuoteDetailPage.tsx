import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  CheckCircle2,
  ExternalLink,
  Eye,
  FolderPlus,
  Loader2,
  Minus,
  Pencil,
  Plus,
  Save,
  Send,
  Trash2,
} from 'lucide-react';
import { QuoteAuditPanel } from '../components/QuoteAuditPanel';
import { QuoteRoomsEditor } from '../components/QuoteRoomsEditor';
import { Button, FormField, inputClass, selectClass, textareaClass } from '../components/Layout';
import {
  DesignerAssignFields,
  ClientAssignFields,
  emptyNewDesigner,
  emptyNewClient,
} from '../components/AdminPartyFields';
import {
  applyChangeOrderToProject,
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
  QuoteRoom,
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
import { suggestProjectNameFromQuote } from '../lib/scan';

const QUOTE_STATUSES: QuoteStatus[] = [
  'lead',
  'pending',
  'reviewing',
  'quoted',
  'accepted',
  'declined',
];

const STORAGE_TYPES: StorageType[] = ['standard_climate', 'premium_climate', 'short_term'];

const SECTION_HEADING =
  'text-sm font-semibold uppercase tracking-wide text-charcoal';

function ViewField({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wider text-charcoal/70 font-medium">{label}</p>
      <p className="text-sm text-charcoal mt-1 whitespace-pre-wrap">{value?.trim() || '—'}</p>
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
    rooms: quote.rooms ?? [],
  };
}

export function QuoteDetailPage() {
  const { quoteId } = useParams<{ quoteId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const startInEdit = searchParams.get('edit') === '1';
  const [quote, setQuote] = useState<QuoteRequest | null>(null);
  const [form, setForm] = useState<UpdateAdminQuoteForm>({});
  const [designers, setDesigners] = useState<Designer[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [mode, setMode] = useState<'view' | 'edit'>(startInEdit ? 'edit' : 'view');
  const [auditRefreshKey, setAuditRefreshKey] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [fromQuote, setFromQuote] = useState({ designerId: '', name: '', clientId: '' });
  const [quoteDesignerMode, setQuoteDesignerMode] = useState<'existing' | 'new'>('existing');
  const [quoteClientMode, setQuoteClientMode] = useState<'existing' | 'auto' | 'new'>('auto');
  const [quoteNewDesigner, setQuoteNewDesigner] = useState<CreateDesignerInput>(emptyNewDesigner());
  const [quoteNewClient, setQuoteNewClient] = useState<CreateClientInput>(emptyNewClient());
  const [pricingDefaults, setPricingDefaults] = useState<AppSettings | null>(null);
  const pricingLocked = !!(quote?.projectId || quote?.parentProjectId);
  const isChangeOrder = !!quote?.parentProjectId;
  const isReduction = quote?.changeOrderType === 'reduction';

  const setEditMode = (next: 'view' | 'edit') => {
    setMode(next);
    if (quoteId) {
      navigate(
        next === 'edit' ? `/admin/quotes/${quoteId}?edit=1` : `/admin/quotes/${quoteId}`,
        { replace: true },
      );
    }
  };

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
        name: suggestProjectNameFromQuote(q),
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
    rooms: form.rooms,
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
      setEditMode('view');
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
      setEditMode('view');
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

  const handleMarkAccepted = async () => {
    if (!quoteId || !quote) return;
    if (
      !window.confirm(
        'Mark this change order as accepted? You can then add it to the project inventory.',
      )
    ) {
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const updated = await updateQuote(quoteId, { status: 'accepted' });
      setQuote(updated);
      setForm(quoteToForm(updated));
      setNotice('Change order marked as accepted');
      setAuditRefreshKey((k) => k + 1);
    } catch {
      setError('Unable to mark change order as accepted');
    } finally {
      setSaving(false);
    }
  };

  const handleApplyToProject = async () => {
    if (!quoteId || !quote?.parentProjectId) return;
    const actionLabel = isReduction
      ? 'Remove selected pieces from the project inventory?'
      : 'Add quoted rooms and pieces to the project inventory?';
    if (!window.confirm(actionLabel)) return;
    setSaving(true);
    setError(null);
    try {
      await applyChangeOrderToProject(quoteId);
      const updated = await getAdminQuote(quoteId);
      setQuote(updated);
      setForm(quoteToForm(updated));
      setNotice(
        isReduction
          ? 'Scope reduction applied — pieces removed from project'
          : 'Change order applied — inventory updated on project',
      );
      setAuditRefreshKey((k) => k + 1);
    } catch {
      setError(
        isReduction
          ? 'Could not apply reduction — ensure it is accepted and has removal targets'
          : 'Could not apply change order — ensure it is accepted and has rooms/items',
      );
    } finally {
      setSaving(false);
    }
  };

  const changeOrderReadyForApproval = isReduction
    ? (quote?.creditLineItems?.length ?? 0) > 0
    : (quote?.rooms?.length ?? 0) > 0;
  const canMarkAccepted =
    isChangeOrder &&
    !quote?.appliedAt &&
    quote?.status !== 'accepted' &&
    quote?.status !== 'declined';
  const canApplyChangeOrder =
    isChangeOrder &&
    !quote?.appliedAt &&
    quote?.status === 'accepted' &&
    changeOrderReadyForApproval;

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
    const projectName = fromQuote.name.trim();
    if (!quote || !projectName || !isQuoteDesignerReady || !isQuoteClientReady) return;
    setSaving(true);
    try {
      const project = await createProjectFromQuote(quote.id, {
        name: projectName,
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
          <p className="text-sm text-charcoal/70 mt-1">
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
            <>
              <Button variant="outline" onClick={() => setEditMode('edit')} className="min-h-[44px]">
                <Pencil size={14} className="mr-2" />
                Edit
              </Button>
              {isChangeOrder && !quote.appliedAt && (
                <>
                  {canMarkAccepted && (
                    <Button
                      variant="outline"
                      onClick={() => void handleMarkAccepted()}
                      loading={saving}
                      className="min-h-[44px]"
                    >
                      <CheckCircle2 size={14} className="mr-2" />
                      Mark accepted
                    </Button>
                  )}
                  {canApplyChangeOrder && (
                    <Button
                      onClick={() => void handleApplyToProject()}
                      loading={saving}
                      className="min-h-[44px]"
                    >
                      {isReduction ? (
                        <Minus size={14} className="mr-2" />
                      ) : (
                        <Plus size={14} className="mr-2" />
                      )}
                      {isReduction ? 'Remove from project' : 'Add to project'}
                    </Button>
                  )}
                </>
              )}
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => { setForm(quoteToForm(quote)); setEditMode('view'); }} className="min-h-[44px]">
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

      {quote.parentProjectId && (
        <Link
          to={`/project/${quote.parentProjectId}`}
          className="flex items-center gap-2 p-4 bg-amber-50 text-amber-900 text-sm mb-6 border border-amber-200"
        >
          <ExternalLink size={16} />
          Change order for project
          {quote.changeOrderNumber != null && ` #${quote.changeOrderNumber}`}
          {isReduction && ' · Scope reduction'}
          {quote.appliedAt && (isReduction ? ' · Removed from inventory' : ' · Applied to inventory')}
        </Link>
      )}

      {isChangeOrder && (
        <section className="bg-white border border-cream-dark p-5 md:p-6 mb-6 space-y-4">
          <h2 className={`${SECTION_HEADING}`}>
            {isReduction ? 'Scope reduction workflow' : 'Change order workflow'}
          </h2>
          {quote.appliedAt ? (
            <p className="text-sm text-emerald-800 flex items-center gap-2">
              <CheckCircle2 size={16} />
              {isReduction
                ? 'This reduction has been applied to the project inventory.'
                : 'This change order has been added to the project inventory.'}
            </p>
          ) : (
            <>
              <ol className="text-sm text-charcoal/75 space-y-2 list-decimal list-inside">
                <li className={changeOrderReadyForApproval ? 'text-charcoal' : ''}>
                  {isReduction
                    ? 'Confirm credit line items (created from project scope selection)'
                    : 'Add rooms and catalogue items (Edit quote)'}
                  {changeOrderReadyForApproval && (
                    <span className="ml-2 text-emerald-700 text-xs uppercase tracking-wider">
                      Done
                    </span>
                  )}
                </li>
                <li className={quote.status === 'accepted' ? 'text-charcoal' : ''}>
                  Send to the client for approval, or mark accepted internally
                  {quote.status === 'accepted' && (
                    <span className="ml-2 text-emerald-700 text-xs uppercase tracking-wider">
                      Done
                    </span>
                  )}
                </li>
                <li>
                  {isReduction ? 'Remove items from project inventory' : 'Add items to project inventory'}
                </li>
              </ol>
              {!changeOrderReadyForApproval && !isReduction && (
                <p className="text-sm text-amber-900 bg-amber-50 border border-amber-200 px-3 py-2">
                  Add at least one room with catalogue items before you can finalize this change order.
                </p>
              )}
              {quote.status === 'accepted' && !changeOrderReadyForApproval && (
                <p className="text-sm text-amber-900 bg-amber-50 border border-amber-200 px-3 py-2">
                  Accepted, but nothing to apply yet — {isReduction ? 'no removal targets' : 'add rooms first'}.
                </p>
              )}
              <div className="flex flex-wrap gap-2 pt-1">
                {!changeOrderReadyForApproval && !isReduction && (
                  <Button onClick={() => setEditMode('edit')} className="min-h-[44px]">
                    <Pencil size={14} className="mr-2" />
                    Add rooms & items
                  </Button>
                )}
                {canMarkAccepted && (
                  <Button
                    variant="outline"
                    onClick={() => void handleMarkAccepted()}
                    loading={saving}
                    className="min-h-[44px]"
                  >
                    <CheckCircle2 size={14} className="mr-2" />
                    Mark accepted
                  </Button>
                )}
                {mode === 'view' && canMarkAccepted && (
                  <Button
                    variant="outline"
                    onClick={() => setEditMode('edit')}
                    className="min-h-[44px]"
                  >
                    <Send size={14} className="mr-2" />
                    Send to client
                  </Button>
                )}
                {canApplyChangeOrder && (
                  <Button
                    onClick={() => void handleApplyToProject()}
                    loading={saving}
                    className="min-h-[44px]"
                  >
                    {isReduction ? (
                      <Minus size={14} className="mr-2" />
                    ) : (
                      <Plus size={14} className="mr-2" />
                    )}
                    {isReduction ? 'Remove from project inventory' : 'Add to project inventory'}
                  </Button>
                )}
              </div>
            </>
          )}
        </section>
      )}

      <div className="space-y-6">
        {mode === 'view' ? (
          <>
            <section className="bg-white border border-cream-dark p-6">
              <h2 className={`${SECTION_HEADING} mb-4`}>Contact</h2>
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
              <h2 className={`${SECTION_HEADING} mb-4`}>Project & addresses</h2>
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
              <h2 className={`${SECTION_HEADING} mb-4`}>Logistics</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <ViewField label="Miles to warehouse" value={String(quote.milesToStorage ?? 0)} />
                <ViewField label="Miles to install" value={String(quote.milesToInstall ?? 0)} />
                <ViewField label="Storage months" value={String(quote.storageMonths ?? 1)} />
                <ViewField label="Storage type" value={quote.storageType ? STORAGE_TYPE_LABELS[quote.storageType] : null} />
                <ViewField label="Pickup locations" value={String(quote.pickupLocationCount ?? 1)} />
              </div>
              {quote.storageLocationName && (
                <p className="text-xs text-charcoal/65 mt-3">Nearest warehouse: {quote.storageLocationName}</p>
              )}
            </section>

            {(quote.rooms?.length ?? 0) > 0 ? (
              <section className="bg-white border border-cream-dark p-6">
                <h2 className={`${SECTION_HEADING} mb-4`}>Rooms & catalogue</h2>
                <QuoteRoomsEditor
                  rooms={quote.rooms ?? []}
                  onChange={() => {}}
                  storageMonths={quote.storageMonths ?? 1}
                  storageType={quote.storageType ?? 'standard_climate'}
                  disabled
                />
              </section>
            ) : isChangeOrder && !isReduction ? (
              <section className="bg-white border border-cream-dark p-6">
                <h2 className={`${SECTION_HEADING} mb-2`}>Rooms & catalogue</h2>
                <p className="text-sm text-charcoal/70">No rooms added yet. Edit this quote to add furniture.</p>
              </section>
            ) : null}

            {(quote.creditLineItems?.length ?? 0) > 0 && (
              <section className="bg-white border border-cream-dark p-6">
                <h2 className={`${SECTION_HEADING} mb-4`}>Credit line items</h2>
                <div className="border border-cream-dark divide-y divide-cream-dark text-sm">
                  {quote.creditLineItems!.map((li, i) => (
                    <div key={i} className="flex justify-between gap-4 px-3 py-2">
                      <span className="text-charcoal/80">{li.description}</span>
                      <span className="shrink-0 text-charcoal">−{formatCurrency(li.amount)}</span>
                    </div>
                  ))}
                </div>
                {quote.quotedAmount != null && (
                  <p className="text-sm font-medium text-gold mt-3">
                    Total credit: {formatCurrency(Number(quote.quotedAmount))}
                  </p>
                )}
              </section>
            )}

            <section className="bg-white border border-cream-dark p-6">
              <h2 className={`${SECTION_HEADING} mb-1`}>Pricing settings</h2>
              {pricingLocked && (
                <p className="text-xs text-charcoal/65 mb-4">
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
                <h2 className={`${SECTION_HEADING} mb-4`}>Estimate summary</h2>
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
              <h2 className={`${SECTION_HEADING} mb-4`}>Pricing & notes</h2>
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
          <h2 className={`${SECTION_HEADING} mb-4`}>Contact</h2>
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
          <h2 className={`${SECTION_HEADING} mb-4`}>Project & addresses</h2>
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
          <h2 className={`${SECTION_HEADING} mb-4`}>Logistics</h2>
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
            <p className="text-xs text-charcoal/65 mt-3">
              Nearest warehouse: {quote.storageLocationName}
            </p>
          )}
        </section>

        {!isReduction ? (
        <section className="bg-white border border-cream-dark p-6">
          <h2 className={`${SECTION_HEADING} mb-4`}>Rooms & catalogue</h2>
          <QuoteRoomsEditor
            rooms={form.rooms ?? []}
            onChange={(rooms: QuoteRoom[]) => patchField('rooms', rooms)}
            storageMonths={form.storageMonths ?? quote.storageMonths ?? 1}
            storageType={form.storageType ?? quote.storageType ?? 'standard_climate'}
          />
        </section>
        ) : (quote.creditLineItems?.length ?? 0) > 0 ? (
          <section className="bg-white border border-cream-dark p-6">
            <h2 className={`${SECTION_HEADING} mb-4`}>Credit line items</h2>
            <p className="text-sm text-charcoal/70 mb-3">
              These line items will be credited when the client approves and the reduction is applied.
            </p>
            <div className="border border-cream-dark divide-y divide-cream-dark text-sm">
              {quote.creditLineItems!.map((li, i) => (
                <div key={i} className="flex justify-between gap-4 px-3 py-2">
                  <span className="text-charcoal/80">{li.description}</span>
                  <span className="shrink-0">−{formatCurrency(li.amount)}</span>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        <section className="bg-white border border-cream-dark p-6">
          <h2 className={`${SECTION_HEADING} mb-1`}>Pricing settings</h2>
          {pricingLocked ? (
            <p className="text-xs text-charcoal/65">
              Pricing cannot be changed after a project is created or for change orders.
            </p>
          ) : (
            <>
              <p className="text-xs text-charcoal/65 mb-4">
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
            <h2 className={`${SECTION_HEADING} mb-4`}>Estimate summary</h2>
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
          <h2 className={`${SECTION_HEADING} mb-4`}>Pricing & notes</h2>
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

        {!quote.projectId && !quote.parentProjectId && (
          <section className="bg-white border border-cream-dark p-6">
            <h2 className={`${SECTION_HEADING} mb-2`}>Initialize project</h2>
            <p className="text-sm text-charcoal/70 mb-4">
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
                  required
                  placeholder="e.g. Morrison Lake House — 123 Main St"
                  onChange={(e) => setFromQuote((p) => ({ ...p, name: e.target.value }))}
                />
              </FormField>
              <p className="text-xs text-charcoal/65 -mt-2">
                Pre-filled from the quote; edit as needed. This name appears on inventory labels.
              </p>
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
                disabled={!fromQuote.name.trim() || !isQuoteDesignerReady || !isQuoteClientReady}
                className="w-full min-h-[48px]"
              >
                <FolderPlus size={14} className="mr-2" />
                Create project from quote
              </Button>
            </div>
          </section>
        )}

        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <Button variant="outline" onClick={() => { setForm(quoteToForm(quote)); setEditMode('view'); }} className="flex-1 min-h-[48px]">
            Cancel
          </Button>
          <Button variant="outline" onClick={() => void handleSave()} loading={saving} className="flex-1 min-h-[48px]">
            <Save size={14} className="mr-2" />
            Save changes
          </Button>
          {canMarkAccepted && (
            <Button
              variant="outline"
              onClick={() => void handleMarkAccepted()}
              loading={saving}
              className="flex-1 min-h-[48px]"
            >
              <CheckCircle2 size={14} className="mr-2" />
              Mark accepted
            </Button>
          )}
          {canApplyChangeOrder && (
            <Button
              onClick={() => void handleApplyToProject()}
              loading={saving}
              className="flex-1 min-h-[48px]"
            >
              {isReduction ? (
                <Minus size={14} className="mr-2" />
              ) : (
                <Plus size={14} className="mr-2" />
              )}
              {isReduction ? 'Remove from project' : 'Add to project'}
            </Button>
          )}
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
