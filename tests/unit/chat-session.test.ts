import { describe, expect, it } from 'vitest';
import { chatTitle, newChatSession, newMessage } from '../../src/lib/chat/session';

describe('chat sessions', () => {
  it('CHAT-SESSION creates a local session with stable defaults', () => {
    const session = newChatSession();
    expect(session.id.length).toBeGreaterThan(0);
    expect(session.title).toBe('AI chat');
    expect(session.messages).toEqual([]);
    expect(session.bookId).toBeNull();
  });

  it('CHAT-TITLE normalizes whitespace and limits the title', () => {
    expect(chatTitle('  吾輩は猫である。\n名前はまだ無い。  ')).toBe('吾輩は猫である。 名前はまだ無い。');
    expect(chatTitle(' '.repeat(100))).toBe('AI chat');
    expect(chatTitle('あ'.repeat(80)).length).toBe(48);
  });

  it('CHAT-MESSAGE creates user and assistant messages', () => {
    const message = newMessage('assistant', '文法を説明します。');
    expect(message.role).toBe('assistant');
    expect(message.content).toBe('文法を説明します。');
    expect(message.id.length).toBeGreaterThan(0);
    expect(message.createdAt).toBeGreaterThan(0);
  });
});
