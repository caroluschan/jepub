import { useEffect, useState } from 'react';
import { Icon } from '../../components/Icon';
import { Markdown } from '../../components/Markdown';
import { Spinner } from '../../components/Spinner';
import { useToast } from '../../components/Toast';
import { useI18n } from '../../lib/i18n/useI18n';
import { newMessage } from '../../lib/chat/session';
import { buildLearningSummaryPrompt } from '../../lib/knowledge/prompts';
import { deleteKnowledgeRecord, listKnowledgeRecords } from '../../lib/storage/db';
import type { KnowledgeRecord } from '../../lib/types';
import { navigateToLibrary } from '../../lib/router';
import { useSettings } from '../settings/SettingsProvider';
import { useLlm } from '../ai/LlmProvider';

export function MyPediaPage() {
  const { t } = useI18n();
  const { push } = useToast();
  const { settings } = useSettings();
  const llm = useLlm();
  const [records, setRecords] = useState<KnowledgeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState('');
  const [summarizing, setSummarizing] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  const canSummarize =
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
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const summarize = async (): Promise<void> => {
    if (!canSummarize || records.length === 0) return;
    setSummarizing(true);
    setSummary('');
    setSummaryError(null);
    try {
      const prompt = buildLearningSummaryPrompt(records);
      const result = await llm.generate(
        [newMessage('user', prompt)],
        (token) => setSummary((current) => current + token),
        500,
      );
      setSummary(result);
    } catch (cause) {
      setSummaryError(cause instanceof Error ? cause.message : t('AI model could not be loaded.'));
    } finally {
      setSummarizing(false);
    }
  };

  const remove = (id: string): void => {
    if (!window.confirm(t('Delete this record?'))) return;
    void deleteKnowledgeRecord(id)
      .then(() => setRecords((current) => current.filter((record) => record.id !== id)))
      .catch(() => push(t('Could not add to MyPedia.'), { tone: 'error' }));
  };

  return (
    <div className="mypedia-page" data-testid="mypedia-page">
      <header className="mypedia-page__header">
        <button
          type="button"
          className="icon-button"
          aria-label={t('Back')}
          onClick={navigateToLibrary}
        >
          <Icon name="arrow-left" />
        </button>
        <div className="mypedia-page__heading">
          <span className="label">{t('Knowledge base')}</span>
          <h1 className="mypedia-page__title">{t('MyPedia')}</h1>
        </div>
        {canSummarize && records.length > 0 ? (
          <button
            type="button"
            className="button button--quiet"
            data-testid="summarize-learning"
            disabled={summarizing}
            onClick={() => void summarize()}
          >
            {summarizing ? t('Summarizing…') : t('Summarize my learning')}
          </button>
        ) : null}
      </header>

      <main className="mypedia-page__body">
        {loading ? (
          <div className="mypedia-page__empty">
            <Spinner />
          </div>
        ) : records.length === 0 ? (
          <div className="mypedia-page__empty">
            <p>{t('No knowledge yet.')}</p>
            <p>{t('Add translations from the sentence panel or ask the AI to build your knowledge base.')}</p>
          </div>
        ) : (
          <>
            {summary.length > 0 || summaryError !== null || summarizing ? (
              <section className="mypedia-summary" aria-live="polite">
                <span className="label">{t('Learning summary')}</span>
                {summaryError !== null ? (
                  <p className="mypedia-page__error">{summaryError}</p>
                ) : (
                  <Markdown source={summary || t('Summarizing…')} />
                )}
              </section>
            ) : null}

            <div className="mypedia-list">
              {records.map((record) => (
                <article className="mypedia-card" key={record.id} data-testid="mypedia-record">
                  <div className="mypedia-card__head">
                    <span className="label">
                      {record.kind === 'translation' ? t('Translation') : t('AI answer')}
                    </span>
                    <button
                      type="button"
                      className="icon-button"
                      aria-label={t('Delete this record?')}
                      onClick={() => remove(record.id)}
                    >
                      <Icon name="trash" size={16} />
                    </button>
                  </div>
                  <p className="mypedia-card__sentence" lang="ja">
                    {record.sentence}
                  </p>
                  {record.translation !== undefined ? (
                    <p className="mypedia-card__body">{record.translation}</p>
                  ) : null}
                  {record.answer !== undefined ? (
                    <div className="mypedia-card__body">
                      <Markdown source={record.answer} />
                    </div>
                  ) : null}
                  <p className="mypedia-card__meta">
                    {new Date(record.createdAt).toLocaleString()}
                  </p>
                </article>
              ))}
            </div>
          </>
        )}

        {!canSummarize && records.length > 0 ? (
          <p className="mypedia-page__note">{t('Enable AI to summarize your learning.')}</p>
        ) : null}
        <p className="mypedia-page__note">{t('MyPedia is stored on this device.')}</p>
      </main>
    </div>
  );
}
