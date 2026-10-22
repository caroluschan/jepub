import type { KnowledgeRecord, QuizQuestion } from '../types';

function recordText(record: KnowledgeRecord): string {
  const lines = [`Kind: ${record.kind}`, `Sentence: ${record.sentence}`];
  if (record.readings !== undefined) lines.push(`Readings: ${record.readings}`);
  if (record.romaji !== undefined) lines.push(`Romaji: ${record.romaji}`);
  if (record.translation !== undefined) lines.push(`Translation: ${record.translation}`);
  if (record.question !== undefined) lines.push(`Question: ${record.question}`);
  if (record.answer !== undefined) lines.push(`Answer: ${record.answer}`);
  return lines.join('\n').slice(0, 1200);
}

export function buildLearningSummaryPrompt(records: readonly KnowledgeRecord[]): string {
  const selected = records.slice(0, 25);
  return [
    'You are helping a Japanese learner review their own study records.',
    'Write a concise learning summary in Markdown with three short sections:',
    '1. What they have studied',
    '2. Strengths and recurring gaps',
    '3. Three concrete next study steps',
    'Use only the records below. Do not invent facts. Keep it under 350 words.',
    '',
    ...selected.map((record, index) => `Record ${index + 1}\n${recordText(record)}`),
  ].join('\n\n');
}

export function buildQuizPrompt(record: KnowledgeRecord): string {
  return [
    'Create one multiple-choice quiz question for a Japanese learner using this study record:',
    '',
    recordText(record),
    '',
    'The question should test understanding of the Japanese sentence, its reading, grammar, or meaning.',
    'Return ONLY valid JSON with exactly these keys:',
    '{"question":"...","options":["...","...","...","..."],"answer":0,"explanation":"..."}',
    'Rules: exactly 4 distinct options; answer is the zero-based index of the correct option; no Markdown fences.',
  ].join('\n');
}

export function parseQuizQuestion(raw: string): QuizQuestion {
  const cleaned = raw.replace(/```(?:json)?/giu, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('The AI did not return a quiz question.');
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned.slice(start, end + 1)) as unknown;
  } catch {
    throw new Error('The AI returned an invalid quiz question.');
  }
  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error('The AI returned an invalid quiz question.');
  }
  const record = parsed as Record<string, unknown>;
  const question = record['question'];
  const options = record['options'];
  const answer = record['answer'];
  const explanation = record['explanation'];
  if (
    typeof question !== 'string' ||
    question.trim().length === 0 ||
    !Array.isArray(options) ||
    options.length !== 4 ||
    !options.every((option) => typeof option === 'string' && option.trim().length > 0) ||
    typeof answer !== 'number' ||
    !Number.isInteger(answer) ||
    answer < 0 ||
    answer > 3 ||
    typeof explanation !== 'string'
  ) {
    throw new Error('The AI returned an invalid quiz question.');
  }
  return {
    question,
    options: [options[0], options[1], options[2], options[3]] as [string, string, string, string],
    answer,
    explanation,
  };
}
