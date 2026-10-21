import Kuroshiro from 'kuroshiro';
import KuromojiAnalyzer from 'kuroshiro-analyzer-kuromoji';
import type { FuriganaScript } from '../types';
import { cleanRomaji } from '../text/romaji';
import { sanitizeRuby } from './sanitize';

export class FuriganaError extends Error {
  constructor(message = 'Furigana conversion failed.') {
    super(message);
    this.name = 'FuriganaError';
  }
}

let instancePromise: Promise<Kuroshiro> | null = null;

async function getKuroshiro(): Promise<Kuroshiro> {
  if (instancePromise === null) {
    instancePromise = (async () => {
      const instance = new Kuroshiro();
      await instance.init(
        new KuromojiAnalyzer({ dictPath: `${import.meta.env.BASE_URL}kuromoji-dict/` }),
      );
      return instance;
    })().catch((error: unknown) => {
      instancePromise = null;
      throw new FuriganaError(
        error instanceof Error ? error.message : 'Could not initialize the Japanese analyzer.',
      );
    });
  }
  return instancePromise;
}

export async function preloadKuroshiro(): Promise<void> {
  await getKuroshiro();
}

export async function convertRuby(
  text: string,
  script: FuriganaScript = 'katakana',
): Promise<string> {
  const kuroshiro = await getKuroshiro();
  try {
    const converted = await kuroshiro.convert(text, { to: script, mode: 'furigana' });
    return sanitizeRuby(converted);
  } catch {
    throw new FuriganaError();
  }
}

export async function convertRomaji(text: string): Promise<string> {
  const kuroshiro = await getKuroshiro();
  try {
    const converted = await kuroshiro.convert(text, { to: 'romaji', mode: 'spaced' });
    return cleanRomaji(converted);
  } catch {
    throw new FuriganaError();
  }
}
