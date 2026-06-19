import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Loader2, MapPin, Package } from 'lucide-react';
import { getPieceByScanToken } from '../api/client';
import { PieceUpdateForm } from '../components/PieceUpdateForm';
import { StageBadge, ConditionBadge } from '../components/Badges';
import { PiecePhoto } from '../components/PiecePhoto';
import { useAuth } from '../context/AuthContext';
import { PERMISSIONS, hasAnyPermission } from '../lib/permissions';
import { formatJobNumber } from '../lib/scan';
import { STAGE_LABELS } from '../lib/labels';
import type { Piece, PieceEvent } from '../types';

type ScannedPiece = Piece & {
  events: PieceEvent[];
  jobNumber?: string;
  project?: { id: string; name: string; isDemo?: boolean };
};

export function ScanPiecePage() {
  const { token } = useParams<{ token: string }>();
  const { user } = useAuth();
  const [piece, setPiece] = useState<ScannedPiece | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const canUpdate = hasAnyPermission(
    user?.permissions,
    [PERMISSIONS.FIELD_USE, PERMISSIONS.PROJECTS_MANAGE],
    user?.role,
  );

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    setError(false);
    getPieceByScanToken(token)
      .then((data) => setPiece(data as ScannedPiece))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="animate-spin text-gold" size={32} />
      </div>
    );
  }

  if (error || !piece) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center">
        <Package size={40} className="mx-auto text-charcoal/20 mb-4" />
        <h1 className="font-serif text-xl mb-2">Invalid scan code</h1>
        <p className="text-sm text-charcoal/50 mb-6">
          This label may be outdated or the piece was removed from inventory.
        </p>
        <Link to="/" className="text-gold text-sm">Return home</Link>
      </div>
    );
  }

  const jobNumber = piece.jobNumber ?? formatJobNumber(piece.projectId ?? piece.project?.id ?? '');
  const isDemo = piece.project?.isDemo;
  const projectHref = isDemo ? '/demo' : `/project/${piece.project?.id ?? piece.projectId}`;

  if (showForm && canUpdate) {
    return (
      <div className="px-4 py-6 pb-28 max-w-lg mx-auto">
        <button
          type="button"
          onClick={() => setShowForm(false)}
          className="text-sm text-gold mb-4 min-h-[44px]"
        >
          ← Back to piece details
        </button>
        <h1 className="font-serif text-xl mb-1">{piece.name}</h1>
        <p className="text-xs text-charcoal/40 mb-4">{jobNumber}</p>
        <PieceUpdateForm
          piece={piece}
          isDemo={!!isDemo}
          layout="inline"
          onSuccess={(updated) => {
            setPiece((prev) => (prev ? { ...prev, ...updated } : prev));
            setShowForm(false);
          }}
          onCancel={() => setShowForm(false)}
          submitViaScan={token}
        />
      </div>
    );
  }

  return (
    <div className="px-4 py-6 pb-28 max-w-lg mx-auto">
      <div className="text-center mb-6">
        <p className="text-[10px] uppercase tracking-widest text-charcoal/40 mb-1">White Glove Delivery</p>
        <p className="text-xs font-semibold text-gold">{jobNumber}</p>
      </div>

      <div className="bg-white border border-cream-dark p-4 mb-4">
        <div className="flex gap-4">
          <PiecePhoto piece={piece} size="card" className="rounded-sm border border-cream-dark shrink-0" />
          <div className="min-w-0 flex-1">
            <h1 className="font-serif text-lg leading-tight mb-2">{piece.name}</h1>
            {piece.room?.name && (
              <p className="text-xs text-charcoal/50 mb-2">{piece.room.name}</p>
            )}
            <div className="flex flex-wrap gap-2">
              <StageBadge stage={piece.currentStage} />
              <ConditionBadge condition={piece.currentCondition} />
            </div>
          </div>
        </div>

        {piece.currentLocation && (
          <div className="flex items-start gap-2 mt-4 pt-4 border-t border-cream-dark text-sm">
            <MapPin size={16} className="text-gold shrink-0 mt-0.5" />
            <span>{piece.currentLocation}</span>
          </div>
        )}
      </div>

      <div className="bg-white border border-cream-dark p-4 mb-6">
        <h2 className="text-xs uppercase tracking-wider text-charcoal/40 mb-3">Process status</h2>
        <p className="text-sm font-medium mb-1">{STAGE_LABELS[piece.currentStage]}</p>
        <p className="text-xs text-charcoal/50">
          {piece.events.length
            ? `Last updated ${new Date(piece.events[0].createdAt).toLocaleString()}`
            : 'No check-ins recorded yet'}
        </p>
      </div>

      {piece.events.length > 0 && (
        <div className="bg-white border border-cream-dark p-4 mb-6">
          <h2 className="text-xs uppercase tracking-wider text-charcoal/40 mb-3">Recent activity</h2>
          <ul className="space-y-3">
            {piece.events.slice(0, 5).map((evt) => (
              <li key={evt.id} className="text-sm border-l-2 border-gold/30 pl-3">
                <p className="font-medium">{STAGE_LABELS[evt.stage]}</p>
                <p className="text-xs text-charcoal/40">
                  {new Date(evt.createdAt).toLocaleString()}
                  {evt.location ? ` · ${evt.location}` : ''}
                </p>
                {evt.notes && <p className="text-xs text-charcoal/60 mt-0.5">{evt.notes}</p>}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="space-y-3">
        {canUpdate ? (
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="w-full bg-charcoal text-cream py-3 min-h-[52px] text-sm uppercase tracking-wider"
          >
            Check in / update status
          </button>
        ) : user ? (
          <p className="text-xs text-center text-charcoal/50">
            You need field or project manage access to update this piece.
          </p>
        ) : (
          <Link
            to="/login"
            state={{ from: { pathname: `/scan/${token}` } }}
            className="block w-full text-center bg-charcoal text-cream py-3 min-h-[52px] text-sm uppercase tracking-wider"
          >
            Log in to check in
          </Link>
        )}
        <Link
          to={projectHref}
          className="block w-full text-center border border-cream-dark py-3 min-h-[48px] text-sm text-charcoal/70"
        >
          View project
        </Link>
      </div>
    </div>
  );
}
