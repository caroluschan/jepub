import type { TranslationProvider } from '../types';
import {
  cacheTranslation,
  getCachedTranslation,
  pruneTranslations,
  type StoredTranslation,
} from '../storage';

export { getCachedTranslation };

export async function writeTranslationCache(
  key: string,
  text: string,
  provider: TranslationProvider,
): Promise<void> {
  try {
    await cacheTranslation(key, text, provider);
  } catch (error) {
    // Cache persistence is optional: quota/IDB failures must never hide a
    // translation that succeeded.
    console.warn('JEPUB: translation cache write failed.', error);
    return;
  }
  try {
    await pruneTranslations(3000);
  } catch (error) {
    console.warn('JEPUB: translation cache prune failed.', error);
  }
}

export async function readTranslationCache(key: string): Promise<StoredTranslation | null> {
  return getCachedTranslation(key);
}

export async function pruneTranslationCache(): Promise<void> {
  await pruneTranslations(3000);
}
