import { useState } from 'react';
import { FileText, X } from 'lucide-react';
import { Button, FormField, textareaClass } from './Layout';
import type { PdfExportType } from './PdfExportMenu';
import type { ProjectPhase } from '../types';
import { PHASE_LABELS } from '../lib/labels';

const TYPE_LABELS: Record<PdfExportType, string> = {
  inventory: 'Inventory Manifest',
  'status-full': 'Full Status Report',
  'status-planning': `${PHASE_LABELS.planning} Signoff`,
  'status-pickup_storage': `${PHASE_LABELS.pickup_storage} Signoff`,
  'status-installation': `${PHASE_LABELS.installation} Signoff`,
};

function exportTypeToDocument(type: PdfExportType): {
  documentType: 'inventory' | 'status_full' | 'status_phase';
  phase?: ProjectPhase;
} {
  if (type === 'inventory') return { documentType: 'inventory' };
  if (type === 'status-full') return { documentType: 'status_full' };
  const phase = type.replace('status-', '') as ProjectPhase;
  return { documentType: 'status_phase', phase };
}

interface PdfExportDialogProps {
  exportType: PdfExportType;
  loading: boolean;
  onClose: () => void;
  onDownload: (note?: string) => Promise<void>;
  onSave: (note?: string) => Promise<void>;
}

export function PdfExportDialog({ exportType, loading, onClose, onDownload, onSave }: PdfExportDialogProps) {
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  const run = async (action: 'download' | 'save') => {
    setError('');
    try {
      if (action === 'download') await onDownload(note.trim() || undefined);
      else await onSave(note.trim() || undefined);
      onClose();
    } catch {
      setError(action === 'save' ? 'Unable to save PDF to project.' : 'PDF download failed.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4">
      <div className="absolute inset-0 bg-charcoal/50" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-cream p-6 md:rounded max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-serif text-xl flex items-center gap-2">
            <FileText size={18} className="text-gold" /> {TYPE_LABELS[exportType]}
          </h3>
          <button type="button" onClick={onClose} className="p-2 text-charcoal/40 min-h-[44px] min-w-[44px]">
            <X size={18} />
          </button>
        </div>

        <p className="text-xs text-charcoal/50 mb-4">
          Add an optional note to include at the top of the PDF. Save copies to the project for later viewing.
        </p>

        <FormField label="Optional report note">
          <textarea
            className={textareaClass}
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. Final inventory for client records, insurance claim #12345…"
            maxLength={2000}
          />
        </FormField>

        {error && <p className="text-sm text-red-600 mt-3">{error}</p>}

        <div className="flex flex-col sm:flex-row gap-3 mt-6">
          <Button variant="outline" onClick={() => run('download')} loading={loading} className="flex-1 min-h-[48px]">
            Download Only
          </Button>
          <Button onClick={() => run('save')} loading={loading} className="flex-1 min-h-[48px]">
            Save to Project
          </Button>
        </div>
      </div>
    </div>
  );
}

export { exportTypeToDocument };
