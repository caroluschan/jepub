import { initMobiFile, type Mobi, type MobiTocItem } from '@lingo-reader/mobi-parser';
import { parseChapterContent } from '../epub/content';
import { findBookByHash } from '../storage';
import type {
  ChapterRecord,
  ImportedBook,
  ParsedEpub,
  TocEntry,
} from '../types';
import { ImportDuplicateError, ImportError, ImportTooLargeError } from './errors';
import { sha256Hex } from './hash';
import { saveParsedBook } from './saveParsedBook';

export const MAX_MOBI_IMPORT_BYTES = 100 * 1024 * 1024;
export const MOBI_MIME = 'application/x-mobipocket-ebook';

interface FlatTocItem {
  label: string;
  href: string;
  depth: number;
}

function looksLikeMobi(file: File): boolean {
  return file.name.toLowerCase().endsWith('.mobi') || file.type === MOBI_MIME;
}

function flattenToc(items: readonly MobiTocItem[], depth = 0, result: FlatTocItem[] = []): FlatTocItem[] {
  for (const item of items) {
    result.push({ label: item.label.trim(), href: item.href, depth });
    if (item.children !== undefined) flattenToc(item.children, depth + 1, result);
  }
  return result;
}

function parseMobi(mobi: Mobi): ParsedEpub {
  const chapters: ChapterRecord[] = [];
  const chapterIndexById = new Map<string, number>();
  const firstHeadings = new Map<number, string>();

  for (const spineItem of mobi.getSpine()) {
    const loaded = mobi.loadChapter(spineItem.id);
    if (loaded === undefined) continue;

    const content = parseChapterContent({
      xhtml: loaded.html,
      chapterPath: `mobi-${spineItem.id}`,
      resolveImage: () => null,
    });
    if (content.blocks.length === 0) continue;

    const index = chapters.length;
    chapterIndexById.set(spineItem.id, index);
    if (content.firstHeading !== null) firstHeadings.set(index, content.firstHeading);
    chapters.push({
      index,
      href: `mobi-${spineItem.id}`,
      title: '',
      dir: '',
      blocks: content.blocks,
      imagePaths: [],
      textLength: content.textLength,
    });
  }

  if (chapters.length === 0) {
    throw new ImportError('This MOBI has no readable chapters.');
  }

  const labelsByChapter = new Map<number, string>();
  let toc: TocEntry[] = [];
  for (const item of flattenToc(mobi.getToc())) {
    const resolved = mobi.resolveHref(item.href);
    if (resolved === undefined) continue;
    const chapterIndex = chapterIndexById.get(resolved.id);
    if (chapterIndex === undefined) continue;

    if (item.label.length > 0 && !labelsByChapter.has(chapterIndex)) {
      labelsByChapter.set(chapterIndex, item.label);
    }
    toc.push({ title: item.label, chapterIndex, fragment: null, depth: item.depth });
  }

  for (const chapter of chapters) {
    chapter.title =
      labelsByChapter.get(chapter.index) ??
      firstHeadings.get(chapter.index) ??
      `Chapter ${chapter.index + 1}`;
  }

  if (toc.length === 0) {
    toc = chapters.map((chapter) => ({
      title: chapter.title,
      chapterIndex: chapter.index,
      fragment: null,
      depth: 0,
    }));
  }

  const metadata = mobi.getMetadata();
  const title = metadata.title.trim().length > 0 ? metadata.title.trim() : 'Untitled';
  const author = metadata.author
    .map((name) => name.trim())
    .filter((name) => name.length > 0)
    .join(', ');
  const language = metadata.language.trim().length > 0 ? metadata.language.trim() : 'ja';

  return {
    title,
    author,
    language,
    cover: null,
    chapters,
    toc,
    assets: [],
  };
}

export async function importMobiFile(file: File): Promise<ImportedBook> {
  if (file.size > MAX_MOBI_IMPORT_BYTES) {
    throw new ImportTooLargeError('This MOBI is larger than the 100 MB import limit.');
  }
  if (!looksLikeMobi(file)) {
    throw new ImportError('Only MOBI files can be imported.');
  }

  const buffer = await file.arrayBuffer();
  const fileHash = await sha256Hex(buffer);
  const existing = await findBookByHash(fileHash);
  if (existing !== null) throw new ImportDuplicateError(existing);

  let parsed: ParsedEpub;
  let mobi: Mobi | null = null;
  try {
    mobi = await initMobiFile(new Uint8Array(buffer));
    parsed = parseMobi(mobi);
  } catch (error) {
    if (error instanceof ImportError) throw error;
    throw new ImportError(
      'This MOBI file could not be read. It may be DRM-protected or damaged.',
    );
  } finally {
    mobi?.destroy();
  }

  return saveParsedBook({
    parsed,
    blob: new Blob([buffer], { type: file.type.length > 0 ? file.type : MOBI_MIME }),
    fileName: file.name,
    source: 'mobi',
    fileHash,
  });
}
