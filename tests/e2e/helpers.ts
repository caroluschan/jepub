import { expect, type Page } from '@playwright/test';
import path from 'node:path';

export type TranslatorMode = 'available' | 'none' | 'progress';

export interface ApiMockOptions {
  translator?: TranslatorMode;
  translation?: string;
  translationDelay?: number;
  staleDelay?: number;
  speechError?: string;
}

interface MockWindow extends Window {
  __spoken?: Array<{ text: string; lang: string }>;
}

export const SAMPLE_EPUB = path.resolve(process.cwd(), 'public/sample/jepub-sample.epub');

export async function installApiMocks(page: Page, options: ApiMockOptions = {}): Promise<void> {
  await page.addInitScript((settings: ApiMockOptions) => {
    const scope = window as MockWindow;
    const spoken: Array<{ text: string; lang: string }> = [];
    scope.__spoken = spoken;

    class MockUtterance {
      text: string;
      lang = '';
      rate = 1;
      pitch = 1;
      voice: unknown = null;
      onend: ((event: SpeechSynthesisEvent) => void) | null = null;
      onerror: ((event: SpeechSynthesisErrorEvent) => void) | null = null;
      onstart: ((event: SpeechSynthesisEvent) => void) | null = null;

      constructor(text: string) {
        this.text = text;
      }
    }

    (window as unknown as { SpeechSynthesisUtterance: unknown }).SpeechSynthesisUtterance =
      MockUtterance;

    const synth = window.speechSynthesis;
    if (synth !== undefined) {
      const voice = {
        default: true,
        lang: 'ja-JP',
        localService: true,
        name: 'Mock Japanese',
        voiceURI: 'mock-ja-JP',
      };
      synth.getVoices = () => [voice as unknown as SpeechSynthesisVoice];
      synth.speak = (utterance) => {
        spoken.push({ text: utterance.text, lang: utterance.lang });
        window.setTimeout(() => {
          if (settings.speechError !== undefined) {
            if (typeof utterance.onerror === 'function') {
              utterance.onerror({
                error: settings.speechError,
              } as SpeechSynthesisErrorEvent);
            }
            return;
          }
          if (typeof utterance.onend === 'function') {
            utterance.onend(new Event('end') as SpeechSynthesisEvent);
          }
        }, 200);
      };
      synth.cancel = () => undefined;
    }

    (window as unknown as { Translator: unknown }).Translator = undefined;
    if (settings.translator === 'none') return;

    const mode = settings.translator ?? 'available';
    (window as unknown as { Translator: unknown }).Translator = {
      availability: () => Promise.resolve(mode === 'progress' ? 'downloadable' : 'available'),
      create: async (init: {
        monitor?: (monitor: {
          addEventListener: (
            type: string,
            listener: (event: { loaded: number; total: number }) => void,
          ) => void;
        }) => void;
      }) => {
        if (mode === 'progress') {
          init.monitor?.({
            addEventListener: (type, listener) => {
              if (type !== 'downloadprogress') return;
              let loaded = 0;
              const timer = window.setInterval(() => {
                loaded += 0.25;
                listener({ loaded, total: 1 });
                if (loaded >= 1) window.clearInterval(timer);
              }, 120);
            },
          });
          await new Promise((resolve) => window.setTimeout(resolve, 700));
        }

        return {
          translate: async (text: string) => {
            if (settings.translation !== undefined) {
              await new Promise((resolve) =>
                window.setTimeout(resolve, settings.translationDelay ?? 0),
              );
              return settings.translation;
            }
            if (text.includes('吾輩')) {
              await new Promise((resolve) =>
                window.setTimeout(resolve, settings.staleDelay ?? 0),
              );
              return 'STALE_TRANSLATION';
            }
            if (text.includes('名前')) {
              return 'FRESH_TRANSLATION';
            }
            return 'A quiet English translation.';
          },
          destroy: () => undefined,
        };
      },
    };
  }, options);

  await page.route('https://api.mymemory.translated.net/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        responseStatus: 200,
        responseData: { translatedText: options.translation ?? 'I am a cat.' },
      }),
    });
  });
}

export async function routeMyMemory(page: Page, translated = 'I am a cat.'): Promise<void> {
  await page.route('https://api.mymemory.translated.net/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        responseStatus: 200,
        responseData: { translatedText: translated },
      }),
    });
  });
}

export async function gotoLibrary(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page.getByTestId('library-page')).toBeVisible();
}

export async function waitForReader(page: Page): Promise<void> {
  await expect(page.getByTestId('reader-page')).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('[data-testid^="sentence-"]').first()).toBeVisible({ timeout: 30_000 });
}

export async function importSample(page: Page): Promise<void> {
  await gotoLibrary(page);
  await page.getByRole('button', { name: /Read the sample/i }).click();
  await waitForReader(page);
}

export async function openSentence(
  page: Page,
  testId = 'sentence-1-0',
): Promise<void> {
  await page.getByTestId(testId).click();
  await expect(page.getByRole('dialog', { name: 'Sentence details' })).toBeVisible();
}

export async function waitForFurigana(page: Page, reading = 'ネコ'): Promise<void> {
  await expect(page.locator('rt').filter({ hasText: reading }).first()).toBeVisible({
    timeout: 90_000,
  });
}

export async function setSettingsBeforeLoad(
  page: Page,
  patch: Record<string, unknown>,
): Promise<void> {
  await page.addInitScript((settingsPatch: Record<string, unknown>) => {
    const key = 'jepub:settings:v1';
    const existing: Record<string, unknown> = {
      theme: 'light',
      fontSize: 19,
      orientation: 'horizontal',
      furigana: true,
      furiganaScript: 'katakana',
      onlineTranslation: false,
    };
    window.localStorage.setItem(key, JSON.stringify({ ...existing, ...settingsPatch }));
  }, patch);
}

export async function spokenEntries(
  page: Page,
): Promise<Array<{ text: string; lang: string }>> {
  return page.evaluate(() => {
    const scope = window as MockWindow;
    return scope.__spoken ?? [];
  });
}
