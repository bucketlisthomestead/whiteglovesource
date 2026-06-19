import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, ChevronRight, MinusCircle } from 'lucide-react';
import { createScopeReductionQuote, previewScopeReduction } from '../api/client';
import type { CreditLineItemPreview, Project } from '../types';
import { formatCurrency } from '../lib/labels';
import { Button } from './Layout';

interface ProjectScopeReductionSectionProps {
  project: Project;
  canManage: boolean;
}

export function ProjectScopeReductionSection({
  project,
  canManage,
}: ProjectScopeReductionSectionProps) {
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);
  const [selectedPieceIds, setSelectedPieceIds] = useState<Set<string>>(new Set());
  const [selectedRoomIds, setSelectedRoomIds] = useState<Set<string>>(new Set());
  const [preview, setPreview] = useState<{
    proposedLineItems: CreditLineItemPreview[];
    creditTotal: number;
  } | null>(null);
  const [selectedLineKeys, setSelectedLineKeys] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<'preview' | 'create' | null>(null);
  const [error, setError] = useState('');

  const piecesByRoom = useMemo(() => {
    const map = new Map<string, typeof project.pieces>();
    for (const room of project.rooms) {
      map.set(room.id, project.pieces.filter((p) => p.roomId === room.id));
    }
    const unassigned = project.pieces.filter((p) => !p.roomId);
    if (unassigned.length) map.set('__unassigned__', unassigned);
    return map;
  }, [project.pieces, project.rooms]);

  const togglePiece = (pieceId: string) => {
    setPreview(null);
    setSelectedLineKeys(new Set());
    setSelectedPieceIds((prev) => {
      const next = new Set(prev);
      if (next.has(pieceId)) next.delete(pieceId);
      else next.add(pieceId);
      return next;
    });
  };

  const toggleRoom = (roomId: string | null, pieceIds: string[]) => {
    setPreview(null);
    setSelectedLineKeys(new Set());
    const allSelected = pieceIds.every((id) => selectedPieceIds.has(id));
    if (roomId) {
      setSelectedRoomIds((rooms) => {
        const next = new Set(rooms);
        if (allSelected) next.delete(roomId);
        else next.add(roomId);
        return next;
      });
    }
    setSelectedPieceIds((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        for (const id of pieceIds) next.delete(id);
      } else {
        for (const id of pieceIds) next.add(id);
      }
      return next;
    });
  };

  const handlePreview = async () => {
    const pieceIds = [...selectedPieceIds];
    const roomIds = [...selectedRoomIds];
    if (!pieceIds.length && !roomIds.length) {
      setError('Select at least one room or piece to remove.');
      return;
    }
    setBusy('preview');
    setError('');
    try {
      const result = await previewScopeReduction(project.id, { pieceIds, roomIds });
      setPreview({
        proposedLineItems: result.proposedLineItems,
        creditTotal: result.creditTotal,
      });
      setSelectedLineKeys(new Set(result.proposedLineItems.map((l) => l.key)));
    } catch {
      setError('Could not preview credit line items for the selected inventory.');
    } finally {
      setBusy(null);
    }
  };

  const toggleLineItem = (key: string) => {
    setSelectedLineKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const selectedCreditTotal = useMemo(() => {
    if (!preview) return 0;
    return preview.proposedLineItems
      .filter((l) => selectedLineKeys.has(l.key))
      .reduce((sum, l) => sum + l.amount, 0);
  }, [preview, selectedLineKeys]);

  const handleCreate = async () => {
    if (!preview || !selectedLineKeys.size) {
      setError('Select at least one credit line item.');
      return;
    }
    setBusy('create');
    setError('');
    try {
      const quote = await createScopeReductionQuote(project.id, {
        pieceIds: [...selectedPieceIds],
        roomIds: [...selectedRoomIds],
        selectedLineItemKeys: [...selectedLineKeys],
      });
      navigate(`/admin/quotes/${quote.id}?edit=1`);
    } catch {
      setError('Could not create scope reduction quote.');
      setBusy(null);
    }
  };

  if (!canManage || !project.pieces.length) return null;

  return (
    <section className="bg-white border border-cream-dark p-5 md:p-6 space-y-4">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-start justify-between gap-3 text-left min-h-[44px]"
      >
        <div>
          <h2 className="font-serif text-lg text-charcoal flex items-center gap-2">
            <MinusCircle size={18} className="text-charcoal/70" />
            Scope reduction
          </h2>
          <p className="text-sm text-charcoal/70 mt-1">
            Remove rooms or pieces from inventory and create a credit quote with selected line items.
          </p>
        </div>
        {expanded ? (
          <ChevronDown size={18} className="text-charcoal/50 shrink-0 mt-1" />
        ) : (
          <ChevronRight size={18} className="text-charcoal/50 shrink-0 mt-1" />
        )}
      </button>

      {expanded && (
        <div className="space-y-5 border-t border-cream-dark pt-4">
          {error && <p className="text-sm text-red-700">{error}</p>}

          <div className="space-y-3">
            <p className="text-sm font-semibold uppercase tracking-wide text-charcoal">
              Select inventory to remove
            </p>
            {[...piecesByRoom.entries()].map(([roomId, pieces]) => {
              const roomName =
                roomId === '__unassigned__'
                  ? 'Unassigned'
                  : project.rooms.find((r) => r.id === roomId)?.name ?? 'Room';
              const allChecked = pieces.every((p) => selectedPieceIds.has(p.id));
              return (
                <div key={roomId} className="border border-cream-dark">
                  <label className="flex items-center gap-3 px-4 py-3 bg-cream/30 cursor-pointer min-h-[44px]">
                    <input
                      type="checkbox"
                      checked={allChecked && pieces.length > 0}
                      onChange={() =>
                        toggleRoom(
                          roomId === '__unassigned__' ? null : roomId,
                          pieces.map((p) => p.id),
                        )
                      }
                      className="w-4 h-4 accent-charcoal"
                    />
                    <span className="text-sm font-medium text-charcoal">
                      {roomName}
                      <span className="text-charcoal/55 font-normal ml-2">
                        ({pieces.length} piece{pieces.length === 1 ? '' : 's'})
                      </span>
                    </span>
                  </label>
                  <div className="divide-y divide-cream-dark">
                    {pieces.map((piece) => (
                      <label
                        key={piece.id}
                        className="flex items-center gap-3 px-4 py-2.5 pl-10 cursor-pointer hover:bg-cream/20 min-h-[44px]"
                      >
                        <input
                          type="checkbox"
                          checked={selectedPieceIds.has(piece.id)}
                          onChange={() => togglePiece(piece.id)}
                          className="w-4 h-4 accent-charcoal"
                        />
                        <span className="text-sm text-charcoal">{piece.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          <Button
            type="button"
            variant="outline"
            onClick={() => void handlePreview()}
            loading={busy === 'preview'}
            disabled={!selectedPieceIds.size}
            className="min-h-[44px]"
          >
            Preview credit line items
          </Button>

          {preview && (
            <div className="space-y-3 border border-cream-dark p-4 bg-cream/20">
              <p className="text-sm font-semibold uppercase tracking-wide text-charcoal">
                Select quoted line items to credit
              </p>
              <p className="text-xs text-charcoal/65">
                Uncheck any line items that should not be removed from the contract.
              </p>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {preview.proposedLineItems.map((line) => (
                  <label
                    key={line.key}
                    className="flex items-start gap-3 p-3 bg-white border border-cream-dark cursor-pointer min-h-[44px]"
                  >
                    <input
                      type="checkbox"
                      checked={selectedLineKeys.has(line.key)}
                      onChange={() => toggleLineItem(line.key)}
                      className="w-4 h-4 accent-charcoal mt-0.5"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-charcoal">{line.description}</p>
                      <p className="text-xs text-charcoal/55 mt-0.5">{line.category}</p>
                    </div>
                    <span className="text-sm font-medium text-charcoal shrink-0">
                      {formatCurrency(line.amount)}
                    </span>
                  </label>
                ))}
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-cream-dark">
                <p className="text-sm text-charcoal">
                  Selected credit:{' '}
                  <span className="font-medium text-gold">{formatCurrency(selectedCreditTotal)}</span>
                </p>
                <Button
                  type="button"
                  onClick={() => void handleCreate()}
                  loading={busy === 'create'}
                  disabled={!selectedLineKeys.size}
                  className="min-h-[44px]"
                >
                  Create reduction quote
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
