import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type {
  Bookmark,
  BookProgress,
  BookRecord,
  ChapterSet,
  TranslationProvider,
} from '../types';
import type { AssetInput, StoredAsset, StoredFile, StoredTranslation } from './types';

interface JepubDatabase extends DBSchema {
  books: {
    key: string;
    value: BookRecord;
    indexes: { lastOpenedAt: number; fileHash: string };
  };
  files: {
    key: string;
    value: StoredFile;
  };
  chapterSets: {
    key: string;
    value: ChapterSet;
  };
  assets: {
    key: string;
    value: StoredAsset;
    indexes: { bookId: string };
  };
  translations: {
    key: string;
    value: StoredTranslation;
    indexes: { createdAt: number };
  };
  bookmarks: {
    key: string;
    value: Bookmark;
    indexes: { bookId: string };
  };
}

export function assetKey(bookId: string, path: string): string {
  return `${bookId}:${path}`;
}

let databasePromise: Promise<IDBPDatabase<JepubDatabase>> | null = null;

export function openDb(): Promise<IDBPDatabase<JepubDatabase>> {
  if (databasePromise === null) {
    // Promise.resolve().then() also converts a synchronous IndexedDB failure
    // into a rejection instead of throwing out of openDb().
    const attempt = Promise.resolve().then(() =>
      openDB<JepubDatabase>('jepub', 2, {
        upgrade(database, oldVersion) {
          if (oldVersion < 1) {
            const books = database.createObjectStore('books', { keyPath: 'id' });
            books.createIndex('lastOpenedAt', 'lastOpenedAt');
            books.createIndex('fileHash', 'fileHash');

            database.createObjectStore('files', { keyPath: 'id' });
            database.createObjectStore('chapterSets', { keyPath: 'bookId' });

            const assets = database.createObjectStore('assets', { keyPath: 'key' });
            assets.createIndex('bookId', 'bookId');

            const translations = database.createObjectStore('translations', { keyPath: 'key' });
            translations.createIndex('createdAt', 'createdAt');
          }

          if (oldVersion < 2) {
            const bookmarks = database.createObjectStore('bookmarks', { keyPath: 'id' });
            bookmarks.createIndex('bookId', 'bookId');
          }
        },
      }),
    );
    // Never cache a rejected open: a blocked/private-mode failure must be
    // retryable from the library's Retry button.
    databasePromise = attempt.catch((error: unknown) => {
      databasePromise = null;
      throw error;
    });
  }
  return databasePromise;
}

export async function closeDb(): Promise<void> {
  if (databasePromise === null) return;
  const pending = databasePromise;
  databasePromise = null;
  try {
    const database = await pending;
    database.close();
  } catch (error) {
    // A rejected open has nothing to close; resetting above makes retry work.
    console.warn('JEPUB: database close skipped after a failed open.', error);
  }
}

export async function importBookAtomic(
  book: BookRecord,
  fileBlob: Blob,
  chapterSet: ChapterSet,
  assets: readonly AssetInput[],
): Promise<void> {
  const database = await openDb();
  const transaction = database.transaction(
    ['books', 'files', 'chapterSets', 'assets'],
    'readwrite',
  );

  await transaction.objectStore('books').put(book);
  await transaction.objectStore('files').put({ id: book.id, blob: fileBlob });
  await transaction.objectStore('chapterSets').put(chapterSet);

  const assetsStore = transaction.objectStore('assets');
  for (const asset of assets) {
    await assetsStore.put({
      key: assetKey(book.id, asset.path),
      bookId: book.id,
      path: asset.path,
      blob: asset.blob,
      mime: asset.mime,
    });
  }

  await transaction.done;
}

export async function updateProgress(
  id: string,
  progress: BookProgress,
  touchLastOpened: boolean,
): Promise<void> {
  const database = await openDb();
  const transaction = database.transaction('books', 'readwrite');
  const store = transaction.objectStore('books');
  const book = await store.get(id);
  if (book !== undefined) {
    await store.put({
      ...book,
      progress,
      lastOpenedAt: touchLastOpened ? Date.now() : book.lastOpenedAt,
    });
  }
  await transaction.done;
}

export async function deleteBook(id: string): Promise<void> {
  const database = await openDb();
  const transaction = database.transaction(
    ['books', 'files', 'chapterSets', 'assets', 'translations', 'bookmarks'],
    'readwrite',
  );

  const assetKeys = await transaction.objectStore('assets').index('bookId').getAllKeys(id);
  for (const key of assetKeys) {
    await transaction.objectStore('assets').delete(key);
  }

  const bookmarkKeys = await transaction
    .objectStore('bookmarks')
    .index('bookId')
    .getAllKeys(id);
  for (const key of bookmarkKeys) {
    await transaction.objectStore('bookmarks').delete(key);
  }

  await transaction.objectStore('books').delete(id);
  await transaction.objectStore('files').delete(id);
  await transaction.objectStore('chapterSets').delete(id);
  // Translation keys are text hashes with no reliable book back-reference, so
  // clearing the whole derived cache guarantees deleted book text never
  // survives on disk.
  await transaction.objectStore('translations').clear();
  await transaction.done;
}

export async function cacheTranslation(
  key: string,
  text: string,
  provider: TranslationProvider,
): Promise<void> {
  const database = await openDb();
  await database.put('translations', {
    key,
    text,
    provider,
    createdAt: Date.now(),
  });
}

export async function getCachedTranslation(key: string): Promise<StoredTranslation | null> {
  const database = await openDb();
  const record = await database.get('translations', key);
  return record ?? null;
}

export async function pruneTranslations(keep = 3000): Promise<void> {
  const database = await openDb();
  const transaction = database.transaction('translations', 'readwrite');
  const store = transaction.objectStore('translations');
  const count = await store.count();
  if (count > keep) {
    const records = await store.index('createdAt').getAll();
    records.sort((left, right) => left.createdAt - right.createdAt);
    const excess = records.slice(0, count - keep);
    for (const record of excess) {
      await store.delete(record.key);
    }
  }
  await transaction.done;
}
