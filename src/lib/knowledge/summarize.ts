import { newMessage } from '../chat/session';
import type { ChatMessage } from '../types';
import { buildKnowledgeSummaryPrompt, parseKnowledgeSummary } from './prompts';

type Generate = (
  messages: ChatMessage[],
  onToken: (token: string) => void,
  maxTokens?: number,
) => Promise<string>;

export async function summarizeForKnowledge(
  generate: Generate,
  question: string,
  answer: string,
): Promise<string | null> {
  const raw = await generate(
    [newMessage('user', buildKnowledgeSummaryPrompt(question, answer))],
    () => undefined,
    220,
  );
  return parseKnowledgeSummary(raw);
}
