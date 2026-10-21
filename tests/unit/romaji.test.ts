import { describe, expect, it } from 'vitest';
import { cleanRomaji } from '../../src/lib/text/romaji';

describe('cleanRomaji', () => {
  it('ROM-PUNCT removes spaces before punctuation and collapses runs', () => {
    expect(cleanRomaji('Hello , world .')).toBe('Hello, world.');
    expect(cleanRomaji('本当 ? そう だ !')).toBe('本当? そう だ!');
    expect(cleanRomaji('a  b   c')).toBe('a b c');
  });

  it('ROM-QUOTE tightens opening and closing quotes', () => {
    expect(cleanRomaji('「 そうか ？ 」')).toBe('「そうか？」');
    expect(cleanRomaji('( hello )')).toBe('(hello)');
  });

  it('ROM-ELLIPSIS normalizes spaced ellipses to a single mark', () => {
    const cleaned = cleanRomaji('そう か … … そう か');
    expect(cleaned).toBe('そう か… そう か');
    expect(cleaned.match(/…/gu)?.length).toBe(1);
  });

  it('ROM-LATIN preserves macrons and apostrophes', () => {
    expect(cleanRomaji('Tōkyō  e  iku')).toBe('Tōkyō e iku');
    expect(cleanRomaji("don't  stop")).toBe("don't stop");
    expect(cleanRomaji('')).toBe('');
  });
});
