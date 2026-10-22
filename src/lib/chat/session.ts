import type { ChatMessage, ChatSession } from '../types';

export function newId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `chat-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function newMessage(role: ChatMessage['role'], content: string): ChatMessage {
  return {
    id: newId(),
    role,
    content,
    createdAt: Date.now(),
  };
}

export function chatTitle(text: string): string {
  const normalized = text.replace(/\s+/gu, ' ').trim();
  return normalized.length === 0 ? 'AI chat' : normalized.slice(0, 48);
}

export function newChatSession(seed: Partial<ChatSession> = {}): ChatSession {
  const now = Date.now();
  return {
    id: newId(),
    title: seed.title ?? 'AI chat',
    messages: seed.messages ?? [],
    createdAt: now,
    updatedAt: now,
    bookId: seed.bookId ?? null,
    sentence: seed.sentence ?? null,
  };
}
