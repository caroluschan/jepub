import { useMemo, useState } from 'react';
import { Markdown } from '../../components/Markdown';
import { useToast } from '../../components/Toast';
import { useI18n } from '../../lib/i18n/useI18n';
import { chatTitle, newChatSession, newMessage } from '../../lib/chat/session';
import { buildSentencePrompt, readingsFromRuby } from '../../lib/llm/prompt';
import { getByotProvider } from '../../lib/llm/byot';
import type { ByotProviderId } from '../../lib/types';
import { putChatSession } from '../../lib/storage/db';
import { navigateToChat } from '../../lib/router';
import { useSettings } from '../settings/SettingsProvider';
import { useLlm } from './LlmProvider';
import { AiConsentDialog } from './AiConsentDialog';

interface AskAiSectionProps {
  sentence: string;
  rubyHtml: string | null;
  romaji: string | null;
  translation: string | null;
}

type AskState = 'idle' | 'loading' | 'ready' | 'error';

export function AskAiSection({
  sentence,
  rubyHtml,
  romaji,
  translation,
}: AskAiSectionProps) {
  const { settings, updateSettings } = useSettings();
  const { t } = useI18n();
  const { push } = useToast();
  const llm = useLlm();
  const [consentOpen, setConsentOpen] = useState(false);
  const [askState, setAskState] = useState<AskState>('idle');
  const [answer, setAnswer] = useState('');
  const [error, setError] = useState<string | null>(null);

  const prompt = useMemo(
    () =>
      buildSentencePrompt({
        sentence,
        readings: readingsFromRuby(rubyHtml),
        romaji,
        translation,
      }),
    [romaji, rubyHtml, sentence, translation],
  );

  if (llm.checking || !llm.canUse) return null;
  const isLocal = llm.mode === 'local';
  const isOfflineByot = llm.mode === 'byot' && !llm.online;

  const run = async (): Promise<void> => {
    setAskState('loading');
    setAnswer('');
    setError(null);
    const userMessage = newMessage('user', prompt);
    try {
      const result = await llm.generate([userMessage], (token) => {
        setAnswer((current) => current + token);
      });
      setAnswer(result);
      setAskState('ready');
    } catch (cause) {
      setAskState('error');
      setError(cause instanceof Error ? cause.message : t('AI model could not be loaded.'));
    }
  };

  const ask = (): void => {
    if (isOfflineByot) return;
    if (isLocal && !settings.llmConsent) {
      setConsentOpen(true);
      return;
    }
    void run();
  };

  const acceptConsent = (): void => {
    updateSettings({ llmConsent: true });
    setConsentOpen(false);
    void run();
  };

  const chatMore = (): void => {
    if (answer.length === 0) return;
    const session = newChatSession({
      title: chatTitle(sentence),
      sentence,
      messages: [newMessage('user', sentence), newMessage('assistant', answer)],
    });
    void putChatSession(session)
      .then(() => navigateToChat(session.id))
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

  return (
    <div className="sentence-sheet__ai" data-testid="ask-ai">
      <div className="sentence-sheet__ai-head">
        <span className="label">{isLocal ? t('On-device AI') : t('BYOT')}</span>
        <span className="provider-chip">
          {isLocal
            ? t('Small local model. It can make mistakes.')
            : t('Your key, sent directly to {provider}.', {
                provider: getProviderLabel(settings.aiProvider),
              })}
        </span>
      </div>

      {progressLabel !== null && askState === 'loading' ? (
        <p className="sentence-sheet__ai-progress">{progressLabel}</p>
      ) : null}

      {askState === 'loading' && progressLabel === null ? (
        <p className="sentence-sheet__ai-progress" aria-live="polite">
          {t('AI is thinking…')}
        </p>
      ) : null}

      {askState === 'error' ? (
        <p className="sentence-sheet__ai-error" role="alert">
          {error ?? t('AI model could not be loaded.')}
        </p>
      ) : null}

      {answer.length > 0 ? (
        <div className="sentence-sheet__ai-answer" aria-live="polite">
          <Markdown source={answer} />
        </div>
      ) : null}

      <div className="sentence-sheet__ai-actions">
        <button
          type="button"
          className="button button--quiet"
          data-testid="ask-ai-button"
          disabled={askState === 'loading' || isOfflineByot}
          onClick={ask}
        >
          {t('Ask AI')}
        </button>
        {askState === 'ready' ? (
          <button type="button" className="button--text" data-testid="chat-more" onClick={chatMore}>
            {t('Chat More')}
          </button>
        ) : null}
      </div>

      {isOfflineByot ? (
        <p className="sentence-sheet__ai-progress" data-testid="ai-offline-note">
          {t('BYOT needs an internet connection.')}
        </p>
      ) : null}

      {isLocal && consentOpen ? (
        <AiConsentDialog onAccept={acceptConsent} onClose={() => setConsentOpen(false)} />
      ) : null}
    </div>
  );
}

function getProviderLabel(provider: ByotProviderId): string {
  return getByotProvider(provider).label;
}
