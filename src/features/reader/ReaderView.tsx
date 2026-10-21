import { useCallback, useEffect, useRef, type RefObject } from 'react';
import type { ChapterRecord, FuriganaScript, Orientation } from '../../lib/types';
import {
  installVerticalWheel,
  readScrollRatio,
  resetScrollConvention,
  writeScrollRatio,
} from '../../lib/reader/readerScroll';
import { ChapterView } from './ChapterView';

interface ReaderViewProps {
  chapter: ChapterRecord;
  chapterIndex: number;
  orientation: Orientation;
  fontSize: number;
  furiganaEnabled: boolean;
  furiganaScript: FuriganaScript;
  retryNonce: number;
  assets: Map<string, string>;
  speakingId: string | null;
  initialRatio: number;
  fragment: string | null;
  nonce: number;
  hasNext: boolean;
  scrollRef: RefObject<HTMLDivElement | null>;
  onRatioChange: (ratio: number) => void;
  onOpenSentence: (sentence: string, element: HTMLElement) => void;
  onNextChapter: () => void;
}

export function ReaderView({
  chapter,
  chapterIndex,
  orientation,
  fontSize,
  furiganaEnabled,
  furiganaScript,
  retryNonce,
  assets,
  speakingId,
  initialRatio,
  fragment,
  nonce,
  hasNext,
  scrollRef,
  onRatioChange,
  onOpenSentence,
  onNextChapter,
}: ReaderViewProps) {
  const lastRatioRef = useRef(initialRatio);
  const previousRef = useRef({ nonce, chapterIndex, orientation, fontSize });

  const isNonScrollable = useCallback((): boolean => {
    const element = scrollRef.current;
    if (element === null) return false;
    const max =
      orientation === 'horizontal'
        ? element.scrollHeight - element.clientHeight
        : element.scrollWidth - element.clientWidth;
    return max <= 0;
  }, [orientation, scrollRef]);

  const captureRatio = useCallback(() => {
    const element = scrollRef.current;
    if (element === null) return 0;
    // A final chapter that fits in one viewport is complete, not at 0%.
    const ratio =
      !hasNext && isNonScrollable() ? 1 : readScrollRatio(element, orientation);
    lastRatioRef.current = ratio;
    onRatioChange(ratio);
    return ratio;
  }, [hasNext, isNonScrollable, onRatioChange, orientation, scrollRef]);

  useEffect(() => {
    const element = scrollRef.current;
    if (element === null) return;

    const previous = previousRef.current;
    const navigationChanged = previous.nonce !== nonce || previous.chapterIndex !== chapterIndex;
    const layoutChanged = previous.orientation !== orientation || previous.fontSize !== fontSize;
    const target = navigationChanged ? initialRatio : lastRatioRef.current;
    previousRef.current = { nonce, chapterIndex, orientation, fontSize };
    resetScrollConvention(element);

    let second = 0;
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => {
        if (navigationChanged && fragment !== null) {
          const selector = `[data-anchor="${CSS.escape(fragment)}"]`;
          const anchor = element.querySelector<HTMLElement>(selector);
          if (anchor !== null) {
            anchor.scrollIntoView({ block: 'start', inline: 'start' });
            captureRatio();
            return;
          }
        }
        const resolvedTarget = !hasNext && target === 0 && isNonScrollable() ? 1 : target;
        lastRatioRef.current = resolvedTarget;
        writeScrollRatio(element, orientation, resolvedTarget);
        onRatioChange(resolvedTarget);
        if (layoutChanged && !navigationChanged) captureRatio();
      });
    });

    return () => {
      cancelAnimationFrame(first);
      cancelAnimationFrame(second);
    };
  }, [
    captureRatio,
    chapterIndex,
    fontSize,
    fragment,
    hasNext,
    initialRatio,
    isNonScrollable,
    nonce,
    onRatioChange,
    orientation,
    scrollRef,
  ]);

  useEffect(() => {
    const element = scrollRef.current;
    if (element === null) return;

    let frame = 0;
    const onScroll = (): void => {
      if (frame !== 0) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        captureRatio();
      });
    };
    element.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      element.removeEventListener('scroll', onScroll);
      if (frame !== 0) cancelAnimationFrame(frame);
    };
  }, [captureRatio, scrollRef]);

  useEffect(() => {
    if (orientation !== 'vertical') return;
    const element = scrollRef.current;
    if (element === null) return;
    return installVerticalWheel(element);
  }, [orientation, scrollRef]);

  return (
    <div
      ref={scrollRef}
      className={`reader-scroll is-${orientation}`}
      data-testid="reader-scroll"
      style={{ fontSize: `${fontSize}px` }}
    >
      <ChapterView
        chapter={chapter}
        furiganaEnabled={furiganaEnabled}
        furiganaScript={furiganaScript}
        retryNonce={retryNonce}
        assets={assets}
        speakingId={speakingId}
        hasNext={hasNext}
        onOpenSentence={onOpenSentence}
        onNextChapter={onNextChapter}
      />
    </div>
  );
}
