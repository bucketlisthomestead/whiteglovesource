import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import QRCode from 'qrcode';
import { Loader2, Printer, ArrowLeft, Download } from 'lucide-react';
import { getProject, getProjectLabels } from '../api/client';
import { getDemoProject } from '../api/client';
import { loadDemoProject } from '../offline/demoSession';
import { useAuth } from '../context/AuthContext';
import { PERMISSIONS, hasAnyPermission } from '../lib/permissions';
import { buildScanUrl, formatJobNumber, formatLabelDate } from '../lib/scan';
import {
  DEFAULT_LABEL_TEMPLATE,
  LABEL_SHEET_TEMPLATES,
  type LabelSheetTemplate,
} from '../lib/label-sizes';
import { downloadLabelsPdf } from '../lib/label-pdf';
import type { Piece } from '../types';

interface LabelItem {
  pieceId: string;
  scanToken: string;
  pieceName: string;
  roomName: string | null;
}

export function LabelPrintPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [jobNumber, setJobNumber] = useState('');
  const [labels, setLabels] = useState<LabelItem[]>([]);
  const [printedAt, setPrintedAt] = useState(formatLabelDate());
  const [isDemo, setIsDemo] = useState(false);
  const [templateId, setTemplateId] = useState(DEFAULT_LABEL_TEMPLATE.id);
  const [pdfLoading, setPdfLoading] = useState(false);
  const qrCache = useRef<Map<string, string>>(new Map());

  const template =
    LABEL_SHEET_TEMPLATES.find((t) => t.id === templateId) ?? DEFAULT_LABEL_TEMPLATE;

  const canPrint = hasAnyPermission(
    user?.permissions,
    [PERMISSIONS.PROJECTS_MANAGE, PERMISSIONS.FIELD_USE],
    user?.role,
  );

  useEffect(() => {
    if (!id) return;
    const load = async () => {
      setLoading(true);
      setError(false);
      try {
        const isDemoRoute = id === 'demo';
        if (user && !isDemoRoute && canPrint) {
          try {
            const data = await getProjectLabels(id);
            setProjectName(data.projectName);
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
            // fall through to project load
          }
        }

        let project;
        if (isDemoRoute) {
          const result = await loadDemoProject(getDemoProject);
          project = result.project;
        } else {
          project = await getProject(id);
        }

        setIsDemo(!!project.isDemo);
        setProjectName(project.name);
        setJobNumber(formatJobNumber(project.id));
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
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id, user, canPrint]);

  useEffect(() => {
    labels.forEach(async (label) => {
      if (qrCache.current.has(label.scanToken)) return;
      const url = buildScanUrl(label.scanToken);
      const dataUrl = await QRCode.toDataURL(url, {
        margin: 1,
        width: 120,
        errorCorrectionLevel: 'M',
      });
      qrCache.current.set(label.scanToken, dataUrl);
      setLabels((prev) => [...prev]);
    });
  }, [labels.length]);

  const handlePrint = () => window.print();

  const handleDownloadPdf = async () => {
    setPdfLoading(true);
    try {
      await downloadLabelsPdf(labels, template, {
        jobNumber,
        printedAt,
        projectName,
      });
    } finally {
      setPdfLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="animate-spin text-gold" size={32} />
      </div>
    );
  }

  if (error || !labels.length) {
    return (
      <div className="max-w-lg mx-auto px-4 py-10 text-center">
        <p className="text-charcoal/60 mb-4">
          {error ? 'Unable to load labels.' : 'No pieces with scan codes found for this project.'}
        </p>
        <Link to={isDemo ? '/demo' : `/project/${id}`} className="text-gold text-sm">
          ← Back to project
        </Link>
      </div>
    );
  }

  const backHref = isDemo ? '/demo' : `/project/${id}`;
  const previewStyles = previewStylesFor(template);

  return (
    <div className="label-print-root">
      <div className="no-print max-w-4xl mx-auto px-4 py-6">
        <Link to={backHref} className="inline-flex items-center gap-1 text-sm text-gold mb-4 min-h-[44px]">
          <ArrowLeft size={16} /> Back to project
        </Link>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="font-serif text-2xl">Inventory Labels</h1>
            <p className="text-sm text-charcoal/50 mt-1">
              {projectName} · {labels.length} label{labels.length === 1 ? '' : 's'} · {jobNumber}
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <label className="flex flex-col gap-1 text-xs text-charcoal/60">
              Label sheet
              <select
                value={templateId}
                onChange={(e) => setTemplateId(e.target.value)}
                className="border border-charcoal/20 bg-cream px-3 py-2.5 min-h-[48px] text-sm text-charcoal"
              >
                {LABEL_SHEET_TEMPLATES.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} — {t.description}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex gap-2 sm:items-end">
              <button
                type="button"
                onClick={handleDownloadPdf}
                disabled={pdfLoading}
                className="inline-flex items-center justify-center gap-2 border border-charcoal/30 text-charcoal px-4 py-3 min-h-[48px] text-sm uppercase tracking-wider disabled:opacity-50"
              >
                {pdfLoading ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />}
                Download PDF
              </button>
              <button
                type="button"
                onClick={handlePrint}
                className="inline-flex items-center justify-center gap-2 bg-charcoal text-cream px-5 py-3 min-h-[48px] text-sm uppercase tracking-wider"
              >
                <Printer size={18} /> Print
              </button>
            </div>
          </div>
        </div>
        <p className="text-xs text-charcoal/40 mb-4">
          {template.description}. Choose your Avery sheet, download a print-ready PDF, or use Print for browser output.
          Scan any QR code to open the piece check-in page.
        </p>
      </div>

      <div
        className="label-sheet mx-auto pb-8"
        style={{
          maxWidth: `${template.pageWidth}in`,
          paddingLeft: `${template.margins.left}in`,
          paddingRight: `${template.margins.left}in`,
          paddingTop: `${template.margins.top}in`,
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
          column-gap: ${template.hGap}in;
          row-gap: ${template.vGap}in;
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
        @media print {
          .no-print { display: none !important; }
          .label-print-root { background: white; }
          .label-card { border-color: #ccc; }
          @page { size: letter; margin: 0; }
        }
      `}</style>
    </div>
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
