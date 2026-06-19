import { useEffect, useMemo, useState, useCallback } from 'react';
import { PageHeader, FormField, Button, inputClass, textareaClass, selectClass } from '../components/Layout';
import { getPieceCatalog, estimateQuote, startQuoteLead, completeQuote } from '../api/client';
import {
  SERVICE_TYPES,
  STORAGE_TYPE_LABELS,
  CATALOG_CATEGORY_LABELS,
  formatCurrency,
} from '../lib/labels';
import {
  PRICING_RATES,
  catalogPieceTotal,
  catalogPieceBreakdown,
} from '../lib/quotePricing';
import type {
  PieceCatalogItem,
  QuoteEstimate,
  QuoteRoom,
  StorageType,
} from '../types';
import {
  CheckCircle,
  AlertCircle,
  Plus,
  Trash2,
  Loader2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

const DEFAULT_ROOM_NAMES = ['Living Room', 'Primary Bedroom', 'Dining Room', 'Kitchen', 'Office'];
const QUOTE_DRAFT_KEY = 'wgds_quote_draft_id';
const STEPS = ['Contact', 'Logistics', 'Pieces & Submit'] as const;

function StepIndicator({ step }: { step: number }) {
  return (
    <ol className="flex items-center gap-2 mb-8">
      {STEPS.map((label, i) => {
        const n = i + 1;
        const active = n === step;
        const done = n < step;
        return (
          <li key={label} className="flex items-center gap-2 flex-1 min-w-0 last:flex-none">
            <div
              className={`w-7 h-7 shrink-0 flex items-center justify-center text-xs font-medium border ${
                active
                  ? 'bg-charcoal text-cream border-charcoal'
                  : done
                    ? 'bg-gold text-charcoal border-gold'
                    : 'bg-white text-charcoal/40 border-cream-dark'
              }`}
            >
              {done ? '✓' : n}
            </div>
            <span
              className={`text-[10px] uppercase tracking-wider truncate hidden sm:inline ${
                active ? 'text-charcoal font-medium' : 'text-charcoal/40'
              }`}
            >
              {label}
            </span>
            {i < STEPS.length - 1 && (
              <div className={`h-px flex-1 min-w-2 ${done ? 'bg-gold' : 'bg-cream-dark'}`} />
            )}
          </li>
        );
      })}
    </ol>
  );
}

function emptyRoom(name = 'Living Room'): QuoteRoom {
  return { name, items: [] };
}

export function QuotePage() {
  const [catalog, setCatalog] = useState<PieceCatalogItem[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [contact, setContact] = useState({
    contactName: '',
    email: '',
    phone: '',
    company: '',
    serviceType: SERVICE_TYPES[4],
    projectDescription: '',
    propertyAddress: '',
    pickupAddress: '',
    preferredDate: '',
  });
  const [logistics, setLogistics] = useState({
    storageMonths: '2',
    storageType: 'standard_climate' as StorageType,
    pickupLocationCount: '1',
  });
  const [rooms, setRooms] = useState<QuoteRoom[]>([emptyRoom()]);
  const [estimate, setEstimate] = useState<QuoteEstimate | null>(null);
  const [estimating, setEstimating] = useState(false);
  const [showBreakdown, setShowBreakdown] = useState(true);
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [step, setStep] = useState(() => (sessionStorage.getItem(QUOTE_DRAFT_KEY) ? 2 : 1));
  const [quoteId, setQuoteId] = useState<string | null>(() => sessionStorage.getItem(QUOTE_DRAFT_KEY));
  const [stepSaving, setStepSaving] = useState(false);
  const [stepError, setStepError] = useState(false);

  useEffect(() => {
    getPieceCatalog()
      .then(setCatalog)
      .catch(() => {})
      .finally(() => setCatalogLoading(false));
  }, []);

  const catalogByCategory = useMemo(() => {
    const map = new Map<string, PieceCatalogItem[]>();
    for (const item of catalog) {
      const list = map.get(item.category) || [];
      list.push(item);
      map.set(item.category, list);
    }
    return map;
  }, [catalog]);

  const hasItems = rooms.some((r) => r.items.some((i) => i.quantity > 0));

  const runEstimate = useCallback(async () => {
    if (!hasItems) {
      setEstimate(null);
      return;
    }
    setEstimating(true);
    try {
      const result = await estimateQuote({
        rooms: rooms.map((r) => ({
          name: r.name,
          items: r.items.filter((i) => i.quantity > 0 && i.catalogItemId),
        })).filter((r) => r.items.length > 0),
        pickupAddress: contact.pickupAddress || undefined,
        propertyAddress: contact.propertyAddress || undefined,
        storageMonths: parseInt(logistics.storageMonths, 10) || 0,
        storageType: logistics.storageType,
        pickupLocationCount: parseInt(logistics.pickupLocationCount, 10) || 1,
      });
      setEstimate(result);
    } catch {
      setEstimate(null);
    } finally {
      setEstimating(false);
    }
  }, [rooms, logistics, hasItems, contact.pickupAddress, contact.propertyAddress]);

  useEffect(() => {
    if (step < 3) return;
    const t = setTimeout(runEstimate, 400);
    return () => clearTimeout(t);
  }, [runEstimate, step]);

  const updateContact = (field: string) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) => setContact((p) => ({ ...p, [field]: e.target.value }));

  const updateLogistics = (field: string) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => setLogistics((p) => ({ ...p, [field]: e.target.value }));

  const addRoom = () => {
    const used = rooms.map((r) => r.name);
    const nextName = DEFAULT_ROOM_NAMES.find((n) => !used.includes(n)) || `Room ${rooms.length + 1}`;
    setRooms((r) => [...r, emptyRoom(nextName)]);
  };

  const removeRoom = (index: number) => {
    setRooms((r) => (r.length <= 1 ? r : r.filter((_, i) => i !== index)));
  };

  const updateRoomName = (index: number, name: string) => {
    setRooms((rs) => rs.map((r, i) => (i === index ? { ...r, name } : r)));
  };

  const addItemToRoom = (roomIndex: number, catalogItemId: string) => {
    if (!catalogItemId) return;
    setRooms((rs) =>
      rs.map((r, i) => {
        if (i !== roomIndex) return r;
        const existing = r.items.find((it) => it.catalogItemId === catalogItemId);
        if (existing) {
          return {
            ...r,
            items: r.items.map((it) =>
              it.catalogItemId === catalogItemId
                ? { ...it, quantity: it.quantity + 1 }
                : it,
            ),
          };
        }
        return { ...r, items: [...r.items, { catalogItemId, quantity: 1 }] };
      }),
    );
  };

  const updateItemQty = (roomIndex: number, catalogItemId: string, quantity: number) => {
    setRooms((rs) =>
      rs.map((r, i) => {
        if (i !== roomIndex) return r;
        if (quantity < 1) {
          return { ...r, items: r.items.filter((it) => it.catalogItemId !== catalogItemId) };
        }
        return {
          ...r,
          items: r.items.map((it) =>
            it.catalogItemId === catalogItemId ? { ...it, quantity } : it,
          ),
        };
      }),
    );
  };

  const catalogName = (id: string) => catalog.find((c) => c.id === id)?.name || 'Item';
  const catalogItem = (id: string) => catalog.find((c) => c.id === id);

  const storageMonthsNum = parseInt(logistics.storageMonths, 10) || 0;

  const itemLineTotal = (catalogItemId: string, quantity: number) => {
    const item = catalogItem(catalogItemId);
    if (!item) return 0;
    return catalogPieceTotal(item, storageMonthsNum, logistics.storageType) * quantity;
  };

  const handleStep1Continue = async () => {
    if (!contact.contactName.trim() || !contact.email.trim() || !contact.serviceType) return;
    if (quoteId) {
      setStep(2);
      return;
    }
    setStepError(false);
    setStepSaving(true);
    try {
      const lead = await startQuoteLead({
        contactName: contact.contactName.trim(),
        email: contact.email.trim(),
        phone: contact.phone.trim() || undefined,
        company: contact.company.trim() || undefined,
        serviceType: contact.serviceType,
      });
      setQuoteId(lead.id);
      sessionStorage.setItem(QUOTE_DRAFT_KEY, lead.id);
      setStep(2);
    } catch {
      setStepError(true);
    } finally {
      setStepSaving(false);
    }
  };

  const resetQuoteBuilder = () => {
    sessionStorage.removeItem(QUOTE_DRAFT_KEY);
    setQuoteId(null);
    setStep(1);
    setContact({
      contactName: '', email: '', phone: '', company: '',
      serviceType: SERVICE_TYPES[4], projectDescription: '',
      propertyAddress: '', pickupAddress: '', preferredDate: '',
    });
    setLogistics({
      storageMonths: '2',
      storageType: 'standard_climate',
      pickupLocationCount: '1',
    });
    setRooms([emptyRoom()]);
    setEstimate(null);
    setStatus('idle');
    setStepError(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quoteId || !hasItems) return;
    setStatus('loading');
    try {
      await completeQuote(quoteId, {
        projectDescription: contact.projectDescription || undefined,
        propertyAddress: contact.propertyAddress || undefined,
        pickupAddress: contact.pickupAddress || undefined,
        preferredDate: contact.preferredDate || undefined,
        storageMonths: parseInt(logistics.storageMonths, 10) || 0,
        storageType: logistics.storageType,
        pickupLocationCount: parseInt(logistics.pickupLocationCount, 10) || 1,
        rooms: rooms
          .map((r) => ({
            name: r.name,
            items: r.items.filter((i) => i.quantity > 0),
          }))
          .filter((r) => r.items.length > 0),
      });
      resetQuoteBuilder();
      setStatus('success');
    } catch {
      setStatus('error');
    }
  };

  if (status === 'success') {
    return (
      <>
        <PageHeader
          eyebrow="Pricing"
          title="Quote Submitted"
          subtitle="Your detailed estimate is on its way."
        />
        <section className="max-w-2xl mx-auto px-4 py-12 text-center">
          <CheckCircle className="mx-auto text-gold mb-4" size={48} />
          <h2 className="font-serif text-2xl mb-2">Thank You</h2>
          <p className="text-charcoal/60 max-w-md mx-auto">
            {estimate
              ? `Your estimated project total is ${formatCurrency(estimate.estimatedTotal)}. Our team will review and confirm within one business day.`
              : "We'll review your project and respond with a confirmed quote within one business day."}
          </p>
          <button onClick={resetQuoteBuilder} className="mt-6 text-sm text-gold underline">
            Build another quote
          </button>
        </section>
      </>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="Pricing"
        title="Build Your Quote"
        subtitle="Select pieces by room, add logistics details, and get an instant estimate."
      />

      <section className="max-w-6xl mx-auto px-4 py-8 md:py-12 pb-32">
        <StepIndicator step={step} />

        <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            {(status === 'error' || stepError) && (
              <div className="flex items-center gap-2 p-4 bg-red-50 text-red-700 text-sm">
                <AlertCircle size={16} />
                {stepError
                  ? 'Unable to save your contact info. Please try again.'
                  : 'Unable to submit. Please try again.'}
              </div>
            )}

            {/* Step 1 — Contact */}
            {step === 1 && (
            <div className="bg-white border border-cream-dark p-5 md:p-6 space-y-5">
              <div>
                <h2 className="font-serif text-lg">Contact Information</h2>
                <p className="text-sm text-charcoal/50 mt-1">
                  We&apos;ll save your details right away so our team can follow up — even if you don&apos;t finish the quote.
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <FormField label="Your Name" required>
                  <input className={inputClass} value={contact.contactName} onChange={updateContact('contactName')} required />
                </FormField>
                <FormField label="Email" required>
                  <input type="email" className={inputClass} value={contact.email} onChange={updateContact('email')} required />
                </FormField>
                <FormField label="Phone">
                  <input type="tel" className={inputClass} value={contact.phone} onChange={updateContact('phone')} />
                </FormField>
                <FormField label="Design Firm / Company">
                  <input className={inputClass} value={contact.company} onChange={updateContact('company')} />
                </FormField>
              </div>
              <FormField label="Service Type" required>
                <select className={selectClass} value={contact.serviceType} onChange={updateContact('serviceType')} required>
                  {SERVICE_TYPES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </FormField>
              <Button
                type="button"
                loading={stepSaving}
                onClick={handleStep1Continue}
                className="w-full min-h-[52px] bg-gold text-charcoal hover:bg-gold/90"
              >
                Continue to Logistics
              </Button>
            </div>
            )}

            {/* Step 2 — Logistics */}
            {step === 2 && (
            <div className="bg-white border border-cream-dark p-5 md:p-6 space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <h2 className="font-serif text-lg">Locations & Logistics</h2>
                  <p className="text-sm text-charcoal/50 mt-1">
                    Mileage is calculated automatically from your addresses to our nearest warehouse.
                  </p>
                </div>
                <p className="text-[10px] uppercase tracking-wider text-charcoal/40 shrink-0">
                  Coordination fee {formatCurrency(PRICING_RATES.projectBaseFee)} ·{' '}
                  {formatCurrency(PRICING_RATES.mileRate)}/mi ·{' '}
                  +{formatCurrency(PRICING_RATES.additionalPickupSurcharge)}/extra pickup
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <FormField label="Pickup Address" required>
                  <input className={inputClass} value={contact.pickupAddress} onChange={updateContact('pickupAddress')} placeholder="Vendor or market address, High Point NC" required />
                  <p className="text-[10px] text-charcoal/40 mt-1">Where we collect your pieces</p>
                </FormField>
                <FormField label="Install Property Address" required>
                  <input className={inputClass} value={contact.propertyAddress} onChange={updateContact('propertyAddress')} placeholder="Final install location" required />
                  <p className="text-[10px] text-charcoal/40 mt-1">Where pieces are delivered from our warehouse</p>
                </FormField>
                <FormField label="Storage Duration (months)" required>
                  <input type="number" min="0" max="24" className={inputClass} value={logistics.storageMonths} onChange={updateLogistics('storageMonths')} required />
                </FormField>
                <FormField label="Storage Type" required>
                  <select className={selectClass} value={logistics.storageType} onChange={updateLogistics('storageType')} required>
                    {(Object.entries(STORAGE_TYPE_LABELS) as [StorageType, string][]).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </FormField>
                <FormField label="Number of Pickup Locations" required>
                  <input type="number" min="1" max="20" className={inputClass} value={logistics.pickupLocationCount} onChange={updateLogistics('pickupLocationCount')} required />
                  {parseInt(logistics.pickupLocationCount, 10) > 1 && (
                    <p className="text-[10px] text-charcoal/40 mt-1">
                      +{formatCurrency((parseInt(logistics.pickupLocationCount, 10) - 1) * PRICING_RATES.additionalPickupSurcharge)} for extra locations
                    </p>
                  )}
                </FormField>
                <FormField label="Preferred Install Date">
                  <input type="date" className={inputClass} value={contact.preferredDate} onChange={updateContact('preferredDate')} />
                </FormField>
              </div>
              <div className="flex gap-3 pt-2">
                <Button type="button" variant="outline" onClick={() => setStep(1)} className="flex-1 min-h-[52px]">
                  Back
                </Button>
                <Button type="button" onClick={() => setStep(3)} className="flex-1 min-h-[52px] bg-gold text-charcoal hover:bg-gold/90">
                  Continue to Pieces
                </Button>
              </div>
            </div>
            )}

            {/* Step 3 — Rooms */}
            {step === 3 && (
            <>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-serif text-lg">Rooms & Pieces</h2>
                <button
                  type="button"
                  onClick={addRoom}
                  className="flex items-center gap-1 text-xs uppercase tracking-wider text-gold min-h-[44px] px-3"
                >
                  <Plus size={14} /> Add Room
                </button>
              </div>

              {catalogLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="animate-spin text-gold" size={24} />
                </div>
              ) : (
                rooms.map((room, roomIndex) => (
                  <div key={roomIndex} className="bg-white border border-cream-dark p-4 md:p-5 space-y-4">
                    <div className="flex items-center gap-3">
                      <input
                        className={`${inputClass} flex-1 font-medium`}
                        value={room.name}
                        onChange={(e) => updateRoomName(roomIndex, e.target.value)}
                        placeholder="Room name"
                      />
                      {rooms.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeRoom(roomIndex)}
                          className="p-2 text-charcoal/40 hover:text-red-600 min-w-[44px] min-h-[44px] flex items-center justify-center"
                          aria-label="Remove room"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>

                    {room.items.length > 0 && (
                      <div className="space-y-2 border-t border-cream-dark pt-3">
                        {room.items.map((item) => {
                          const cat = catalogItem(item.catalogItemId);
                          const breakdown = cat
                            ? catalogPieceBreakdown(cat, storageMonthsNum, logistics.storageType)
                            : null;
                          return (
                          <div key={item.catalogItemId} className="flex items-start gap-3 py-1">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{catalogName(item.catalogItemId)}</p>
                              {breakdown && (
                                <p className="text-[10px] text-charcoal/45 mt-0.5">
                                  {formatCurrency(breakdown.pickup)} pickup ·{' '}
                                  {storageMonthsNum > 0 && (
                                    <>{formatCurrency(breakdown.storage)} storage · </>
                                  )}
                                  {formatCurrency(breakdown.install)} install
                                  <span className="text-charcoal/30"> · per piece</span>
                                </p>
                              )}
                            </div>
                            <input
                              type="number"
                              min="1"
                              max="99"
                              value={item.quantity}
                              onChange={(e) =>
                                updateItemQty(roomIndex, item.catalogItemId, parseInt(e.target.value, 10) || 0)
                              }
                              className="w-14 px-2 py-2 border border-cream-dark text-center text-sm min-h-[44px] shrink-0"
                              aria-label="Quantity"
                            />
                            <span className="text-sm font-medium text-gold w-20 text-right shrink-0 pt-2.5">
                              {formatCurrency(itemLineTotal(item.catalogItemId, item.quantity))}
                            </span>
                            <button
                              type="button"
                              onClick={() => updateItemQty(roomIndex, item.catalogItemId, 0)}
                              className="p-2 text-charcoal/40 hover:text-red-600 shrink-0"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                          );
                        })}
                        <div className="flex justify-end pt-2 border-t border-cream-dark/60">
                          <span className="text-xs uppercase tracking-wider text-charcoal/40 mr-2">Room subtotal</span>
                          <span className="text-sm font-medium">
                            {formatCurrency(
                              room.items.reduce(
                                (sum, i) => sum + itemLineTotal(i.catalogItemId, i.quantity),
                                0,
                              ),
                            )}
                          </span>
                        </div>
                      </div>
                    )}

                    <FormField label="Add piece from catalogue">
                      <select
                        className={selectClass}
                        value=""
                        onChange={(e) => {
                          addItemToRoom(roomIndex, e.target.value);
                          e.target.value = '';
                        }}
                      >
                        <option value="">Select a piece type…</option>
                        {Array.from(catalogByCategory.entries()).map(([cat, items]) => (
                          <optgroup key={cat} label={CATALOG_CATEGORY_LABELS[cat as keyof typeof CATALOG_CATEGORY_LABELS] || cat}>
                            {items.map((item) => (
                              <option key={item.id} value={item.id}>
                                {item.name} — {formatCurrency(catalogPieceTotal(item, storageMonthsNum, logistics.storageType))}/pc
                              </option>
                            ))}
                          </optgroup>
                        ))}
                      </select>
                      <p className="text-[10px] text-charcoal/40 mt-1.5">
                        Prices include pickup, {storageMonthsNum} mo storage & install per piece
                      </p>
                    </FormField>
                  </div>
                ))
              )}
            </div>

            <FormField label="Additional Notes">
              <textarea
                className={textareaClass}
                value={contact.projectDescription}
                onChange={updateContact('projectDescription')}
                placeholder="Special handling, timeline constraints, vendor details…"
              />
            </FormField>

            <Button type="button" variant="outline" onClick={() => setStep(2)} className="w-full min-h-[52px] lg:hidden">
              Back to Logistics
            </Button>
            </>
            )}
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1">
            <div className="lg:sticky lg:top-4 bg-charcoal text-cream p-5 md:p-6 space-y-4">
              {step < 3 ? (
                <>
                  <h2 className="font-serif text-xl">Quote Builder</h2>
                  <p className="text-sm text-cream/60">
                    {step === 1
                      ? 'Step 1 of 3 — tell us how to reach you. Your contact info is saved when you continue.'
                      : 'Step 2 of 3 — pickup and install addresses drive mileage to our nearest warehouse.'}
                  </p>
                  {quoteId && (
                    <p className="text-xs text-gold/80 border border-gold/20 p-3">
                      Contact saved — you can return later to finish this quote.
                    </p>
                  )}
                </>
              ) : (
                <>
              <h2 className="font-serif text-xl">Estimate</h2>

              {!hasItems ? (
                <p className="text-sm text-cream/60">Add pieces to rooms to see your estimate.</p>
              ) : estimating ? (
                <div className="flex items-center gap-2 text-cream/70 text-sm py-4">
                  <Loader2 size={16} className="animate-spin" /> Calculating…
                </div>
              ) : estimate ? (
                <>
                  <div className="border-t border-cream/20 pt-4 space-y-2 text-sm">
                    <div className="flex justify-between text-cream/70">
                      <span>{estimate.totalRooms} room(s) · {estimate.totalPieces} piece(s)</span>
                    </div>
                    <div className="flex justify-between text-cream/70">
                      <span>Handling & install</span>
                      <span>{formatCurrency(estimate.subtotalPieces)}</span>
                    </div>
                    {estimate.subtotalStorage > 0 && (
                      <div className="flex justify-between text-cream/70">
                        <span>Storage</span>
                        <span>{formatCurrency(estimate.subtotalStorage)}</span>
                      </div>
                    )}
                    {estimate.subtotalMileage > 0 && (
                      <div className="flex justify-between text-cream/70">
                        <span>Mileage</span>
                        <span>{formatCurrency(estimate.subtotalMileage)}</span>
                      </div>
                    )}
                    {(estimate.milesToStorage > 0 || estimate.milesToInstall > 0) && (
                      <p className="text-[10px] text-cream/45 leading-relaxed">
                        {estimate.milesToStorage > 0 && (
                          <>{estimate.milesToStorage} mi pickup → {estimate.storageLocationName || 'warehouse'}</>
                        )}
                        {estimate.milesToStorage > 0 && estimate.milesToInstall > 0 && ' · '}
                        {estimate.milesToInstall > 0 && (
                          <>{estimate.milesToInstall} mi warehouse → install</>
                        )}
                      </p>
                    )}
                    {estimate.mileageNote && (
                      <p className="text-[10px] text-cream/40 leading-relaxed">{estimate.mileageNote}</p>
                    )}
                    {estimate.subtotalPickups > 0 && (
                      <div className="flex justify-between text-cream/70">
                        <span>Extra pickups</span>
                        <span>{formatCurrency(estimate.subtotalPickups)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-cream/70">
                      <span>Coordination</span>
                      <span>{formatCurrency(estimate.projectBaseFee)}</span>
                    </div>
                  </div>

                  <div className="border-t border-cream/20 pt-4">
                    <div className="flex justify-between items-baseline">
                      <span className="text-xs uppercase tracking-wider text-cream/50">Estimated Total</span>
                      <span className="font-serif text-3xl text-gold">{formatCurrency(estimate.estimatedTotal)}</span>
                    </div>
                    <p className="text-[10px] text-cream/40 mt-2">
                      Estimate only — final quote confirmed by White Glove Source after review.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowBreakdown((s) => !s)}
                    className="flex items-center gap-1 text-xs text-cream/60 hover:text-cream w-full"
                  >
                    {showBreakdown ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    {showBreakdown ? 'Hide' : 'View'} line-item breakdown
                  </button>

                  {showBreakdown && (
                    <div className="max-h-56 overflow-y-auto text-[11px] space-y-1.5 border-t border-cream/10 pt-3">
                      {estimate.lineItems.map((li, i) => (
                        <div key={i} className="flex justify-between gap-2 text-cream/70">
                          <span className="truncate">
                            {li.description}
                            {li.quantity > 1 && li.unitAmount > 0 && (
                              <span className="text-cream/40">
                                {' '}({li.quantity} × {formatCurrency(li.unitAmount)})
                              </span>
                            )}
                          </span>
                          <span className="shrink-0 font-medium text-cream">{formatCurrency(li.amount)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <p className="text-sm text-cream/60">Unable to calculate estimate.</p>
              )}

              <Button
                type="submit"
                loading={status === 'loading'}
                disabled={!hasItems || estimating}
                className="w-full min-h-[52px] bg-gold text-charcoal hover:bg-gold/90"
              >
                Submit Quote Request
              </Button>
                </>
              )}
            </div>
          </div>
        </form>
      </section>
    </>
  );
}
