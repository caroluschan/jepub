import { importBookAtomic } from '../storage';
import { blobToDataUrl } from '../storage/cover';
import type { BookRecord, ImportedBook, ParsedEpub } from '../types';

export interface SaveParsedBookInput {
  parsed: ParsedEpub;
  blob: Blob;
  fileName: string;
  source: BookRecord['source'];
  fileHash: string;
  sourceUrl?: string | null;
}

function requestPersistence(): void {
  if (typeof navigator === 'undefined' || navigator.storage === undefined) return;
  void navigator.storage.persist().catch((error: unknown) => {
    console.warn('JEPUB: persistent storage was not granted.', error);
  });
}

/** Builds the library record and writes the book, file, chapter set, and assets atomically. */
export async function saveParsedBook(input: SaveParsedBookInput): Promise<ImportedBook> {
  const { parsed, blob, fileName, source, fileHash, sourceUrl } = input;
  const coverDataUrl =
    parsed.cover === null
      ? null
      : await blobToDataUrl(parsed.cover).catch(() => null);
  const book: BookRecord = {
    id: crypto.randomUUID(),
    title: parsed.title,
    author: parsed.author,
    language: parsed.language,
    cover: parsed.cover,
    coverDataUrl,
    fileName,
    fileSize: blob.size,
    fileHash,
    chapterCount: parsed.chapters.length,
    addedAt: Date.now(),
    lastOpenedAt: null,
    progress: { chapterIndex: 0, ratio: 0 },
    source,
    sourceUrl: sourceUrl ?? null,
  };

  const chapterSet = {
    bookId: book.id,
    version: 1 as const,
    chapters: parsed.chapters,
    toc: parsed.toc,
  };

  await importBookAtomic(book, blob, chapterSet, parsed.assets);
  requestPersistence();
  return { book, chapterSet };
}
