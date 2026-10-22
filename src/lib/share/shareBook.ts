import { getBookFile } from '../storage';
import type { BookRecord } from '../types';

export type ShareOutcome = 'shared' | 'downloaded' | 'copied' | 'cancelled' | 'failed';

export interface ShareDependencies {
  share?: (data: ShareData) => Promise<void>;
  canShare?: (data?: ShareData) => boolean;
  clipboard?: (text: string) => Promise<void>;
  download?: (file: File) => void;
  fileLoader?: (bookId: string) => Promise<Blob | null>;
}

export function fileMimeType(fileName: string, fallback: string): string {
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.epub')) return 'application/epub+zip';
  if (lower.endsWith('.mobi')) return 'application/x-mobipocket-ebook';
  if (lower.endsWith('.txt')) return 'text/plain';
  if (lower.endsWith('.html') || lower.endsWith('.htm')) return 'text/html';
  return fallback;
}

function isAbortError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'name' in error &&
    (error as { name?: unknown }).name === 'AbortError'
  );
}

function navigatorShare(): ShareDependencies['share'] {
  if (typeof navigator === 'undefined' || typeof navigator.share !== 'function') {
    return undefined;
  }
  return (data) => navigator.share(data);
}

function navigatorCanShare(): ShareDependencies['canShare'] {
  if (typeof navigator === 'undefined' || typeof navigator.canShare !== 'function') {
    return undefined;
  }
  return (data) => navigator.canShare(data);
}

function navigatorClipboard(): ShareDependencies['clipboard'] {
  if (
    typeof navigator === 'undefined' ||
    navigator.clipboard === undefined ||
    typeof navigator.clipboard.writeText !== 'function'
  ) {
    return undefined;
  }
  return (text) => navigator.clipboard.writeText(text);
}

function defaultDownload(file: File): void {
  const url = URL.createObjectURL(file);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = file.name;
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

async function shareAozora(
  book: BookRecord,
  sourceUrl: string,
  deps: ShareDependencies,
): Promise<ShareOutcome> {
  const share = deps.share ?? navigatorShare();
  if (share !== undefined) {
    try {
      await share({ title: book.title, url: sourceUrl });
      return 'shared';
    } catch (error) {
      if (isAbortError(error)) return 'cancelled';
    }
  }

  const clipboard = deps.clipboard ?? navigatorClipboard();
  if (clipboard !== undefined) {
    try {
      await clipboard(sourceUrl);
      return 'copied';
    } catch {
      return 'failed';
    }
  }

  return 'failed';
}

async function shareFile(book: BookRecord, deps: ShareDependencies): Promise<ShareOutcome> {
  const loadFile = deps.fileLoader ?? getBookFile;
  let blob: Blob | null;
  try {
    blob = await loadFile(book.id);
  } catch {
    return 'failed';
  }
  if (blob === null) return 'failed';

  const type = fileMimeType(book.fileName, blob.type);
  const file = new File([blob], book.fileName, { type });
  const share = deps.share ?? navigatorShare();
  const canShare = deps.canShare ?? navigatorCanShare();
  const data: ShareData = { files: [file], title: book.title };

  if (share !== undefined && (canShare === undefined || canShare(data))) {
    try {
      await share(data);
      return 'shared';
    } catch (error) {
      if (isAbortError(error)) return 'cancelled';
    }
  }

  const download = deps.download ?? defaultDownload;
  try {
    download(file);
    return 'downloaded';
  } catch {
    return 'failed';
  }
}

export async function shareBook(
  book: BookRecord,
  deps: ShareDependencies = {},
): Promise<ShareOutcome> {
  if (book.source === 'aozora' && typeof book.sourceUrl === 'string' && book.sourceUrl.length > 0) {
    return shareAozora(book, book.sourceUrl, deps);
  }
  return shareFile(book, deps);
}
