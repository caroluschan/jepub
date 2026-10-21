const WHITESPACE = /\s/u;

function isWhitespaceCodePoint(cp: number): boolean {
  if (cp === 0x20 || (cp >= 0x09 && cp <= 0x0d)) return true;
  if (cp === 0x85 || cp === 0xa0) return true;
  if (cp === 0x1680) return true;
  if (cp >= 0x2000 && cp <= 0x200a) return true;
  if (cp === 0x2028 || cp === 0x2029 || cp === 0x202f || cp === 0x205f) return true;
  if (cp === 0x3000 || cp === 0xfeff) return true;
  return false;
}

/**
 * Japanese/CJK code points. Whitespace is handled before this predicate, so
 * U+3000 never reaches it.
 */
export function isCjkCodePoint(cp: number): boolean {
  return (
    (cp >= 0x2e80 && cp <= 0x2eff) || // CJK radicals supplement
    (cp >= 0x2f00 && cp <= 0x2fdf) || // Kangxi radicals
    (cp >= 0x3000 && cp <= 0x303f) || // CJK symbols and punctuation
    (cp >= 0x3040 && cp <= 0x30ff) || // Hiragana + Katakana
    (cp >= 0x3100 && cp <= 0x312f) || // Bopomofo
    (cp >= 0x31f0 && cp <= 0x31ff) || // Katakana phonetic extensions
    (cp >= 0x3400 && cp <= 0x4dbf) || // CJK unified ideographs extension A
    (cp >= 0x4e00 && cp <= 0x9fff) || // CJK unified ideographs
    (cp >= 0xf900 && cp <= 0xfaff) || // CJK compatibility ideographs
    (cp >= 0xfe30 && cp <= 0xfe4f) || // CJK compatibility forms
    (cp >= 0xfe50 && cp <= 0xfe6f) || // Small form variants
    (cp >= 0xff00 && cp <= 0xffef) || // Fullwidth forms + halfwidth katakana
    (cp >= 0x20000 && cp <= 0x3ffff) // CJK extensions B and beyond
  );
}

function isCjkChar(char: string): boolean {
  const cp = char.codePointAt(0);
  return cp !== undefined && isCjkCodePoint(cp);
}

function nextNonWhitespace(text: string, start: number): string | null {
  let i = start;
  while (i < text.length) {
    const cp = text.codePointAt(i);
    if (cp === undefined) return null;
    const char = String.fromCodePoint(cp);
    if (!isWhitespaceCodePoint(cp)) return char;
    i += char.length;
  }
  return null;
}

/**
 * Normalizes Japanese prose for reader/segmenter consumption.
 *
 * Hard-wrapped Japanese loses its line breaks entirely (CJK on both sides).
 * A single space survives when either neighbour is non-CJK so that Latin
 * words and numbers stay separated.
 */
export function normalizeJapanese(input: string): string {
  if (input.length === 0) return '';

  const text = input.replace(/\r\n?/g, '\n').replace(/[\u00a0\u3000]/g, ' ');
  let out = '';
  let lastNonSpace: string | null = null;
  let i = 0;

  while (i < text.length) {
    const cp = text.codePointAt(i);
    if (cp === undefined) break;
    const char = String.fromCodePoint(cp);

    if (isWhitespaceCodePoint(cp)) {
      let j = i + char.length;
      while (j < text.length) {
        const nextCp = text.codePointAt(j);
        if (nextCp === undefined || !isWhitespaceCodePoint(nextCp)) break;
        j += String.fromCodePoint(nextCp).length;
      }

      const next = nextNonWhitespace(text, j);
      if (lastNonSpace !== null && next !== null && isCjkChar(lastNonSpace) && isCjkChar(next)) {
        // Japanese hard wrap: the space is an artifact of the line width.
      } else if (out.length > 0 && !out.endsWith(' ')) {
        out += ' ';
      }
      i = j;
      continue;
    }

    out += char;
    if (!WHITESPACE.test(char)) lastNonSpace = char;
    i += char.length;
  }

  return out.trim();
}
