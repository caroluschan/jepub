import { describe, expect, it } from 'vitest';
import { LRU } from '../../src/lib/furigana/lru';
import { ConversionQueue, FuriganaCancelledError } from '../../src/lib/furigana/queue';
import { sanitizeRuby } from '../../src/lib/furigana/sanitize';
import { FuriganaService } from '../../src/lib/furigana/service';
import type { FuriganaScript } from '../../src/lib/types';

interface FakeConverter {
  calls: string[];
  preload: () => Promise<void>;
  convertRuby: (text: string, script?: FuriganaScript) => Promise<string>;
  convertRomaji: (text: string) => Promise<string>;
}

function makeConverter(calls: string[]): FakeConverter {
  return {
    calls,
    preload: async () => undefined,
    convertRuby: async (text, script = 'katakana') => {
      calls.push(`ruby:${script}:${text}`);
      return `<ruby>${text}<rt>よみ</rt></ruby>`;
    },
    convertRomaji: async (text) => {
      calls.push(`romaji:${text}`);
      return 'Tōkyō';
    },
  };
}

describe('furigana', () => {
  it('FURI-SANITIZE keeps only ruby, rt, rp and rb without attributes', () => {
    const dirty =
      '<ruby onclick="steal()">漢<rp>(</rp><rt class="x">かん</rt><rp>)</rp></ruby><script>alert(1)</script><b>bold</b>';
    const clean = sanitizeRuby(dirty);
    expect(clean).toContain('<ruby>');
    expect(clean).toContain('<rt>かん</rt>');
    expect(clean).not.toContain('onclick');
    expect(clean).not.toContain('script');
    expect(clean).not.toContain('<b>');
    expect(clean).not.toContain('class=');
  });

  it('FURI-LRU evicts the least recently used entry', () => {
    const lru = new LRU<string, string>(2);
    lru.set('a', '1');
    lru.set('b', '2');
    expect(lru.get('a')).toBe('1');
    lru.set('c', '3');
    expect(lru.size()).toBe(2);
    expect(lru.get('b')).toBeUndefined();
    expect(lru.get('a')).toBe('1');
    expect(lru.get('c')).toBe('3');
    lru.clear();
    expect(lru.size()).toBe(0);
  });

  it('FURI-QUEUE runs conversions strictly sequentially', async () => {
    const queue = new ConversionQueue();
    const order: string[] = [];
    const gate: { release: () => void } = { release: () => undefined };

    const first = queue.enqueue(async () => {
      order.push('first-start');
      await new Promise<void>((resolve) => {
        gate.release = resolve;
      });
      order.push('first-end');
      return 'first';
    });
    const second = queue.enqueue(async () => {
      order.push('second-start');
      return 'second';
    });

    await Promise.resolve();
    expect(order).toEqual(['first-start']);
    gate.release();
    await expect(first).resolves.toBe('first');
    await expect(second).resolves.toBe('second');
    expect(order).toEqual(['first-start', 'first-end', 'second-start']);
  });

  it('FURI-CANCEL rejects queued work from a superseded generation', async () => {
    const queue = new ConversionQueue();
    const gate: { release: () => void } = { release: () => undefined };

    const running = queue.enqueue(async () => {
      await new Promise<void>((resolve) => {
        gate.release = resolve;
      });
      return 'running';
    });
    await Promise.resolve();

    const queued = queue.enqueue(async () => 'queued');
    queue.cancel();
    gate.release();
    await expect(running).resolves.toBe('running');
    await expect(queued).rejects.toBeInstanceOf(FuriganaCancelledError);

    queue.reset();
    await expect(queue.enqueue(async () => 'fresh')).resolves.toBe('fresh');
  });

  it('ROMAJI-CLEAN and ruby conversions reuse the cache and converter output', async () => {
    const calls: string[] = [];
    const service = new FuriganaService(makeConverter(calls));

    expect(await service.getRomaji('東京')).toBe('Tōkyō');
    expect(await service.getRomaji('東京')).toBe('Tōkyō');
    expect(calls.filter((call) => call === 'romaji:東京')).toHaveLength(1);

    expect(await service.getRuby('猫')).toBe('<ruby>猫<rt>よみ</rt></ruby>');
    expect(await service.getRuby('猫')).toBe('<ruby>猫<rt>よみ</rt></ruby>');
    expect(calls.filter((call) => call === 'ruby:katakana:猫')).toHaveLength(1);
  });

  it('FURI-SCRIPT defaults to katakana and caches each script separately', async () => {
    const calls: string[] = [];
    const service = new FuriganaService({
      ...makeConverter(calls),
      convertRuby: async (text, script = 'katakana') => {
        calls.push(`ruby:${script}:${text}`);
        const reading = script === 'hiragana' ? 'ねこ' : 'ネコ';
        return `<ruby>${text}<rt>${reading}</rt></ruby>`;
      },
    });

    expect(await service.getRuby('猫')).toContain('ネコ');
    expect(await service.getRuby('猫', 'hiragana')).toContain('ねこ');
    expect(await service.getRuby('猫', 'katakana')).toContain('ネコ');
    expect(await service.getRuby('猫', 'hiragana')).toContain('ねこ');
    expect(calls).toEqual(['ruby:katakana:猫', 'ruby:hiragana:猫']);
  });
});
