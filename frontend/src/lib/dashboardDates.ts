export interface DashboardDateRange {
  from: string;
  to: string;
}

export type DateRangePreset = 'month' | 'quarter' | 'year' | 'next6' | 'custom';

export const DATE_RANGE_PRESETS: { value: DateRangePreset; label: string }[] = [
  { value: 'month', label: 'This month' },
  { value: 'quarter', label: 'This quarter' },
  { value: 'year', label: 'This year' },
  { value: 'next6', label: 'Next 6 months' },
  { value: 'custom', label: 'Custom' },
];

export function toDateInput(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function thisMonthRange(now = new Date()): DashboardDateRange {
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return { from: toDateInput(from), to: toDateInput(to) };
}

export function thisQuarterRange(now = new Date()): DashboardDateRange {
  const quarter = Math.floor(now.getMonth() / 3);
  const from = new Date(now.getFullYear(), quarter * 3, 1);
  const to = new Date(now.getFullYear(), quarter * 3 + 3, 0);
  return { from: toDateInput(from), to: toDateInput(to) };
}

export function thisYearRange(now = new Date()): DashboardDateRange {
  const from = new Date(now.getFullYear(), 0, 1);
  const to = new Date(now.getFullYear(), 11, 31);
  return { from: toDateInput(from), to: toDateInput(to) };
}

export function nextSixMonthsRange(now = new Date()): DashboardDateRange {
  const from = new Date(now);
  const to = new Date(now);
  to.setMonth(to.getMonth() + 6);
  return { from: toDateInput(from), to: toDateInput(to) };
}

/** @deprecated use nextSixMonthsRange */
export function defaultDashboardDateRange(now = new Date()): DashboardDateRange {
  return nextSixMonthsRange(now);
}

export function rangeForPreset(
  preset: DateRangePreset,
  custom?: DashboardDateRange | null,
  now = new Date(),
): DashboardDateRange {
  switch (preset) {
    case 'month':
      return thisMonthRange(now);
    case 'quarter':
      return thisQuarterRange(now);
    case 'year':
      return thisYearRange(now);
    case 'next6':
      return nextSixMonthsRange(now);
    case 'custom':
      return custom ?? nextSixMonthsRange(now);
  }
}

export function formatDashboardDateRange(range: DashboardDateRange): string {
  const fmt = (iso: string) =>
    new Date(`${iso}T12:00:00`).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  return `${fmt(range.from)} – ${fmt(range.to)}`;
}
