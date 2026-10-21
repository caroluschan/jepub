import DOMPurify from 'dompurify';

const ALLOWED_TAGS = ['ruby', 'rt', 'rp', 'rb'];

export function sanitizeRuby(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR: [],
  });
}
