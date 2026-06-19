export const DEMO_PIECE_PHOTOS: Record<string, string> = {
  'Cal King Upholstered Bed': '/demo/pieces/cal-king-bed.jpg',
  'Nightstand (Pair)': '/demo/pieces/nightstand.jpg',
  'Dresser & Mirror': '/demo/pieces/dresser.jpg',
  'Sectional Sofa — Custom Linen': '/demo/pieces/sectional.jpg',
  'Marble Coffee Table': '/demo/pieces/coffee-table.jpg',
  'Floor Lamp — Brass Arc': '/demo/pieces/floor-lamp.jpg',
  'Dining Table — 10ft Walnut': '/demo/pieces/dining-table.jpg',
  'Dining Chairs (10)': '/demo/pieces/dining-chairs.jpg',
  'Chandelier — Hand-Blown Glass': '/demo/pieces/chandelier.jpg',
  'Executive Desk — Walnut': '/demo/pieces/desk.jpg',
  'Leather Desk Chair': '/demo/pieces/desk-chair.jpg',
  'Freestanding Soaking Tub': '/demo/pieces/soaking-tub.jpg',
  'Vanity Console — Double': '/demo/pieces/vanity.jpg',
  'Area Rug — 9x12 Hand-Knotted': '/demo/pieces/area-rug.jpg',
};

export function piecePhotoUrl(
  piece: {
    name: string;
    photoUrl?: string | null;
    stagePhotos?: { milestone: string; photoUrl: string }[];
  },
  milestone?: 'pickup' | 'delivery' | 'install',
): string | undefined {
  if (milestone && piece.stagePhotos) {
    const stagePhoto = piece.stagePhotos.find((p) => p.milestone === milestone);
    if (stagePhoto?.photoUrl) return stagePhoto.photoUrl;
  }
  return piece.photoUrl || DEMO_PIECE_PHOTOS[piece.name];
}
