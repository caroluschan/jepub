import { useEffect } from 'react';
import { useToast } from '../components/Toast';
import { ImportDuplicateError, ImportError, importEpubFile } from '../lib/import/importEpub';
import { navigateToBook } from '../lib/router';
import type { BookRecord } from '../lib/types';
import { notifyLibraryChanged } from '../features/library/libraryEvents';

function friendlyError(error: unknown): string {
  if (error instanceof ImportError) return error.message;
  return 'Could not import this EPUB.';
}

export function useLaunchQueue(): void {
  const { push } = useToast();

  useEffect(() => {
    const queue = window.launchQueue;
    if (queue === undefined) return;

    let disposed = false;
    queue.setConsumer((params) => {
      void (async () => {
        const files = params.files ?? [];
        if (files.length === 0) return;

        const opened: BookRecord[] = [];
        for (const handle of files) {
          if (disposed) return;
          try {
            const file = await handle.getFile();
            const result = await importEpubFile(file, { source: 'handler' });
            opened.push(result.book);
            notifyLibraryChanged();
          } catch (error) {
            if (error instanceof ImportDuplicateError) {
              opened.push(error.existing);
              push('Already in your library.', { tone: 'default' });
            } else {
              push(friendlyError(error), { tone: 'error' });
            }
          }
        }

        const first = opened[0];
        if (opened.length === 1 && first !== undefined) navigateToBook(first.id);
      })();
    });

    return () => {
      disposed = true;
      queue.setConsumer(() => undefined);
    };
  }, [push]);
}
