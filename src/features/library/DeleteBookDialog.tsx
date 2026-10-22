import { Modal } from '../../components/Modal';
import { useI18n } from '../../lib/i18n/useI18n';
import type { BookRecord } from '../../lib/types';

interface DeleteBookDialogProps {
  book: BookRecord;
  onCancel: () => void;
  onConfirm: () => void;
  busy: boolean;
}

export function DeleteBookDialog({ book, onCancel, onConfirm, busy }: DeleteBookDialogProps) {
  const { t } = useI18n();
  return (
    <Modal
      onClose={onCancel}
      variant="confirm"
      ariaLabel={t('Remove this book?')}
      panelTestId="delete-dialog"
    >
      <div className="confirm-body">
        <span className="label">{t('Library')}</span>
        <h2>{t('Remove this book?')}</h2>
        <p className="confirm-book" lang="ja">
          {book.title}
        </p>
        <p>
          {t('The EPUB, its reading position, and cached sentence translations will be deleted from this device.')}
        </p>
      </div>
      <div className="confirm-actions">
        <button type="button" className="button button--quiet" onClick={onCancel}>
          {t('Cancel')}
        </button>
        <button
          type="button"
          className="button"
          disabled={busy}
          onClick={onConfirm}
        >
          {busy ? t('Removing…') : t('Remove')}
        </button>
      </div>
    </Modal>
  );
}
