import type { TranslationProvider, TranslationResult } from '../types';
import { getCachedTranslation, writeTranslationCache } from './cache';
import {
  TranslationAbortedError,
  TranslationTooLongError,
  TranslationUnavailableError,
} from './errors';
import { translationKey } from './hash';
import { mymemoryTranslate } from './mymemory';
import { translateOnDevice } from './translatorApi';

export {
  TranslationAbortedError,
  TranslationTooLongError,
  TranslationUnavailableError,
} from './errors';

export interface TranslateSentenceOptions {
  targetLanguage: string;
  onlineEnabled: boolean;
  signal?: AbortSignal;
  onProgress?: (progress: { loaded: number; total: number }) => void;
  onProvider?: (provider: TranslationProvider) => void;
}

interface InflightEntry {
  token: number;
  signal: AbortSignal | undefined;
  promise: Promise<TranslationResult>;
}

const inflight = new Map<string, InflightEntry>();
const latestToken = new Map<string, number>();
let nextToken = 1;

function isLatest(key: string, token: number): boolean {
  return latestToken.get(key) === token;
}

function ensureCurrent(key: string, token: number, signal: AbortSignal | undefined): void {
  if (signal?.aborted === true || !isLatest(key, token)) {
    throw new TranslationAbortedError();
  }
}

async function runTranslation(
  text: string,
  key: string,
  token: number,
  options: TranslateSentenceOptions,
): Promise<TranslationResult> {
  ensureCurrent(key, token, options.signal);

  let onDevice: string | null = null;
  try {
    onDevice = await translateOnDevice(text, options.targetLanguage, options.onProgress);
  } catch {
    onDevice = null;
  }
  ensureCurrent(key, token, options.signal);

  if (onDevice !== null) {
    await writeTranslationCache(key, onDevice, 'on-device');
    ensureCurrent(key, token, options.signal);
    options.onProvider?.('on-device');
    return { text: onDevice, provider: 'on-device', cached: false };
  }

  if (!options.onlineEnabled) {
    throw new TranslationUnavailableError('online-disabled');
  }
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    throw new TranslationUnavailableError('offline');
  }

  let online: string;
  try {
    online = await mymemoryTranslate(text, {
      targetLanguage: options.targetLanguage,
      signal: options.signal,
    });
  } catch (error) {
    if (error instanceof TranslationAbortedError) throw error;
    // A too-long sentence is actionable in the UI (specific message, no
    // Retry), so it must not be flattened into a generic unavailability.
    if (error instanceof TranslationTooLongError) throw error;
    throw new TranslationUnavailableError('failed');
  }
  ensureCurrent(key, token, options.signal);

  await writeTranslationCache(key, online, 'mymemory');
  ensureCurrent(key, token, options.signal);
  options.onProvider?.('mymemory');
  return { text: online, provider: 'mymemory', cached: false };
}

export async function translateSentence(
  text: string,
  options: TranslateSentenceOptions,
): Promise<TranslationResult> {
  const key = await translationKey(text, options.targetLanguage);

  let cached: Awaited<ReturnType<typeof getCachedTranslation>> = null;
  try {
    cached = await getCachedTranslation(key);
  } catch (error) {
    console.warn('JEPUB: translation cache read failed.', error);
  }
  if (cached !== null) {
    return { text: cached.text, provider: cached.provider, cached: true };
  }

  const existing = inflight.get(key);
  if (existing !== undefined && existing.signal?.aborted !== true) {
    return existing.promise;
  }

  const token = nextToken;
  nextToken += 1;
  latestToken.set(key, token);

  const promise = runTranslation(text, key, token, options).finally(() => {
    const current = inflight.get(key);
    if (current?.token === token) {
      inflight.delete(key);
      latestToken.delete(key);
    }
  });

  inflight.set(key, { token, signal: options.signal, promise });
  return promise;
}
