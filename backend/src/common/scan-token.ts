import { randomBytes } from 'crypto';

/** Short URL-safe token for piece label QR codes (12 chars). */
export function generateScanToken(): string {
  return randomBytes(9).toString('base64url');
}

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
