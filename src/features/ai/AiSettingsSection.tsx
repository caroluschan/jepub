import { useState } from 'react';
import { useToast } from '../../components/Toast';
import { useI18n } from '../../lib/i18n/useI18n';
import { useSettings } from '../settings/SettingsProvider';
import { useLlm } from './LlmProvider';
import { AiConsentDialog } from './AiConsentDialog';

export function AiSettingsSection() {
  const { settings, updateSettings } = useSettings();
  const { t } = useI18n();
  const { push } = useToast();
  const llm = useLlm();
  const [consentOpen, setConsentOpen] = useState(false);

  if (llm.checking || llm.support === null || !llm.support.supported) return null;

  const status =
    llm.phase === 'downloading'
      ? llm.progress === null
        ? t('Preparing AI…')
        : t('Downloading AI model… {percent}%', { percent: Math.round(llm.progress) })
      : llm.phase === 'loading'
        ? t('Loading AI model…')
        : llm.phase === 'ready'
          ? t('AI is ready.')
          : llm.phase === 'error'
            ? llm.error ?? t('AI model could not be loaded.')
            : settings.llmConsent
              ? t('The model downloads once, when you first ask.')
              : t('AI is off.');

  const enable = (): void => {
    if (settings.llmConsent) {
      updateSettings({ llmConsent: false });
    } else {
      setConsentOpen(true);
    }
  };

  const download = (): void => {
    void llm.ensureReady().catch(() => {
      push(t('AI model could not be loaded.'), { tone: 'error' });
    });
  };

  const remove = (): void => {
    void llm
      .resetModel()
      .then(() => push(t('AI model removed.'), { tone: 'success' }))
      .catch(() => push(t('AI model could not be loaded.'), { tone: 'error' }));
  };

  return (
    <section className="settings-group" aria-labelledby="settings-ai">
      <div className="settings-group__head">
        <h3 className="settings-group__title" id="settings-ai">
          {t('AI settings')}
        </h3>
      </div>
      <div className="settings-section">
        <div className="settings-row">
          <div className="settings-row__copy">
            <span className="settings-row__title">{t('On-device AI')}</span>
            <span className="settings-row__note">
              {t('About 645 MB. It runs locally and may be slow or inaccurate.')}
            </span>
          </div>
          <button
            type="button"
            className="switch"
            role="switch"
            aria-checked={settings.llmConsent}
            aria-label={t('On-device AI')}
            onClick={enable}
          >
            <span className="switch__track" aria-hidden="true" />
          </button>
        </div>

        <p className="settings-row__note" data-testid="ai-status">
          {status}
        </p>

        {settings.llmConsent && llm.phase === 'idle' ? (
          <button type="button" className="button button--quiet settings-retry" onClick={download}>
            {t('Download and enable')}
          </button>
        ) : null}

        {llm.phase === 'ready' ? (
          <button type="button" className="button--text settings-retry" onClick={remove}>
            {t('Remove AI model')}
          </button>
        ) : null}
      </div>

      {consentOpen ? (
        <AiConsentDialog
          onAccept={() => {
            updateSettings({ llmConsent: true });
            setConsentOpen(false);
          }}
          onClose={() => setConsentOpen(false)}
        />
      ) : null}
    </section>
  );
}
