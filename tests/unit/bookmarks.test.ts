import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  addBookmark,
  closeDb,
  deleteBook,
  deleteBookmark,
  getBook,
  importBookAtomic,
  listBookmarks,
  openDb,
} from '../../src/lib/storage';
import type { Bookmark, BookRecord, ChapterSet } from '../../src/lib/types';

function makeBook(id: string): BookRecord {
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

function makeBookmark(id: string, bookId: string, createdAt: number): Bookmark {
  return {
    id,
    bookId,
    chapterIndex: 0,
    ratio: 0.25,
    chapterTitle: '第一章',
    createdAt,
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

async function seedBook(id: string): Promise<void> {
  await importBookAtomic(makeBook(id), new Blob(['book']), makeChapterSet(id), []);
}

beforeEach(resetDatabase);
afterEach(resetDatabase);

describe('bookmarks', () => {
  it('BOOKMARK-CRUD adds, lists, and deletes bookmarks', async () => {
    await seedBook('book');
    await addBookmark(makeBookmark('one', 'book', 100));
    await addBookmark(makeBookmark('two', 'book', 200));

    expect((await listBookmarks('book')).map((bookmark) => bookmark.id)).toEqual([
      'two',
      'one',
    ]);

    await deleteBookmark('one');
    expect((await listBookmarks('book')).map((bookmark) => bookmark.id)).toEqual(['two']);
  });

  it('BOOKMARK-ORDER sorts newest first and scopes to a book', async () => {
    await seedBook('a');
    await seedBook('b');
    await addBookmark(makeBookmark('old', 'a', 100));
    await addBookmark(makeBookmark('newest', 'a', 300));
    await addBookmark(makeBookmark('middle', 'a', 200));
    await addBookmark(makeBookmark('other', 'b', 400));

    expect((await listBookmarks('a')).map((bookmark) => bookmark.id)).toEqual([
      'newest',
      'middle',
      'old',
    ]);
    expect((await listBookmarks('b')).map((bookmark) => bookmark.id)).toEqual(['other']);
    expect(await listBookmarks('missing')).toEqual([]);
  });

  it('BOOKMARK-DELETE-CASCADE removes a book and only its bookmarks', async () => {
    await seedBook('delete-me');
    await seedBook('keep-me');
    await addBookmark(makeBookmark('mine-1', 'delete-me', 100));
    await addBookmark(makeBookmark('mine-2', 'delete-me', 200));
    await addBookmark(makeBookmark('theirs', 'keep-me', 150));

    await deleteBook('delete-me');

    expect(await getBook('delete-me')).toBeUndefined();
    expect(await listBookmarks('delete-me')).toEqual([]);
    expect((await listBookmarks('keep-me')).map((bookmark) => bookmark.id)).toEqual([
      'theirs',
    ]);
  });

  it('BOOKMARK-MIGRATION upgrades a v1 database without losing book data', async () => {
    const legacyBook = makeBook('legacy');
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open('jepub', 1);
      request.onupgradeneeded = () => {
        const database = request.result;
        const books = database.createObjectStore('books', { keyPath: 'id' });
        books.createIndex('lastOpenedAt', 'lastOpenedAt');
        books.createIndex('fileHash', 'fileHash');
        database.createObjectStore('files', { keyPath: 'id' });
        database.createObjectStore('chapterSets', { keyPath: 'bookId' });
        const assets = database.createObjectStore('assets', { keyPath: 'key' });
        assets.createIndex('bookId', 'bookId');
        const translations = database.createObjectStore('translations', { keyPath: 'key' });
        translations.createIndex('createdAt', 'createdAt');
      };
      request.onsuccess = () => {
        const database = request.result;
        const transaction = database.transaction('books', 'readwrite');
        transaction.objectStore('books').put(legacyBook);
        transaction.oncomplete = () => {
          database.close();
          resolve();
        };
        transaction.onerror = () => reject(transaction.error ?? new Error('put failed'));
      };
      request.onerror = () => reject(request.error ?? new Error('open failed'));
    });

    const database = await openDb();
    expect(database.version).toBe(2);
    expect(database.objectStoreNames.contains('bookmarks')).toBe(true);
    expect(await database.get('books', 'legacy')).toEqual(legacyBook);

    await addBookmark(makeBookmark('after-upgrade', 'legacy', 500));
    expect((await listBookmarks('legacy')).map((bookmark) => bookmark.id)).toEqual([
      'after-upgrade',
    ]);
  });
});
