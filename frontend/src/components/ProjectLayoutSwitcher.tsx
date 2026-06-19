import { useState } from 'react';
import { LayoutGrid, Check, ChevronDown } from 'lucide-react';
import {
  PROJECT_LAYOUT_IDS,
  PROJECT_LAYOUT_PRESETS,
  type ProjectLayoutId,
} from '../lib/projectLayout';

interface ProjectLayoutSwitcherProps {
  layoutId: ProjectLayoutId;
  onChange: (id: ProjectLayoutId) => void;
  className?: string;
}

export function ProjectLayoutSwitcher({
  layoutId,
  onChange,
  className = '',
}: ProjectLayoutSwitcherProps) {
  const [open, setOpen] = useState(false);
  const current = PROJECT_LAYOUT_PRESETS[layoutId];

  return (
    <div className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-2 px-3 py-2 text-xs uppercase tracking-wider border border-cream-dark bg-white hover:bg-cream/50 min-h-[44px] transition-colors"
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <LayoutGrid size={14} className="text-gold shrink-0" />
        <span className="text-charcoal hidden sm:inline">Layout:</span>
        <span className="text-charcoal font-medium">{current.label}</span>
        <ChevronDown size={14} className={`text-charcoal/50 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 cursor-default"
            aria-label="Close layout menu"
            onClick={() => setOpen(false)}
          />
          <div
            className="absolute right-0 top-full mt-1 z-50 w-[min(100vw-2rem,22rem)] bg-white border border-cream-dark shadow-lg"
            role="listbox"
            aria-label="Project layout"
          >
            <p className="px-4 py-2 text-[10px] uppercase tracking-wider text-charcoal/55 border-b border-cream-dark">
              Your saved view
            </p>
            {PROJECT_LAYOUT_IDS.map((id) => {
              const preset = PROJECT_LAYOUT_PRESETS[id];
              const selected = id === layoutId;
              return (
                <button
                  key={id}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onClick={() => {
                    onChange(id);
                    setOpen(false);
                  }}
                  className={`w-full text-left px-4 py-3 border-b border-cream-dark last:border-b-0 hover:bg-cream/40 transition-colors min-h-[44px] ${
                    selected ? 'bg-gold/10' : ''
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium text-charcoal">{preset.label}</p>
                      <p className="text-xs text-charcoal/65 mt-0.5 leading-snug">
                        {preset.description}
                      </p>
                    </div>
                    {selected && <Check size={16} className="text-gold shrink-0 mt-0.5" />}
                  </div>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
