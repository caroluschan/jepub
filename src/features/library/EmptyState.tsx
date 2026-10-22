import { Icon } from '../../components/Icon';
import { useI18n } from '../../lib/i18n/useI18n';

interface EmptyStateProps {
  onAdd: () => void;
  onSample: () => void;
  sampleLoading: boolean;
}

export function EmptyState({ onAdd, onSample, sampleLoading }: EmptyStateProps) {
  const { t } = useI18n();
  return (
    <section className="empty-state" data-testid="empty-state" aria-labelledby="empty-title">
      <div className="empty-state__glyph" lang="ja" aria-hidden="true">
        本
      </div>
      <p className="label">{t('Your shelf')}</p>
      <h2 id="empty-title">{t('Your shelf is empty.')}</h2>
      <p className="empty-state__copy">
        {t('Bring an EPUB, MOBI, a plain text file, or a work from Aozora Bunko onto this device. Books stay here, in your browser, and work offline once opened.')}
      </p>
      <div className="empty-state__actions">
        <button type="button" className="button" onClick={onAdd}>
          <Icon name="plus" size={18} /> {t('Add a book')}
        </button>
        <button
          type="button"
          className="button--text"
          data-testid="sample-button"
          disabled={sampleLoading}
          onClick={onSample}
        >
          {sampleLoading ? t('Adding sample…') : t('Read the sample — 吾輩は猫である（抄）')}
        </button>
      </div>
      <p className="empty-state__tagline" lang="ja">
        日本語を、ゆっくり。
      </p>
    </section>
  );
}
