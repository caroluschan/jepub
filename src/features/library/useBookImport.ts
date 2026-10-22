import { useState } from 'react';
import { useToast } from '../../components/Toast';
import { importAozoraBook } from '../../lib/import/aozora';
import { ImportDuplicateError, ImportError } from '../../lib/import/errors';
import { importEpubFile, importSample } from '../../lib/import/importEpub';
import { importTextFile } from '../../lib/import/textBook';
import { navigateToBook } from '../../lib/router';
import type { BookRecord, ImportedBook } from '../../lib/types';
import { notifyLibraryChanged } from './libraryEvents';

export interface ImportingState {
  fileName: string;
  phase: string;
}

export type AozoraImportResult = { ok: true } | { ok: false; error: string };

type ImportKind = 'epub' | 'text' | 'unsupported';

function kindOf(file: File): ImportKind {
  const name = file.name.toLowerCase();
  if (name.endsWith('.epub') || file.type === 'application/epub+zip') return 'epub';
  if (name.endsWith('.txt') || file.type.startsWith('text/plain')) return 'text';
  return 'unsupported';
}

function friendlyError(error: unknown, fallback: string): string {
  if (error instanceof ImportError) return error.message;
  return fallback;
}

function phaseLabel(phase: string): string {
  if (phase === 'saving') return 'Adding to your shelf…';
  if (phase === 'hashing') return 'Reading…';
  return 'Reading…';
}

export function useBookImport() {
  const { push } = useToast();
  const [importing, setImporting] = useState<ImportingState | null>(null);

  const run = async (files: File[], source: 'file' | 'drop'): Promise<void> => {
    if (files.length === 0) return;

    const imported: ImportedBook[] = [];
    const duplicates: BookRecord[] = [];

    for (const file of files) {
      const kind = kindOf(file);
      if (kind === 'unsupported') {
        push('Only EPUB and TXT files can be added.', { tone: 'error' });
        continue;
      }

      setImporting({ fileName: file.name, phase: 'Reading…' });
      try {
        let result: ImportedBook;
        if (kind === 'epub') {
          result = await importEpubFile(file, {
            source,
            onPhase: (phase) => setImporting({ fileName: file.name, phase: phaseLabel(phase) }),
          });
        } else {
          result = await importTextFile(file);
        }
        imported.push(result);
        notifyLibraryChanged();
      } catch (error) {
        if (error instanceof ImportDuplicateError) {
          duplicates.push(error.existing);
          push('This book is already in your library.', { tone: 'default' });
        } else {
          push(
            friendlyError(error, 'Could not add this book.'),
            { tone: 'error' },
          );
        }
      }
    }

    setImporting(null);

    if (imported.length === 1) {
      navigateToBook(imported[0]?.book.id ?? '');
      return;
    }
    if (imported.length === 0 && duplicates.length === 1) {
      const existing = duplicates[0];
      if (existing !== undefined) navigateToBook(existing.id);
    }
  };

  const importFiles = (files: File[]): void => {
    void run(files, 'file');
  };

  const importDroppedFiles = (files: File[]): void => {
    void run(files, 'drop');
  };

  const importAozora = async (url: string): Promise<AozoraImportResult> => {
    setImporting({ fileName: 'Aozora Bunko', phase: 'Downloading…' });
    try {
      const result = await importAozoraBook(url, {
        onPhase: (phase) => setImporting({ fileName: 'Aozora Bunko', phase }),
      });
      notifyLibraryChanged();
      setImporting(null);
      navigateToBook(result.book.id);
      return { ok: true };
    } catch (error) {
      setImporting(null);
      if (error instanceof ImportDuplicateError) {
        push('This book is already in your library.', { tone: 'default' });
        navigateToBook(error.existing.id);
        return { ok: true };
      }
      return {
        ok: false,
        error: friendlyError(error, 'Could not download this Aozora work.'),
      };
    }
  };

  const importSampleBook = async (): Promise<void> => {
    setImporting({ fileName: '吾輩は猫である（抄）', phase: 'Reading…' });
    try {
      const result = await importSample();
      notifyLibraryChanged();
      setImporting(null);
      navigateToBook(result.book.id);
    } catch (error) {
      setImporting(null);
      if (error instanceof ImportDuplicateError) {
        push('This book is already in your library.', { tone: 'default' });
        navigateToBook(error.existing.id);
        return;
      }
      push(friendlyError(error, 'Could not add this book.'), { tone: 'error' });
    }
  };

  return { importing, importFiles, importDroppedFiles, importAozora, importSampleBook };
}
