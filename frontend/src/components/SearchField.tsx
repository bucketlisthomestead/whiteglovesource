import { Search } from 'lucide-react';
import { inputClass } from './Layout';

interface SearchFieldProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function SearchField({ value, onChange, placeholder = 'Search…', className = '' }: SearchFieldProps) {
  return (
    <div className={`relative ${className}`}>
      <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-charcoal/30 pointer-events-none" />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`${inputClass} pl-10 min-h-[44px]`}
      />
    </div>
  );
}

export function matchesSearch(query: string, ...parts: (string | null | undefined)[]) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return parts.some((p) => p?.toLowerCase().includes(q));
}
