import { useState } from 'react';
import { Check, PenLine, Loader2, Download } from 'lucide-react';
import type { Piece, Project, ProjectPhase, PhotoMilestone, SignerRole, Signoff } from '../types';
import {
  INVENTORY_SIGNOFF_REQUIREMENTS,
  MILESTONE_SIGNOFF_REQUIREMENTS,
  PHASE_LABELS,
  PHOTO_MILESTONE_LABELS,
  SIGNER_ROLE_LABELS,
} from '../lib/labels';
import { createSignoff, downloadStatusReportPdf } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { randomId } from '../lib/randomId';
import { formatDate } from '../lib/labels';

interface SignoffSectionProps {
  project: Project;
  piece?: Piece;
  onSignoff?: (signoff: Signoff) => void;
  isDemo?: boolean;
}

function hasSignoff(
  signoffs: Signoff[] | undefined,
  opts: { phase?: ProjectPhase; milestone?: PhotoMilestone; role: SignerRole; pieceId?: string },
) {
  return (signoffs || []).some(
    (s) =>
      s.signerRole === opts.role &&
      (opts.phase ? s.phase === opts.phase && s.signoffType === 'inventory' : true) &&
      (opts.milestone ? s.milestone === opts.milestone && s.signoffType === 'milestone' : true) &&
      (opts.pieceId ? s.pieceId === opts.pieceId : !s.pieceId || s.pieceId === opts.pieceId),
  );
}

function canUserSign(
  role: SignerRole,
  isAdmin: boolean,
  isDesigner: boolean,
  isClient: boolean,
  isDemo?: boolean,
) {
  if (isDemo) return true;
  if (isAdmin) return true;
  if (role === 'designer' && isDesigner) return true;
  if (role === 'client' && isClient) return true;
  return false;
}

function demoSignerName(role: SignerRole, userName?: string) {
  return userName || (role === 'designer' ? 'Designer (Demo)' : 'Client (Demo)');
}

export function InventorySignoffPanel({ project, onSignoff, isDemo }: SignoffSectionProps) {
  const { user, isAdmin, isDesigner, isClient } = useAuth();
  const [loading, setLoading] = useState<string | null>(null);
  const [pdfPhase, setPdfPhase] = useState<ProjectPhase | null>(null);
  const projectSignoffs = project.signoffs?.filter((s) => s.signoffType === 'inventory') || [];

  const handleDownloadPhase = async (phase: ProjectPhase) => {
    if (isDemo) return;
    setPdfPhase(phase);
    try {
      const blob = await downloadStatusReportPdf(project.id, phase);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `signoff-${phase}-${project.name.slice(0, 20)}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert('PDF download requires an online connection and login.');
    } finally {
      setPdfPhase(null);
    }
  };

  const handleSign = async (phase: ProjectPhase, role: SignerRole) => {
    if (!isDemo && !user) return;
    const key = `inv-${phase}-${role}`;
    setLoading(key);
    try {
      if (isDemo) {
        onSignoff?.({
          id: randomId(),
          projectId: project.id,
          signoffType: 'inventory',
          signerRole: role,
          signerName: demoSignerName(role, user?.name),
          phase,
          signedAt: new Date().toISOString(),
        });
        return;
      }
      const signoff = await createSignoff({
        projectId: project.id,
        signoffType: 'inventory',
        signerRole: role,
        phase,
      });
      onSignoff?.(signoff);
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="bg-white border border-cream-dark p-4 md:p-5 mb-6">
      <h3 className="font-serif text-lg mb-1">Inventory Signoffs</h3>
      <p className="text-xs text-charcoal/50 mb-4">
        Designer and client approval at each project phase. Download a signoff PDF for insurance or client records.
      </p>
      <div className="space-y-4">
        {INVENTORY_SIGNOFF_REQUIREMENTS.map(({ phase, roles }) => (
          <div key={phase} className="border-t border-cream-dark pt-3 first:border-0 first:pt-0">
            <div className="flex items-center justify-between gap-2 mb-2">
              <p className="text-xs font-medium text-charcoal">{PHASE_LABELS[phase]}</p>
              {!isDemo && user && (
                <button
                  type="button"
                  onClick={() => handleDownloadPhase(phase)}
                  disabled={pdfPhase === phase}
                  className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-charcoal/50 hover:text-gold min-h-[32px] px-2"
                >
                  {pdfPhase === phase ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : (
                    <Download size={12} />
                  )}
                  PDF
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {roles.map((role) => {
                const signed = hasSignoff(projectSignoffs, { phase, role });
                const existing = projectSignoffs.find((s) => s.phase === phase && s.signerRole === role);
                const allowed = isDemo || (user && canUserSign(role, isAdmin, isDesigner, isClient, isDemo));

                if (signed && existing) {
                  return (
                    <span
                      key={role}
                      className="inline-flex items-center gap-1.5 px-3 py-2 bg-emerald-50 text-emerald-800 text-xs"
                    >
                      <Check size={14} />
                      {SIGNER_ROLE_LABELS[role]} — {existing.signerName}
                    </span>
                  );
                }

                if (!allowed) {
                  return (
                    <span
                      key={role}
                      className="inline-flex items-center gap-1.5 px-3 py-2 bg-cream text-charcoal/40 text-xs border border-cream-dark"
                    >
                      {SIGNER_ROLE_LABELS[role]} pending
                    </span>
                  );
                }

                return (
                  <button
                    key={role}
                    type="button"
                    disabled={loading === `inv-${phase}-${role}`}
                    onClick={() => handleSign(phase, role)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 bg-charcoal text-cream text-xs min-h-[40px] hover:bg-charcoal/90 transition-colors"
                  >
                    {loading === `inv-${phase}-${role}` ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <PenLine size={14} />
                    )}
                    Sign as {SIGNER_ROLE_LABELS[role]}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function PieceMilestoneSignoffs({ project, piece, onSignoff, isDemo }: SignoffSectionProps) {
  const { user, isAdmin, isDesigner, isClient } = useAuth();
  const [loading, setLoading] = useState<string | null>(null);
  if (!piece) return null;

  const pieceSignoffs = [
    ...(piece.signoffs || []),
    ...(project.signoffs?.filter((s) => s.pieceId === piece.id && s.signoffType === 'milestone') || []),
  ];

  const handleSign = async (milestone: PhotoMilestone, role: SignerRole) => {
    if (!isDemo && !user) return;
    const key = `ms-${milestone}-${role}`;
    setLoading(key);
    try {
      if (isDemo) {
        onSignoff?.({
          id: randomId(),
          projectId: project.id,
          pieceId: piece.id,
          signoffType: 'milestone',
          signerRole: role,
          signerName: demoSignerName(role, user?.name),
          milestone,
          signedAt: new Date().toISOString(),
        });
        return;
      }
      const signoff = await createSignoff({
        projectId: project.id,
        pieceId: piece.id,
        signoffType: 'milestone',
        signerRole: role,
        milestone,
      });
      onSignoff?.(signoff);
    } finally {
      setLoading(null);
    }
  };

  const hasPhoto = (milestone: PhotoMilestone) =>
    piece.stagePhotos?.some((p) => p.milestone === milestone);

  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-charcoal/40 mb-2">
        Milestone Signoffs
      </p>
      <div className="space-y-3">
        {MILESTONE_SIGNOFF_REQUIREMENTS.map(({ milestone, roles }) => (
          <div key={milestone} className="flex flex-col gap-1.5">
            <p className="text-xs text-charcoal/70">{PHOTO_MILESTONE_LABELS[milestone]}</p>
            <div className="flex flex-wrap gap-2">
              {roles.map((role) => {
                const signed = hasSignoff(pieceSignoffs, { milestone, role, pieceId: piece.id });
                const existing = pieceSignoffs.find(
                  (s) => s.milestone === milestone && s.signerRole === role,
                );
                const allowed = isDemo || (user && canUserSign(role, isAdmin, isDesigner, isClient, isDemo));
                const photoReady = hasPhoto(milestone);

                if (signed && existing) {
                  return (
                    <span
                      key={role}
                      className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-50 text-emerald-800 text-[10px]"
                    >
                      <Check size={12} />
                      {SIGNER_ROLE_LABELS[role]}
                      <span className="text-charcoal/40">· {formatDate(existing.signedAt.slice(0, 10))}</span>
                    </span>
                  );
                }

                if (!photoReady) {
                  return (
                    <span
                      key={role}
                      className="inline-flex items-center gap-1 px-2 py-1 bg-cream text-charcoal/40 text-[10px] border border-cream-dark"
                    >
                      Photo required
                    </span>
                  );
                }

                if (!allowed) {
                  return (
                    <span
                      key={role}
                      className="inline-flex items-center gap-1 px-2 py-1 bg-cream text-charcoal/40 text-[10px] border border-cream-dark"
                    >
                      {SIGNER_ROLE_LABELS[role]} pending
                    </span>
                  );
                }

                return (
                  <button
                    key={role}
                    type="button"
                    disabled={loading === `ms-${milestone}-${role}`}
                    onClick={() => handleSign(milestone, role)}
                    className="inline-flex items-center gap-1 px-2 py-1 bg-charcoal text-cream text-[10px] min-h-[32px]"
                  >
                    {loading === `ms-${milestone}-${role}` ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : (
                      <PenLine size={12} />
                    )}
                    Sign ({SIGNER_ROLE_LABELS[role]})
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
