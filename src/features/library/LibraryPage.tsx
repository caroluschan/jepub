import { useRef, useState } from 'react';
import { Icon } from '../../components/Icon';
import { ThemeToggle } from '../../components/ThemeToggle';
import { useToast } from '../../components/Toast';
import { deleteBook } from '../../lib/storage';
import type { BookRecord } from '../../lib/types';
import { BookCard } from './BookCard';
import { DeleteBookDialog } from './DeleteBookDialog';
import { EmptyState } from './EmptyState';
import { DropOverlay, ImportOverlay } from './ImportDropzone';
import { useBookImport } from './useBookImport';
import { useLibrary } from './useLibrary';

function LibrarySkeleton() {
  return (
    <div className="book-grid" aria-hidden="true">
      {[0, 1, 2].map((index) => (
        <div className="book-card book-card--skeleton" key={index}>
          <div className="book-card__cover skeleton-box" />
          <div className="book-card__body">
            <div className="skeleton-line skeleton-line--wide" />
            <div className="skeleton-line" />
            <div className="skeleton-line skeleton-line--short" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function LibraryPage() {
  const { books, status, refresh } = useLibrary();
  const { importing, importFiles, importDroppedFiles, importSampleBook } = useBookImport();
  const { push } = useToast();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [dragDepth, setDragDepth] = useState(0);
  const [pendingDelete, setPendingDelete] = useState<BookRecord | null>(null);
  const [deleting, setDeleting] = useState(false);

  const openPicker = (): void => {
    fileInputRef.current?.click();
  };

  const handleFiles = (files: FileList | null): void => {
    if (files === null) return;
    importFiles(Array.from(files));
  };

  const confirmDelete = async (): Promise<void> => {
    if (pendingDelete === null) return;
    setDeleting(true);
    try {
      await deleteBook(pendingDelete.id);
      setPendingDelete(null);
      await refresh();
      push('Book removed from this device.', { tone: 'default' });
    } catch {
      push('Could not remove this book. Try again.', { tone: 'error' });
    } finally {
      setDeleting(false);
    }
  };

  const sampleLoading = importing !== null && importing.fileName.includes('吾輩');

  return (
    <div
      className="library-page"
      data-testid="library-page"
      onDragEnter={(event) => {
        if (!event.dataTransfer.types.includes('Files')) return;
        event.preventDefault();
        setDragDepth((depth) => depth + 1);
      }}
      onDragOver={(event) => {
        if (!event.dataTransfer.types.includes('Files')) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = 'copy';
      }}
      onDragLeave={(event) => {
        event.preventDefault();
        const next = event.relatedTarget;
        if (next instanceof Node && event.currentTarget.contains(next)) return;
        setDragDepth((depth) => Math.max(0, depth - 1));
      }}
      onDrop={(event) => {
        event.preventDefault();
        setDragDepth(0);
        importDroppedFiles(Array.from(event.dataTransfer.files));
      }}
    >
      <header className="library-header">
        <h1 className="wordmark">
          JEPUB
          <span className="wordmark__rule" aria-hidden="true" />
          <span className="wordmark__label">日本語 EPUB READER</span>
        </h1>
        <div className="library-header__actions">
          <button type="button" className="button button--quiet add-button" onClick={openPicker}>
            <Icon name="plus" size={18} />
            <span>Add EPUB</span>
          </button>
          <ThemeToggle />
        </div>
      </header>

      <main className="library-main">
        {status === 'loading' ? (
          <div className="library-lede" aria-hidden="true">
            <p className="label">Library</p>
            <p className="library-tagline" lang="ja">
              日本語を、ゆっくり。
            </p>
          </div>
        ) : null}

        {status === 'loading' ? <LibrarySkeleton /> : null}

        {status === 'error' ? (
          <section className="library-error" role="alert">
            <p className="label">Storage</p>
            <h2>JEPUB can&apos;t read this browser&apos;s storage.</h2>
            <p>
              IndexedDB may be blocked in private windows or by a browser setting. Your shelf needs
              it to keep books on this device.
            </p>
            <button type="button" className="button" onClick={() => void refresh()}>
              Retry
            </button>
          </section>
        ) : null}

        {status === 'ready' && books.length === 0 ? (
          <EmptyState
            onAdd={openPicker}
            onSample={() => void importSampleBook()}
            sampleLoading={sampleLoading}
          />
        ) : null}

        {status === 'ready' && books.length > 0 ? (
          <>
            <div className="library-lede">
              <div>
                <p className="label">
                  Library · {books.length} {books.length === 1 ? 'volume' : 'volumes'}
                </p>
                <p className="library-tagline" lang="ja">
                  日本語を、ゆっくり。
                </p>
              </div>
            </div>
            <div className="book-grid">
              {books.map((book) => (
                <BookCard key={book.id} book={book} onDelete={setPendingDelete} />
              ))}
            </div>
          </>
        ) : null}
      </main>

      <footer className="library-footer">
        <p className="library-footer__storage">
          <span className="library-footer__dot" aria-hidden="true" />
          <span>Stored on this device</span>
        </p>
        <p className="library-footer__tag">Japanese EPUB reader</p>
      </footer>

      <input
        ref={fileInputRef}
        className="visually-hidden"
        type="file"
        accept=".epub,application/epub+zip"
        aria-label="Choose EPUB files"
        multiple
        onChange={(event) => {
          handleFiles(event.currentTarget.files);
          event.currentTarget.value = '';
        }}
      />

      {dragDepth > 0 ? <DropOverlay /> : null}
      {importing !== null ? <ImportOverlay importing={importing} /> : null}

      {pendingDelete !== null ? (
        <DeleteBookDialog
          book={pendingDelete}
          busy={deleting}
          onCancel={() => setPendingDelete(null)}
          onConfirm={() => void confirmDelete()}
        />
      ) : null}
    </div>
  );
}
