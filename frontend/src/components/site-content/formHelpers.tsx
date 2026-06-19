import { ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { FormField, inputClass, textareaClass } from '../Layout';

export function SectionHeading({ title, description }: { title: string; description?: string }) {
  return (
    <div className="border-b border-cream-dark pb-3 mb-4">
      <h3 className="font-serif text-lg text-charcoal">{title}</h3>
      {description && <p className="text-xs text-charcoal/50 mt-1">{description}</p>}
    </div>
  );
}

export function TextInput({
  label,
  value,
  onChange,
  required,
  placeholder,
  mono,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  placeholder?: string;
  mono?: boolean;
}) {
  return (
    <FormField label={label} required={required}>
      <input
        className={`${inputClass}${mono ? ' font-mono text-sm' : ''}`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </FormField>
  );
}

export function TextAreaInput({
  label,
  value,
  onChange,
  required,
  placeholder,
  rows = 3,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <FormField label={label} required={required}>
      <textarea
        className={textareaClass}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
      />
    </FormField>
  );
}

export function StringListEditor({
  label,
  items,
  onChange,
  addLabel = 'Add item',
  placeholder = 'List item',
}: {
  label: string;
  items: string[];
  onChange: (items: string[]) => void;
  addLabel?: string;
  placeholder?: string;
}) {
  const updateItem = (index: number, value: string) => {
    const next = [...items];
    next[index] = value;
    onChange(next);
  };

  const removeItem = (index: number) => {
    onChange(items.filter((_, i) => i !== index));
  };

  const moveItem = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };

  return (
    <FormField label={label}>
      <div className="space-y-2">
        {items.map((item, index) => (
          <div key={index} className="flex gap-2 items-start">
            <input
              className={`${inputClass} flex-1`}
              value={item}
              onChange={(e) => updateItem(index, e.target.value)}
              placeholder={placeholder}
            />
            <div className="flex shrink-0 gap-1">
              <button
                type="button"
                onClick={() => moveItem(index, -1)}
                disabled={index === 0}
                className="p-2 border border-cream-dark text-charcoal/50 hover:text-gold disabled:opacity-30"
                aria-label="Move up"
              >
                <ChevronUp size={16} />
              </button>
              <button
                type="button"
                onClick={() => moveItem(index, 1)}
                disabled={index === items.length - 1}
                className="p-2 border border-cream-dark text-charcoal/50 hover:text-gold disabled:opacity-30"
                aria-label="Move down"
              >
                <ChevronDown size={16} />
              </button>
              <button
                type="button"
                onClick={() => removeItem(index)}
                className="p-2 border border-cream-dark text-charcoal/50 hover:text-red-600"
                aria-label="Remove"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        ))}
        <button
          type="button"
          onClick={() => onChange([...items, ''])}
          className="inline-flex items-center gap-1 text-xs uppercase tracking-wider text-gold hover:text-charcoal"
        >
          <Plus size={14} />
          {addLabel}
        </button>
      </div>
    </FormField>
  );
}

export function ArrayItemShell({
  title,
  index,
  total,
  onMoveUp,
  onMoveDown,
  onRemove,
  children,
}: {
  title: string;
  index: number;
  total: number;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
  children: ReactNode;
}) {
  return (
    <div className="border border-cream-dark p-4 bg-cream/20 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs uppercase tracking-wider text-charcoal/60">
          {title} {index + 1}
        </p>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={onMoveUp}
            disabled={index === 0}
            className="p-1.5 border border-cream-dark text-charcoal/50 hover:text-gold disabled:opacity-30"
            aria-label="Move up"
          >
            <ChevronUp size={14} />
          </button>
          <button
            type="button"
            onClick={onMoveDown}
            disabled={index === total - 1}
            className="p-1.5 border border-cream-dark text-charcoal/50 hover:text-gold disabled:opacity-30"
            aria-label="Move down"
          >
            <ChevronDown size={14} />
          </button>
          <button
            type="button"
            onClick={onRemove}
            className="p-1.5 border border-cream-dark text-charcoal/50 hover:text-red-600"
            aria-label="Remove"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
      {children}
    </div>
  );
}
