import type { Bookmark } from '../types';
import { openDb } from './db';

export async function listBookmarks(bookId: string): Promise<Bookmark[]> {
  const database = await openDb();
  const bookmarks = await database.getAllFromIndex('bookmarks', 'bookId', bookId);
  return bookmarks.sort((left, right) => right.createdAt - left.createdAt);
}

export async function addBookmark(bookmark: Bookmark): Promise<void> {
  const database = await openDb();
  await database.put('bookmarks', bookmark);
}

export async function deleteBookmark(id: string): Promise<void> {
  const database = await openDb();
  await database.delete('bookmarks', id);
}
