/** Maps demo piece names to static photos in frontend/public/demo/pieces */
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

export function getDemoPhotoUrl(pieceName: string): string | undefined {
  return DEMO_PIECE_PHOTOS[pieceName];
}

const SLUG_BY_NAME: Record<string, string> = {
  'Cal King Upholstered Bed': 'cal-king-bed',
  'Nightstand (Pair)': 'nightstand',
  'Dresser & Mirror': 'dresser',
  'Sectional Sofa — Custom Linen': 'sectional',
  'Marble Coffee Table': 'coffee-table',
  'Floor Lamp — Brass Arc': 'floor-lamp',
  'Dining Table — 10ft Walnut': 'dining-table',
  'Dining Chairs (10)': 'dining-chairs',
  'Chandelier — Hand-Blown Glass': 'chandelier',
  'Executive Desk — Walnut': 'desk',
  'Leather Desk Chair': 'desk-chair',
  'Freestanding Soaking Tub': 'soaking-tub',
  'Vanity Console — Double': 'vanity',
  'Area Rug — 9x12 Hand-Knotted': 'area-rug',
};

export function getMilestonePhotoUrl(
  pieceName: string,
  milestone: 'pickup' | 'delivery' | 'install',
): string | undefined {
  const slug = SLUG_BY_NAME[pieceName];
  if (!slug) return getDemoPhotoUrl(pieceName);
  return `/demo/pieces/${slug}-${milestone}.jpg`;
}
