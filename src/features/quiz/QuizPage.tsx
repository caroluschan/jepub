import { useEffect, useRef, useState } from 'react';
import { Icon } from '../../components/Icon';
import { Spinner } from '../../components/Spinner';
import { useI18n } from '../../lib/i18n/useI18n';
import { newMessage } from '../../lib/chat/session';
import { buildQuizPrompt, parseQuizQuestion } from '../../lib/knowledge/prompts';
import { listKnowledgeRecords } from '../../lib/storage/db';
import type { KnowledgeRecord, QuizQuestion } from '../../lib/types';
import { navigateToLibrary, navigateToMyPedia } from '../../lib/router';
import { useSettings } from '../settings/SettingsProvider';
import { useLlm } from '../ai/LlmProvider';
import { AiConsentDialog } from '../ai/AiConsentDialog';

type QuizState = 'idle' | 'loading' | 'ready' | 'error';

export function QuizPage() {
  const { t, language } = useI18n();
  const { settings, updateSettings, openSettings } = useSettings();
  const llm = useLlm();
  const [records, setRecords] = useState<KnowledgeRecord[]>([]);
  const [question, setQuestion] = useState<QuizQuestion | null>(null);
  const [state, setState] = useState<QuizState>('idle');
  const [selected, setSelected] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [consentOpen, setConsentOpen] = useState(false);
  const [loadingRecords, setLoadingRecords] = useState(true);
  const currentIdRef = useRef<string | null>(null);
  const startedRef = useRef(false);

  const needsLocalConsent = llm.mode === 'local' && llm.canUse && !settings.llmConsent;
  const quizAvailable =
    llm.canUse && (llm.mode === 'local' ? settings.llmConsent : llm.online);

  useEffect(() => {
    let active = true;
    void listKnowledgeRecords()
      .then((items) => {
        if (active) setRecords(items);
      })
      .catch(() => {
        if (active) setRecords([]);
      })
      .finally(() => {
        if (active) setLoadingRecords(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const generateQuestion = async (avoidId?: string): Promise<void> => {
    if (!quizAvailable || records.length === 0) return;
    setState('loading');
    setQuestion(null);
    setSelected(null);
    setError(null);
    const pool = records.length > 1 ? records.filter((record) => record.id !== avoidId) : records;
    const record = pool[Math.floor(Math.random() * pool.length)] ?? records[0];
    if (record === undefined) return;
    currentIdRef.current = record.id;
    try {
      const raw = await llm.generate(
        [newMessage('user', buildQuizPrompt(record, language))],
        () => undefined,
        450,
      );
      setQuestion(parseQuizQuestion(raw));
      setState('ready');
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : t('Quiz question could not be generated.'),
      );
      setState('error');
    }
  };

  useEffect(() => {
    if (startedRef.current || !quizAvailable || loadingRecords || records.length === 0) return;
    startedRef.current = true;
    void generateQuestion();
  }, [generateQuestion, loadingRecords, quizAvailable, records]);

  const acceptConsent = (): void => {
    updateSettings({ llmConsent: true });
    setConsentOpen(false);
  };

  return (
    <div className="quiz-page" data-testid="quiz-page">
      <header className="quiz-page__header">
        <button type="button" className="icon-button" aria-label={t('Back')} onClick={navigateToLibrary}>
          <Icon name="arrow-left" />
        </button>
        <div className="quiz-page__heading">
          <span className="label">{t('Knowledge base')}</span>
          <h1 className="quiz-page__title">{t('Quiz')}</h1>
        </div>
      </header>

      <main className="quiz-page__body">
        {loadingRecords || llm.checking ? (
          <div className="quiz-page__center">
            <Spinner />
          </div>
        ) : !llm.canUse ? (
          <div className="quiz-page__gate">
            <h2>{t('Quiz needs an AI service.')}</h2>
            <p>{t('Enable AI in Settings to use the quiz.')}</p>
            <button type="button" className="button" onClick={() => openSettings()}>
              {t('Open AI settings')}
            </button>
          </div>
        ) : needsLocalConsent ? (
          <div className="quiz-page__gate">
            <h2>{t('Before you use on-device AI')}</h2>
            <p>{t('Small local model. It can make mistakes.')}</p>
            <button type="button" className="button" onClick={() => setConsentOpen(true)}>
              {t('Enable AI')}
            </button>
            {consentOpen ? (
              <AiConsentDialog onAccept={acceptConsent} onClose={() => setConsentOpen(false)} />
            ) : null}
          </div>
        ) : !quizAvailable ? (
          <div className="quiz-page__gate">
            <h2>{t('The quiz needs an internet connection.')}</h2>
            <p>{t('Enable AI in Settings to use the quiz.')}</p>
            <button type="button" className="button" onClick={() => openSettings()}>
              {t('Open AI settings')}
            </button>
          </div>
        ) : records.length === 0 ? (
          <div className="quiz-page__empty">
            <h2>{t('No knowledge records yet.')}</h2>
            <p>{t('Add translations from the sentence panel or ask the AI to build your knowledge base.')}</p>
            <button type="button" className="button" onClick={navigateToMyPedia}>
              {t('MyPedia')}
            </button>
          </div>
        ) : state === 'error' ? (
          <div className="quiz-page__gate">
            <h2>{t('Quiz question could not be generated.')}</h2>
            <p>{error}</p>
            <button
              type="button"
              className="button"
              onClick={() => {
                startedRef.current = true;
                void generateQuestion(currentIdRef.current ?? undefined);
              }}
            >
              {t('Try again')}
            </button>
          </div>
        ) : state === 'loading' ? (
          <div className="quiz-page__center">
            <Spinner />
            <p>
              {llm.phase === 'downloading' && llm.progress !== null
                ? t('Downloading AI model… {percent}%', { percent: Math.round(llm.progress) })
                : llm.phase === 'loading'
                  ? t('Loading AI model…')
                  : t('AI is thinking…')}
            </p>
          </div>
        ) : question !== null ? (
          <section className="quiz-card" aria-live="polite">
            <p className="label">{t('Question')}</p>
            <h2 className="quiz-card__question">{question.question}</h2>
            <div className="quiz-options">
              {question.options.map((option, index) => {
                const answered = selected !== null;
                const correct = index === question.answer;
                const chosen = index === selected;
                return (
                  <button
                    type="button"
                    key={option}
                    className={[
                      'quiz-option',
                      answered && correct ? 'quiz-option--correct' : '',
                      answered && chosen && !correct ? 'quiz-option--wrong' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    disabled={answered}
                    onClick={() => setSelected(index)}
                  >
                    <span className="quiz-option__letter">{String.fromCharCode(65 + index)}</span>
                    <span>{option}</span>
                  </button>
                );
              })}
            </div>
            {selected !== null ? (
              <div className="quiz-result">
                <p className="quiz-result__title">
                  {selected === question.answer ? t('Correct') : t('Not quite')}
                </p>
                <p>{question.explanation}</p>
                <button
                  type="button"
                  className="button"
                  onClick={() => {
                    startedRef.current = true;
                    void generateQuestion(currentIdRef.current ?? undefined);
                  }}
                >
                  {t('Next question')}
                </button>
              </div>
            ) : (
              <p className="quiz-page__note">{t('Choose the correct answer.')}</p>
            )}
          </section>
        ) : null}
      </main>
    </div>
  );
}
