import { useCallback, useEffect, useRef, useState } from 'react';
import { useToast } from '../../components/Toast';
import { clamp01 } from '../../lib/reader/scrollProgress';
import { updateProgress } from '../../lib/storage';
import type { BookRecord, ChapterSet } from '../../lib/types';

export interface ReaderNavigation {
  chapterIndex: number;
  initialRatio: number;
  fragment: string | null;
  nonce: number;
}

function clampChapter(index: number, count: number): number {
  if (count <= 0) return 0;
  return Math.min(count - 1, Math.max(0, Math.trunc(index)));
}

export function useReaderSession(book: BookRecord, chapterSet: ChapterSet) {
  const { push } = useToast();
  const count = chapterSet.chapters.length;
  const initialChapter = clampChapter(book.progress.chapterIndex, count);
  const initialRatio = clamp01(book.progress.ratio);

  const [navigation, setNavigation] = useState<ReaderNavigation>({
    chapterIndex: initialChapter,
    initialRatio,
    fragment: null,
    nonce: 0,
  });
  const [percent, setPercent] = useState(() =>
    count === 0 ? 0 : Math.round(((initialChapter + initialRatio) / count) * 100),
  );

  const chapterRef = useRef(initialChapter);
  const ratioRef = useRef(initialRatio);
  const timerRef = useRef<number | null>(null);
  const saveErrorShownRef = useRef(false);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const persist = useCallback(
    async (chapterIndex: number, ratio: number): Promise<void> => {
      try {
        await updateProgress(book.id, { chapterIndex, ratio: clamp01(ratio) }, false);
        saveErrorShownRef.current = false;
      } catch {
        // Keep scrolling usable, but never lose progress silently. Scroll
        // events keep calling persist, so a transient failure can recover.
        if (!saveErrorShownRef.current) {
          saveErrorShownRef.current = true;
          push('Reading position could not be saved.', { tone: 'error' });
        }
      }
    },
    [book.id, push],
  );

  const flush = useCallback(async (): Promise<void> => {
    clearTimer();
    await persist(chapterRef.current, ratioRef.current);
  }, [clearTimer, persist]);

  const reportRatio = useCallback(
    (next: number) => {
      const ratio = clamp01(next);
      ratioRef.current = ratio;
      const overall = count === 0 ? 0 : ((chapterRef.current + ratio) / count) * 100;
      setPercent(Math.min(100, Math.max(0, Math.round(overall))));

      clearTimer();
      timerRef.current = window.setTimeout(() => {
        timerRef.current = null;
        persist(chapterRef.current, ratioRef.current);
      }, 400);
    },
    [clearTimer, count, persist],
  );

  const navigateTo = useCallback(
    (chapterIndex: number, fragment: string | null = null, ratio = 0) => {
      const target = clampChapter(chapterIndex, count);
      const targetRatio = clamp01(ratio);
      clearTimer();
      void persist(chapterRef.current, ratioRef.current);
      chapterRef.current = target;
      ratioRef.current = targetRatio;
      setNavigation((current) => ({
        chapterIndex: target,
        initialRatio: targetRatio,
        fragment,
        nonce: current.nonce + 1,
      }));
      setPercent(
        count === 0
          ? 0
          : Math.min(100, Math.max(0, Math.round(((target + targetRatio) / count) * 100))),
      );
    },
    [clearTimer, count, persist],
  );

  useEffect(() => {
    const onHide = (): void => {
      if (document.visibilityState === 'hidden') flush();
    };
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', onHide);
    return () => {
      window.removeEventListener('pagehide', flush);
      document.removeEventListener('visibilitychange', onHide);
      flush();
    };
  }, [flush]);

  return {
    navigation,
    percent,
    reportRatio,
    navigateTo,
    flush,
  };
}
