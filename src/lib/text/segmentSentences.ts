import { normalizeJapanese } from './normalizeJapanese';

const SENTENCE_END = '。．！？!?…';
const OPENERS = '「『（(【〈《“‘';
const CLOSERS = '」』）)】〉》”’"\'';
const PUNCTUATION_ONLY = /^[^\p{L}\p{N}]+$/u;

function quoteBalance(text: string): number {
  let depth = 0;
  for (const char of text) {
    if (OPENERS.includes(char)) depth += 1;
    else if (CLOSERS.includes(char)) depth = Math.max(0, depth - 1);
  }
  return depth;
}

/**
 * Deterministic fallback used when Intl.Segmenter is unavailable (and by the
 * tests that pin the fallback contract). Never splits inside balanced quotes.
 */
export function splitSentencesWithRegex(text: string): string[] {
  const pieces: string[] = [];
  let start = 0;
  let depth = 0;
  let i = 0;

  while (i < text.length) {
    const char = text[i];
    if (char === undefined) break;

    if (OPENERS.includes(char)) {
      depth += 1;
      i += 1;
      continue;
    }
    if (CLOSERS.includes(char)) {
      depth = Math.max(0, depth - 1);
      i += 1;
      continue;
    }
    if (depth === 0 && SENTENCE_END.includes(char)) {
      let end = i + 1;
      while (end < text.length && SENTENCE_END.includes(text[end] ?? '')) end += 1;
      while (end < text.length && CLOSERS.includes(text[end] ?? '')) end += 1;
      pieces.push(text.slice(start, end));
      start = end;
      i = end;
      continue;
    }
    i += 1;
  }

  if (start < text.length) pieces.push(text.slice(start));
  return pieces;
}

function coalesce(segments: string[]): string[] {
  const merged: string[] = [];
  let openBalance = 0;

  for (const segment of segments) {
    if (merged.length > 0 && openBalance > 0) {
      merged[merged.length - 1] = `${merged[merged.length - 1] ?? ''}${segment}`;
    } else {
      merged.push(segment);
    }
    openBalance = Math.max(0, openBalance + quoteBalance(segment));
  }

  const result: string[] = [];
  for (const raw of merged) {
    const segment = raw.trim();
    if (segment.length === 0) continue;
    if (PUNCTUATION_ONLY.test(segment) && result.length > 0) {
      result[result.length - 1] = `${result[result.length - 1] ?? ''}${segment}`;
      continue;
    }
    result.push(segment);
  }
  return result;
}

/**
 * Splits normalized Japanese prose into display sentences.
 *
 * Uses Intl.Segmenter when the runtime provides it, then stabilizes the
 * result so punctuation-only fragments and quote-interior splits do not
 * become their own sentence.
 */
export function segmentSentences(input: string): string[] {
  const text = normalizeJapanese(input);
  if (text.length === 0) return [];

  const Segmenter = Intl.Segmenter;
  if (typeof Segmenter === 'function') {
    const segmenter = new Segmenter('ja', { granularity: 'sentence' });
    const segments: string[] = [];
    for (const part of segmenter.segment(text)) segments.push(part.segment);
    return coalesce(segments);
  }

  return coalesce(splitSentencesWithRegex(text));
}
