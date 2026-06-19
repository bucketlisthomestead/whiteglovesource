import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Download, FileText, Loader2 } from 'lucide-react';
import type { ProjectPhase } from '../types';
import { PHASE_LABELS } from '../lib/labels';

type PdfExportType = 'inventory' | 'status-full' | `status-${ProjectPhase}`;

interface PdfExportMenuProps {
  disabled?: boolean;
  loading?: boolean;
  onExport: (type: PdfExportType) => void;
  compact?: boolean;
}

const OPTIONS: { type: PdfExportType; label: string; description: string }[] = [
  {
    type: 'inventory',
    label: 'Inventory Manifest',
    description: 'Piece list with stage and condition',
  },
  {
    type: 'status-full',
    label: 'Full Status Report',
    description: 'All phases, signoffs, and chain of custody',
  },
  {
    type: 'status-planning',
    label: `${PHASE_LABELS.planning} Signoff`,
    description: 'Phase 1 inventory acknowledgment',
  },
  {
    type: 'status-pickup_storage',
    label: `${PHASE_LABELS.pickup_storage} Signoff`,
    description: 'Phase 2 pickup & storage record',
  },
  {
    type: 'status-installation',
    label: `${PHASE_LABELS.installation} Signoff`,
    description: 'Phase 3 installation record',
  },
];

export function PdfExportMenu({ disabled, loading, onExport, compact }: PdfExportMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={disabled || loading}
        className={`flex items-center justify-center gap-2 border border-cream-dark hover:border-gold text-sm min-h-[48px] transition-colors ${
          compact ? 'px-3' : 'px-4 py-3 w-full sm:w-auto'
        }`}
      >
        {loading ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
        {loading ? 'Generating…' : 'Export PDF'}
        <ChevronDown size={14} className="text-charcoal/40" />
      </button>

      {open && !loading && (
        <div className="absolute right-0 z-20 mt-1 w-72 bg-white border border-cream-dark shadow-lg">
          {OPTIONS.map((opt) => (
            <button
              key={opt.type}
              type="button"
              onClick={() => {
                setOpen(false);
                onExport(opt.type);
              }}
              className="w-full text-left px-4 py-3 hover:bg-cream border-b border-cream-dark last:border-0 min-h-[56px]"
            >
              <span className="flex items-center gap-2 text-sm font-medium text-charcoal">
                <FileText size={14} className="text-gold shrink-0" />
                {opt.label}
              </span>
              <span className="block text-[10px] text-charcoal/50 mt-0.5 pl-6">{opt.description}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export type { PdfExportType };
