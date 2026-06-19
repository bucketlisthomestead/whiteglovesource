import { useEffect, useState } from 'react';
import { Download, Loader2, QrCode, RefreshCw } from 'lucide-react';
import {
  downloadProjectLabelPdf,
  generateProjectLabelPdf,
  getProjectLabelPdfs,
} from '../api/client';
import type { ProjectLabelPdfVersion } from '../types';
import {
  DEFAULT_LABEL_TEMPLATE_ID,
  LABEL_SHEET_TEMPLATES,
} from '../lib/label-sizes';
import { formatDate } from '../lib/labels';

interface ProjectLabelPdfsPanelProps {
  projectId: string;
}

export function ProjectLabelPdfsPanel({ projectId }: ProjectLabelPdfsPanelProps) {
  const [versions, setVersions] = useState<ProjectLabelPdfVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [templateId, setTemplateId] = useState(DEFAULT_LABEL_TEMPLATE_ID);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    setLoading(true);
    getProjectLabelPdfs(projectId)
      .then(setVersions)
      .catch(() => setVersions([]))
      .finally(() => setLoading(false));
  }, [projectId]);

  const latest = versions[0] ?? null;

  const handleGenerate = async () => {
    setGenerating(true);
    setError(null);
    try {
      const created = await generateProjectLabelPdf(projectId, { templateId });
      setVersions((prev) => [created, ...prev.filter((v) => v.id !== created.id)]);
    } catch {
      setError('Unable to generate label PDF. Ensure the project has scannable pieces.');
    } finally {
      setGenerating(false);
    }
  };

  const handleDownload = async (version: ProjectLabelPdfVersion) => {
    setDownloadingId(version.id);
    try {
      await downloadProjectLabelPdf(projectId, version.id, version.filename);
    } catch {
      setError('Unable to download label PDF.');
    } finally {
      setDownloadingId(null);
    }
  };

  if (loading) {
    return (
      <div className="mt-4 pt-4 border-t border-cream-dark flex items-center gap-2 text-xs text-charcoal/50">
        <Loader2 size={14} className="animate-spin" /> Loading label PDFs…
      </div>
    );
  }

  return (
    <div className="mt-4 pt-4 border-t border-cream-dark">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div className="min-w-0">
          <span className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-charcoal/50">
            <QrCode size={14} className="text-gold" />
            Label PDFs
          </span>
          {latest ? (
            <div className="mt-2 p-3 bg-cream/50 border border-cream-dark">
              <p className="text-sm font-medium text-charcoal">
                Latest — v{latest.version} · {latest.templateName}
              </p>
              <p className="text-[10px] text-charcoal/40 mt-0.5">
                {latest.pieceCount} label{latest.pieceCount === 1 ? '' : 's'} ·{' '}
                {formatDate(latest.createdAt.slice(0, 10))}
                {latest.createdByName ? ` · ${latest.createdByName}` : ''}
              </p>
              <button
                type="button"
                onClick={() => handleDownload(latest)}
                disabled={downloadingId === latest.id}
                className="mt-2 inline-flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-gold min-h-[44px] disabled:opacity-50"
              >
                {downloadingId === latest.id ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <Download size={12} />
                )}
                Download latest
              </button>
            </div>
          ) : (
            <p className="text-xs text-charcoal/50 mt-2">
              No server-generated label PDFs yet.
            </p>
          )}
        </div>

        <div className="flex flex-col gap-2 sm:items-end shrink-0">
          <label className="flex flex-col gap-1 text-xs text-charcoal/60 w-full sm:w-56">
            Avery template
            <select
              value={templateId}
              onChange={(e) => setTemplateId(e.target.value)}
              className="border border-charcoal/20 bg-cream px-3 py-2.5 min-h-[44px] text-sm text-charcoal"
            >
              {LABEL_SHEET_TEMPLATES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={handleGenerate}
            disabled={generating}
            className="inline-flex items-center justify-center gap-2 bg-charcoal text-cream px-4 py-2.5 min-h-[44px] text-[10px] uppercase tracking-wider disabled:opacity-50 w-full sm:w-auto"
          >
            {generating ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <RefreshCw size={14} />
            )}
            {latest ? 'Regenerate PDF' : 'Generate PDF'}
          </button>
        </div>
      </div>

      {error && <p className="mt-3 text-xs text-red-700">{error}</p>}

      {versions.length > 0 && (
        <>
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="mt-4 flex items-center justify-between w-full text-left min-h-[44px]"
          >
            <span className="text-[10px] uppercase tracking-wider text-charcoal/50">
              Version history ({versions.length})
            </span>
            <span className="text-xs text-gold">{expanded ? 'Hide' : 'View all'}</span>
          </button>

          {expanded && (
            <div className="mt-2 border border-cream-dark divide-y divide-cream-dark bg-cream/30">
              {versions.map((version) => (
                <div
                  key={version.id}
                  className="px-4 py-3 flex items-start justify-between gap-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-charcoal">
                      v{version.version} · {version.templateName}
                    </p>
                    <p className="text-[10px] text-charcoal/40 mt-0.5">
                      {version.pieceCount} labels · {version.printedAt} ·{' '}
                      {formatDate(version.createdAt.slice(0, 10))}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDownload(version)}
                    disabled={downloadingId === version.id}
                    className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-gold min-h-[44px] px-2 disabled:opacity-50 shrink-0"
                  >
                    {downloadingId === version.id ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : (
                      <Download size={12} />
                    )}
                    Download
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
