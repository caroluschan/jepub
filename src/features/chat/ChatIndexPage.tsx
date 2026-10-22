import { useEffect, useState } from 'react';
import { Icon } from '../../components/Icon';
import { useToast } from '../../components/Toast';
import { useI18n } from '../../lib/i18n/useI18n';
import { newChatSession } from '../../lib/chat/session';
import { deleteChatSession, listChatSessions, putChatSession } from '../../lib/storage/db';
import type { ChatSession } from '../../lib/types';
import { navigateToChat, navigateToLibrary } from '../../lib/router';

export function ChatIndexPage() {
  const { t } = useI18n();
  const { push } = useToast();
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    void listChatSessions()
      .then((items) => {
        if (active) setSessions(items);
      })
      .catch(() => {
        if (active) setSessions([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const startNewChat = (): void => {
    const created = newChatSession();
    void putChatSession(created)
      .then(() => navigateToChat(created.id))
      .catch(() => push(t('AI model could not be loaded.'), { tone: 'error' }));
  };

  const remove = (id: string): void => {
    if (!window.confirm(t('Delete chat?'))) return;
    void deleteChatSession(id)
      .then(() => setSessions((current) => current.filter((item) => item.id !== id)))
      .catch(() => push(t('AI model could not be loaded.'), { tone: 'error' }));
  };

  return (
    <div className="chat-page" data-testid="chat-index">
      <header className="chat-page__header">
        <button
          type="button"
          className="icon-button"
          aria-label={t('Back')}
          onClick={navigateToLibrary}
        >
          <Icon name="arrow-left" />
        </button>
        <div className="chat-page__heading">
          <span className="label">{t('AI chat')}</span>
          <h1 className="chat-page__title">{t('Chat room')}</h1>
        </div>
        <div className="chat-page__header-actions">
          <button type="button" className="button--text" onClick={startNewChat}>
            {t('New chat')}
          </button>
        </div>
      </header>

      <main className="chat-index">
        {loading ? (
          <p className="chat-index__empty">{t('Loading chats…')}</p>
        ) : sessions.length === 0 ? (
          <div className="chat-index__empty">
            <p>{t('No saved chats yet.')}</p>
            <button type="button" className="button" onClick={startNewChat}>
              {t('New chat')}
            </button>
          </div>
        ) : (
          <div className="chat-index__list">
            {sessions.map((session) => (
              <div className="chat-index__item" key={session.id}>
                <button
                  type="button"
                  className="chat-index__open"
                  onClick={() => navigateToChat(session.id)}
                >
                  <span className="chat-index__title">{session.title}</span>
                  <span className="chat-index__meta">
                    {new Date(session.updatedAt).toLocaleString()}
                  </span>
                </button>
                <button
                  type="button"
                  className="icon-button"
                  aria-label={t('Delete chat?')}
                  onClick={() => remove(session.id)}
                >
                  <Icon name="trash" size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
