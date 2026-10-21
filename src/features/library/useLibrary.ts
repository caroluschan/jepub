import { useCallback, useEffect, useState } from 'react';
import { listBooks } from '../../lib/storage';
import type { BookRecord } from '../../lib/types';
import { onLibraryChanged } from './libraryEvents';

export type LibraryStatus = 'loading' | 'ready' | 'error';

interface LibraryState {
  books: BookRecord[];
  status: LibraryStatus;
}

export function useLibrary() {
  const [state, setState] = useState<LibraryState>({ books: [], status: 'loading' });

  const refresh = useCallback(async () => {
    try {
      const books = await listBooks();
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
