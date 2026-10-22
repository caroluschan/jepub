import { describe, expect, it, vi } from 'vitest';
import { shareBook } from '../../src/lib/share/shareBook';
import type { BookRecord } from '../../src/lib/types';

function makeBook(overrides: Partial<BookRecord> = {}): BookRecord {
  return {
    id: 'book-1',
    title: '羅生門',
    author: '芥川龍之介',
    language: 'ja',
    cover: null,
    fileName: 'rashomon.epub',
    fileSize: 10,
    fileHash: 'hash',
    chapterCount: 1,
    addedAt: 1,
    lastOpenedAt: null,
    progress: { chapterIndex: 0, ratio: 0 },
    source: 'file',
    ...overrides,
  };
}

function abortError(): Error {
  const error = new Error('Share cancelled');
  error.name = 'AbortError';
  return error;
}

describe('shareBook', () => {
  it('SHARE-FILE shares the stored file with its MIME type', async () => {
    const shared: ShareData[] = [];
    const outcome = await shareBook(makeBook(), {
      fileLoader: async () => new Blob(['epub-bytes']),
      canShare: () => true,
      share: async (data) => {
        shared.push(data);
      },
    });

    expect(outcome).toBe('shared');
    expect(shared).toHaveLength(1);
    expect(shared[0]?.title).toBe('羅生門');
    const file = shared[0]?.files?.[0];
    expect(file?.name).toBe('rashomon.epub');
    expect(file?.type).toBe('application/epub+zip');
    expect(await file?.text()).toBe('epub-bytes');
  });

  it('SHARE-AOZORA-URL shares the source URL instead of a file', async () => {
    const shared: ShareData[] = [];
    const fileLoader = vi.fn(async () => new Blob(['unused']));
    const outcome = await shareBook(
      makeBook({
        source: 'aozora',
        sourceUrl: 'https://www.aozora.gr.jp/cards/000879/card127.html',
      }),
      {
        fileLoader,
        share: async (data) => {
          shared.push(data);
        },
      },
    );

    expect(outcome).toBe('shared');
    expect(fileLoader).not.toHaveBeenCalled();
    expect(shared[0]?.url).toBe('https://www.aozora.gr.jp/cards/000879/card127.html');
    expect(shared[0]?.files).toBeUndefined();
  });

  it('SHARE-CANCEL reports cancelled and does not fall back', async () => {
    const clipboard = vi.fn(async () => undefined);
    const outcome = await shareBook(
      makeBook({ source: 'aozora', sourceUrl: 'https://www.aozora.gr.jp/cards/a/card1.html' }),
      {
        share: async () => {
          throw abortError();
        },
        clipboard,
      },
    );

    expect(outcome).toBe('cancelled');
    expect(clipboard).not.toHaveBeenCalled();
  });

  it('SHARE-FALLBACK-DOWNLOAD downloads when file sharing is unsupported', async () => {
    const download = vi.fn();
    const share = vi.fn(async () => undefined);

    const unsupported = await shareBook(makeBook(), {
      fileLoader: async () => new Blob(['mobi-bytes']),
      canShare: () => false,
      share,
      download,
    });

    expect(unsupported).toBe('downloaded');
    expect(share).not.toHaveBeenCalled();
    expect(download).toHaveBeenCalledTimes(1);
    const file = download.mock.calls[0]?.[0] as File;
    expect(file.name).toBe('rashomon.epub');

    const throwing = vi.fn(async () => {
      throw new TypeError('File sharing unsupported');
    });
    const secondDownload = vi.fn();
    const viaTypeError = await shareBook(makeBook({ fileName: 'book.mobi', source: 'mobi' }), {
      fileLoader: async () => new Blob(['mobi-bytes']),
      share: throwing,
      download: secondDownload,
    });

    expect(viaTypeError).toBe('downloaded');
    expect(secondDownload).toHaveBeenCalledTimes(1);
    expect((secondDownload.mock.calls[0]?.[0] as File).type).toBe(
      'application/x-mobipocket-ebook',
    );
  });

  it('SHARE-FALLBACK-COPY copies the Aozora URL when sharing fails', async () => {
    const copied: string[] = [];
    const outcome = await shareBook(
      makeBook({ source: 'aozora', sourceUrl: 'https://www.aozora.gr.jp/cards/a/card1.html' }),
      {
        share: async () => {
          throw new TypeError('Share unavailable');
        },
        clipboard: async (text) => {
          copied.push(text);
        },
      },
    );

    expect(outcome).toBe('copied');
    expect(copied).toEqual(['https://www.aozora.gr.jp/cards/a/card1.html']);
  });

  it('SHARE-FALLBACK-COPY reports failed when the clipboard is unavailable', async () => {
    const outcome = await shareBook(
      makeBook({ source: 'aozora', sourceUrl: 'https://www.aozora.gr.jp/cards/a/card1.html' }),
      {
        share: async () => {
          throw new TypeError('Share unavailable');
        },
      },
    );

    expect(outcome).toBe('failed');
  });
});
