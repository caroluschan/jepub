import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  TranslationError,
  TranslationTimeoutError,
  TranslationTooLongError,
  TranslationUnavailableError,
} from '../../src/lib/translate/errors';
import { translationKey } from '../../src/lib/translate/hash';
import { getCachedTranslation } from '../../src/lib/translate/cache';
import { mymemoryTranslate } from '../../src/lib/translate/mymemory';
import { destroyOnDeviceTranslator } from '../../src/lib/translate/translatorApi';
import { translateSentence } from '../../src/lib/translate';
import { closeDb } from '../../src/lib/storage';

async function resetDatabase(): Promise<void> {
  await closeDb();
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase('jepub');
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error ?? new Error('deleteDatabase failed'));
    request.onblocked = () => resolve();
  });
}

beforeEach(async () => {
  await resetDatabase();
});

afterEach(async () => {
  await destroyOnDeviceTranslator();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  await resetDatabase();
});

describe('translation providers', () => {
  it('TR-LOCAL uses the on-device translator and caches the result', async () => {
    const translate = vi.fn(async (text: string) => `EN:${text}`);
    vi.stubGlobal('Translator', {
      availability: async () => 'available',
      create: async () => ({ translate, destroy: () => undefined }),
    });

    const providers: string[] = [];
    const first = await translateSentence('猫', {
      onlineEnabled: false,
      onProvider: (provider) => providers.push(provider),
    });
    expect(first).toEqual({ text: 'EN:猫', provider: 'on-device', cached: false });
    expect(providers).toEqual(['on-device']);

    const second = await translateSentence('猫', { onlineEnabled: false });
    expect(second).toEqual({ text: 'EN:猫', provider: 'on-device', cached: true });
    expect(translate).toHaveBeenCalledTimes(1);
  });

  it('TR-PROGRESS forwards on-device download progress', async () => {
    let monitorListener: ((event: { loaded: number; total: number }) => void) | null = null;
    vi.stubGlobal('Translator', {
      availability: async () => 'downloadable',
      create: async (options: {
        monitor?: (monitor: {
          addEventListener: (
            type: string,
            listener: (event: { loaded: number; total: number }) => void,
          ) => void;
        }) => void;
      }) => {
        const monitor = {
          addEventListener: (
            type: string,
            listener: (event: { loaded: number; total: number }) => void,
          ) => {
            if (type === 'downloadprogress') monitorListener = listener;
          },
        };
        options.monitor?.(monitor);
        return { translate: async (text: string) => `EN:${text}`, destroy: () => undefined };
      },
    });

    const progress: Array<{ loaded: number; total: number }> = [];
    const result = await translateSentence('猫', {
      onlineEnabled: false,
      onProgress: (event) => progress.push(event),
    });
    expect(result.provider).toBe('on-device');

    expect(monitorListener).not.toBeNull();
    if (monitorListener !== null) {
      (monitorListener as (event: { loaded: number; total: number }) => void)({
        loaded: 5,
        total: 10,
      });
    }
    expect(progress).toEqual([{ loaded: 5, total: 10 }]);
  });

  it('TR-FALLBACK-ON falls back to MyMemory when enabled and caches it', async () => {
    vi.stubGlobal('Translator', undefined);
    const fetchMock = vi.fn(async (url: string) => {
      expect(url).toContain('api.mymemory.translated.net/get');
      expect(url).toContain('langpair=ja%7Cen');
      return new Response(
        JSON.stringify({
          responseStatus: 200,
          responseData: { translatedText: 'A cat.' },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    });
    vi.stubGlobal('fetch', fetchMock);

    const providers: string[] = [];
    const result = await translateSentence('猫', {
      onlineEnabled: true,
      onProvider: (provider) => providers.push(provider),
    });
    expect(result).toEqual({ text: 'A cat.', provider: 'mymemory', cached: false });
    expect(providers).toEqual(['mymemory']);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const cached = await translateSentence('猫', { onlineEnabled: false });
    expect(cached.cached).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('TR-MYMEMORY validates responses and rejects over-long text', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(JSON.stringify({ responseStatus: 200, responseData: { translatedText: 'A cat.' } }), {
          status: 200,
        }),
      ),
    );
    expect(await mymemoryTranslate('猫')).toBe('A cat.');

    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(JSON.stringify({ responseStatus: 403, responseData: { translatedText: '' } }), {
          status: 200,
        }),
      ),
    );
    await expect(mymemoryTranslate('猫')).rejects.toBeInstanceOf(TranslationError);

    await expect(mymemoryTranslate('あ'.repeat(451))).rejects.toBeInstanceOf(
      TranslationTooLongError,
    );
  });

  it('TR-TOO-LONG preserves the too-long error instead of flattening it', async () => {
    vi.stubGlobal('Translator', undefined);
    await expect(
      translateSentence('あ'.repeat(451), { onlineEnabled: true }),
    ).rejects.toBeInstanceOf(TranslationTooLongError);
  });

  it('TR-TIMEOUT aborts MyMemory after the configured timeout', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async (_url: string, init?: RequestInit) =>
          new Promise<Response>((_resolve, reject) => {
            init?.signal?.addEventListener('abort', () => {
              reject(new DOMException('Aborted', 'AbortError'));
            });
          }),
      ),
    );

    await expect(mymemoryTranslate('猫', { timeoutMs: 15 })).rejects.toBeInstanceOf(
      TranslationTimeoutError,
    );
  });

  it('TR-STALE never returns or caches a superseded in-flight result', async () => {
    const resolvers: Array<(value: string) => void> = [];
    vi.stubGlobal('Translator', {
      availability: async () => 'available',
      create: async () => ({
        translate: () =>
          new Promise<string>((resolve) => {
            resolvers.push(resolve);
          }),
        destroy: () => undefined,
      }),
    });

    const controller = new AbortController();
    const first = translateSentence('犬', { onlineEnabled: false, signal: controller.signal });
    await vi.waitFor(() => expect(resolvers.length).toBe(1));

    controller.abort();
    const second = translateSentence('犬', { onlineEnabled: false });
    await vi.waitFor(() => expect(resolvers.length).toBe(2));

    resolvers[0]?.('stale translation');
    await expect(first).rejects.toBeInstanceOf(TranslationError);

    resolvers[1]?.('fresh translation');
    const fresh = await second;
    expect(fresh.text).toBe('fresh translation');

    const key = await translationKey('犬');
    expect((await getCachedTranslation(key))?.text).toBe('fresh translation');
  });

  it('TR-UNAVAILABLE distinguishes disabled online translation', async () => {
    vi.stubGlobal('Translator', undefined);
    await expect(translateSentence('猫', { onlineEnabled: false })).rejects.toMatchObject({
      name: 'TranslationUnavailableError',
      reason: 'online-disabled',
    });
    await expect(translateSentence('猫', { onlineEnabled: false })).rejects.toBeInstanceOf(
      TranslationUnavailableError,
    );
  });
});
