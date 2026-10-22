import { findBookByHash } from '../storage';
import type { ChapterBlock, ChapterRecord, ImportedBook, ParsedEpub } from '../types';
import { ImportDuplicateError, ImportError } from './errors';
import { sha256Hex } from './hash';
import { parseAozoraCard, parseAozoraFileHtml, type AozoraCard, type ParsedAozoraFile } from './aozora/parse';
import { validateAozoraUrl } from './aozora/url';
import { saveParsedBook } from './saveParsedBook';

export {
  parseAozoraCard,
  parseAozoraFileHtml,
  markdownToHtml,
  type AozoraCard,
  type ParsedAozoraFile,
} from './aozora/parse';
export { validateAozoraUrl, type AozoraUrlInfo, type AozoraUrlKind } from './aozora/url';

const JINA_READER = 'https://r.jina.ai/';
const DEFAULT_TIMEOUT_MS = 45_000;

export interface AozoraImportOptions {
  onPhase?: (phase: string) => void;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

function statusError(status: number): ImportError {
  if (status === 404) return new ImportError('That Aozora page could not be found.');
  if (status === 429) {
    return new ImportError('Aozora downloads are rate limited right now. Wait a moment and try again.');
  }
  return new ImportError(`Aozora download failed (HTTP ${status}).`);
}

async function fetchJina(
  target: string,
  format: 'markdown' | 'html',
  options: AozoraImportOptions,
): Promise<string> {
  const fetcher = options.fetchImpl ?? fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? DEFAULT_TIMEOUT_MS);

  try {
    const headers: Record<string, string> =
      format === 'html' ? { 'X-Return-Format': 'html' } : {};
    const response = await fetcher(`${JINA_READER}${target}`, {
      headers,
      signal: controller.signal,
    });
    if (!response.ok) throw statusError(response.status);

    const text = await response.text();
    if (text.trim().length === 0) {
      throw new ImportError('Aozora returned no content. Try again.');
    }
    return text;
  } catch (error) {
    if (error instanceof ImportError) throw error;
    if (error instanceof Error && error.name === 'AbortError') {
      throw new ImportError('Aozora took too long to respond. Try again.');
    }
    throw new ImportError(
      'Could not reach Aozora through Jina Reader. Check your connection and try again.',
    );
  } finally {
    clearTimeout(timer);
  }
}

function blocksText(blocks: readonly ChapterBlock[]): string {
  return blocks.flatMap((block) => ('sentences' in block ? block.sentences : [])).join('');
}

async function fetchFiles(
  info: ReturnType<typeof validateAozoraUrl>,
  options: AozoraImportOptions,
): Promise<{ card: AozoraCard | null; files: ParsedAozoraFile[] }> {
  let card: AozoraCard | null = null;
  let fileUrls: string[];
  if (info.kind === 'file') {
    fileUrls = [info.url];
  } else {
    const markdown = await fetchJina(info.url, 'markdown', options);
    card = parseAozoraCard(markdown);
    fileUrls = card.fileUrls;
  }
  if (fileUrls.length === 0) {
    throw new ImportError('No downloadable text was found on this Aozora card.');
  }

  options.onPhase?.('Reading…');
  const files: ParsedAozoraFile[] = [];
  for (const fileUrl of fileUrls) {
    const html = await fetchJina(fileUrl, 'html', options);
    files.push(parseAozoraFileHtml(html));
  }
  return { card, files };
}

export async function importAozoraBook(
  rawUrl: string,
  options: AozoraImportOptions = {},
): Promise<ImportedBook> {
  const info = validateAozoraUrl(rawUrl);
  options.onPhase?.('Downloading…');

  const { card, files } = await fetchFiles(info, options);
  const blocks = files.flatMap((file) => file.blocks);
  if (blocks.length === 0) {
    throw new ImportError('This Aozora work has no readable text.');
  }

  const title = card?.title || files[0]?.title || '';
  const author = card?.author || files[0]?.author || '';
  if (title.length === 0) {
    throw new ImportError('Could not read the title of this Aozora work.');
  }

  const safeId = info.id.replace(/[^a-z0-9_-]+/giu, '-') || 'book';
  const chapter: ChapterRecord = {
    index: 0,
    href: `aozora-${safeId}.html`,
    title,
    dir: '',
    blocks,
    imagePaths: [],
    textLength: blocksText(blocks).length,
  };
  const parsed: ParsedEpub = {
    title,
    author,
    language: 'ja',
    cover: null,
    chapters: [chapter],
    toc: [{ title, chapterIndex: 0, fragment: null, depth: 0 }],
    assets: [],
  };

  const fileHash = await sha256Hex(`${title}\n${blocksText(blocks)}`);
  const existing = await findBookByHash(fileHash);
  if (existing !== null) throw new ImportDuplicateError(existing);

  options.onPhase?.('Adding…');
  return saveParsedBook({
    parsed,
    blob: new Blob([files.map((file) => file.cleanedHtml).join('\n')], {
      type: 'text/html;charset=utf-8',
    }),
    fileName: `aozora-${safeId}.html`,
    source: 'aozora',
    fileHash,
    sourceUrl: info.url,
  });
}
