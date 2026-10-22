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
  __translationTargets?: string[];
}

export const SAMPLE_EPUB = path.resolve(process.cwd(), 'public/sample/jepub-sample.epub');

export async function installApiMocks(page: Page, options: ApiMockOptions = {}): Promise<void> {
  await page.addInitScript((settings: ApiMockOptions) => {
    const scope = window as MockWindow;
    const spoken: Array<{ text: string; lang: string }> = [];
    scope.__spoken = spoken;
    const translationTargets: string[] = [];
    scope.__translationTargets = translationTargets;

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
      availability: (options: { targetLanguage: string }) => {
        translationTargets.push(options.targetLanguage);
        return Promise.resolve(mode === 'progress' ? 'downloadable' : 'available');
      },
      create: async (init: {
        targetLanguage?: string;
        monitor?: (monitor: {
          addEventListener: (
            type: string,
            listener: (event: { loaded: number; total: number }) => void,
          ) => void;
        }) => void;
      }) => {
        if (init.targetLanguage !== undefined) translationTargets.push(init.targetLanguage);
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
    const seedKey = 'jepub:test-settings-seeded';
    if (window.sessionStorage.getItem(seedKey) === '1') return;
    const key = 'jepub:settings:v1';
    const existing: Record<string, unknown> = {
      theme: 'light',
      fontSize: 19,
      orientation: 'horizontal',
      furigana: true,
      furiganaScript: 'katakana',
      onlineTranslation: false,
      translationTarget: 'en',
      uiLanguage: 'en',
    };
    window.localStorage.setItem(key, JSON.stringify({ ...existing, ...settingsPatch }));
    window.sessionStorage.setItem(seedKey, '1');
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

export const AOZORA_CARD_MARKDOWN = `Title: 羅生門 (芥川 竜之介)

URL Source: https://www.aozora.gr.jp/cards/000879/card127.html

Markdown Content:
## 図書カード：No.127

作品名：羅生門
作品名読み：らしょうもん
著者名：[芥川 竜之介](https://www.aozora.gr.jp/index_pages/person879.html)

https://www.aozora.gr.jp/cards/000879/files/127_15260.html
`;

export const AOZORA_FILE_HTML = `<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="ja">
<head>
  <meta name="DC.Title" content="羅生門">
  <meta name="DC.Creator" content="芥川龍之介">
</head>
<body>
  <div class="main_text">
    ある日の暮方の事である。一人の<ruby><rb>下人</rb><rp>（</rp><rt>げにん</rt><rp>）</rp></ruby>が、<ruby><rb>羅生門</rb><rp>（</rp><rt>らしょうもん</rt><rp>）</rp></ruby>の下で雨やみを待っていた。
  </div>
</body>
</html>`;

interface AozoraMockOptions {
  status?: number;
}

/** Intercepts Jina Reader and serves deterministic Aozora card/file payloads. */
export async function installAozoraMocks(
  page: Page,
  options: AozoraMockOptions = {},
): Promise<void> {
  await page.route('https://r.jina.ai/**', async (route) => {
    const request = route.request();
    const cors = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'X-Return-Format',
    };
    if (request.method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: cors });
      return;
    }
    if (options.status !== undefined) {
      await route.fulfill({ status: options.status, headers: cors, body: 'not found' });
      return;
    }
    const target = request.url().slice('https://r.jina.ai/'.length);
    const isFile = target.includes('/files/');
    await route.fulfill({
      status: 200,
      headers: { ...cors, 'Content-Type': 'text/plain; charset=utf-8' },
      body: isFile ? AOZORA_FILE_HTML : AOZORA_CARD_MARKDOWN,
    });
  });
}
