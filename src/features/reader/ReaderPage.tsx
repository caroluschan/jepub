import { useEffect, useRef, useState } from 'react';
import { useToast } from '../../components/Toast';
import { useI18n } from '../../lib/i18n/useI18n';
import { navigateToLibrary } from '../../lib/router';
import { getBook, getChapterSet, updateProgress } from '../../lib/storage';
import type { BookRecord, ChapterSet } from '../../lib/types';
import { ReaderSession } from './ReaderSession';

type LoadState =
  | { status: 'loading' }
  | { status: 'ready'; book: BookRecord; chapterSet: ChapterSet }
  | { status: 'error' };

function ReaderError({ onBack }: { onBack: () => void }) {
  const { t } = useI18n();
  return (
    <div className="reader-page reader-page--error" data-testid="reader-page">
      <div className="reader-error" role="alert">
        <p className="label">JEPUB</p>
        <h1>{t('This book could not be opened.')}</h1>
        <p>{t('The stored copy may be incomplete, or it was removed from this device.')}</p>
        <button type="button" className="button" onClick={onBack}>
          {t('Back to library')}
        </button>
      </div>
    </div>
  );
}

const SKELETON_WIDTHS = ['94%', '88%', '96%', '72%', '92%', '90%', '86%', '58%'];

function ReaderLoading() {
  const { t } = useI18n();
  return (
    <div className="reader-page reader-page--loading" data-testid="reader-page">
      <header className="reader-toolbar reader-toolbar--skeleton" aria-hidden="true">
        <span className="reader-skeleton__button" />
        <div className="reader-toolbar__titles">
          <span className="reader-skeleton__line reader-skeleton__line--book" />
          <span className="reader-skeleton__line reader-skeleton__line--chapter" />
        </div>
        <span className="reader-skeleton__button" />
      </header>
      <div className="reader-skeleton" role="status" aria-live="polite">
        <span className="label">{t('Opening book…')}</span>
        <div className="reader-skeleton__page">
          {SKELETON_WIDTHS.map((width, index) => (
            <span
              className="reader-skeleton__line"
              key={`${width}-${index}`}
              style={{ width }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export function ReaderPage({ bookId }: { bookId: string }) {
  const { push } = useToast();
  const { t } = useI18n();
  const saveErrorShownRef = useRef(false);
  const [state, setState] = useState<LoadState>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    setState({ status: 'loading' });

    void Promise.all([getBook(bookId), getChapterSet(bookId)])
      .then(([book, chapterSet]) => {
        if (cancelled) return;
        if (book === undefined || chapterSet === undefined || chapterSet.chapters.length === 0) {
          setState({ status: 'error' });
          return;
        }
        setState({ status: 'ready', book, chapterSet });
        void updateProgress(book.id, book.progress, true).catch(() => {
          if (!saveErrorShownRef.current) {
            saveErrorShownRef.current = true;
            push(t('Reading position could not be saved.'), { tone: 'error' });
          }
        });
      })
      .catch(() => {
        if (!cancelled) setState({ status: 'error' });
      });

    return () => {
      cancelled = true;
    };
  }, [bookId, push, t]);

  if (state.status === 'loading') return <ReaderLoading />;
  if (state.status === 'error') return <ReaderError onBack={navigateToLibrary} />;
  const firstChapter = state.chapterSet.chapters[0];
  if (firstChapter === undefined) return <ReaderError onBack={navigateToLibrary} />;
  return (
    <ReaderSession
      book={state.book}
      chapterSet={state.chapterSet}
      firstChapter={firstChapter}
    />
  );
}
