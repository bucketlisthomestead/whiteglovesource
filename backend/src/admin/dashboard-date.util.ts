export interface DashboardDateRange {
  from: string;
  to: string;
}

function toDateInput(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function defaultDashboardDateRange(
  now = new Date(),
): DashboardDateRange {
  const from = new Date(now);
  const to = new Date(now);
  to.setMonth(to.getMonth() + 6);
  return { from: toDateInput(from), to: toDateInput(to) };
}

export function parseDashboardDateRange(
  from?: string,
  to?: string,
): DashboardDateRange {
  const defaults = defaultDashboardDateRange();
  const fromValue = from?.trim() || defaults.from;
  const toValue = to?.trim() || defaults.to;

  if (fromValue > toValue) {
    return { from: toValue, to: fromValue };
  }

  return { from: fromValue, to: toValue };
}

export function parseOptionalDateRange(
  from?: string,
  to?: string,
): DashboardDateRange | null {
  const fromValue = from?.trim();
  const toValue = to?.trim();
  if (!fromValue && !toValue) return null;
  return parseDashboardDateRange(fromValue, toValue);
}
