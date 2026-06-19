import DOMPurify from 'dompurify';

const ALLOWED_TAGS = ['p', 'br', 'strong', 'em', 'b', 'i', 'a', 'ul', 'ol', 'li'];
const ALLOWED_ATTR = ['href', 'target', 'rel'];

export function sanitizeRichText(html: string): string {
  return DOMPurify.sanitize(html, { ALLOWED_TAGS, ALLOWED_ATTR });
}

export function normalizeRichTextOutput(html: string): string {
  const trimmed = html.trim();
  if (!trimmed || trimmed === '<p></p>' || trimmed === '<p><br></p>') {
    return '';
  }
  return sanitizeRichText(trimmed);
}

export function isRichText(value: string): boolean {
  return /<[a-z][\s\S]*>/i.test(value);
}

export function stripRichText(value: string): string {
  if (!isRichText(value)) return value;
  const doc = new DOMParser().parseFromString(sanitizeRichText(value), 'text/html');
  return doc.body.textContent?.trim() ?? '';
}
