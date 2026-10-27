import { useCallback, useEffect, useRef, useState } from 'react';
import { Icon } from '../../components/Icon';
import { Markdown } from '../../components/Markdown';
import { Modal } from '../../components/Modal';
import { Spinner } from '../../components/Spinner';
import { useToast } from '../../components/Toast';
import { useI18n } from '../../lib/i18n/useI18n';
import { chatTitle, newChatSession, newMessage } from '../../lib/chat/session';
import { makeKnowledgeRecord } from '../../lib/knowledge/record';
import { summarizeForKnowledge } from '../../lib/knowledge/summarize';
import {
  deleteChatSession,
  getChatSession,
  listChatSessions,
  putChatSession,
  saveKnowledgeRecord,
} from '../../lib/storage/db';
import type { ChatSession } from '../../lib/types';
import { navigateToChat, navigateToLibrary } from '../../lib/router';
import { useSettings } from '../settings/SettingsProvider';
import { useLlm } from '../ai/LlmProvider';
import { AiConsentDialog } from '../ai/AiConsentDialog';

interface ChatPageProps {
  sessionId: string | null;
}

export function ChatPage({ sessionId }: ChatPageProps) {
  const { settings, updateSettings, openSettings } = useSettings();
  const { t } = useI18n();
  const { push } = useToast();
  const llm = useLlm();
  const [session, setSession] = useState<ChatSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [streaming, setStreaming] = useState('');
  const [sendError, setSendError] = useState<string | null>(null);
  const [consentOpen, setConsentOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [history, setHistory] = useState<ChatSession[]>([]);
  const isLocal = llm.mode === 'local';
  const isByot = llm.mode === 'byot';
  const isOvh = llm.mode === 'ovh';
  const offlineRemote = (isByot || isOvh) && !llm.online;
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setNotFound(false);
    setSession(null);

    const load = async (): Promise<void> => {
      if (sessionId === null) {
        const created = newChatSession();
        await putChatSession(created);
        if (!active) return;
        setSession(created);
        setLoading(false);
        navigateToChat(created.id);
        return;
      }
      const stored = await getChatSession(sessionId);
      if (!active) return;
      if (stored === null) {
        setNotFound(true);
      } else {
        setSession(stored);
      }
      setLoading(false);
    };

    void load().catch(() => {
      if (!active) return;
      setNotFound(true);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [sessionId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [session?.messages, streaming]);

  const goBack = useCallback(() => {
    if (window.history.length > 1) window.history.back();
    else navigateToLibrary();
  }, []);

  const acceptConsent = (): void => {
    updateSettings({ llmConsent: true });
    setConsentOpen(false);
  };

  const send = async (): Promise<void> => {
    const text = input.trim();
    if (text.length === 0 || sending || session === null) return;
    if (offlineRemote) return;
    if (isByot && !llm.byotConfigured) {
      openSettings(undefined, 'ai');
      return;
    }
    if (isLocal && !settings.llmConsent) {
      setConsentOpen(true);
      return;
    }

    const userMessage = newMessage('user', text);
    const withUser: ChatSession = {
      ...session,
      title: session.messages.length === 0 ? chatTitle(text) : session.title,
      messages: [...session.messages, userMessage],
      updatedAt: Date.now(),
    };
    setSession(withUser);
    setInput('');
    setSending(true);
    setStreaming('');
    setSendError(null);
    await putChatSession(withUser);

    try {
      const answer = await llm.generate(withUser.messages, (token) => {
        setStreaming((current) => current + token);
      });
      const withAnswer: ChatSession = {
        ...withUser,
        messages: [...withUser.messages, newMessage('assistant', answer)],
        updatedAt: Date.now(),
      };
      setSession(withAnswer);
      await putChatSession(withAnswer);
      try {
        const summary = await summarizeForKnowledge(llm.generate, text, answer);
        if (summary !== null) {
          await saveKnowledgeRecord(
            makeKnowledgeRecord(
              { kind: 'ai', sentence: text, question: text, summary },
              summary,
            ),
          );
        }
      } catch {
        // A failed summary must not discard the chat answer.
      }
    } catch (cause) {
      setSendError(cause instanceof Error ? cause.message : t('AI model could not be loaded.'));
    } finally {
      setSending(false);
      setStreaming('');
    }
  };

  const startNewChat = (): void => {
    const created = newChatSession();
    void putChatSession(created)
      .then(() => {
        setHistoryOpen(false);
        navigateToChat(created.id);
      })
      .catch(() => push(t('AI model could not be loaded.'), { tone: 'error' }));
  };

  const openHistory = (): void => {
    setHistoryOpen(true);
    void listChatSessions()
      .then(setHistory)
      .catch(() => {
        setHistory([]);
        push(t('AI model could not be loaded.'), { tone: 'error' });
      });
  };

  const removeSession = (id: string): void => {
    if (!window.confirm(t('Delete chat?'))) return;
    void deleteChatSession(id)
      .then(() => {
        setHistory((current) => current.filter((item) => item.id !== id));
        if (session?.id === id) startNewChat();
      })
      .catch(() => push(t('AI model could not be loaded.'), { tone: 'error' }));
  };

  const progressLabel =
    llm.phase === 'downloading'
      ? llm.progress === null
        ? t('Preparing AI…')
        : t('Downloading AI model… {percent}%', { percent: Math.round(llm.progress) })
      : llm.phase === 'loading'
        ? t('Loading AI model…')
        : null;

  if (loading || llm.checking) {
    return (
      <div className="chat-page chat-page--center">
        <Spinner />
        <p>{t('Preparing AI…')}</p>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="chat-page chat-page--center">
        <h1 className="chat-page__gate-title">{t('Chat not found.')}</h1>
        <button type="button" className="button" onClick={startNewChat}>
          {t('New chat')}
        </button>
      </div>
    );
  }

  return (
    <div className="chat-page" data-testid="chat-page">
      <header className="chat-page__header">
        <button type="button" className="icon-button" aria-label={t('Back')} onClick={goBack}>
          <Icon name="arrow-left" />
        </button>
        <div className="chat-page__heading">
          <span className="label">
            {isByot ? t('BYOT') : isOvh ? t('OVHcloud (Free & Unstable)') : t('AI chat')}
          </span>
          <h1 className="chat-page__title">{session?.title ?? t('AI chat')}</h1>
        </div>
        <div className="chat-page__header-actions">
          <button type="button" className="button--text" onClick={openHistory}>
            {t('History')}
          </button>
          <button type="button" className="button--text" onClick={startNewChat}>
            {t('New chat')}
          </button>
        </div>
      </header>

      <main className="chat-page__body">
        {session !== null && session.messages.length === 0 && !sending ? (
          <div className="chat-page__empty">
            <p>{t('No messages yet.')}</p>
            <p>{t('Ask about Japanese grammar, vocabulary, or this book.')}</p>
          </div>
        ) : null}

        {session?.messages.map((message) => (
          <article
            key={message.id}
            className={`chat-message chat-message--${message.role}`}
            data-testid={`chat-message-${message.role}`}
          >
            {message.role === 'assistant' ? (
              <span className="label chat-message__label">{t('AI answer')}</span>
            ) : null}
            {message.role === 'assistant' ? (
              <Markdown className="chat-message__content" source={message.content} />
            ) : (
              <div className="chat-message__content" dir="auto">
                {message.content}
              </div>
            )}
          </article>
        ))}

        {sending ? (
          <article className="chat-message chat-message--assistant" aria-live="polite">
            <span className="label chat-message__label">{t('AI answer')}</span>
            <Markdown
              className="chat-message__content"
              source={streaming.length > 0 ? streaming : progressLabel ?? t('AI is thinking…')}
            />
          </article>
        ) : null}
        {sendError !== null ? (
          <p className="chat-page__error" role="alert">
            {sendError}
          </p>
        ) : null}
        <div ref={endRef} />
      </main>

      {llm.mode === 'off' ? (
        <div className="chat-page__composer-gate" data-testid="chat-composer-gate">
          <p>{t('AI is off. Choose BYOT or Local in Settings.')}</p>
          <button type="button" className="button" onClick={() => openSettings(undefined, 'ai')}>
            {t('Open AI settings')}
          </button>
        </div>
      ) : isByot && !llm.byotConfigured ? (
        <div className="chat-page__composer-gate" data-testid="chat-composer-gate">
          <p>{t('Set up BYOT in Settings.')}</p>
          <button type="button" className="button" onClick={() => openSettings(undefined, 'ai')}>
            {t('Open AI settings')}
          </button>
        </div>
      ) : isLocal && !settings.llmConsent ? (
        <div className="chat-page__composer-gate" data-testid="chat-composer-gate">
          <p>{t('Before you use on-device AI')}</p>
          <p>{t('Small local model. It can make mistakes.')}</p>
          <button type="button" className="button" onClick={() => setConsentOpen(true)}>
            {t('Enable AI')}
          </button>
          {consentOpen ? (
            <AiConsentDialog
              onAccept={acceptConsent}
              onClose={() => setConsentOpen(false)}
            />
          ) : null}
        </div>
      ) : (
        <form
          className="chat-composer"
          onSubmit={(event) => {
            event.preventDefault();
            void send();
          }}
        >
          <label className="label" htmlFor="chat-input">
            {t('Message')}
          </label>
          <div className="chat-composer__row">
            <textarea
              id="chat-input"
              className="chat-composer__input"
              rows={2}
              value={input}
              placeholder={t('Ask about Japanese grammar, vocabulary, or this book.')}
              disabled={sending || offlineRemote}
              onChange={(event) => setInput(event.currentTarget.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  void send();
                }
              }}
            />
            <button
              type="submit"
              className="button"
              disabled={sending || offlineRemote || input.trim().length === 0}
            >
              {t('Send')}
            </button>
          </div>
          <p className="chat-page__note">{t('Your chat stays on this device.')}</p>
          {offlineRemote ? (
            <p className="chat-page__note" data-testid="ai-offline-note">
              {isByot ? t('BYOT needs an internet connection.') : t('OVHcloud needs an internet connection.')}
            </p>
          ) : null}
        </form>
      )}

      {historyOpen ? (
        <Modal
          onClose={() => setHistoryOpen(false)}
          variant="drawer"
          ariaLabel={t('History')}
          className="chat-history"
          panelTestId="chat-history"
        >
          <div className="chat-history__head">
            <span className="label">{t('History')}</span>
            <button
              type="button"
              className="icon-button"
              aria-label={t('Close chat')}
              onClick={() => setHistoryOpen(false)}
            >
              <Icon name="close" />
            </button>
          </div>
          <div className="chat-history__list">
            {history.length === 0 ? (
              <p className="chat-history__empty">{t('No saved chats yet.')}</p>
            ) : (
              history.map((item) => (
                <div className="chat-history__item" key={item.id}>
                  <button
                    type="button"
                    className="chat-history__open"
                    onClick={() => {
                      setHistoryOpen(false);
                      navigateToChat(item.id);
                    }}
                  >
                    {item.title}
                  </button>
                  <button
                    type="button"
                    className="icon-button"
                    aria-label={t('Delete chat?')}
                    onClick={() => removeSession(item.id)}
                  >
                    <Icon name="trash" size={16} />
                  </button>
                </div>
              ))
            )}
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
