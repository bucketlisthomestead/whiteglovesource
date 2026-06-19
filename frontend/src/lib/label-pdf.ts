import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';
import { buildScanUrl } from './scan';
import {
  type LabelSheetTemplate,
  labelSlotPosition,
  labelsPerPage,
} from './label-sizes';

export interface LabelPdfItem {
  scanToken: string;
  pieceName: string;
  roomName: string | null;
}

export interface LabelPdfMeta {
  jobNumber: string;
  printedAt: string;
  projectName: string;
}

const PADDING = 0.08;

function qrSizeInches(template: LabelSheetTemplate): number {
  const minDim = Math.min(template.labelWidth, template.labelHeight);
  return Math.min(0.85, minDim * 0.42);
}

function truncateText(doc: jsPDF, text: string, maxWidth: number): string {
  if (doc.getTextWidth(text) <= maxWidth) return text;
  let trimmed = text;
  while (trimmed.length > 1 && doc.getTextWidth(`${trimmed}…`) > maxWidth) {
    trimmed = trimmed.slice(0, -1);
  }
  return `${trimmed}…`;
}

function drawLabelBorder(
  doc: jsPDF,
  template: LabelSheetTemplate,
  x: number,
  y: number,
) {
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.01);
  doc.setLineDashPattern([0.04, 0.04], 0);
  doc.rect(x, y, template.labelWidth, template.labelHeight, 'S');
  doc.setLineDashPattern([], 0);
}

function drawLabel(
  doc: jsPDF,
  template: LabelSheetTemplate,
  x: number,
  y: number,
  meta: LabelPdfMeta,
  item: LabelPdfItem,
  qrDataUrl: string,
) {
  drawLabelBorder(doc, template, x, y);

  const qrSize = qrSizeInches(template);
  const textRight = x + template.labelWidth - PADDING - qrSize - 0.06;
  const textWidth = Math.max(0.5, textRight - (x + PADDING));
  const textX = x + PADDING;
  let textY = y + PADDING + 0.12;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(template.labelHeight <= 1.05 ? 7 : 8);
  doc.text(meta.jobNumber, textX, textY, { maxWidth: textWidth });

  textY += template.labelHeight <= 1.05 ? 0.11 : 0.14;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(template.labelHeight <= 1.05 ? 7.5 : 9);
  const name = truncateText(doc, item.pieceName, textWidth);
  doc.text(name, textX, textY, { maxWidth: textWidth });

  if (item.roomName && template.labelHeight >= 1.2) {
    textY += template.labelHeight <= 1.05 ? 0.1 : 0.12;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(template.labelHeight <= 1.05 ? 6.5 : 7.5);
    doc.setTextColor(80, 80, 80);
    doc.text(truncateText(doc, item.roomName, textWidth), textX, textY, { maxWidth: textWidth });
    doc.setTextColor(0, 0, 0);
  }

  if (template.labelHeight >= 1.5) {
    textY += 0.12;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(120, 120, 120);
    doc.text(meta.printedAt, textX, textY, { maxWidth: textWidth });
    doc.setTextColor(0, 0, 0);
  }

  const qrX = x + template.labelWidth - PADDING - qrSize;
  const qrY = y + (template.labelHeight - qrSize) / 2;
  doc.addImage(qrDataUrl, 'PNG', qrX, qrY, qrSize, qrSize);

  doc.setDrawColor(212, 207, 196);
  doc.setLineWidth(0.01);
  doc.setLineDashPattern([2, 2], 0);
  doc.rect(x, y, template.labelWidth, template.labelHeight, 'S');
  doc.setLineDashPattern([], 0);
}

async function qrDataUrlForToken(scanToken: string, px: number): Promise<string> {
  return QRCode.toDataURL(buildScanUrl(scanToken), {
    margin: 1,
    width: px,
    errorCorrectionLevel: 'M',
  });
}

export async function generateLabelsPdf(
  items: LabelPdfItem[],
  template: LabelSheetTemplate,
  meta: LabelPdfMeta,
): Promise<Blob> {
  const perPage = labelsPerPage(template);
  const pageCount = Math.max(1, Math.ceil(items.length / perPage));
  const doc = new jsPDF({
    unit: 'in',
    format: [template.pageWidth, template.pageHeight],
    compress: true,
  });

  const qrPx = Math.round(qrSizeInches(template) * 120);
  const qrCache = new Map<string, string>();
  for (const item of items) {
    if (!qrCache.has(item.scanToken)) {
      qrCache.set(item.scanToken, await qrDataUrlForToken(item.scanToken, qrPx));
    }
  }

  for (let page = 0; page < pageCount; page++) {
    if (page > 0) doc.addPage([template.pageWidth, template.pageHeight], 'portrait');

    const start = page * perPage;
    const end = Math.min(start + perPage, items.length);

    for (let i = start; i < end; i++) {
      const slot = i - start;
      const { x, y } = labelSlotPosition(template, slot);
      const item = items[i];
      drawLabel(doc, template, x, y, meta, item, qrCache.get(item.scanToken)!);
    }
  }

  return doc.output('blob');
}

export function labelPdfFilename(projectName: string, templateId: string): string {
  const safe = projectName.replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-').slice(0, 40);
  return `${safe || 'inventory'}-labels-${templateId}.pdf`;
}

export async function downloadLabelsPdf(
  items: LabelPdfItem[],
  template: LabelSheetTemplate,
  meta: LabelPdfMeta,
): Promise<void> {
  const blob = await generateLabelsPdf(items, template, meta);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = labelPdfFilename(meta.projectName, template.id);
  link.click();
  URL.revokeObjectURL(url);
}
