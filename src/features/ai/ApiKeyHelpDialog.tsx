import { Modal } from '../../components/Modal';
import { useI18n } from '../../lib/i18n/useI18n';
import { getByotProvider } from '../../lib/llm/byot';
import { API_KEY_HELP } from '../../lib/llm/apiKeyHelp';
import type { ByotProviderId } from '../../lib/types';

interface ApiKeyHelpDialogProps {
  provider: ByotProviderId;
  onClose: () => void;
}

export function ApiKeyHelpDialog({ provider, onClose }: ApiKeyHelpDialogProps) {
  const { t } = useI18n();
  const definition = getByotProvider(provider);
  const help = API_KEY_HELP[provider];

  return (
    <Modal
      onClose={onClose}
      variant="center"
      className="api-key-help"
      ariaLabel={t('How to get an API key')}
      panelTestId="api-key-help"
    >
      <div className="api-key-help__head">
        <span className="label">{definition.label}</span>
        <h2 className="api-key-help__title">
          {t('Get your {provider} API key', { provider: definition.label })}
        </h2>
      </div>
      <ol className="api-key-help__steps">
        {help.steps.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
      {help.note !== undefined ? <p className="api-key-help__note">{help.note}</p> : null}
      <div className="api-key-help__actions">
        {help.consoleUrl.length > 0 ? (
          <a className="button" href={help.consoleUrl} target="_blank" rel="noreferrer">
            {t('Open provider console')}
          </a>
        ) : null}
        {help.docsUrl.length > 0 ? (
          <a className="button button--quiet" href={help.docsUrl} target="_blank" rel="noreferrer">
            {t('Read official documentation')}
          </a>
        ) : null}
        <button type="button" className="button--text" onClick={onClose}>
          {t('Close')}
        </button>
      </div>
    </Modal>
  );
}
