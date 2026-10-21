import { describe, expect, it, vi } from 'vitest';

const { constructorOptions } = vi.hoisted(() => ({
  constructorOptions: [] as unknown[],
}));

vi.mock('kuroshiro-analyzer-kuromoji', () => ({
  default: class {
    constructor(options: unknown) {
      constructorOptions.push(options);
    }

    async init(): Promise<void> {
      return undefined;
    }
  },
}));

vi.mock('kuroshiro', () => ({
  default: class {
    async init(): Promise<void> {
      return undefined;
    }

    async convert(): Promise<string> {
      return '';
    }
  },
}));

import { preloadKuroshiro } from '../../src/lib/furigana/kuroshiro';

describe('kuroshiro dictionary wiring', () => {
  it('FURI-DICT-PATH hands the browser dictionary path to the analyzer', async () => {
    await preloadKuroshiro();

    expect(constructorOptions).toHaveLength(1);
    const options = constructorOptions[0] as { dictPath?: string; dicPath?: string };
    expect(options.dictPath).toBeDefined();
    expect(options.dictPath?.endsWith('kuromoji-dict/')).toBe(true);
    expect(options.dicPath).toBeUndefined();
  });
});
