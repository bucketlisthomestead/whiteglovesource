import type { Piece, PieceStagePhoto, PhotoMilestone } from '../types';
import { PHOTO_MILESTONE_LABELS } from '../lib/labels';
import { piecePhotoUrl } from '../lib/piecePhotos';

const MILESTONES: PhotoMilestone[] = ['pickup', 'delivery', 'install'];

interface StagePhotosProps {
  piece: Piece;
  compact?: boolean;
}

export function StagePhotos({ piece, compact }: StagePhotosProps) {
  const byMilestone = MILESTONES.reduce(
    (acc, m) => {
      acc[m] = piece.stagePhotos?.find((p) => p.milestone === m);
      return acc;
    },
    {} as Record<PhotoMilestone, PieceStagePhoto | undefined>,
  );

  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-charcoal/40 mb-2">
        Stage Photos
      </p>
      <div className={`grid grid-cols-3 gap-2 ${compact ? '' : 'md:gap-3'}`}>
        {MILESTONES.map((milestone) => {
          const photo = byMilestone[milestone];
          const src = photo?.photoUrl || piecePhotoUrl(piece, milestone);

          return (
            <div key={milestone} className="text-center">
              <div
                className={`aspect-square bg-cream-dark border border-cream-dark overflow-hidden ${
                  compact ? '' : 'md:aspect-[4/3]'
                }`}
              >
                {src ? (
                  <img
                    src={src}
                    alt={`${piece.name} — ${PHOTO_MILESTONE_LABELS[milestone]}`}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center px-1">
                    <span className="text-[9px] uppercase tracking-wider text-charcoal/30">
                      No photo
                    </span>
                  </div>
                )}
              </div>
              <p className="text-[9px] uppercase tracking-wider text-charcoal/50 mt-1">
                {PHOTO_MILESTONE_LABELS[milestone]}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
