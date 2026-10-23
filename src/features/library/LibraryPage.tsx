import { useEffect, useMemo, useRef, useState } from 'react';
import { AppMenu } from '../../components/AppMenu';
import { Icon } from '../../components/Icon';
import { useToast } from '../../components/Toast';
import { useI18n } from '../../lib/i18n/useI18n';
import { deleteBook } from '../../lib/storage';
import type { BookRecord } from '../../lib/types';
import { AddBookSheet } from './AddBookSheet';
import { BookCard, bookPercent } from './BookCard';
import { DeleteBookDialog } from './DeleteBookDialog';
import { EmptyState } from './EmptyState';
import { DropOverlay, ImportOverlay } from './ImportDropzone';
import { useBookImport } from './useBookImport';
import { useLibrary } from './useLibrary';

type SourceFilter = 'all' | 'imported' | 'sample' | 'text' | 'aozora' | 'mobi';
type ReadingFilter = 'all' | 'unread' | 'reading' | 'finished';

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
  const { importing, importFiles, importDroppedFiles, importAozora, importSampleBook } =
    useBookImport();
  const { push } = useToast();
  const { t } = useI18n();
  const epubInputRef = useRef<HTMLInputElement | null>(null);
  const textInputRef = useRef<HTMLInputElement | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [dragDepth, setDragDepth] = useState(0);
  const [pendingDelete, setPendingDelete] = useState<BookRecord | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [query, setQuery] = useState('');
  const [authorFilter, setAuthorFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all');
  const [readingFilter, setReadingFilter] = useState<ReadingFilter>('all');
  const [filtersOpen, setFiltersOpen] = useState(false);

  const openAddSheet = (): void => {
    setAddOpen(true);
  };

  const chooseEpub = (): void => {
    epubInputRef.current?.click();
  };

  const chooseText = (): void => {
    textInputRef.current?.click();
  };

  const handleFiles = (files: FileList | null): void => {
    setAddOpen(false);
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
      push(t('Book removed from this device.'), { tone: 'default' });
    } catch {
      push(t('Could not remove this book. Try again.'), { tone: 'error' });
    } finally {
      setDeleting(false);
    }
  };

  const authors = useMemo(
    () =>
      [...new Set(books.map((book) => book.author.trim()).filter((author) => author.length > 0))].sort(
        (left, right) => left.localeCompare(right),
      ),
    [books],
  );

  useEffect(() => {
    if (authorFilter.length > 0 && !authors.includes(authorFilter)) setAuthorFilter('');
  }, [authorFilter, authors]);

  const activeFilterCount =
    (query.trim().length > 0 ? 1 : 0) +
    (authorFilter.length > 0 ? 1 : 0) +
    (sourceFilter !== 'all' ? 1 : 0) +
    (readingFilter !== 'all' ? 1 : 0);
  const filtersActive = activeFilterCount > 0;

  const filteredBooks = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    return books.filter((book) => {
      if (
        needle.length > 0 &&
        !`${book.title} ${book.author}`.toLocaleLowerCase().includes(needle)
      ) {
        return false;
      }
      if (authorFilter.length > 0 && book.author !== authorFilter) return false;
      if (sourceFilter !== 'all') {
        if (sourceFilter === 'imported') {
          if (book.source !== 'file' && book.source !== 'handler' && book.source !== 'drop') {
            return false;
          }
        } else if (sourceFilter === 'sample' && book.source !== 'sample') {
          return false;
        } else if (sourceFilter === 'text' && book.source !== 'text') {
          return false;
        } else if (sourceFilter === 'aozora' && book.source !== 'aozora') {
          return false;
        } else if (sourceFilter === 'mobi' && book.source !== 'mobi') {
          return false;
        }
      }
      if (readingFilter !== 'all') {
        const percent = bookPercent(book);
        if (readingFilter === 'unread' && book.lastOpenedAt !== null) return false;
        if (readingFilter === 'finished' && percent < 99) return false;
        if (readingFilter === 'reading' && (book.lastOpenedAt === null || percent >= 99)) {
          return false;
        }
      }
      return true;
    });
  }, [authorFilter, books, query, readingFilter, sourceFilter]);

  const clearFilters = (): void => {
    setQuery('');
    setAuthorFilter('');
    setSourceFilter('all');
    setReadingFilter('all');
  };

  const sourceLabel = (source: SourceFilter): string => {
    if (source === 'imported') return t('Imported');
    if (source === 'sample') return t('Sample');
    if (source === 'text') return t('Text');
    if (source === 'aozora') return t('Aozora');
    if (source === 'mobi') return t('MOBI');
    return t('All sources');
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
          <AppMenu onAddBook={openAddSheet} />
        </div>
      </header>

      <main className="library-main">
        {status === 'loading' ? (
          <div className="library-lede" aria-hidden="true">
            <p className="label">{t('Library')}</p>
            <p className="library-tagline" lang="ja">
              日本語を、ゆっくり。
            </p>
          </div>
        ) : null}

        {status === 'loading' ? <LibrarySkeleton /> : null}

        {status === 'error' ? (
          <section className="library-error" role="alert">
            <p className="label">{t('Storage')}</p>
            <h2>{t("JEPUB can't read this browser's storage.")}</h2>
            <p>
              {t('IndexedDB may be blocked in private windows or by a browser setting. Your shelf needs it to keep books on this device.')}
            </p>
            <button type="button" className="button" onClick={() => void refresh()}>
              {t('Retry')}
            </button>
          </section>
        ) : null}

        {status === 'ready' && books.length === 0 ? (
          <EmptyState
            onAdd={openAddSheet}
            onSample={() => void importSampleBook()}
            sampleLoading={sampleLoading}
          />
        ) : null}

        {status === 'ready' && books.length > 0 ? (
          <>
            <div className="library-lede">
              <div>
                <p className="label" aria-live="polite">
                  {filtersActive
                    ? t('Showing {count} of {total}', {
                        count: filteredBooks.length,
                        total: books.length,
                      })
                    : books.length === 1
                      ? t('Library · 1 volume')
                      : t('Library · {count} volumes', { count: books.length })}
                </p>
                <p className="library-tagline" lang="ja">
                  日本語を、ゆっくり。
                </p>
              </div>
              <button
                type="button"
                className={`button button--quiet library-filter-toggle${filtersActive ? ' library-filter-toggle--active' : ''}`}
                aria-expanded={filtersOpen}
                aria-controls="library-filters"
                aria-label={filtersOpen ? t('Hide filters') : t('Show filters')}
                data-testid="library-filter-toggle"
                onClick={() => setFiltersOpen((open) => !open)}
              >
                <Icon name="filter" size={16} />
                <span>{t('Filters')}</span>
                {activeFilterCount > 0 ? (
                  <span className="library-filter-count">{activeFilterCount}</span>
                ) : null}
              </button>
            </div>
            {filtersOpen ? (
              <div id="library-filters" className="library-tools" data-testid="library-tools">
   <div className="library-search">
                <Icon name="search" size={17} />
                <input
                  type="search"
                  value={query}
                  aria-label={t('Search books or authors')}
                  placeholder={t('Search books or authors')}
                  data-testid="library-search"
                  onChange={(event) => setQuery(event.currentTarget.value)}
                />
                {query.length > 0 ? (
                  <button
                    type="button"
                    className="icon-button library-search__clear"
                    aria-label={t('Clear filters')}
                    onClick={() => setQuery('')}
                  >
                    <Icon name="close" size={14} />
                  </button>
                ) : null}
              </div>
              <div className="library-filter-group">
                <select
                  className="library-filter"
                  aria-label={t('Author')}
                  data-testid="filter-author"
                  value={authorFilter}
                  onChange={(event) => setAuthorFilter(event.currentTarget.value)}
                >
                  <option value="">{t('All authors')}</option>
                  {authors.map((author) => (
                    <option value={author} key={author}>
                      {author}
                    </option>
                  ))}
                </select>
                <select
                  className="library-filter"
                  aria-label={t('Source')}
                  data-testid="filter-source"
                  value={sourceFilter}
                  onChange={(event) => setSourceFilter(event.currentTarget.value as SourceFilter)}
                >
                  <option value="all">{t('All sources')}</option>
                  <option value="imported">{sourceLabel('imported')}</option>
                  <option value="sample">{sourceLabel('sample')}</option>
                  <option value="text">{sourceLabel('text')}</option>
                  <option value="aozora">{sourceLabel('aozora')}</option>
                  <option value="mobi">{sourceLabel('mobi')}</option>
                </select>
                <select
                  className="library-filter"
                  aria-label={t('Reading status')}
                  data-testid="filter-status"
                  value={readingFilter}
                  onChange={(event) => setReadingFilter(event.currentTarget.value as ReadingFilter)}
                >
                  <option value="all">{t('All reading statuses')}</option>
                  <option value="unread">{t('Unread')}</option>
                  <option value="reading">{t('In progress')}</option>
                  <option value="finished">{t('Finished')}</option>
                </select>
                {filtersActive ? (
                  <button
                    type="button"
                    className="button--text library-clear"
                    onClick={clearFilters}
                  >
                    {t('Clear filters')}
                  </button>
                ) : null}
              </div>
                          </div>
            ) : null}
            {filteredBooks.length > 0 ? (
              <div className="book-grid">
                {filteredBooks.map((book) => (
                  <BookCard key={book.id} book={book} onDelete={setPendingDelete} />
                ))}
              </div>
            ) : (
              <div className="library-no-results" data-testid="library-no-results">
                <p>{t('No books match.')}</p>
                <p>{t('Try a different search or clear the filters.')}</p>
                <button type="button" className="button" onClick={clearFilters}>
                  {t('Clear filters')}
                </button>
              </div>
            )}
          </>
        ) : null}
      </main>

      <footer className="library-footer">
        <p className="library-footer__storage">
          <span className="library-footer__dot" aria-hidden="true" />
          <span>{t('Stored on this device')}</span>
        </p>
        <p className="library-footer__tag">{t('Japanese EPUB reader')}</p>
      </footer>

      <input
        ref={epubInputRef}
        className="visually-hidden"
        type="file"
        accept=".epub,.mobi,application/epub+zip,application/x-mobipocket-ebook"
        aria-label={t('Choose EPUB / MOBI files')}
        data-testid="epub-input"
        multiple
        onChange={(event) => {
          handleFiles(event.currentTarget.files);
          event.currentTarget.value = '';
        }}
      />
      <input
        ref={textInputRef}
        className="visually-hidden"
        type="file"
        accept=".txt,text/plain"
        aria-label={t('Choose .txt files')}
        data-testid="text-input"
        multiple
        onChange={(event) => {
          handleFiles(event.currentTarget.files);
          event.currentTarget.value = '';
        }}
      />

      {dragDepth > 0 ? <DropOverlay /> : null}
      {importing !== null ? <ImportOverlay importing={importing} /> : null}

      {addOpen ? (
        <AddBookSheet
          onClose={() => setAddOpen(false)}
          onChooseEpub={chooseEpub}
          onChooseText={chooseText}
          onAozora={importAozora}
          importing={importing}
        />
      ) : null}

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
