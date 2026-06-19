import { FormField, inputClass } from './Layout';
import {
  DATE_RANGE_PRESETS,
  formatDashboardDateRange,
  type DateRangePreset,
  type DashboardDateRange,
} from '../lib/dashboardDates';

interface DateRangeFilterProps {
  preset: DateRangePreset;
  onPresetChange: (preset: DateRangePreset) => void;
  customFrom: string;
  customTo: string;
  onCustomFromChange: (value: string) => void;
  onCustomToChange: (value: string) => void;
  onApplyCustom: () => void;
  appliedRange: DashboardDateRange;
  hint?: string;
}

export function DateRangeFilter({
  preset,
  onPresetChange,
  customFrom,
  customTo,
  onCustomFromChange,
  onCustomToChange,
  onApplyCustom,
  appliedRange,
  hint = 'Quotes use preferred date (or submitted date). Projects use target install date (or created date).',
}: DateRangeFilterProps) {
  return (
    <div className="bg-white border border-cream-dark p-4 md:p-5">
      <p className="text-[10px] uppercase tracking-wider text-charcoal/45 mb-3">Date range</p>

      <div className="flex flex-wrap gap-1 mb-4">
        {DATE_RANGE_PRESETS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onPresetChange(opt.value)}
            className={`shrink-0 px-3 py-2 text-[10px] uppercase tracking-wider min-h-[40px] border transition-colors ${
              preset === opt.value
                ? 'bg-charcoal text-cream border-charcoal'
                : 'bg-white border-cream-dark text-charcoal/50 hover:border-charcoal/30'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {preset === 'custom' && (
        <div className="flex flex-col lg:flex-row lg:items-end gap-4 mb-4">
          <FormField label="From">
            <input
              type="date"
              className={inputClass}
              value={customFrom}
              onChange={(e) => onCustomFromChange(e.target.value)}
            />
          </FormField>
          <FormField label="To">
            <input
              type="date"
              className={inputClass}
              value={customTo}
              onChange={(e) => onCustomToChange(e.target.value)}
            />
          </FormField>
          <button
            type="button"
            onClick={onApplyCustom}
            disabled={!customFrom || !customTo}
            className="px-4 py-2.5 bg-charcoal text-cream text-xs uppercase tracking-wider min-h-[44px] disabled:opacity-40"
          >
            Apply custom range
          </button>
        </div>
      )}

      <p className="text-xs text-charcoal/45">
        Showing {formatDashboardDateRange(appliedRange)}
        {hint ? ` · ${hint}` : ''}
      </p>
    </div>
  );
}
