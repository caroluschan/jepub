import {
  TranslationAbortedError,
  TranslationError,
  TranslationTimeoutError,
  TranslationTooLongError,
} from './errors';
import { DEFAULT_TRANSLATION_TARGET, getTranslationLanguage } from './languages';

export const MYMEMORY_ENDPOINT = 'https://api.mymemory.translated.net/get';
export const MYMEMORY_MAX_CHARS = 450;
export const MYMEMORY_TIMEOUT_MS = 8000;

export interface MyMemoryOptions {
  targetLanguage?: string;
  signal?: AbortSignal;
  timeoutMs?: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export async function mymemoryTranslate(
  text: string,
  options: MyMemoryOptions = {},
): Promise<string> {
  if (text.length > MYMEMORY_MAX_CHARS) {
    throw new TranslationTooLongError();
  }

  if (options.signal?.aborted) {
    throw new TranslationAbortedError();
  }

  const controller = new AbortController();
  let timedOut = false;
  const timeoutMs = options.timeoutMs ?? MYMEMORY_TIMEOUT_MS;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  const onCallerAbort = (): void => controller.abort();
  options.signal?.addEventListener('abort', onCallerAbort, { once: true });

  try {
    const target = getTranslationLanguage(
      options.targetLanguage ?? DEFAULT_TRANSLATION_TARGET,
    ).myMemoryCode;
    const url = `${MYMEMORY_ENDPOINT}?q=${encodeURIComponent(text)}&langpair=${encodeURIComponent(
      `ja|${target}`,
    )}`;
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      throw new TranslationError(`MyMemory returned HTTP ${response.status}.`);
    }

    const payload: unknown = await response.json();
    if (!isRecord(payload)) {
      throw new TranslationError('MyMemory returned an invalid response.');
    }

    const status = payload['responseStatus'];
    const statusOk = status === 200 || status === '200';
    if (!statusOk) {
      throw new TranslationError('MyMemory rejected the translation request.');
    }

    const data = payload['responseData'];
    if (!isRecord(data)) {
      throw new TranslationError('MyMemory returned no translation data.');
    }
    const translated = data['translatedText'];
    if (typeof translated !== 'string' || translated.trim().length === 0) {
      throw new TranslationError('MyMemory returned an empty translation.');
    }
    return translated.trim();
  } catch (error) {
    if (timedOut) throw new TranslationTimeoutError();
    if (controller.signal.aborted) throw new TranslationAbortedError();
    if (error instanceof TranslationError) throw error;
    throw new TranslationError('Could not reach the translation service.');
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener('abort', onCallerAbort);
  }
}
