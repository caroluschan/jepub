import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import type { BookRecord, ChapterSet } from '../../src/lib/types';
import {
  cacheTranslation,
  closeDb,
  deleteBook,
  getCachedTranslation,
  findBookByHash,
  getAssets,
  getBook,
  getBookFile,
  getChapterSet,
  importBookAtomic,
  listBooks,
  openDb,
  pruneTranslations,
  saveKnowledgeRecord,
  listKnowledgeRecords,
  deleteKnowledgeRecord,
  updateProgress,
} from '../../src/lib/storage';

function makeBook(id: string, overrides: Partial<BookRecord> = {}): BookRecord {
  return {
    id,
    title: `Book ${id}`,
    author: '作者',
    language: 'ja',
    cover: null,
    fileName: `${id}.epub`,
    fileSize: 1234,
    fileHash: `hash-${id}`,
    chapterCount: 1,
    addedAt: 100,
    lastOpenedAt: null,
    progress: { chapterIndex: 0, ratio: 0 },
    source: 'file',
    ...overrides,
  };
}

function makeChapterSet(bookId: string): ChapterSet {
  return {
    bookId,
    version: 1,
    chapters: [
      {
        index: 0,
        href: 'OEBPS/ch1.xhtml',
        title: '第一章',
        dir: 'OEBPS',
        blocks: [{ kind: 'paragraph', sentences: ['本文。'] }],
        imagePaths: [],
        textLength: 3,
      },
    ],
    toc: [{ title: '第一章', chapterIndex: 0, fragment: null, depth: 0 }],
  };
}

async function resetDatabase(): Promise<void> {
  await closeDb();
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase('jepub');
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error ?? new Error('deleteDatabase failed'));
    request.onblocked = () => resolve();
  });
}

beforeEach(async () => {
  await resetDatabase();
});

afterEach(async () => {
  await resetDatabase();
});

describe('storage', () => {
  it('DB-ATOMIC stores book, file, chapter set and assets together', async () => {
    const book = makeBook('a');
    const fileBlob = new Blob(['epub-bytes'], { type: 'application/epub+zip' });
    const assets = [
      { path: 'OEBPS/images/a.png', mime: 'image/png', blob: new Blob(['a'], { type: 'image/png' }) },
      { path: 'OEBPS/images/b.png', mime: 'image/png', blob: new Blob(['b'], { type: 'image/png' }) },
    ];

    await importBookAtomic(book, fileBlob, makeChapterSet(book.id), assets);

    expect(await getBook(book.id)).toEqual(book);
    expect(await getBookFile(book.id)).not.toBeNull();
    expect(await getChapterSet(book.id)).toEqual(makeChapterSet(book.id));
    const storedAssets = await getAssets(book.id, assets.map((asset) => asset.path));
    expect([...storedAssets.keys()].sort()).toEqual([
      'OEBPS/images/a.png',
      'OEBPS/images/b.png',
    ]);
    expect(await storedAssets.get('OEBPS/images/a.png')?.text()).toBe('a');
  });

  it('DB-LIST-DELETE lists by recency and cascades deletes in one transaction', async () => {
    await importBookAtomic(
      makeBook('old', { lastOpenedAt: 200, addedAt: 500 }),
      new Blob(['old']),
      makeChapterSet('old'),
      [{ path: 'p', mime: 'image/png', blob: new Blob(['p']) }],
    );
    await importBookAtomic(
      makeBook('new', { lastOpenedAt: 300, addedAt: 100 }),
      new Blob(['new']),
      makeChapterSet('new'),
      [],
    );
    await importBookAtomic(
      makeBook('unopened', { lastOpenedAt: null, addedAt: 900 }),
      new Blob(['unopened']),
      makeChapterSet('unopened'),
      [],
    );

    expect((await listBooks()).map((book) => book.id)).toEqual(['new', 'old', 'unopened']);

    await deleteBook('old');
    expect(await getBook('old')).toBeUndefined();
    expect(await getBookFile('old')).toBeNull();
    expect(await getChapterSet('old')).toBeUndefined();
    expect(await getAssets('old', ['p'])).toEqual(new Map());
    expect((await listBooks()).map((book) => book.id)).toEqual(['new', 'unopened']);
  });

  it('DB-PROGRESS updates progress and touches lastOpenedAt only when asked', async () => {
    const book = makeBook('progress');
    await importBookAtomic(book, new Blob(['x']), makeChapterSet(book.id), []);

    const before = Date.now();
    await updateProgress('progress', { chapterIndex: 1, ratio: 0.5 }, true);
    const opened = await getBook('progress');
    expect(opened?.progress).toEqual({ chapterIndex: 1, ratio: 0.5 });
    expect(opened?.lastOpenedAt).not.toBeNull();
    expect(opened?.lastOpenedAt ?? 0).toBeGreaterThanOrEqual(before);

    await updateProgress('progress', { chapterIndex: 2, ratio: 0.75 }, false);
    const untouched = await getBook('progress');
    expect(untouched?.progress).toEqual({ chapterIndex: 2, ratio: 0.75 });
    expect(untouched?.lastOpenedAt).toBe(opened?.lastOpenedAt);
  });

  it('DB-DEDUPE finds an existing book by file hash', async () => {
    const book = makeBook('dedupe', { fileHash: 'same-hash' });
    await importBookAtomic(book, new Blob(['x']), makeChapterSet(book.id), []);

    expect(await findBookByHash('same-hash')).toEqual(book);
    expect(await findBookByHash('missing')).toBeNull();
  });

  it('DB-RETRY resets a rejected open so Retry can succeed', async () => {
    const openSpy = vi.spyOn(indexedDB, 'open');
    openSpy.mockImplementationOnce(() => {
      throw new Error('IndexedDB blocked');
    });

    await expect(openDb()).rejects.toThrow('IndexedDB blocked');
    await expect(closeDb()).resolves.toBeUndefined();

    // The failed promise must not be cached forever.
    await expect(listBooks()).resolves.toEqual([]);
    expect(openSpy).toHaveBeenCalled();
  });

  it('DB-DELETE-TRANSLATIONS clears cached sentences when a book is deleted', async () => {
    const book = makeBook('translations');
    await importBookAtomic(book, new Blob(['x']), makeChapterSet(book.id), []);
    await cacheTranslation('sentence-key', 'Cached sentence.', 'mymemory');
    expect((await getCachedTranslation('sentence-key'))?.text).toBe('Cached sentence.');

    await deleteBook(book.id);
    expect(await getCachedTranslation('sentence-key')).toBeNull();
  });

  it('DB-PRUNE keeps the newest translations', async () => {
    const now = vi.spyOn(Date, 'now');
    now.mockReturnValue(1_000);
    await cacheTranslation('old', 'Old.', 'mymemory');
    now.mockReturnValue(2_000);
    await cacheTranslation('new', 'New.', 'mymemory');
    await pruneTranslations(1);
    expect(await getCachedTranslation('old')).toBeNull();
    expect((await getCachedTranslation('new'))?.text).toBe('New.');
  });

  it('DB-ASSETS keys assets by book id and returns only requested paths', async () => {
    const book = makeBook('assets');
    await importBookAtomic(book, new Blob(['x']), makeChapterSet(book.id), [
      { path: 'one', mime: 'image/png', blob: new Blob(['one']) },
      { path: 'two', mime: 'image/png', blob: new Blob(['two']) },
      { path: 'three', mime: 'image/png', blob: new Blob(['three']) },
    ]);

    const selected = await getAssets('assets', ['one', 'three']);
    expect([...selected.keys()].sort()).toEqual(['one', 'three']);
    expect(await selected.get('three')?.text()).toBe('three');
    expect(await getAssets('assets', ['missing'])).toEqual(new Map());

    const db = await openDb();
    expect(await db.get('assets', 'assets:one')).toMatchObject({
      bookId: 'assets',
      path: 'one',
    });
  });
});

  it('DB-KNOWLEDGE saves, deduplicates, lists, and deletes records', async () => {
    const record = {
      id: 'knowledge-1',
      kind: 'translation' as const,
      sentence: '吾輩は猫である。',
      translation: 'I am a cat.',
      targetLanguage: 'en',
      createdAt: 100,
      fingerprint: 'translation-test',
    };
    await saveKnowledgeRecord(record);
    await saveKnowledgeRecord({ ...record, id: 'knowledge-2', createdAt: 200 });
    const records = await listKnowledgeRecords();
    expect(records).toHaveLength(1);
    expect(records[0]?.id).toBe('knowledge-1');

    await deleteKnowledgeRecord('knowledge-1');
    expect(await listKnowledgeRecords()).toEqual([]);
  });
