import { createHash } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TranslationResult } from '../../src/lib/types';
import { translationKey } from '../../src/lib/translate/hash';
import { getCachedTranslation, writeTranslationCache } from '../../src/lib/translate/cache';
import { destroyOnDeviceTranslator } from '../../src/lib/translate/translatorApi';
import { translateSentence } from '../../src/lib/translate';
import { closeDb } from '../../src/lib/storage';

const CACHE_TEXT = '日本語を読む。';

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

describe('translation cache key and cache', () => {
  it('TR-CACHE-KEY hashes v1|<target>|text with SHA-256', async () => {
    const expected = createHash('sha256').update('v1|en|日本語').digest('hex');
    expect(await translationKey('日本語')).toBe(expected);
    expect(await translationKey('日本語')).toBe(await translationKey('日本語'));
    expect(await translationKey('英語')).not.toBe(await translationKey('日本語'));

    const french = createHash('sha256').update('v1|fr|日本語').digest('hex');
    expect(await translationKey('日本語', 'fr')).toBe(french);
    expect(await translationKey('日本語', 'fr')).not.toBe(
      await translationKey('日本語', 'de'),
    );
  });

  it('TR-CACHE-HIT returns a cached translation without touching providers', async () => {
    const key = await translationKey(CACHE_TEXT);
    await writeTranslationCache(key, 'Reading Japanese.', 'mymemory');

    const cached = await getCachedTranslation(key);
    expect(cached?.text).toBe('Reading Japanese.');
    expect(cached?.provider).toBe('mymemory');

    const onProvider = vi.fn();
    const result = await translateSentence(CACHE_TEXT, {
      targetLanguage: 'en',
      onlineEnabled: false,
      onProvider,
    });
    expect(result).toEqual<TranslationResult>({
      text: 'Reading Japanese.',
      provider: 'mymemory',
      cached: true,
    });
    expect(onProvider).not.toHaveBeenCalled();
  });
});
