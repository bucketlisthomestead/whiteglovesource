/** Display job number derived from project id. */
export function formatJobNumber(projectId: string): string {
  return `WG-${projectId.replace(/-/g, '').slice(0, 8).toUpperCase()}`;
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
