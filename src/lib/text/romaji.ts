/**
 * Cleans the spaced romaji that Kuroshiro emits (mode: 'spaced') without
 * touching macrons or apostrophes.
 */
export function cleanRomaji(input: string): string {
  let text = input.replace(/\s+/gu, ' ').trim();
  if (text.length === 0) return '';

  // Ellipsis runs, with or without the spaces the tokenizer inserts.
  text = text.replace(/…(?:\s*…)+/gu, '…');

  // Drop spaces between consecutive punctuation marks.
  text = text.replace(/([.,!?;:…])\s+(?=[.,!?;:…])/gu, '$1');
  text = text.replace(/([.,!?;:…])\s*([.,!?;:…])/gu, '$1$2');

  // No space before closing punctuation or closing quotes/brackets.
  text = text.replace(/\s+([.,!?;:%)\]}。、，．！？：；…」』】”’])/gu, '$1');

  // No space after opening quotes/brackets.
  text = text.replace(/([“‘「『【([])\s+/gu, '$1');

  text = text.replace(/ {2,}/gu, ' ').trim();
  return text;
}
