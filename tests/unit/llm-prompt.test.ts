import { describe, expect, it } from 'vitest';
import { buildSentencePrompt, readingsFromRuby } from '../../src/lib/llm/prompt';

describe('local AI prompts', () => {
  it('LLM-PROMPT extracts ruby readings without markup', () => {
    const html =
      '<ruby>吾輩<rp>(</rp><rt>わがはい</rt><rp>)</rp></ruby>は<ruby>猫<rp>(</rp><rt>ねこ</rt><rp>)</rp></ruby>である。';
    expect(readingsFromRuby(html)).toBe('吾輩（わがはい） 猫（ねこ）');
    expect(readingsFromRuby(null)).toBe('');
  });

  it('LLM-PROMPT supplies readings, romaji, and translation to the model', () => {
    const prompt = buildSentencePrompt({
      sentence: '吾輩は猫である。',
      readings: '吾輩（わがはい） 猫（ねこ）',
      romaji: 'wagahai wa neko de aru.',
      translation: 'I am a cat.',
    });
    expect(prompt).toContain('Sentence: 吾輩は猫である。');
    expect(prompt).toContain('Readings: 吾輩（わがはい） 猫（ねこ）');
    expect(prompt).toContain('Romaji: wagahai wa neko de aru.');
    expect(prompt).toContain('Existing translation: I am a cat.');
    expect(prompt).toContain('Do not invent readings.');
  });
});
