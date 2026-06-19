import { piecePhotoUrl } from '../lib/piecePhotos';

interface PiecePhotoProps {
  piece: { name: string; photoUrl?: string | null };
  size?: 'thumb' | 'card' | 'hero';
  className?: string;
}

const sizeClasses = {
  thumb: 'w-16 h-16 md:w-20 md:h-20',
  card: 'w-full aspect-[4/3]',
  hero: 'w-full aspect-[16/10]',
};

export function PiecePhoto({ piece, size = 'thumb', className = '' }: PiecePhotoProps) {
  const src = piecePhotoUrl(piece);

  if (!src) {
    return (
      <div
        className={`bg-cream-dark flex items-center justify-center shrink-0 ${sizeClasses[size]} ${className}`}
        aria-hidden
      >
        <span className="text-[10px] uppercase tracking-wider text-charcoal/30 text-center px-1">No photo</span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={piece.name}
      className={`object-cover bg-cream-dark shrink-0 ${sizeClasses[size]} ${className}`}
      loading="lazy"
    />
  );
}
