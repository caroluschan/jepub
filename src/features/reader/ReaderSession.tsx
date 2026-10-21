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
import { navigateToLibrary } from '../../lib/router';
import type { BookRecord, ChapterRecord, ChapterSet, TocEntry } from '../../lib/types';
import { SettingsSheet } from '../settings/SettingsSheet';
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

export function ReaderSession({ book, chapterSet, firstChapter }: ReaderSessionProps) {
  const { settings } = useSettings();
  const { push } = useToast();
  const { navigation, percent, reportRatio, navigateTo, flush } = useReaderSession(
    book,
    chapterSet,
  );
  const chapter = chapterSet.chapters[navigation.chapterIndex] ?? firstChapter;
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [tocOpen, setTocOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [selected, setSelected] = useState<SelectedSentence | null>(null);
  const [retryNonce, setRetryNonce] = useState(0);
  const [furiganaStatus, setFuriganaStatus] = useState<FuriganaStatus>(() =>
    getFuriganaStatus(),
  );
  const [showPill, setShowPill] = useState(true);

  const readAloud = useReadAloud(chapter, scrollRef);
  const { stop: stopReadAloud, toggle: toggleReadAloud, isReading, speakingId } = readAloud;
  const assets = useChapterAssets(book.id, chapter);

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
        push('Furigana ready.', { tone: 'success' });
      })
      .catch(() => {
        push("Furigana couldn't load. Try again.", { tone: 'error' });
      });
  }, [push]);

  const handleNavigate = (entry: TocEntry): void => {
    setTocOpen(false);
    navigateTo(entry.chapterIndex, entry.fragment);
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
        onOpenSettings={() => {
          stopReadAloud();
          setSettingsOpen(true);
        }}
      />

      {settings.furigana && furiganaStatus === 'error' ? (
        <div className="furigana-banner" role="status">
          <span>Furigana unavailable</span>
          <button type="button" className="button--text" onClick={handleRetryFurigana}>
            Retry
          </button>
        </div>
      ) : null}

      {showPill && settings.furigana && furiganaStatus === 'loading' ? (
        <div className="furigana-pill" role="status">
          <Spinner /> Preparing furigana…
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
        onRatioChange={reportRatio}
        onOpenSentence={openSentence}
        onNextChapter={handleNextChapter}
      />

      <footer className="reader-status">
        <div className="reader-status__rail" aria-hidden="true">
          <span style={{ width: `${percent}%` }} />
        </div>
        <div className="reader-status__row">
          <button type="button" className="reader-status__chapter" onClick={openToc}>
            第 {navigation.chapterIndex + 1} 章 / {chapterCount} · {percent}%
          </button>
          {isReading ? <span className="reader-status__reading">Reading aloud</span> : null}
          <div className="reader-status__nav">
            <button
              type="button"
              className="icon-button"
              aria-label="Previous chapter"
              disabled={navigation.chapterIndex <= 0}
              onClick={() => navigateTo(navigation.chapterIndex - 1)}
            >
              <Icon name="chevron-left" />
            </button>
            <button
              type="button"
              className="icon-button"
              aria-label="Next chapter"
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
          onClose={() => setTocOpen(false)}
          onNavigate={handleNavigate}
        />
      ) : null}

      {settingsOpen ? (
        <SettingsSheet
          onClose={() => setSettingsOpen(false)}
          onRetryFurigana={handleRetryFurigana}
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
