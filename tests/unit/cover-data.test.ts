import { describe, expect, it } from 'vitest';
import { blobToDataUrl } from '../../src/lib/storage/cover';

describe('cover data URLs', () => {
  it('COVER-DATA-URL converts a cover blob into a stable data URL', async () => {
    const blob = new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' });
    await expect(blobToDataUrl(blob)).resolves.toBe('data:image/png;base64,AQID');
  });
});
