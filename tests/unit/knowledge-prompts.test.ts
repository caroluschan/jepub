import { describe, expect, it } from 'vitest';
import { buildKnowledgeSummaryPrompt, buildQuizPrompt, parseKnowledgeSummary, parseQuizQuestion } from '../../src/lib/knowledge/prompts';
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
  it('KB-PROMPT asks for durable learning bullets and supports NONE', () => {
    const prompt = buildKnowledgeSummaryPrompt('Explain this sentence.', 'It means I am a cat.');
    expect(prompt).toContain('durable Japanese-learning knowledge');
    expect(prompt).toContain('Explain this sentence.');
    expect(prompt).toContain('It means I am a cat.');
    expect(parseKnowledgeSummary('NONE')).toBeNull();
    expect(parseKnowledgeSummary('- 猫 means cat.')).toBe('- 猫 means cat.');
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
