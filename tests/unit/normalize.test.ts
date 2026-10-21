import { describe, expect, it } from 'vitest';
import { normalizeJapanese } from '../../src/lib/text/normalizeJapanese';

describe('normalizeJapanese', () => {
  it('NORM-CJK-WRAP joins a hard wrap between CJK characters', () => {
    expect(normalizeJapanese('広い門\nの下には')).toBe('広い門の下には');
    expect(normalizeJapanese('雨が\r\n降っていた')).toBe('雨が降っていた');
  });

  it('NORM-IDEO-SPACE trims full-width indentation and drops CJK spacing', () => {
    expect(normalizeJapanese('\u3000或日')).toBe('或日');
    expect(normalizeJapanese('或日\u3000、下人')).toBe('或日、下人');
    expect(normalizeJapanese('a\u00a0b')).toBe('a b');
  });

  it('NORM-LATIN preserves one space around Latin text and digits', () => {
    expect(normalizeJapanese('Project\nGutenberg')).toBe('Project Gutenberg');
    expect(normalizeJapanese('日本語   English')).toBe('日本語 English');
    expect(normalizeJapanese('第 1 章')).toBe('第 1 章');
    expect(normalizeJapanese('a    b\t\tc')).toBe('a b c');
  });

  it('NORM-EMPTY keeps empty and whitespace-only input empty', () => {
    expect(normalizeJapanese('')).toBe('');
    expect(normalizeJapanese('  \n\t\u3000 ')).toBe('');
  });
});
