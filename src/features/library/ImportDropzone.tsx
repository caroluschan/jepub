import { Spinner } from '../../components/Spinner';
import { useI18n } from '../../lib/i18n/useI18n';
import type { ImportingState } from './useBookImport';

export function ImportOverlay({ importing }: { importing: ImportingState }) {
  const { t } = useI18n();
  return (
    <div className="import-overlay" role="status" aria-live="polite" data-testid="import-overlay">
      <div className="import-overlay__card">
        <Spinner large />
        <div>
          <p className="label">{t('Importing')}</p>
          <p className="import-overlay__name" lang="ja">
            {importing.fileName}
          </p>
          <p className="import-overlay__phase">{importing.phase}</p>
        </div>
      </div>
    </div>
  );
}

export function DropOverlay() {
  const { t } = useI18n();
  return (
    <div className="drop-overlay" aria-hidden="true">
      <div className="drop-overlay__frame">
        <p className="label">{t('Add to library')}</p>
        <p>{t('Drop EPUB, MOBI, or TXT files to add')}</p>
      </div>
    </div>
  );
}
