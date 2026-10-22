import type { KnowledgeRecord, QuizQuestion } from '../types';

function recordText(record: KnowledgeRecord): string {
  const lines = [`Kind: ${record.kind}`, `Sentence: ${record.sentence}`];
  if (record.readings !== undefined) lines.push(`Readings: ${record.readings}`);
  if (record.romaji !== undefined) lines.push(`Romaji: ${record.romaji}`);
  if (record.translation !== undefined) lines.push(`Translation: ${record.translation}`);
  if (record.question !== undefined) lines.push(`Question: ${record.question}`);
  if (record.answer !== undefined) lines.push(`Answer: ${record.answer}`);
  if (record.summary !== undefined) lines.push(`Summary: ${record.summary}`);
  return lines.join('\n').slice(0, 1200);
}

export function buildKnowledgeSummaryPrompt(question: string, answer: string): string {
  return [
    'Extract only the durable Japanese-learning knowledge from this AI exchange.',
    'Write 1–3 concise Markdown bullet points covering what the learner should remember.',
    'Do not repeat the full answer, small talk, or process description.',
    'If the exchange contains no durable learning, reply exactly NONE.',
    '',
    `Learner question:\n${question.slice(0, 1200)}`,
    '',
    `AI answer:\n${answer.slice(0, 2400)}`,
  ].join('\n');
}

export function parseKnowledgeSummary(raw: string): string | null {
  const summary = raw.trim();
  if (summary.length === 0 || /^none[.!]?$/iu.test(summary)) return null;
  return summary;
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
