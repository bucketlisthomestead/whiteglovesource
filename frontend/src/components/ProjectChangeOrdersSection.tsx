import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  applyChangeOrderToProject,
  createChangeOrderQuote,
  downloadContractAmendment,
  generateContractAmendment,
  getProjectChangeOrders,
  listContractAmendments,
} from '../api/client';
import type { ChangeOrderSummary, ContractAmendment, Project } from '../types';
import { formatCurrency, formatDate, QUOTE_STATUS_LABELS } from '../lib/labels';
import { Button } from './Layout';
import { FileText, Loader2, Plus, ExternalLink, Download, CheckCircle2, Minus } from 'lucide-react';

interface ProjectChangeOrdersSectionProps {
  project: Project;
  canManage: boolean;
}

export function ProjectChangeOrdersSection({
  project,
  canManage,
}: ProjectChangeOrdersSectionProps) {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<ChangeOrderSummary[]>([]);
  const [amendments, setAmendments] = useState<ContractAmendment[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    setError('');
    Promise.all([
      getProjectChangeOrders(project.id),
      listContractAmendments(project.id).catch(() => [] as ContractAmendment[]),
    ])
      .then(([orderList, amendmentList]) => {
        setOrders(orderList);
        setAmendments(amendmentList);
      })
      .catch(() => setError('Unable to load change orders'))
      .finally(() => setLoading(false));
  }, [project.id]);

  useEffect(() => {
    load();
  }, [load]);

  const handleCreate = async () => {
    setBusy('create');
    setError('');
    try {
      const quote = await createChangeOrderQuote(project.id);
      navigate(`/admin/quotes/${quote.id}?edit=1`);
    } catch {
      setError('Could not create change order quote.');
      setBusy(null);
    }
  };

  const handleApply = async (quoteId: string) => {
    setBusy(`apply-${quoteId}`);
    setError('');
    try {
      await applyChangeOrderToProject(quoteId);
      load();
      window.location.reload();
    } catch {
      setError('Could not apply change order — ensure it is accepted and has rooms/items.');
    } finally {
      setBusy(null);
    }
  };

  const handleGenerateAmendment = async (quoteId: string) => {
    setBusy(`amend-${quoteId}`);
    setError('');
    try {
      await generateContractAmendment(project.id, quoteId);
      load();
    } catch {
      setError('Could not generate contract amendment.');
    } finally {
      setBusy(null);
    }
  };

  const handleDownloadAmendment = async (amendment: ContractAmendment) => {
    setBusy(`dl-${amendment.id}`);
    try {
      const blob = await downloadContractAmendment(project.id, amendment.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = amendment.proposalFilename;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setBusy(null);
    }
  };

  if (!canManage) return null;

  return (
    <section className="bg-white border border-cream-dark p-5 md:p-6 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div>
          <h2 className="font-serif text-lg text-charcoal">Scope additions</h2>
          <p className="text-sm text-charcoal/55 mt-1">
            Create a change-order quote for additional rooms and furniture. After approval on the
            quote page, use <strong className="font-medium text-charcoal/70">Add to project inventory</strong>{' '}
            to merge items into this project.
          </p>
        </div>
        <Button
          type="button"
          onClick={() => void handleCreate()}
          loading={busy === 'create'}
          className="shrink-0 min-h-[44px]"
        >
          <Plus size={14} className="mr-2" />
          New change order quote
        </Button>
      </div>

      {error && <p className="text-sm text-red-700">{error}</p>}

      {loading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="animate-spin text-gold" size={24} />
        </div>
      ) : orders.length === 0 ? (
        <p className="text-sm text-charcoal/50">No change orders yet.</p>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => {
            const amendment = amendments.find((a) => a.quoteId === order.id);
            const isReduction = order.changeOrderType === 'reduction';
            const canApply = isReduction
              ? order.status === 'accepted' &&
                !order.appliedAt &&
                (order.removalPieceCount ?? 0) > 0
              : order.status === 'accepted' && !order.appliedAt && order.roomCount > 0;
            const canAmend = order.status === 'accepted';
            const awaitingApproval =
              !order.appliedAt && order.status !== 'accepted' && order.status !== 'declined';

            return (
              <div
                key={order.id}
                className="border border-cream-dark p-4 flex flex-col gap-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-charcoal">
                      {order.serviceType}
                      <span className="ml-2 text-[10px] uppercase tracking-wider border border-cream-dark px-1.5 py-0.5 text-charcoal/60">
                        {isReduction ? 'Reduction' : 'Addition'}
                      </span>
                      {order.appliedAt && (
                        <span className="ml-2 inline-flex items-center gap-1 text-xs text-green-700 font-normal">
                          <CheckCircle2 size={14} /> Applied
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-charcoal/50 mt-1">
                      {QUOTE_STATUS_LABELS[order.status]}
                      {isReduction
                        ? ` · ${order.removalPieceCount ?? 0} piece(s) to remove`
                        : ` · ${order.roomCount} room(s)`}
                      {!isReduction && order.estimatedPieces != null && ` · ${order.estimatedPieces} pieces`}
                      {' · '}
                      {formatDate(order.createdAt)}
                    </p>
                    {(order.quotedAmount != null || order.estimatedTotal != null) && (
                      <p className="text-sm text-gold mt-1">
                        {isReduction ? 'Credit: ' : ''}
                        {formatCurrency(order.quotedAmount ?? order.estimatedTotal ?? 0)}
                      </p>
                    )}
                  </div>
                  <Link
                    to={`/admin/quotes/${order.id}`}
                    className="inline-flex items-center gap-1 text-xs uppercase tracking-wider text-gold min-h-[44px]"
                  >
                    Open quote <ExternalLink size={12} />
                  </Link>
                </div>

                <div className="flex flex-wrap gap-2">
                  {awaitingApproval && (
                    <p className="text-xs text-charcoal/55 w-full">
                      Open the quote to send for approval or mark accepted, then add to inventory.
                    </p>
                  )}
                  {canAmend && (
                    <button
                      type="button"
                      disabled={!!busy}
                      onClick={() => void handleGenerateAmendment(order.id)}
                      className="inline-flex items-center gap-1.5 px-3 py-2 text-xs uppercase tracking-wider border border-charcoal/20 hover:bg-cream min-h-[44px] disabled:opacity-50"
                    >
                      {busy === `amend-${order.id}` ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <FileText size={14} />
                      )}
                      {amendment ? 'Regenerate amendment' : isReduction ? 'Generate credit amendment' : 'Generate revised contract'}
                    </button>
                  )}
                  {amendment && (
                    <button
                      type="button"
                      disabled={!!busy}
                      onClick={() => void handleDownloadAmendment(amendment)}
                      className="inline-flex items-center gap-1.5 px-3 py-2 text-xs uppercase tracking-wider border border-charcoal/20 hover:bg-cream min-h-[44px] disabled:opacity-50"
                    >
                      <Download size={14} />
                      Download amendment v{amendment.versionNumber}
                    </button>
                  )}
                  {canApply && (
                    <button
                      type="button"
                      disabled={!!busy}
                      onClick={() => void handleApply(order.id)}
                      className="inline-flex items-center gap-1.5 px-3 py-2 text-xs uppercase tracking-wider bg-charcoal text-cream min-h-[44px] disabled:opacity-50"
                    >
                      {busy === `apply-${order.id}` ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : isReduction ? (
                        <Minus size={14} />
                      ) : (
                        <Plus size={14} />
                      )}
                      {isReduction ? 'Remove from inventory' : 'Add to project inventory'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
