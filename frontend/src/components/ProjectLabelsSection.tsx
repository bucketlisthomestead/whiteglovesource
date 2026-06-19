import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { Download, Loader2, Printer, ChevronDown, ChevronUp } from 'lucide-react';
import {
  downloadProjectLabelPdf,
  generateProjectLabelPdf,
  getProjectLabels,
  getProjectLabelPdfs,
} from '../api/client';
import type { ProjectLabelPdfVersion } from '../types';
import { buildScanUrl, formatJobNumber, formatLabelDate } from '../lib/scan';
import {
  DEFAULT_LABEL_TEMPLATE_ID,
  LABEL_SHEET_TEMPLATES,
  getLabelTemplate,
  type LabelSheetTemplate,
} from '../lib/label-sizes';
import { downloadLabelsPdf } from '../lib/label-pdf';
import { formatDate } from '../lib/labels';
import type { Piece, Project } from '../types';

interface LabelItem {
  pieceId: string;
  scanToken: string;
  pieceName: string;
  roomName: string | null;
}

interface ProjectLabelsSectionProps {
  project: Project;
  isDemo?: boolean;
  defaultExpanded?: boolean;
}

export function ProjectLabelsSection({
  project,
  isDemo = false,
  defaultExpanded = false,
}: ProjectLabelsSectionProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const [loading, setLoading] = useState(true);
  const [labels, setLabels] = useState<LabelItem[]>([]);
  const [jobNumber, setJobNumber] = useState('');
  const [printedAt, setPrintedAt] = useState(formatLabelDate());
  const [templateId, setTemplateId] = useState(DEFAULT_LABEL_TEMPLATE_ID);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [serverLoading, setServerLoading] = useState(false);
  const [versions, setVersions] = useState<ProjectLabelPdfVersion[]>([]);
  const [versionsLoading, setVersionsLoading] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(defaultExpanded);
  const qrCache = useRef<Map<string, string>>(new Map());
  const [, bumpQr] = useState(0);

  const template = getLabelTemplate(templateId);
  const projectId = project.id;

  useEffect(() => {
    if (defaultExpanded && sectionRef.current) {
      sectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [defaultExpanded]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      qrCache.current.clear();
      try {
        if (!isDemo) {
          try {
            const data = await getProjectLabels(projectId);
            setJobNumber(data.jobNumber);
            setPrintedAt(formatLabelDate(data.printedAt));
            setLabels(
              data.labels
                .filter((l) => l.scanToken)
                .map((l) => ({
                  pieceId: l.pieceId,
                  scanToken: l.scanToken!,
                  pieceName: l.pieceName,
                  roomName: l.roomName,
                })),
            );
            return;
          } catch {
            // fall through to project pieces
          }
        }

        setJobNumber(formatJobNumber(projectId));
        setPrintedAt(formatLabelDate());
        setLabels(
          (project.pieces as Piece[])
            .filter((p) => p.scanToken)
            .map((p) => ({
              pieceId: p.id,
              scanToken: p.scanToken!,
              pieceName: p.name,
              roomName: p.room?.name ?? null,
            })),
        );
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [projectId, isDemo, project.pieces]);

  useEffect(() => {
    if (isDemo) return;
    setVersionsLoading(true);
    getProjectLabelPdfs(projectId)
      .then(setVersions)
      .catch(() => setVersions([]))
      .finally(() => setVersionsLoading(false));
  }, [projectId, isDemo]);

  useEffect(() => {
    if (!previewOpen) return;
    labels.forEach(async (label) => {
      if (qrCache.current.has(label.scanToken)) return;
      const url = buildScanUrl(label.scanToken);
      const dataUrl = await QRCode.toDataURL(url, {
        margin: 1,
        width: 120,
        errorCorrectionLevel: 'M',
      });
      qrCache.current.set(label.scanToken, dataUrl);
      bumpQr((n) => n + 1);
    });
  }, [labels, previewOpen]);

  const handleDownloadPdf = async () => {
    setPdfLoading(true);
    try {
      await downloadLabelsPdf(labels, template, {
        jobNumber,
        printedAt,
        projectName: project.name,
      });
    } finally {
      setPdfLoading(false);
    }
  };

  const handleGenerateServer = async () => {
    setServerLoading(true);
    try {
      const created = await generateProjectLabelPdf(projectId, { templateId });
      setVersions((prev) => [created, ...prev]);
    } catch {
      window.alert('Unable to save label PDF to project.');
    } finally {
      setServerLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="mb-6 bg-white border border-cream-dark p-4 flex items-center gap-2 text-sm text-charcoal/50">
        <Loader2 size={16} className="animate-spin text-gold" />
        Loading labels…
      </div>
    );
  }

  if (!labels.length) {
    return (
      <section ref={sectionRef} className="mb-6 bg-white border border-cream-dark p-4 md:p-6">
        <div className="flex items-center gap-2 mb-2">
          <Printer size={16} className="text-gold" />
          <h3 className="text-sm font-medium uppercase tracking-wider text-charcoal/70">Inventory Labels</h3>
        </div>
        <p className="text-sm text-charcoal/50">
          No pieces with scan codes yet. Add inventory pieces to generate QR labels.
        </p>
      </section>
    );
  }

  const previewStyles = previewStylesFor(template);

  return (
    <section ref={sectionRef} className="mb-6 bg-white border border-cream-dark p-4 md:p-6">
      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4 mb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Printer size={16} className="text-gold" />
            <h3 className="text-sm font-medium uppercase tracking-wider text-charcoal/70">Inventory Labels</h3>
          </div>
          <p className="text-sm text-charcoal/50">
            {labels.length} label{labels.length === 1 ? '' : 's'} · {jobNumber}
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 shrink-0">
          <label className="flex flex-col gap-1 text-xs text-charcoal/60">
            Avery sheet
            <select
              value={templateId}
              onChange={(e) => setTemplateId(e.target.value)}
              className="border border-charcoal/20 bg-cream px-3 py-2.5 min-h-[44px] text-sm text-charcoal"
            >
              {LABEL_SHEET_TEMPLATES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} — {t.description}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={handleDownloadPdf}
            disabled={pdfLoading}
            className="inline-flex items-center justify-center gap-2 bg-charcoal text-cream px-4 py-2.5 min-h-[44px] text-xs uppercase tracking-wider disabled:opacity-50 sm:self-end"
          >
            {pdfLoading ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
            Download PDF
          </button>
          {!isDemo && (
            <button
              type="button"
              onClick={handleGenerateServer}
              disabled={serverLoading}
              className="inline-flex items-center justify-center gap-2 border border-charcoal/25 text-charcoal px-4 py-2.5 min-h-[44px] text-xs uppercase tracking-wider disabled:opacity-50 sm:self-end hover:border-gold/50"
            >
              {serverLoading ? <Loader2 size={16} className="animate-spin" /> : <Printer size={16} />}
              {versions.length ? 'Regenerate' : 'Save to project'}
            </button>
          )}
        </div>
      </div>

      <p className="text-xs text-charcoal/40 mb-4">
        {template.description}. Download a print-ready PDF with dashed borders around each label slot.
        Scan any QR code to open the piece check-in page.
      </p>

      {!isDemo && (
        <div className="mb-4 pt-4 border-t border-cream-dark">
          <p className="text-[10px] uppercase tracking-wider text-charcoal/40 mb-2">Saved versions</p>
          {versionsLoading ? (
            <p className="text-xs text-charcoal/50 flex items-center gap-2">
              <Loader2 size={12} className="animate-spin" /> Loading…
            </p>
          ) : versions.length === 0 ? (
            <p className="text-xs text-charcoal/50">No saved label PDFs yet.</p>
          ) : (
            <div className="border border-cream-dark divide-y divide-cream-dark">
              {versions.map((v) => (
                <div key={v.id} className="px-3 py-2.5 flex items-center justify-between gap-3 text-sm">
                  <div className="min-w-0">
                    <p className="font-medium text-charcoal truncate">
                      v{v.version} · {v.templateName}
                    </p>
                    <p className="text-xs text-charcoal/50">
                      {v.pieceCount} labels · {v.printedAt}
                      {v.createdByName ? ` · ${v.createdByName}` : ''}
                      {' · '}
                      {formatDate(v.createdAt)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => downloadProjectLabelPdf(projectId, v.id, v.filename)}
                    className="shrink-0 inline-flex items-center gap-1 text-xs text-gold uppercase tracking-wider min-h-[36px] px-2"
                  >
                    <Download size={14} /> PDF
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={() => setPreviewOpen((v) => !v)}
        className="flex items-center gap-2 text-xs text-gold uppercase tracking-wider min-h-[44px]"
      >
        {previewOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        {previewOpen ? 'Hide preview' : 'Show print preview'}
      </button>

      {previewOpen && (
        <div className="mt-4 overflow-x-auto pb-4">
          <div
            className="label-sheet mx-auto"
            style={{
              maxWidth: `${template.pageWidth}in`,
              paddingLeft: `${template.marginLeft}in`,
              paddingRight: `${template.marginLeft}in`,
              paddingTop: `${template.marginTop}in`,
            }}
          >
            {labels.map((label) => {
              const qr = qrCache.current.get(label.scanToken);
              return (
                <article key={label.pieceId} className="label-card" style={previewStyles.card}>
                  <div className="label-card-inner">
                    <div className="label-meta">
                      <p className="label-job" style={previewStyles.job}>{jobNumber}</p>
                      <p className="label-name" style={previewStyles.name}>{label.pieceName}</p>
                      {label.roomName && (
                        <p className="label-room" style={previewStyles.room}>{label.roomName}</p>
                      )}
                      <p className="label-date" style={previewStyles.date}>{printedAt}</p>
                    </div>
                    <div className="label-qr">
                      {qr ? (
                        <img src={qr} alt={`Scan code for ${label.pieceName}`} style={previewStyles.qr} />
                      ) : (
                        <div className="label-qr-placeholder" style={previewStyles.qr} />
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
          <style>{`
            .label-sheet {
              display: grid;
              grid-template-columns: repeat(${template.columns}, ${template.labelWidth}in);
              column-gap: ${template.horizontalGap}in;
              row-gap: ${template.verticalGap}in;
            }
            .label-card {
              box-sizing: border-box;
              page-break-inside: avoid;
              border: 1px dashed #d4cfc4;
            }
            .label-card-inner {
              display: flex;
              align-items: center;
              justify-content: space-between;
              height: 100%;
              gap: 0.08in;
              padding: 0.08in;
            }
            .label-meta {
              flex: 1;
              min-width: 0;
              font-family: system-ui, sans-serif;
            }
            .label-job {
              font-weight: 700;
              letter-spacing: 0.04em;
              margin: 0 0 2px;
            }
            .label-name {
              font-weight: 600;
              line-height: 1.2;
              margin: 0 0 2px;
              overflow: hidden;
              display: -webkit-box;
              -webkit-line-clamp: 2;
              -webkit-box-orient: vertical;
            }
            .label-room {
              color: #666;
              margin: 0 0 2px;
            }
            .label-date {
              color: #888;
              margin: 0;
            }
            .label-qr img {
              display: block;
            }
            .label-qr-placeholder {
              background: #f0ebe3;
            }
          `}</style>
        </div>
      )}
    </section>
  );
}

function previewStylesFor(template: LabelSheetTemplate) {
  const h = template.labelHeight;
  const qrPx = h <= 1 ? 48 : h <= 1.5 ? 56 : h <= 2.25 ? 72 : 96;
  return {
    card: {
      width: `${template.labelWidth}in`,
      height: `${template.labelHeight}in`,
    },
    qr: {
      width: qrPx,
      height: qrPx,
    },
    job: { fontSize: h <= 1 ? '7pt' : h <= 2 ? '8pt' : '9pt' },
    name: { fontSize: h <= 1 ? '8pt' : h <= 2 ? '9pt' : '10pt' },
    room: { fontSize: h <= 1 ? '7pt' : '8pt' },
    date: { fontSize: '7pt' },
  };
}
