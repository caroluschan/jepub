import type { FuriganaScript } from '../types';
import { convertRomaji, convertRuby, preloadKuroshiro } from './kuroshiro';
import { LRU } from './lru';
import { ConversionQueue, FuriganaCancelledError } from './queue';

export type FuriganaStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface FuriganaConverter {
  preload(): Promise<void>;
  convertRuby(text: string, script?: FuriganaScript): Promise<string>;
  convertRomaji(text: string): Promise<string>;
}

export type FuriganaStatusListener = (status: FuriganaStatus) => void;

const DEFAULT_CONVERTER: FuriganaConverter = {
  preload: preloadKuroshiro,
  convertRuby,
  convertRomaji,
};

export class FuriganaService {
  private readonly converter: FuriganaConverter;
  // The ruby cache is keyed by script so switching readings never reuses the
  // wrong kana form.
  private readonly rubyCache = new LRU<string, string>(1500);
  private readonly romajiCache = new LRU<string, string>(1500);
  private readonly queue = new ConversionQueue();
  private readonly listeners = new Set<FuriganaStatusListener>();
  private status: FuriganaStatus = 'idle';

  constructor(converter: FuriganaConverter = DEFAULT_CONVERTER) {
    this.converter = converter;
  }

  getStatus(): FuriganaStatus {
    return this.status;
  }

  onStatusChange(listener: FuriganaStatusListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private setStatus(status: FuriganaStatus): void {
    if (this.status === status) return;
    this.status = status;
    for (const listener of this.listeners) listener(status);
  }

  private async runConversion<T>(task: () => Promise<T>): Promise<T> {
    this.setStatus('loading');
    try {
      const result = await this.queue.enqueue(task);
      this.setStatus('ready');
      return result;
    } catch (error) {
      this.setStatus(error instanceof FuriganaCancelledError ? 'idle' : 'error');
      throw error;
    }
  }

  async getRuby(text: string, script: FuriganaScript = 'katakana'): Promise<string> {
    const cacheKey = `${script}\u0000${text}`;
    const cached = this.rubyCache.get(cacheKey);
    if (cached !== undefined) return cached;
    const result = await this.runConversion(() => this.converter.convertRuby(text, script));
    this.rubyCache.set(cacheKey, result);
    return result;
  }

  async getRomaji(text: string): Promise<string> {
    const cached = this.romajiCache.get(text);
    if (cached !== undefined) return cached;
    const result = await this.runConversion(() => this.converter.convertRomaji(text));
    this.romajiCache.set(text, result);
    return result;
  }

  async preload(): Promise<void> {
    await this.runConversion(() => this.converter.preload());
  }

  clear(): void {
    this.rubyCache.clear();
    this.romajiCache.clear();
  }

  cancel(): void {
    this.queue.cancel();
    this.setStatus('idle');
  }
}

export const furiganaService = new FuriganaService();

export function getRuby(text: string, script: FuriganaScript = 'katakana'): Promise<string> {
  return furiganaService.getRuby(text, script);
}

export function getRomaji(text: string): Promise<string> {
  return furiganaService.getRomaji(text);
}

export function preload(): Promise<void> {
  return furiganaService.preload();
}

export function clear(): void {
  furiganaService.clear();
}

export function getFuriganaStatus(): FuriganaStatus {
  return furiganaService.getStatus();
}

export function onFuriganaStatusChange(listener: FuriganaStatusListener): () => void {
  return furiganaService.onStatusChange(listener);
}
