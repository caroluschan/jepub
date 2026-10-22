import { useRef } from 'react';
import { Modal } from '../../components/Modal';
import { useI18n } from '../../lib/i18n/useI18n';

interface AiConsentDialogProps {
  onAccept: () => void;
  onClose: () => void;
}

export function AiConsentDialog({ onAccept, onClose }: AiConsentDialogProps) {
  const { t } = useI18n();
  const cancelRef = useRef<HTMLButtonElement | null>(null);

  return (
    <Modal
      onClose={onClose}
      variant="confirm"
      ariaLabel={t('AI consent')}
      className="ai-consent"
      initialFocusRef={cancelRef}
      panelTestId="ai-consent"
    >
      <div className="ai-consent__head">
        <span className="label">{t('On-device AI')}</span>
        <h2 className="ai-consent__title">{t('Before you use on-device AI')}</h2>
      </div>
      <p className="ai-consent__copy">
        {t(
          'JEPUB will download a small local model (about 645 MB) to this device. It runs entirely on this device. It may be slow, use battery, and make mistakes.',
        )}
      </p>
      <p className="ai-consent__note">{t('The model downloads once, when you first ask.')}</p>
      <div className="ai-consent__actions">
        <button ref={cancelRef} type="button" className="button button--quiet" onClick={onClose}>
          {t('Not now')}
        </button>
        <button type="button" className="button" onClick={onAccept}>
          {t('Download and enable')}
        </button>
      </div>
    </Modal>
  );
}
