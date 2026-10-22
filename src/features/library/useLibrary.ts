import { useCallback, useEffect, useState } from 'react';
import { listBooks, updateBookCoverDataUrl } from '../../lib/storage';
import { blobToDataUrl } from '../../lib/storage/cover';
import type { BookRecord } from '../../lib/types';
import { onLibraryChanged } from './libraryEvents';

export type LibraryStatus = 'loading' | 'ready' | 'error';

interface LibraryState {
  books: BookRecord[];
  status: LibraryStatus;
}

async function withCoverData(book: BookRecord): Promise<BookRecord> {
  if (typeof book.coverDataUrl === 'string' && book.coverDataUrl.length > 0) return book;
  if (book.cover === null || book.cover === undefined) return book;

  let coverDataUrl: string;
  try {
    coverDataUrl = await blobToDataUrl(book.cover);
  } catch {
    return book;
  }

  try {
    await updateBookCoverDataUrl(book.id, coverDataUrl);
  } catch {
    // Keep the in-memory data URL even if persistence fails.
  }
  return { ...book, coverDataUrl };
}

export function useLibrary() {
  const [state, setState] = useState<LibraryState>({ books: [], status: 'loading' });

  const refresh = useCallback(async () => {
    try {
      const books = await Promise.all((await listBooks()).map(withCoverData));
      setState({ books, status: 'ready' });
    } catch {
      setState({ books: [], status: 'error' });
    }
  }, []);

  useEffect(() => {
    void refresh();
    return onLibraryChanged(() => {
      void refresh();
    });
  }, [refresh]);

  return { ...state, refresh };
}
