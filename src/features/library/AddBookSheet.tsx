import { useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { Icon } from '../../components/Icon';
import { Modal } from '../../components/Modal';
import { Spinner } from '../../components/Spinner';
import type { AozoraImportResult, ImportingState } from './useBookImport';

type AddTab = 'epub' | 'aozora' | 'text';

interface AddBookSheetProps {
  onClose: () => void;
  onChooseEpub: () => void;
  onChooseText: () => void;
  onAozora: (url: string) => Promise<AozoraImportResult>;
  importing: ImportingState | null;
}

const TABS: ReadonlyArray<{ id: AddTab; label: string }> = [
  { id: 'epub', label: 'EPUB' },
  { id: 'aozora', label: 'Aozora' },
  { id: 'text', label: 'Text' },
];

export function AddBookSheet({
  onClose,
  onChooseEpub,
  onChooseText,
  onAozora,
  importing,
}: AddBookSheetProps) {
  const [tab, setTab] = useState<AddTab>('epub');
  const [url, setUrl] = useState('');
  const [error, setError] = useState<string | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const busy = importing !== null;

  const selectTab = (next: AddTab): void => {
    setTab(next);
    setError(null);
  };

  const focusTab = (next: AddTab): void => {
    selectTab(next);
    window.requestAnimationFrame(() => {
      document.getElementById(`add-book-tab-${next}`)?.focus();
    });
  };

  const handleTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number): void => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight' && event.key !== 'Home' && event.key !== 'End') {
      return;
    }
    event.preventDefault();
    const lastIndex = TABS.length - 1;
    const nextIndex =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? lastIndex
          : event.key === 'ArrowLeft'
            ? (index - 1 + TABS.length) % TABS.length
            : (index + 1) % TABS.length;
    const next = TABS[nextIndex];
    if (next !== undefined) focusTab(next.id);
  };

  const submitAozora = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (busy) return;
    if (url.trim().length === 0) {
      setError('Paste an Aozora Bunko card or file URL first.');
      return;
    }

    setError(null);
    const result = await onAozora(url.trim());
    if (result.ok) {
      onClose();
      return;
    }
    setError(result.error);
  };

  return (
    <Modal
      onClose={onClose}
      variant="center"
      ariaLabel="Add a book"
      panelTestId="add-book-sheet"
      initialFocusRef={closeRef}
    >
      <div className="add-book">
        <div className="modal-header add-book__header">
          <div>
            <span className="label">Library</span>
            <h2 className="modal-title">Add a book</h2>
          </div>
          <button
            ref={closeRef}
            type="button"
            className="icon-button"
            aria-label="Close add a book"
            data-testid="add-book-close"
            onClick={onClose}
          >
            <Icon name="close" />
          </button>
        </div>

        <div className="add-book__tabs" role="tablist" aria-label="Book source">
          {TABS.map((entry, index) => (
            <button
              key={entry.id}
              id={`add-book-tab-${entry.id}`}
              type="button"
              role="tab"
              aria-selected={tab === entry.id}
              aria-controls={`add-book-panel-${entry.id}`}
              tabIndex={tab === entry.id ? 0 : -1}
              className="add-book__tab"
              data-testid={`add-book-tab-${entry.id}`}
              onClick={() => selectTab(entry.id)}
              onKeyDown={(event) => handleTabKeyDown(event, index)}
            >
              {entry.label}
            </button>
          ))}
        </div>

        {tab === 'epub' ? (
          <div
            id="add-book-panel-epub"
            role="tabpanel"
            aria-labelledby="add-book-tab-epub"
            className="add-book__panel"
          >
            <p className="add-book__copy">
              Add one or more books from this device. EPUB files stay in your browser and open
              offline once stored.
            </p>
            <button
              type="button"
              className="button add-book__action"
              data-testid="add-epub"
              disabled={busy}
              onClick={onChooseEpub}
            >
              <Icon name="book" size={18} /> Choose EPUB files
            </button>
            <p className="add-book__note">You can also drop EPUB or TXT files on the shelf.</p>
          </div>
        ) : null}

        {tab === 'aozora' ? (
          <div
            id="add-book-panel-aozora"
            role="tabpanel"
            aria-labelledby="add-book-tab-aozora"
            className="add-book__panel"
          >
            <form className="add-book__form" onSubmit={(event) => void submitAozora(event)}>
              <label className="add-book__field-label" htmlFor="aozora-url">
                Work card or file URL
              </label>
              <input
                id="aozora-url"
                className="add-book__input"
                type="url"
                inputMode="url"
                autoComplete="off"
                spellCheck={false}
                placeholder="https://www.aozora.gr.jp/cards/.../card....html"
                value={url}
                disabled={busy}
                aria-invalid={error !== null}
                aria-describedby={error === null ? 'aozora-note' : 'aozora-note aozora-error'}
                onChange={(event) => {
                  setUrl(event.currentTarget.value);
                  if (error !== null) setError(null);
                }}
              />
              {error === null ? null : (
                <p className="add-book__error" role="alert" id="aozora-error" data-testid="aozora-error">
                  {error}
                </p>
              )}
              <div className="add-book__row">
                <button
                  type="submit"
                  className="button add-book__action"
                  data-testid="aozora-submit"
                  disabled={busy || url.trim().length === 0}
                >
                  {busy ? <Spinner /> : null}
                  {busy
                    ? importing?.phase === 'Adding…'
                      ? 'Adding…'
                      : 'Downloading…'
                    : 'Download & add'}
                </button>
                <a
                  className="button--text add-book__external"
                  href="https://www.aozora.gr.jp/"
                  target="_blank"
                  rel="noreferrer"
                >
                  Open Aozora Bunko ↗
                </a>
              </div>
              <p className="add-book__note" id="aozora-note">
                Paste a work&apos;s card page URL. Downloads are fetched through Jina Reader
                because browsers cannot call Aozora directly.
              </p>
            </form>
          </div>
        ) : null}

        {tab === 'text' ? (
          <div
            id="add-book-panel-text"
            role="tabpanel"
            aria-labelledby="add-book-tab-text"
            className="add-book__panel"
          >
            <p className="add-book__copy">
              Bring plain Japanese prose into the reader as a single chapter.
            </p>
            <button
              type="button"
              className="button add-book__action"
              data-testid="add-text"
              disabled={busy}
              onClick={onChooseText}
            >
              <Icon name="book" size={18} /> Choose .txt files
            </button>
            <p className="add-book__note">
              UTF-8 or Shift_JIS. The filename becomes the title.
            </p>
          </div>
        ) : null}
      </div>
    </Modal>
  );
}
