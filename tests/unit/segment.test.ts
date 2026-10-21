import { describe, expect, it } from 'vitest';
import { segmentSentences, splitSentencesWithRegex } from '../../src/lib/text/segmentSentences';

describe('segmentSentences', () => {
  it('SEG-PUNCT splits on Japanese and ASCII sentence punctuation', () => {
    const segments = segmentSentences('「そうか。」と彼は言った。もう一度。');
    expect(segments).toEqual(['「そうか。」', 'と彼は言った。', 'もう一度。']);
    expect(segmentSentences('本当? そうだ!').length).toBe(2);
  });

  it('SEG-QUOTES never leaves a split inside a paired quote', () => {
    expect(segmentSentences('「そうか。そうか。」と彼は言った。')).toEqual([
      '「そうか。そうか。」と彼は言った。',
    ]);
    expect(segmentSentences('『一つ。二つ。』と言った。')).toEqual(['『一つ。二つ。』と言った。']);
  });

  it('SEG-ELLIPSIS treats an ellipsis run as sentence punctuation', () => {
    expect(segmentSentences('そうか……。そうか。')).toEqual(['そうか……。', 'そうか。']);
    expect(segmentSentences('待て… そして…行け。')).toEqual(['待て… そして…行け。']);
  });

  it('SEG-HARDWRAP normalizes hard-wrapped Japanese before splitting', () => {
    const segments = segmentSentences('広い門\nの下には、雨が降っていた。\n彼は立ち止まった。');
    expect(segments).toEqual(['広い門の下には、雨が降っていた。', '彼は立ち止まった。']);
    expect(segments.join('')).not.toContain('\n');
  });

  it('SEG-EMPTY returns no sentences for empty input', () => {
    expect(segmentSentences('')).toEqual([]);
    expect(segmentSentences('   \n\u3000 ')).toEqual([]);
  });

  it('SEG-FALLBACK splits deterministically without Intl.Segmenter', () => {
    expect(splitSentencesWithRegex('「そうか。そうか。」と彼は言った。次。')).toEqual([
      '「そうか。そうか。」と彼は言った。',
      '次。',
    ]);
    expect(splitSentencesWithRegex('本当? そうだ!')).toEqual(['本当?', ' そうだ!']);
  });
});
