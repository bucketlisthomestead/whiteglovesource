/** Display job number derived from project id. */
export function formatJobNumber(projectId: string): string {
  return `WG-${projectId.replace(/-/g, '').slice(0, 8).toUpperCase()}`;
}

/** Human-readable project title for labels and UI (fallback when name is empty). */
export function displayProjectName(
  projectId: string,
  name?: string | null,
): string {
  const trimmed = name?.trim();
  if (trimmed) return trimmed;
  const shortId = projectId.replace(/-/g, '').slice(0, 8).toUpperCase();
  return `Project ${shortId}`;
}

/** Default project name when converting a quote to a project. */
export function suggestProjectNameFromQuote(quote: {
  contactName: string;
  propertyAddress?: string | null;
}): string {
  const street = quote.propertyAddress?.split(',')[0]?.trim();
  return street ? `${quote.contactName} — ${street}` : quote.contactName;
}

/** Full URL encoded in label QR codes. */
export function buildScanUrl(scanToken: string): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return `${origin}/scan/${scanToken}`;
}

export function formatLabelDate(iso?: string): string {
  const d = iso ? new Date(iso) : new Date();
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}
