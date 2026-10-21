import { describe, expect, it } from 'vitest';
import { buildSyntheticEpub, type SyntheticEpubOptions } from '../fixtures/build-epub';

function hex(bytes: Uint8Array): string {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

describe('deterministic test fixtures', () => {
  it('ZIP-DETERMINISTIC produces byte-identical archives across builds', async () => {
    const options: SyntheticEpubOptions = {
      title: 'Deterministic',
      chapters: [
        {
          href: 'OEBPS/ch1.xhtml',
          title: '第一章',
          body: '<h1>第一章</h1><p>本文です。</p>',
        },
      ],
    };

    const first = new Uint8Array(await (await buildSyntheticEpub(options)).arrayBuffer());
    await new Promise((resolve) => setTimeout(resolve, 2100));
    const second = new Uint8Array(await (await buildSyntheticEpub(options)).arrayBuffer());

    expect(hex(second)).toBe(hex(first));
  });
});
