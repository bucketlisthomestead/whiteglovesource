import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import {
  type LabelSheetTemplate,
  labelSlotPosition,
  labelsPerPage,
} from '../common/label-sizes';

export interface LabelPdfItem {
  scanToken: string;
  pieceName: string;
  roomName: string | null;
}

export interface LabelPdfMeta {
  /** Primary header line on each label (project display name). */
  labelTitle: string;
  printedAt: string;
  /** Used for PDF filename. */
  projectName: string;
}

const PADDING = 0.08;
const PT = 72;

function inchesToPt(inches: number): number {
  return inches * PT;
}

function qrSizeInches(template: LabelSheetTemplate): number {
  const minDim = Math.min(template.labelWidth, template.labelHeight);
  return Math.min(0.85, minDim * 0.42);
}

function truncateText(
  doc: PDFKit.PDFDocument,
  text: string,
  maxWidthPt: number,
): string {
  if (doc.widthOfString(text) <= maxWidthPt) return text;
  let trimmed = text;
  while (trimmed.length > 1 && doc.widthOfString(`${trimmed}…`) > maxWidthPt) {
    trimmed = trimmed.slice(0, -1);
  }
  return `${trimmed}…`;
}

function buildScanUrl(scanToken: string, publicOrigin: string): string {
  const origin = publicOrigin.replace(/\/$/, '');
  return `${origin}/scan/${scanToken}`;
}

export function labelPdfFilename(
  projectName: string,
  templateId: string,
  version?: number,
): string {
  const safe = projectName
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 40);
  const base = `${safe || 'inventory'}-labels-${templateId}`;
  return version != null ? `${base}-v${version}.pdf` : `${base}.pdf`;
}

export function formatLabelDate(iso?: string | Date): string {
  const d = iso ? new Date(iso) : new Date();
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

@Injectable()
export class LabelPdfGenerator {
  constructor(private readonly config: ConfigService) {}

  private get publicOrigin(): string {
    return this.config.get<string>('CORS_ORIGIN', 'http://localhost:5173');
  }

  async generate(
    items: LabelPdfItem[],
    template: LabelSheetTemplate,
    meta: LabelPdfMeta,
  ): Promise<Buffer> {
    const perPage = labelsPerPage(template);
    const pageCount = Math.max(1, Math.ceil(items.length / perPage));
    const qrPx = Math.round(qrSizeInches(template) * 120);

    const qrCache = new Map<string, Buffer>();
    for (const item of items) {
      if (!qrCache.has(item.scanToken)) {
        const url = buildScanUrl(item.scanToken, this.publicOrigin);
        const dataUrl = await QRCode.toDataURL(url, {
          margin: 1,
          width: qrPx,
          errorCorrectionLevel: 'M',
        });
        const base64 = dataUrl.replace(/^data:image\/png;base64,/, '');
        qrCache.set(item.scanToken, Buffer.from(base64, 'base64'));
      }
    }

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({
        size: [
          inchesToPt(template.pageWidth),
          inchesToPt(template.pageHeight),
        ],
        margin: 0,
        autoFirstPage: false,
      });
      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      for (let page = 0; page < pageCount; page++) {
        doc.addPage({
          size: [
            inchesToPt(template.pageWidth),
            inchesToPt(template.pageHeight),
          ],
          margin: 0,
        });

        const start = page * perPage;
        const end = Math.min(start + perPage, items.length);

        for (let i = start; i < end; i++) {
          const slot = i - start;
          const { x, y } = labelSlotPosition(template, slot);
          this.drawLabel(
            doc,
            template,
            x,
            y,
            meta,
            items[i],
            qrCache.get(items[i].scanToken)!,
          );
        }
      }

      doc.end();
    });
  }

  private drawLabelBorder(
    doc: PDFKit.PDFDocument,
    x: number,
    y: number,
    labelW: number,
    labelH: number,
  ) {
    doc.save();
    doc.lineWidth(0.5);
    doc.strokeColor('#d4cfc4');
    doc.dash(2, { space: 2 });
    doc.rect(x, y, labelW, labelH).stroke();
    doc.undash();
    doc.restore();
  }

  private drawLabel(
    doc: PDFKit.PDFDocument,
    template: LabelSheetTemplate,
    xIn: number,
    yIn: number,
    meta: LabelPdfMeta,
    item: LabelPdfItem,
    qrBuffer: Buffer,
  ) {
    const x = inchesToPt(xIn);
    const y = inchesToPt(yIn);
    const labelW = inchesToPt(template.labelWidth);
    const labelH = inchesToPt(template.labelHeight);

    this.drawLabelBorder(doc, x, y, labelW, labelH);

    const pad = inchesToPt(PADDING);
    const qrSize = inchesToPt(qrSizeInches(template));
    const textRight = x + labelW - pad - qrSize - inchesToPt(0.06);
    const textWidth = Math.max(inchesToPt(0.5), textRight - (x + pad));
    const textX = x + pad;
    let textY = y + pad + inchesToPt(0.12);

    const compact = template.labelHeight <= 1.05;

    doc.font('Helvetica-Bold');
    doc.fontSize(compact ? 7 : 8);
    doc.fillColor('#000000');
    doc.text(truncateText(doc, meta.labelTitle, textWidth), textX, textY, {
      width: textWidth,
      lineBreak: false,
    });

    textY += inchesToPt(compact ? 0.11 : 0.14);
    doc.font('Helvetica-Bold');
    doc.fontSize(compact ? 7.5 : 9);
    doc.text(truncateText(doc, item.pieceName, textWidth), textX, textY, {
      width: textWidth,
      lineBreak: false,
    });

    if (item.roomName && template.labelHeight >= 1.2) {
      textY += inchesToPt(compact ? 0.1 : 0.12);
      doc.font('Helvetica');
      doc.fontSize(compact ? 6.5 : 7.5);
      doc.fillColor('#505050');
      doc.text(truncateText(doc, item.roomName, textWidth), textX, textY, {
        width: textWidth,
        lineBreak: false,
      });
      doc.fillColor('#000000');
    }

    if (template.labelHeight >= 1.5) {
      textY += inchesToPt(0.12);
      doc.font('Helvetica');
      doc.fontSize(6.5);
      doc.fillColor('#787878');
      doc.text(meta.printedAt, textX, textY, { width: textWidth, lineBreak: false });
      doc.fillColor('#000000');
    }

    const qrX = x + labelW - pad - qrSize;
    const qrY = y + (labelH - qrSize) / 2;
    doc.image(qrBuffer, qrX, qrY, { width: qrSize, height: qrSize });
  }
}
