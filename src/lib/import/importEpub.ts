import type { BookRecord, ImportedBook, ParsedEpub } from '../types';
import { openEpub } from '../epub/openEpub';
import { findBookByHash, importBookAtomic } from '../storage';

export const MAX_IMPORT_BYTES = 100 * 1024 * 1024;

export class ImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ImportError';
  }
}

export class ImportTooLargeError extends ImportError {
  constructor(message = 'This EPUB is larger than the 100 MB import limit.') {
    super(message);
    this.name = 'ImportTooLargeError';
  }
}

export class ImportDuplicateError extends ImportError {
  readonly existing: BookRecord;

  constructor(existing: BookRecord) {
    super('This EPUB is already in your library.');
    this.name = 'ImportDuplicateError';
    this.existing = existing;
  }
}

export interface ImportOptions {
  source: BookRecord['source'];
  onPhase?: (phase: string) => void;
}

function toHex(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let hex = '';
  for (const byte of bytes) {
    hex += byte.toString(16).padStart(2, '0');
  }
  return hex;
}

async function sha256(buffer: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  return toHex(digest);
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
  const fileHash = await sha256(buffer);

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

  const book: BookRecord = {
    id: crypto.randomUUID(),
    title: parsed.title,
    author: parsed.author,
    language: parsed.language,
    cover: parsed.cover,
    fileName: file.name,
    fileSize: file.size,
    fileHash,
    chapterCount: parsed.chapters.length,
    addedAt: Date.now(),
    lastOpenedAt: null,
    progress: { chapterIndex: 0, ratio: 0 },
    source: options.source,
  };

  options.onPhase?.('saving');
  await importBookAtomic(
    book,
    new Blob([buffer], { type: 'application/epub+zip' }),
    {
      bookId: book.id,
      version: 1,
      chapters: parsed.chapters,
      toc: parsed.toc,
    },
    parsed.assets,
  );

  if (typeof navigator !== 'undefined' && navigator.storage !== undefined) {
    void navigator.storage.persist().catch((error: unknown) => {
      console.warn('JEPUB: persistent storage was not granted.', error);
    });
  }

  return {
    book,
    chapterSet: {
      bookId: book.id,
      version: 1,
      chapters: parsed.chapters,
      toc: parsed.toc,
    },
  };
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
