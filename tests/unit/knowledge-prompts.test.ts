import { describe, expect, it } from 'vitest';
import { buildQuizPrompt, buildLearningSummaryPrompt, parseQuizQuestion } from '../../src/lib/knowledge/prompts';
import type { KnowledgeRecord } from '../../src/lib/types';

const record: KnowledgeRecord = {
  id: 'r1',
  kind: 'translation',
  sentence: '吾輩は猫である。',
  translation: 'I am a cat.',
  readings: '吾輩（わがはい）',
  createdAt: 1,
  fingerprint: 'fp',
};

describe('knowledge prompts', () => {
  it('KB-PROMPT includes records in a summary request', () => {
    const prompt = buildLearningSummaryPrompt([record]);
    expect(prompt).toContain('吾輩は猫である。');
    expect(prompt).toContain('I am a cat.');
    expect(prompt).toContain('Three concrete next study steps');
  });

  it('QUIZ-PROMPT asks for strict JSON', () => {
    const prompt = buildQuizPrompt(record);
    expect(prompt).toContain('Return ONLY valid JSON');
    expect(prompt).toContain('exactly 4 distinct options');
  });

  it('QUIZ-PARSE accepts fenced JSON and validates four options', () => {
    const parsed = parseQuizQuestion(
      '```json\n{"question":"What does 猫 mean?","options":["cat","dog","bird","fish"],"answer":0,"explanation":"猫 means cat."}\n```',
    );
    expect(parsed.question).toBe('What does 猫 mean?');
    expect(parsed.options).toHaveLength(4);
    expect(parsed.answer).toBe(0);
  });

  it('QUIZ-PARSE rejects malformed or under-filled questions', () => {
    expect(() => parseQuizQuestion('{"question":"x","options":["a"],"answer":0,"explanation":"y"}')).toThrow(
      'invalid quiz question',
    );
    expect(() => parseQuizQuestion('not json')).toThrow();
  });
});
