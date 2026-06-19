import { useEffect, useState } from 'react';
import { ExternalLink, FileText, Loader2, Download } from 'lucide-react';
import { getProjectDocuments, openProjectDocument, downloadProjectDocument } from '../api/client';
import type { ProjectDocument } from '../types';
import { formatDate } from '../lib/labels';

interface ProjectDocumentsPanelProps {
  projectId: string;
  refreshKey?: number;
}

export function ProjectDocumentsPanel({ projectId, refreshKey = 0 }: ProjectDocumentsPanelProps) {
  const [documents, setDocuments] = useState<ProjectDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    setLoading(true);
    getProjectDocuments(projectId)
      .then(setDocuments)
      .catch(() => setDocuments([]))
      .finally(() => setLoading(false));
  }, [projectId, refreshKey]);

  const handleView = async (doc: ProjectDocument) => {
    setOpeningId(doc.id);
    try {
      await openProjectDocument(doc.id);
    } catch {
      alert('Unable to open document.');
    } finally {
      setOpeningId(null);
    }
  };

  const handleDownload = async (doc: ProjectDocument) => {
    setOpeningId(doc.id);
    try {
      await downloadProjectDocument(doc.id, doc.filename);
    } catch {
      alert('Unable to download document.');
    } finally {
      setOpeningId(null);
    }
  };

  if (loading) {
    return (
      <div className="mt-4 pt-4 border-t border-cream-dark flex items-center gap-2 text-xs text-charcoal/50">
        <Loader2 size={14} className="animate-spin" /> Loading saved PDFs…
      </div>
    );
  }

  return (
    <div className="mt-4 pt-4 border-t border-cream-dark">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center justify-between w-full text-left min-h-[44px]"
      >
        <span className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-charcoal/50">
          <FileText size={14} className="text-gold" />
          Saved PDFs ({documents.length})
        </span>
        <span className="text-xs text-gold">{expanded ? 'Hide' : 'View all'}</span>
      </button>

      {expanded && (
        <div className="mt-3 border border-cream-dark divide-y divide-cream-dark bg-cream/30">
          {documents.length === 0 && (
            <p className="px-4 py-6 text-sm text-charcoal/50 text-center">
              No PDFs saved yet. Use Export PDF → Save to Project to attach reports here.
            </p>
          )}
          {documents.map((doc) => (
            <div key={doc.id} className="px-4 py-3 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-charcoal">{doc.title}</p>
                <p className="text-[10px] text-charcoal/40 mt-0.5">
                  {formatDate(doc.createdAt.slice(0, 10))}
                  {doc.generatedByName ? ` · ${doc.generatedByName}` : ''}
                </p>
                {doc.note && (
                  <p className="text-xs text-charcoal/60 mt-1 line-clamp-2">Note: {doc.note}</p>
                )}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => handleView(doc)}
                  disabled={openingId === doc.id}
                  className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-gold min-h-[44px] px-2 disabled:opacity-50"
                >
                  {openingId === doc.id ? <Loader2 size={12} className="animate-spin" /> : <ExternalLink size={12} />}
                  View
                </button>
                <button
                  type="button"
                  onClick={() => handleDownload(doc)}
                  disabled={openingId === doc.id}
                  className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-charcoal/50 hover:text-gold min-h-[44px] px-2 disabled:opacity-50"
                >
                  <Download size={12} /> Save
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
