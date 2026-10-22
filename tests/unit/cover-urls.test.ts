import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  clearCoverUrls,
  getCoverUrl,
  releaseCoverUrl,
} from '../../src/features/library/coverUrls';

afterEach(() => {
  clearCoverUrls();
  vi.restoreAllMocks();
});

describe('cover URL lifetime', () => {
  it('COVER-URL-CACHE returns one URL per book even when the Blob identity changes', () => {
    const create = vi.spyOn(URL, 'createObjectURL');
    const first = getCoverUrl('book-1', new Blob(['cover-a'], { type: 'image/png' }));
    const second = getCoverUrl('book-1', new Blob(['cover-a'], { type: 'image/png' }));

    expect(first).not.toBeNull();
    expect(second).toBe(first);
    expect(create).toHaveBeenCalledTimes(1);
  });

  it('COVER-URL-RELEASE revokes the cached URL and allows a fresh one', () => {
    const create = vi.spyOn(URL, 'createObjectURL');
    const revoke = vi.spyOn(URL, 'revokeObjectURL');
    const first = getCoverUrl('book-2', new Blob(['cover-b'], { type: 'image/png' }));
    expect(first).not.toBeNull();
    if (first === null) return;

    releaseCoverUrl('book-2');
    expect(revoke).toHaveBeenCalledWith(first);

    const second = getCoverUrl('book-2', new Blob(['cover-b'], { type: 'image/png' }));
    expect(second).not.toBe(first);
    expect(create).toHaveBeenCalledTimes(2);

    releaseCoverUrl('missing-book');
    expect(revoke).toHaveBeenCalledTimes(1);
  });
});
