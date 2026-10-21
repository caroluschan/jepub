import { useCallback, useEffect, useRef, useState } from 'react';
import { getRuby } from '../../lib/furigana/service';
import type { FuriganaScript } from '../../lib/types';

export type BlockFuriganaState = 'idle' | 'loading' | 'done' | 'error';

interface FuriganaBlock {
  attachRef: (node: HTMLElement | null) => void;
  html: readonly string[] | null;
  state: BlockFuriganaState;
}

export function useFuriganaBlocks(
  sentences: readonly string[],
  enabled: boolean,
  furiganaScript: FuriganaScript,
  retryNonce: number,
): FuriganaBlock {
  const nodeRef = useRef<HTMLElement | null>(null);
  const renderedKeyRef = useRef<string | null>(null);
  const [html, setHtml] = useState<readonly string[] | null>(null);
  const [state, setState] = useState<BlockFuriganaState>('idle');
  const key = `${furiganaScript}\u0000${sentences.join('\u0000')}`;

  const attachRef = useCallback((node: HTMLElement | null) => {
    nodeRef.current = node;
  }, []);

  useEffect(() => {
    renderedKeyRef.current = null;
    setHtml(null);
    setState('idle');
  }, [key]);

  useEffect(() => {
    if (!enabled) return;
    const node = nodeRef.current;
    if (node === null) return;
    if (renderedKeyRef.current === key) return;

    let cancelled = false;
    let started = false;

    const convert = async (): Promise<void> => {
      started = true;
      setState('loading');
      const converted: string[] = [];
      try {
        for (const sentence of sentences) {
          const ruby = await getRuby(sentence, furiganaScript);
          if (cancelled) return;
          converted.push(ruby);
        }
        if (cancelled) return;
        renderedKeyRef.current = key;
        setHtml(converted);
        setState('done');
      } catch {
        if (!cancelled) setState('error');
      }
    };

    const observer = new IntersectionObserver(
      (entries) => {
        if (started) return;
        if (entries.some((entry) => entry.isIntersecting)) {
          observer.disconnect();
          void convert();
        }
      },
      { rootMargin: '700px 700px' },
    );

    observer.observe(node);
    return () => {
      cancelled = true;
      observer.disconnect();
    };
  }, [key, enabled, furiganaScript, retryNonce, sentences]);

  return { attachRef, html, state };
}
