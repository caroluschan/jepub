import { useCallback, useEffect, useRef, useState } from 'react';
import { Icon } from '../../components/Icon';
import { SkipLink } from '../../components/SkipLink';
import { Spinner } from '../../components/Spinner';
import { useToast } from '../../components/Toast';
import {
  getFuriganaStatus,
  onFuriganaStatusChange,
  preload,
  type FuriganaStatus,
} from '../../lib/furigana/service';
import { useI18n } from '../../lib/i18n/useI18n';
import { clamp01 } from '../../lib/reader/scrollProgress';
import { navigateToLibrary } from '../../lib/router';
import { shareBook } from '../../lib/share/shareBook';
import { addBookmark, deleteBookmark, listBookmarks } from '../../lib/storage';
import type { Bookmark, BookRecord, ChapterRecord, ChapterSet, TocEntry } from '../../lib/types';
import { useSettings } from '../settings/SettingsProvider';
import { SentenceSheet } from '../sentence/SentenceSheet';
import { ReaderToolbar } from './ReaderToolbar';
import { ReaderView } from './ReaderView';
import { TocDrawer } from './TocDrawer';
import { useChapterAssets } from './useChapterAssets';
import { useReadAloud } from './useReadAloud';
import { useReaderSession } from './useReaderSession';

interface SelectedSentence {
  sentence: string;
  element: HTMLElement;
}

interface ReaderSessionProps {
  book: BookRecord;
  chapterSet: ChapterSet;
  firstChapter: ChapterRecord;
}

const BOOKMARK_TOLERANCE = 0.02;

export function ReaderSession({ book, chapterSet, firstChapter }: ReaderSessionProps) {
  const { settings, openSettings } = useSettings();
  const { t } = useI18n();
  const { push } = useToast();
  const { navigation, percent, reportRatio, navigateTo, flush } = useReaderSession(
    book,
    chapterSet,
  );
  const chapter = chapterSet.chapters[navigation.chapterIndex] ?? firstChapter;
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [tocOpen, setTocOpen] = useState(false);
  const [selected, setSelected] = useState<SelectedSentence | null>(null);
  const [retryNonce, setRetryNonce] = useState(0);
  const [furiganaStatus, setFuriganaStatus] = useState<FuriganaStatus>(() =>
    getFuriganaStatus(),
  );
  const [showPill, setShowPill] = useState(true);
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [currentBookmarkId, setCurrentBookmarkId] = useState<string | null>(null);
  const ratioRef = useRef(navigation.initialRatio);
  const bookmarksRef = useRef<Bookmark[]>([]);

  const readAloud = useReadAloud(chapter, scrollRef);
  const { stop: stopReadAloud, toggle: toggleReadAloud, isReading, speakingId } = readAloud;
  const assets = useChapterAssets(book.id, chapter);

  const refreshBookmarks = useCallback(async (): Promise<void> => {
    try {
      setBookmarks(await listBookmarks(book.id));
    } catch {
      push(t('Bookmarks could not be loaded.'), { tone: 'error' });
    }
  }, [book.id, push, t]);

  useEffect(() => {
    void refreshBookmarks();
  }, [refreshBookmarks]);

  useEffect(() => {
    bookmarksRef.current = bookmarks;
  }, [bookmarks]);

  useEffect(() => {
    ratioRef.current = navigation.initialRatio;
  }, [navigation.initialRatio, navigation.nonce]);

  const currentBookmark =
    bookmarks.find((bookmark) => bookmark.id === currentBookmarkId) ?? null;

  const updateCurrentBookmark = useCallback(() => {
    const match =
      bookmarksRef.current.find(
        (bookmark) =>
          bookmark.chapterIndex === navigation.chapterIndex &&
          Math.abs(bookmark.ratio - ratioRef.current) <= BOOKMARK_TOLERANCE,
      ) ?? null;
    setCurrentBookmarkId((previous) => (previous === match?.id ? previous : match?.id ?? null));
  }, [navigation.chapterIndex]);

  useEffect(() => {
    updateCurrentBookmark();
  }, [bookmarks, navigation.chapterIndex, navigation.nonce, updateCurrentBookmark]);

  const handleRatioChange = useCallback(
    (next: number) => {
      ratioRef.current = clamp01(next);
      reportRatio(next);
      const match =
        bookmarksRef.current.find(
          (bookmark) =>
            bookmark.chapterIndex === navigation.chapterIndex &&
            Math.abs(bookmark.ratio - ratioRef.current) <= BOOKMARK_TOLERANCE,
        ) ?? null;
      setCurrentBookmarkId((previous) => (previous === match?.id ? previous : match?.id ?? null));
    },
    [navigation.chapterIndex, reportRatio],
  );

  useEffect(() => onFuriganaStatusChange(setFuriganaStatus), []);

  useEffect(() => {
    const timer = window.setTimeout(() => setShowPill(false), 5000);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (furiganaStatus === 'ready' || furiganaStatus === 'error') setShowPill(false);
  }, [furiganaStatus]);

  const openSentence = useCallback(
    (sentence: string, element: HTMLElement) => {
      stopReadAloud();
      setSelected({ sentence, element });
    },
    [stopReadAloud],
  );

  const handleRetryFurigana = useCallback(() => {
    void preload()
      .then(() => {
        setRetryNonce((value) => value + 1);
        push(t('Furigana ready.'), { tone: 'success' });
      })
      .catch(() => {
        push(t("Furigana couldn't load. Try again."), { tone: 'error' });
      });
  }, [push, t]);

  const addCurrentBookmark = useCallback(async (): Promise<void> => {
    const existing = bookmarksRef.current.find(
      (bookmark) =>
        bookmark.chapterIndex === navigation.chapterIndex &&
        Math.abs(bookmark.ratio - ratioRef.current) <= BOOKMARK_TOLERANCE,
    );
    if (existing !== undefined) {
      push(t('Already bookmarked here.'));
      return;
    }

    const bookmark: Bookmark = {
      id: crypto.randomUUID(),
      bookId: book.id,
      chapterIndex: navigation.chapterIndex,
      ratio: clamp01(ratioRef.current),
      chapterTitle: chapter.title,
      createdAt: Date.now(),
    };

    try {
      await addBookmark(bookmark);
      setBookmarks(await listBookmarks(book.id));
      push(t('Bookmark added.'), { tone: 'success' });
    } catch {
      push(t('Bookmark could not be saved.'), { tone: 'error' });
    }
  }, [book.id, chapter.title, navigation.chapterIndex, push, t]);

  const removeBookmark = useCallback(
    async (bookmark: Bookmark): Promise<void> => {
      try {
        await deleteBookmark(bookmark.id);
        setBookmarks(await listBookmarks(book.id));
        push(t('Bookmark removed.'));
      } catch {
        push(t('Bookmark could not be removed.'), { tone: 'error' });
      }
    },
    [book.id, push, t],
  );

  const toggleBookmark = useCallback(() => {
    if (currentBookmark !== null) {
      void removeBookmark(currentBookmark);
      return;
    }
    void addCurrentBookmark();
  }, [addCurrentBookmark, currentBookmark, removeBookmark]);

  const handleShare = useCallback(async (): Promise<void> => {
    const outcome = await shareBook(book);
    if (outcome === 'shared') {
      push(t('Shared.'));
      return;
    }
    if (outcome === 'downloaded') {
      push(t('Book downloaded. Share it from your files.'));
      return;
    }
    if (outcome === 'copied') {
      push(t('Aozora link copied.'));
      return;
    }
    if (outcome === 'failed') {
      push(t('Could not share this book.'), { tone: 'error' });
    }
  }, [book, push, t]);

  const handleNavigate = (entry: TocEntry): void => {
    setTocOpen(false);
    navigateTo(entry.chapterIndex, entry.fragment);
  };

  const handleNavigateBookmark = (bookmark: Bookmark): void => {
    setTocOpen(false);
    navigateTo(bookmark.chapterIndex, null, bookmark.ratio);
  };

  const handleNextChapter = useCallback(
    () => navigateTo(navigation.chapterIndex + 1),
    [navigateTo, navigation.chapterIndex],
  );

  const openToc = (): void => {
    stopReadAloud();
    setTocOpen(true);
  };

  const chapterCount = chapterSet.chapters.length;
  const hasNext = navigation.chapterIndex < chapterCount - 1;

  return (
    <div
      className={settings.furigana ? 'reader-page' : 'reader-page no-furigana'}
      data-orientation={settings.orientation}
      data-testid="reader-page"
    >
      <SkipLink />
      <ReaderToolbar
        bookTitle={book.title}
        chapterTitle={chapter.title}
        isReading={isReading}
        onBack={() => {
          stopReadAloud();
          void flush().then(navigateToLibrary);
        }}
        onToggleReadAloud={toggleReadAloud}
        onOpenToc={openToc}
        onShare={() => void handleShare()}
        onOpenSettings={() => {
          stopReadAloud();
          openSettings();
        }}
      />

      {settings.furigana && furiganaStatus === 'error' ? (
        <div className="furigana-banner" role="status">
          <span>{t('Furigana unavailable')}</span>
          <button type="button" className="button--text" onClick={handleRetryFurigana}>
            {t('Retry')}
          </button>
        </div>
      ) : null}

      {showPill && settings.furigana && furiganaStatus === 'loading' ? (
        <div className="furigana-pill" role="status">
          <Spinner /> {t('Preparing furigana…')}
        </div>
      ) : null}

      <ReaderView
        chapter={chapter}
        chapterIndex={navigation.chapterIndex}
        orientation={settings.orientation}
        fontSize={settings.fontSize}
        furiganaEnabled={settings.furigana}
        furiganaScript={settings.furiganaScript}
        retryNonce={retryNonce}
        assets={assets}
        speakingId={speakingId}
        initialRatio={navigation.initialRatio}
        fragment={navigation.fragment}
        nonce={navigation.nonce}
        hasNext={hasNext}
        scrollRef={scrollRef}
        onRatioChange={handleRatioChange}
        onOpenSentence={openSentence}
        onNextChapter={handleNextChapter}
      />

      <footer className="reader-status">
        <div className="reader-status__rail" aria-hidden="true">
          <span style={{ width: `${percent}%` }} />
        </div>
        <div className="reader-status__row">
          <button type="button" className="reader-status__chapter" onClick={openToc}>
            {t('Chapter {current} of {total} · {percent}%', {
              current: navigation.chapterIndex + 1,
              total: chapterCount,
              percent,
            })}
          </button>
          {isReading ? <span className="reader-status__reading">{t('Reading aloud')}</span> : null}
          <div className="reader-status__nav">
            <button
              type="button"
              className="icon-button"
              aria-label={currentBookmark === null ? t('Add bookmark') : t('Remove bookmark')}
              aria-pressed={currentBookmark !== null}
              data-testid="bookmark-button"
              onClick={toggleBookmark}
            >
              <Icon name={currentBookmark === null ? 'bookmark' : 'bookmark-filled'} />
            </button>
            <button
              type="button"
              className="icon-button"
              aria-label={t('Previous chapter')}
              disabled={navigation.chapterIndex <= 0}
              onClick={() => navigateTo(navigation.chapterIndex - 1)}
            >
              <Icon name="chevron-left" />
            </button>
            <button
              type="button"
              className="icon-button"
              aria-label={t('Next chapter')}
              disabled={!hasNext}
              onClick={handleNextChapter}
            >
              <Icon name="chevron-right" />
            </button>
          </div>
        </div>
      </footer>

      {tocOpen ? (
        <TocDrawer
          bookTitle={book.title}
          entries={chapterSet.toc}
          chapters={chapterSet.chapters}
          currentIndex={navigation.chapterIndex}
          bookmarks={bookmarks}
          onClose={() => setTocOpen(false)}
          onNavigate={handleNavigate}
          onAddBookmark={() => void addCurrentBookmark()}
          onNavigateBookmark={handleNavigateBookmark}
          onDeleteBookmark={(bookmark) => void removeBookmark(bookmark)}
        />
      ) : null}

      {selected !== null ? (
        <SentenceSheet
          sentence={selected.sentence}
          restoreFocus={selected.element}
          onClose={() => setSelected(null)}
        />
      ) : null}
    </div>
  );
}
