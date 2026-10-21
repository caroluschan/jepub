import type { BookRecord, ChapterSet } from '../types';
import { openDb } from './db';

function recency(book: BookRecord): number {
  return book.lastOpenedAt ?? -1;
}

export async function listBooks(): Promise<BookRecord[]> {
  const database = await openDb();
  const books = await database.getAll('books');
  return books.sort((left, right) => {
    const byRecency = recency(right) - recency(left);
    if (byRecency !== 0) return byRecency;
    return right.addedAt - left.addedAt;
  });
}

export async function getBook(id: string): Promise<BookRecord | undefined> {
  const database = await openDb();
  return database.get('books', id);
}

export async function getBookFile(id: string): Promise<Blob | null> {
  const database = await openDb();
  const record = await database.get('files', id);
  return record?.blob ?? null;
}

export async function getChapterSet(bookId: string): Promise<ChapterSet | undefined> {
  const database = await openDb();
  return database.get('chapterSets', bookId);
}

export async function findBookByHash(fileHash: string): Promise<BookRecord | null> {
  const database = await openDb();
  const book = await database.getFromIndex('books', 'fileHash', fileHash);
  return book ?? null;
}
