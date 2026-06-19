/** Avery and custom letter label sheet templates (dimensions in inches). */

export interface LabelSheetTemplate {
  id: string;
  name: string;
  description: string;
  pageWidth: number;
  pageHeight: number;
  marginTop: number;
  marginLeft: number;
  labelWidth: number;
  labelHeight: number;
  columns: number;
  rows: number;
  horizontalGap: number;
  verticalGap: number;
}

export const LABEL_SHEET_TEMPLATES: LabelSheetTemplate[] = [
  {
    id: 'avery-5160',
    name: 'Avery 5160',
    description: '1" × 2⅝" address labels — 30 per sheet (3×10)',
    pageWidth: 8.5,
    pageHeight: 11,
    marginTop: 0.5,
    marginLeft: 0.1875,
    labelWidth: 2.625,
    labelHeight: 1,
    columns: 3,
    rows: 10,
    horizontalGap: 0.125,
    verticalGap: 0,
  },
  {
    id: 'avery-5161',
    name: 'Avery 5161',
    description: '1" × 4" address labels — 20 per sheet (2×10)',
    pageWidth: 8.5,
    pageHeight: 11,
    marginTop: 0.5,
    marginLeft: 0.15625,
    labelWidth: 4,
    labelHeight: 1,
    columns: 2,
    rows: 10,
    horizontalGap: 0.125,
    verticalGap: 0,
  },
  {
    id: 'avery-5162',
    name: 'Avery 5162',
    description: '1⅓" × 4" shipping labels — 14 per sheet (2×7)',
    pageWidth: 8.5,
    pageHeight: 11,
    marginTop: 0.83,
    marginLeft: 0.25,
    labelWidth: 4,
    labelHeight: 1.333,
    columns: 2,
    rows: 7,
    horizontalGap: 0.125,
    verticalGap: 0,
  },
  {
    id: 'avery-5163',
    name: 'Avery 5163',
    description: '2" × 4" shipping labels — 10 per sheet (2×5)',
    pageWidth: 8.5,
    pageHeight: 11,
    marginTop: 0.5,
    marginLeft: 0.25,
    labelWidth: 4,
    labelHeight: 2,
    columns: 2,
    rows: 5,
    horizontalGap: 0.125,
    verticalGap: 0,
  },
  {
    id: 'avery-5164',
    name: 'Avery 5164',
    description: '3⅓" × 4" shipping labels — 6 per sheet (2×3)',
    pageWidth: 8.5,
    pageHeight: 11,
    marginTop: 0.5,
    marginLeft: 0.25,
    labelWidth: 4,
    labelHeight: 3.333,
    columns: 2,
    rows: 3,
    horizontalGap: 0.125,
    verticalGap: 0,
  },
  {
    id: 'letter-2x4',
    name: 'Letter 2×4 grid',
    description: 'Custom 2" × 4¼" grid — 8 per sheet (2×4), matches browser print preview',
    pageWidth: 8.5,
    pageHeight: 11,
    marginTop: 0.25,
    marginLeft: 0.25,
    labelWidth: 4.25,
    labelHeight: 2,
    columns: 2,
    rows: 4,
    horizontalGap: 0,
    verticalGap: 0,
  },
];

export const DEFAULT_LABEL_TEMPLATE_ID = 'avery-5163';

export function getLabelTemplate(id: string): LabelSheetTemplate {
  return LABEL_SHEET_TEMPLATES.find((t) => t.id === id) ?? LABEL_SHEET_TEMPLATES[3];
}

export function labelsPerPage(template: LabelSheetTemplate): number {
  return template.columns * template.rows;
}

/** Top-left corner of a label slot on a sheet (0-based index within page). */
export function labelSlotPosition(
  template: LabelSheetTemplate,
  slotIndex: number,
): { x: number; y: number } {
  const col = slotIndex % template.columns;
  const row = Math.floor(slotIndex / template.columns);
  return {
    x: template.marginLeft + col * (template.labelWidth + template.horizontalGap),
    y: template.marginTop + row * (template.labelHeight + template.verticalGap),
  };
}
