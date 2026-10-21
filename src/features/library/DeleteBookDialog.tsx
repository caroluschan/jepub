import { Modal } from '../../components/Modal';
import type { BookRecord } from '../../lib/types';

interface DeleteBookDialogProps {
  book: BookRecord;
  onCancel: () => void;
  onConfirm: () => void;
  busy: boolean;
}

export function DeleteBookDialog({ book, onCancel, onConfirm, busy }: DeleteBookDialogProps) {
  return (
    <Modal
      onClose={onCancel}
      variant="confirm"
      ariaLabel="Remove this book?"
      panelTestId="delete-dialog"
    >
      <div className="confirm-body">
        <span className="label">Library</span>
        <h2>Remove this book?</h2>
        <p className="confirm-book" lang="ja">
          {book.title}
        </p>
        <p>
          The EPUB, its reading position, and cached sentence translations will be deleted
          from this device.
        </p>
      </div>
      <div className="confirm-actions">
        <button type="button" className="button button--quiet" onClick={onCancel}>
          Cancel
        </button>
        <button
          type="button"
          className="button"
          disabled={busy}
          onClick={onConfirm}
        >
          {busy ? 'Removing…' : 'Remove'}
        </button>
      </div>
    </Modal>
  );
}
