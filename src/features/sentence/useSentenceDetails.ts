import { useCallback, useEffect, useState } from 'react';
import {
  TranslationAbortedError,
  TranslationUnavailableError,
  translateSentence,
} from '../../lib/translate';
import { TranslationTooLongError } from '../../lib/translate/errors';
import { getRomaji, getRuby } from '../../lib/furigana/service';
import type { TranslationProvider } from '../../lib/types';
import { useSettings } from '../settings/SettingsProvider';

export type TranslationView =
  | { status: 'loading'; progress: number | null }
  | { status: 'ready'; text: string; provider: TranslationProvider; cached: boolean }
  | { status: 'error'; kind: 'online-disabled' | 'offline' | 'failed' | 'too-long' };

export interface SentenceDetails {
  translation: TranslationView;
  rubyHtml: string | null;
  romaji: string | null;
  romajiState: 'loading' | 'ready' | 'error';
  retryTranslation: () => void;
  enableOnline: () => void;
  retryRomaji: () => void;
}

export function useSentenceDetails(sentence: string): SentenceDetails {
  const { settings, updateSettings } = useSettings();
  const [translation, setTranslation] = useState<TranslationView>({
    status: 'loading',
    progress: null,
  });
  const [rubyHtml, setRubyHtml] = useState<string | null>(null);
  const [romaji, setRomaji] = useState<string | null>(null);
  const [romajiState, setRomajiState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [retryCount, setRetryCount] = useState(0);
  const [romajiCount, setRomajiCount] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    setTranslation({ status: 'loading', progress: null });
    setRubyHtml(null);
    setRomaji(null);
    setRomajiState('loading');

    void getRuby(sentence, settings.furiganaScript)
      .then((html) => {
        if (active && !controller.signal.aborted) setRubyHtml(html);
      })
      .catch(() => {
        if (active && !controller.signal.aborted) setRubyHtml(null);
      });

    void getRomaji(sentence)
      .then((text) => {
        if (!active || controller.signal.aborted) return;
        setRomaji(text);
        setRomajiState('ready');
      })
      .catch(() => {
        if (active && !controller.signal.aborted) setRomajiState('error');
      });

    void translateSentence(sentence, {
      onlineEnabled: settings.onlineTranslation,
      signal: controller.signal,
      onProgress: (progress) => {
        if (!active || controller.signal.aborted) return;
        const ratio = progress.total > 0 ? progress.loaded / progress.total : null;
        setTranslation({ status: 'loading', progress: ratio });
      },
    })
      .then((result) => {
        if (!active || controller.signal.aborted) return;
        setTranslation({
          status: 'ready',
          text: result.text,
          provider: result.provider,
          cached: result.cached,
        });
      })
      .catch((error: unknown) => {
        if (!active || controller.signal.aborted) return;
        if (error instanceof TranslationAbortedError) return;
        if (error instanceof TranslationTooLongError) {
          setTranslation({ status: 'error', kind: 'too-long' });
          return;
        }
        if (error instanceof TranslationUnavailableError) {
          if (error.reason === 'online-disabled') {
            setTranslation({ status: 'error', kind: 'online-disabled' });
          } else if (error.reason === 'offline') {
            setTranslation({ status: 'error', kind: 'offline' });
          } else {
            setTranslation({ status: 'error', kind: 'failed' });
          }
          return;
        }
        setTranslation({ status: 'error', kind: 'failed' });
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [sentence, settings.furiganaScript, settings.onlineTranslation, retryCount]);

  useEffect(() => {
    if (romajiCount === 0) return;
    let active = true;
    setRomajiState('loading');
    void getRomaji(sentence)
      .then((text) => {
        if (!active) return;
        setRomaji(text);
        setRomajiState('ready');
      })
      .catch(() => {
        if (active) setRomajiState('error');
      });
    return () => {
      active = false;
    };
  }, [romajiCount, sentence]);

  const retryTranslation = useCallback(() => setRetryCount((count) => count + 1), []);
  const retryRomaji = useCallback(() => setRomajiCount((count) => count + 1), []);
  const enableOnline = useCallback(
    () => updateSettings({ onlineTranslation: true }),
    [updateSettings],
  );

  return {
    translation,
    rubyHtml,
    romaji,
    romajiState,
    retryTranslation,
    enableOnline,
    retryRomaji,
  };
}
