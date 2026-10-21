import { useState } from 'react';
import { useToast } from '../../components/Toast';
import {
  ImportDuplicateError,
  ImportError,
  importEpubFile,
  importSample,
} from '../../lib/import/importEpub';
import { navigateToBook } from '../../lib/router';
import type { BookRecord, ImportedBook } from '../../lib/types';
import { notifyLibraryChanged } from './libraryEvents';

export interface ImportingState {
  fileName: string;
  phase: string;
}

function friendlyError(error: unknown): string {
  if (error instanceof ImportError) return error.message;
  return 'Could not import this EPUB.';
}

function phaseLabel(phase: string): string {
  if (phase === 'saving') return 'Adding to your shelf…';
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
      setImporting({ fileName: file.name, phase: 'Reading…' });
      try {
        const result = await importEpubFile(file, {
          source,
          onPhase: (phase) => setImporting({ fileName: file.name, phase: phaseLabel(phase) }),
        });
        imported.push(result);
        notifyLibraryChanged();
      } catch (error) {
        if (error instanceof ImportDuplicateError) {
          duplicates.push(error.existing);
          push('Already in your library.', { tone: 'default' });
        } else {
          push(friendlyError(error), { tone: 'error' });
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
        push('Already in your library.', { tone: 'default' });
        navigateToBook(error.existing.id);
        return;
      }
      push(friendlyError(error), { tone: 'error' });
    }
  };

  return { importing, importFiles, importDroppedFiles, importSampleBook };
}
