import { useEffect, useState } from 'react';
import { AlertCircle, DollarSign, Loader2 } from 'lucide-react';
import type { PhasePaymentStatus, Project, ProjectPhase, ProjectPhasePayment } from '../types';
import { getProjectPhasePayments, updateProjectPhasePayment } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { PERMISSIONS } from '../lib/permissions';
import {
  formatCurrency,
  formatDate,
  PHASE_LABELS,
  PHASE_ORDER,
  PHASE_PAYMENT_STATUS_LABELS,
  PHASE_PAYMENT_STATUS_ORDER,
} from '../lib/labels';

interface PhasePaymentsSectionProps {
  project: Project;
}

type PhaseDraft = {
  status: PhasePaymentStatus;
  amountExpected: string;
  note: string;
};

function emptyPayment(projectId: string, phase: ProjectPhase): ProjectPhasePayment {
  return {
    id: null,
    projectId,
    phase,
    status: 'not_due',
    amountExpected: null,
    capturedAt: null,
    capturedByUserId: null,
    capturedByName: null,
    note: null,
    updatedAt: null,
  };
}

function toDraft(payment: ProjectPhasePayment): PhaseDraft {
  return {
    status: payment.status,
    amountExpected: payment.amountExpected != null ? String(payment.amountExpected) : '',
    note: payment.note ?? '',
  };
}

export function PhasePaymentsSection({ project }: PhasePaymentsSectionProps) {
  const { hasPermission } = useAuth();
  const canManage = hasPermission(PERMISSIONS.PROJECTS_MANAGE);
  const [payments, setPayments] = useState<ProjectPhasePayment[]>([]);
  const [drafts, setDrafts] = useState<Partial<Record<ProjectPhase, PhaseDraft>>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<ProjectPhase | null>(null);
  const [error, setError] = useState('');

  const load = () => {
    setLoading(true);
    setError('');
    getProjectPhasePayments(project.id)
      .then((rows) => {
        setPayments(rows);
        const nextDrafts: Partial<Record<ProjectPhase, PhaseDraft>> = {};
        for (const row of rows) {
          nextDrafts[row.phase] = toDraft(row);
        }
        setDrafts(nextDrafts);
      })
      .catch(() => setError('Unable to load phase payments'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [project.id]);

  const paymentByPhase = Object.fromEntries(payments.map((p) => [p.phase, p])) as Partial<
    Record<ProjectPhase, ProjectPhasePayment>
  >;

  const persistPhase = async (phase: ProjectPhase, draft: PhaseDraft) => {
    setBusy(phase);
    setError('');
    try {
      const amount =
        draft.amountExpected.trim() === '' ? null : Number.parseFloat(draft.amountExpected);
      const updated = await updateProjectPhasePayment(project.id, phase, {
        status: draft.status,
        amountExpected: amount != null && !Number.isNaN(amount) ? amount : null,
        note: draft.note.trim() || null,
      });
      setPayments((prev) => prev.map((p) => (p.phase === phase ? updated : p)));
      setDrafts((prev) => ({ ...prev, [phase]: toDraft(updated) }));
    } catch {
      setError(`Failed to update ${PHASE_LABELS[phase]} payment.`);
    } finally {
      setBusy(null);
    }
  };

  const updateDraft = (phase: ProjectPhase, patch: Partial<PhaseDraft>) => {
    const base = drafts[phase] ?? toDraft(paymentByPhase[phase] ?? emptyPayment(project.id, phase));
    return { ...base, ...patch };
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-8 text-sm text-charcoal/50 justify-center bg-white border border-cream-dark mt-6">
        <Loader2 size={16} className="animate-spin" /> Loading payments…
      </div>
    );
  }

  return (
    <div className="bg-white border border-cream-dark p-4 md:p-6 mt-6">
      <div className="mb-4">
        <h2 className="text-sm uppercase tracking-wider font-medium text-charcoal flex items-center gap-2">
          <DollarSign size={16} className="text-gold" />
          Payment by Phase
        </h2>
        <p className="text-xs text-charcoal/50 mt-1">
          Manual payment tracking per workflow phase — no payment processor.
        </p>
      </div>

      {error && (
        <p className="mb-4 px-3 py-2 bg-red-50 text-red-800 text-xs border border-red-200 flex items-center gap-2">
          <AlertCircle size={14} /> {error}
        </p>
      )}

      <div className="space-y-4">
        {PHASE_ORDER.map((phase) => {
          const payment = paymentByPhase[phase] ?? emptyPayment(project.id, phase);
          const draft = drafts[phase] ?? toDraft(payment);
          const isBusy = busy === phase;

          return (
            <div key={phase} className="border border-cream-dark p-3 bg-cream/20">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <div>
                  <p className="text-sm font-medium text-charcoal">{PHASE_LABELS[phase]}</p>
                  <p className="text-[10px] text-charcoal/45 uppercase tracking-wider">{phase}</p>
                </div>
                <StatusPill status={payment.status} />
              </div>

              {canManage ? (
                <div className="space-y-3">
                  <label className="block">
                    <span className="text-xs uppercase tracking-wider text-charcoal/50">Status</span>
                    <select
                      value={draft.status}
                      disabled={isBusy}
                      onChange={(e) => {
                        const next = updateDraft(phase, {
                          status: e.target.value as PhasePaymentStatus,
                        });
                        setDrafts((prev) => ({ ...prev, [phase]: next }));
                        void persistPhase(phase, next);
                      }}
                      className="mt-1 w-full border border-cream-dark px-3 py-2 text-sm bg-white min-h-[44px]"
                    >
                      {PHASE_PAYMENT_STATUS_ORDER.map((status) => (
                        <option key={status} value={status}>
                          {PHASE_PAYMENT_STATUS_LABELS[status]}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block">
                    <span className="text-xs uppercase tracking-wider text-charcoal/50">
                      Amount expected
                    </span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={draft.amountExpected}
                      disabled={isBusy}
                      onChange={(e) =>
                        setDrafts((prev) => ({
                          ...prev,
                          [phase]: updateDraft(phase, { amountExpected: e.target.value }),
                        }))
                      }
                      onBlur={() => void persistPhase(phase, drafts[phase] ?? draft)}
                      placeholder="Optional"
                      className="mt-1 w-full border border-cream-dark px-3 py-2 text-sm bg-white min-h-[44px]"
                    />
                  </label>

                  <label className="block">
                    <span className="text-xs uppercase tracking-wider text-charcoal/50">Note</span>
                    <textarea
                      value={draft.note}
                      disabled={isBusy}
                      onChange={(e) =>
                        setDrafts((prev) => ({
                          ...prev,
                          [phase]: updateDraft(phase, { note: e.target.value }),
                        }))
                      }
                      onBlur={() => void persistPhase(phase, drafts[phase] ?? draft)}
                      placeholder="Check number, method, etc."
                      rows={2}
                      className="mt-1 w-full border border-cream-dark px-3 py-2 text-sm bg-cream/30 resize-none"
                    />
                  </label>

                  {payment.status === 'captured' && payment.capturedAt && (
                    <p className="text-xs text-charcoal/60">
                      Captured {formatDate(payment.capturedAt.slice(0, 10))}
                      {payment.capturedByName ? ` by ${payment.capturedByName}` : ''}
                    </p>
                  )}
                </div>
              ) : (
                <div className="space-y-1 text-sm text-charcoal/80">
                  {payment.amountExpected != null && (
                    <p>Amount expected: {formatCurrency(payment.amountExpected)}</p>
                  )}
                  {payment.status === 'captured' && payment.capturedAt && (
                    <p>
                      Captured {formatDate(payment.capturedAt.slice(0, 10))}
                      {payment.capturedByName ? ` · ${payment.capturedByName}` : ''}
                    </p>
                  )}
                  {payment.note && <p className="text-xs text-charcoal/60">{payment.note}</p>}
                  {payment.status === 'not_due' && (
                    <p className="text-xs text-charcoal/45">Not due yet</p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: PhasePaymentStatus }) {
  const cls =
    status === 'captured'
      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
      : status === 'due'
        ? 'bg-amber-50 text-amber-900 border-amber-200'
        : 'bg-cream text-charcoal/60 border-cream-dark';

  return (
    <span className={`inline-flex px-2.5 py-1 text-[10px] uppercase tracking-wider border ${cls}`}>
      {PHASE_PAYMENT_STATUS_LABELS[status]}
    </span>
  );
}
