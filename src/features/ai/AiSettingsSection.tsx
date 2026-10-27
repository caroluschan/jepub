import { useEffect, useState } from 'react';
import { Icon } from '../../components/Icon';
import { useToast } from '../../components/Toast';
import { useI18n } from '../../lib/i18n/useI18n';
import { BYOT_PROVIDERS, fetchByotModels, getByotProvider } from '../../lib/llm/byot';
import type { AiMode, ByotProviderId } from '../../lib/types';
import { useSettings } from '../settings/SettingsProvider';
import { useLlm } from './LlmProvider';
import { AiConsentDialog } from './AiConsentDialog';
import { ApiKeyHelpDialog } from './ApiKeyHelpDialog';
import { newMessage } from '../../lib/chat/session';

export function AiSettingsSection() {
  const { settings, updateSettings } = useSettings();
  const { t } = useI18n();
  const { push } = useToast();
  const llm = useLlm();
  const [consentOpen, setConsentOpen] = useState(false);
  const [models, setModels] = useState<string[]>([]);
  const [modelsState, setModelsState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [modelsError, setModelsError] = useState<string | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [customModelMode, setCustomModelMode] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  const provider = getByotProvider(settings.aiProvider);
  const localAvailable = llm.support?.supported === true;
  const mode: AiMode = settings.aiMode === 'local' && !localAvailable ? 'off' : settings.aiMode;
  const isLocal = mode === 'local';
  const isByot = mode === 'byot';
  const isOvh = mode === 'ovh';
  const modelInList = models.includes(settings.aiModel);
  const showCustomModel =
    customModelMode || (modelsState === 'ready' && settings.aiModel.length > 0 && !modelInList);
  const canTest =
    mode === 'local'
      ? settings.llmConsent
      : mode === 'byot'
        ? llm.byotConfigured && llm.online
        : mode === 'ovh'
          ? llm.online
          : false;

  useEffect(() => {
    if (!isByot) return;
    const key = settings.aiApiKey.trim();
    const base = settings.aiBaseUrl.trim();
    if (settings.aiProvider !== 'custom' && settings.aiProvider !== 'openrouter' && key.length === 0) {
      setModels([]);
      setModelsState('idle');
      return;
    }
    if (settings.aiProvider === 'custom' && base.length === 0) {
      setModels([]);
      setModelsState('idle');
      return;
    }

    let active = true;
    setModelsState('loading');
    setModelsError(null);
    const timer = window.setTimeout(() => {
      void fetchByotModels({
        provider: settings.aiProvider,
        apiKey: settings.aiApiKey,
        model: settings.aiModel,
        baseUrl: settings.aiBaseUrl,
      })
        .then((names) => {
          if (!active) return;
          setModels(names);
          setModelsState('ready');
        })
        .catch(() => {
          if (!active) return;
          setModels([]);
          setModelsState('error');
          setModelsError(t('Models could not be loaded. You can type a model ID instead.'));
        });
    }, 700);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [
    isByot,
    settings.aiApiKey,
    settings.aiBaseUrl,
    settings.aiProvider,
    t,
  ]);

  const changeMode = (next: AiMode): void => {
    if (next === 'local' && !localAvailable) return;
    if (next === 'local' && !settings.llmConsent) {
      setConsentOpen(true);
      return;
    }
    updateSettings({ aiMode: next });
  };

  const changeProvider = (next: ByotProviderId): void => {
    const definition = getByotProvider(next);
    setCustomModelMode(false);
    updateSettings({
      aiProvider: next,
      aiModel: definition.defaultModel,
      aiBaseUrl: next === 'custom' ? settings.aiBaseUrl : '',
    });
  };

  const refreshModels = (): void => {
    setModelsState('loading');
    setModelsError(null);
    void fetchByotModels({
      provider: settings.aiProvider,
      apiKey: settings.aiApiKey,
      model: settings.aiModel,
      baseUrl: settings.aiBaseUrl,
    })
      .then((names) => {
        setModels(names);
        setModelsState('ready');
      })
      .catch(() => {
        setModels([]);
        setModelsState('error');
        setModelsError(t('Models could not be loaded. You can type a model ID instead.'));
      });
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

  const localStatus =
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

  return (
    <section className="settings-group" aria-labelledby="settings-ai">
      <div className="settings-group__head">
        <h3 className="settings-group__title" id="settings-ai">
          {t('AI service')}
        </h3>
      </div>
      <div className="settings-section">
        <div className="settings-row__copy">
          <label className="settings-row__title" htmlFor="ai-mode">
            {t('AI mode')}
          </label>
          <span className="settings-row__note">
            {t('Choose how JEPUB should answer AI questions.')}
          </span>
        </div>
        <select
          id="ai-mode"
          className="settings-select"
          data-testid="ai-mode"
          value={mode}
          onChange={(event) => changeMode(event.currentTarget.value as AiMode)}
        >
          <option value="off">{t('Off')}</option>
          <option value="byot">{t('BYOT')}</option>
          {localAvailable ? <option value="local">{t('Local')}</option> : null}
          <option value="ovh">{t('OVHcloud (Free & Unstable)')}</option>
        </select>

        {mode === 'off' ? (
          <p className="settings-row__note" data-testid="ai-status">
            {t('AI is off. Choose BYOT or Local in Settings.')}
          </p>
        ) : null}

        {isByot ? (
          <div className="ai-byot" data-testid="ai-byot">
            <label className="settings-row__title" htmlFor="ai-provider">
              {t('Provider')}
            </label>
            <select
              id="ai-provider"
              className="settings-select"
              data-testid="ai-provider"
              value={settings.aiProvider}
              onChange={(event) =>
                changeProvider(event.currentTarget.value as ByotProviderId)
              }
            >
              {BYOT_PROVIDERS.map((entry) => (
                <option value={entry.id} key={entry.id}>
                  {entry.label}
                </option>
              ))}
            </select>

            {settings.aiProvider === 'custom' ? (
              <>
                <label className="settings-row__title" htmlFor="ai-base-url">
                  {t('Custom base URL')}
                </label>
                <input
                  id="ai-base-url"
                  className="settings-input"
                  data-testid="ai-base-url"
                  type="url"
                  placeholder="https://example.com/v1"
                  value={settings.aiBaseUrl}
                  onChange={(event) =>
                    updateSettings({ aiBaseUrl: event.currentTarget.value })
                  }
                />
              </>
            ) : null}

            <div className="settings-row">
              <label className="settings-row__title" htmlFor="ai-api-key">
                {t('API key')}
              </label>
              <button
                type="button"
                className="icon-button"
                aria-label={t('How to get an API key')}
                data-testid="ai-key-help"
                onClick={() => setHelpOpen(true)}
              >
                <Icon name="help" size={17} />
              </button>
            </div>
            <input
              id="ai-api-key"
              className="settings-input"
              data-testid="ai-api-key"
              type="password"
              autoComplete="off"
              spellCheck={false}
              value={settings.aiApiKey}
              onChange={(event) =>
                updateSettings({ aiApiKey: event.currentTarget.value })
              }
            />

            <div className="settings-row">
              <label className="settings-row__title" htmlFor="ai-model">
                {t('Model')}
              </label>
              <button type="button" className="button--text" onClick={refreshModels}>
                {t('Refresh models')}
              </button>
            </div>
            {modelsState === 'ready' && models.length > 0 ? (
              <select
                id="ai-model"
                className="settings-select"
                data-testid="ai-model-select"
                value={showCustomModel ? '__custom__' : settings.aiModel}
                onChange={(event) => {
                  const value = event.currentTarget.value;
                  if (value === '__custom__') {
                    setCustomModelMode(true);
                    return;
                  }
                  setCustomModelMode(false);
                  updateSettings({ aiModel: value });
                }}
              >
                <option value="">{t('Select a model')}</option>
                {models.map((name) => (
                  <option value={name} key={name}>
                    {name}
                  </option>
                ))}
                <option value="__custom__">{t('Custom model ID…')}</option>
              </select>
            ) : null}
            {modelsState !== 'ready' || models.length === 0 || showCustomModel ? (
              <input
                id={modelsState === 'ready' && models.length > 0 ? 'ai-custom-model' : 'ai-model'}
                className="settings-input"
                data-testid="ai-model"
                placeholder={t('Enter a model ID')}
                value={settings.aiModel}
                onChange={(event) =>
                  updateSettings({ aiModel: event.currentTarget.value })
                }
              />
            ) : null}

            <p className="settings-row__note" data-testid="ai-models-status">
              {modelsState === 'loading'
                ? t('Loading models…')
                : modelsState === 'error'
                  ? modelsError
                  : modelsState === 'ready' && models.length > 0
                    ? t('{count} models available.', { count: models.length })
                    : t('The model list is optional; type the model ID if it is not listed.')}
            </p>
            <p className="settings-row__note">
              {t('Your API key is stored in this browser and sent directly to the provider. Use a restricted key.')}
            </p>
            {!llm.online ? (
              <p className="settings-row__note" data-testid="ai-offline-note">
                {t('BYOT needs an internet connection.')}
              </p>
            ) : null}
            <p className="settings-row__note">
              {t('Your key, sent directly to {provider}.', { provider: provider.label })}
            </p>
          </div>
        ) : null}

        {isOvh ? (
          <div className="ai-byot" data-testid="ai-ovh">
            <div className="settings-row__copy">
              <span className="settings-row__title">{t('OVHcloud (Free & Unstable)')}</span>
              <span className="settings-row__note">
                {t('OVHcloud is a free, unauthenticated endpoint. It may be slow or unavailable.')}
              </span>
            </div>
            <p className="settings-row__note">Model: mistral@latest</p>
            {!llm.online ? (
              <p className="settings-row__note" data-testid="ai-offline-note">
                {t('OVHcloud needs an internet connection.')}
              </p>
            ) : null}
          </div>
        ) : null}

        {isLocal ? (
          <div data-testid="ai-local">
            <div className="settings-row__copy">
              <span className="settings-row__title">{t('Local model')}</span>
              <span className="settings-row__note">
                {t('About 645 MB. It runs locally and may be slow or inaccurate.')}
              </span>
            </div>
            <p className="settings-row__note" data-testid="ai-status">
              {localStatus}
            </p>
            {llm.phase === 'idle' ? (
              <button
                type="button"
                className="button button--quiet settings-retry"
                onClick={download}
              >
                {t('Download and enable')}
              </button>
            ) : null}
            {llm.phase === 'ready' ? (
              <button type="button" className="button--text settings-retry" onClick={remove}>
                {t('Remove AI model')}
              </button>
            ) : null}
          </div>
        ) : null}

        {canTest ? (
          <div className="ai-test" data-testid="ai-test">
            <button
              type="button"
              className="button button--quiet settings-retry"
              disabled={testing}
              onClick={() => {
                setTesting(true);
                setTestResult(null);
                void llm
                  .generate(
                    [newMessage('user', 'Reply with exactly: OK')],
                    () => undefined,
                    20,
                  )
                  .then(() => setTestResult({ ok: true, message: t('AI service works.') }))
                  .catch((cause: unknown) =>
                    setTestResult({
                      ok: false,
                      message:
                        cause instanceof Error ? cause.message : t('AI test failed.'),
                    }),
                  )
                  .finally(() => setTesting(false));
              }}
            >
              {testing ? t('Testing…') : t('Test AI')}
            </button>
            {testResult !== null ? (
              <p
                className={`ai-test__result ${testResult.ok ? 'ai-test__result--ok' : 'ai-test__result--error'}`}
                data-testid="ai-test-result"
              >
                {testResult.message}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>

      {helpOpen ? (
        <ApiKeyHelpDialog provider={settings.aiProvider} onClose={() => setHelpOpen(false)} />
      ) : null}

      {consentOpen ? (
        <AiConsentDialog
          onAccept={() => {
            updateSettings({ llmConsent: true, aiMode: 'local' });
            setConsentOpen(false);
          }}
          onClose={() => setConsentOpen(false)}
        />
      ) : null}
    </section>
  );
}
