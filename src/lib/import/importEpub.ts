import type { BookRecord, ImportedBook, ParsedEpub } from '../types';
import { openEpub } from '../epub/openEpub';
import { findBookByHash } from '../storage';
import { ImportDuplicateError, ImportError, ImportTooLargeError } from './errors';
import { sha256Hex } from './hash';
import { saveParsedBook } from './saveParsedBook';

export { ImportDuplicateError, ImportError, ImportTooLargeError } from './errors';

export const MAX_IMPORT_BYTES = 100 * 1024 * 1024;

export interface ImportOptions {
  source: BookRecord['source'];
  onPhase?: (phase: string) => void;
}

function looksLikeEpub(file: File): boolean {
  return file.name.toLowerCase().endsWith('.epub') || file.type === 'application/epub+zip';
}

export async function importEpubFile(
  file: File,
  options: ImportOptions,
): Promise<ImportedBook> {
  if (file.size > MAX_IMPORT_BYTES) {
    throw new ImportTooLargeError();
  }
  if (!looksLikeEpub(file)) {
    throw new ImportError('Only EPUB files can be imported.');
  }

  options.onPhase?.('hashing');
  const buffer = await file.arrayBuffer();
  const fileHash = await sha256Hex(buffer);

  const existing = await findBookByHash(fileHash);
  if (existing !== null) {
    throw new ImportDuplicateError(existing);
  }

  options.onPhase?.('parsing');
  let parsed: ParsedEpub;
  try {
    parsed = await openEpub(new Blob([buffer], { type: 'application/epub+zip' }));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not read this EPUB.';
    throw new ImportError(message);
  }

  if (parsed.chapters.length === 0) {
    throw new ImportError('This EPUB has no readable chapters.');
  }

  options.onPhase?.('saving');
  return saveParsedBook({
    parsed,
    blob: new Blob([buffer], { type: 'application/epub+zip' }),
    fileName: file.name,
    source: options.source,
    fileHash,
  });
}

export async function importSample(): Promise<ImportedBook> {
  let response: Response;
  try {
    response = await fetch(`${import.meta.env.BASE_URL}sample/jepub-sample.epub`);
  } catch {
    throw new ImportError('Could not download the sample book.');
  }

  if (!response.ok) {
    throw new ImportError(`Could not download the sample book (HTTP ${response.status}).`);
  }

  const blob = await response.blob();
  const file = new File([blob], 'jepub-sample.epub', { type: 'application/epub+zip' });
  return importEpubFile(file, { source: 'sample' });
}
