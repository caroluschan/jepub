import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { useToast } from '../../components/Toast';
import {
  getJapaneseVoices,
  isSpeechSupported,
  speakJapanese,
  SpeechPlaybackError,
  stopSpeaking,
} from '../../lib/speech/speech';
import type { ChapterRecord } from '../../lib/types';

interface SentenceEntry {
  id: string;
  text: string;
}

function collectSentences(chapter: ChapterRecord): SentenceEntry[] {
  const entries: SentenceEntry[] = [];
  chapter.blocks.forEach((block, blockIndex) => {
    if (!('sentences' in block)) return;
    block.sentences.forEach((text, sentenceIndex) => {
      entries.push({ id: `${blockIndex}-${sentenceIndex}`, text });
    });
  });
  return entries;
}

function firstVisibleId(container: HTMLElement): string | null {
  const bounds = container.getBoundingClientRect();
  const nodes = container.querySelectorAll<HTMLElement>('[data-sentence-id]');
  for (const node of nodes) {
    const rect = node.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) continue;
    const visible =
      rect.bottom > bounds.top + 4 &&
      rect.top < bounds.bottom - 4 &&
      rect.right > bounds.left + 4 &&
      rect.left < bounds.right - 4;
    if (visible) return node.dataset['sentenceId'] ?? null;
  }
  return null;
}

export function useReadAloud(
  chapter: ChapterRecord,
  containerRef: RefObject<HTMLElement | null>,
) {
  const { push } = useToast();
  const [isReading, setIsReading] = useState(false);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const controllerRef = useRef<AbortController | null>(null);

  const stop = useCallback(() => {
    const controller = controllerRef.current;
    controllerRef.current = null;
    controller?.abort();
    stopSpeaking();
    setIsReading(false);
    setSpeakingId(null);
  }, []);

  const start = useCallback(async () => {
    if (controllerRef.current !== null) {
      stop();
      return;
    }
    if (!isSpeechSupported()) {
      push('Speech is not available on this device.', { tone: 'error' });
      return;
    }
    if (speechSynthesis.getVoices().length > 0 && getJapaneseVoices().length === 0) {
      push('No Japanese voice is available on this device.', { tone: 'error' });
      return;
    }

    const entries = collectSentences(chapter);
    if (entries.length === 0) return;

    const container = containerRef.current;
    const visibleId = container === null ? null : firstVisibleId(container);
    const startIndex = Math.max(
      0,
      entries.findIndex((entry) => entry.id === visibleId),
    );

    const controller = new AbortController();
    controllerRef.current = controller;
    setIsReading(true);

    let failure: SpeechPlaybackError | null = null;

    for (let index = startIndex; index < entries.length; index += 1) {
      const entry = entries[index];
      if (entry === undefined || controller.signal.aborted) break;

      setSpeakingId(entry.id);
      const element = container?.querySelector<HTMLElement>(
        `[data-sentence-id="${entry.id}"]`,
      );
      element?.scrollIntoView({ block: 'center', inline: 'center', behavior: 'smooth' });

      try {
        await speakJapanese(entry.text, { signal: controller.signal });
      } catch (error) {
        if (!controller.signal.aborted) {
          failure =
            error instanceof SpeechPlaybackError
              ? error
              : new SpeechPlaybackError('speech-error');
        }
        break;
      }

      if (controller.signal.aborted) break;
    }

    if (!controller.signal.aborted) {
      controllerRef.current = null;
      setIsReading(false);
      setSpeakingId(null);
      // A failed utterance is never chapter completion.
      if (failure !== null) {
        push('Read-aloud stopped because speech failed.', { tone: 'error' });
      } else {
        push('End of chapter.', { tone: 'default' });
      }
    }
  }, [chapter, containerRef, push, stop]);

  const toggle = useCallback(() => {
    if (controllerRef.current !== null) {
      stop();
      return;
    }
    void start().catch(() => {
      push('Read-aloud could not start.', { tone: 'error' });
    });
  }, [push, start, stop]);

  useEffect(() => {
    stop();
  }, [chapter.index, stop]);

  useEffect(() => {
    const onHide = (): void => stop();
    window.addEventListener('pagehide', onHide);
    return () => {
      window.removeEventListener('pagehide', onHide);
      controllerRef.current?.abort();
      stopSpeaking();
    };
  }, [stop]);

  return { isReading, speakingId, toggle, stop };
}
