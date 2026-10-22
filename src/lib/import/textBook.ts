import { segmentSentences } from '../text/segmentSentences';
import type { ChapterBlock, ChapterRecord, ImportedBook, ParsedEpub } from '../types';
import { findBookByHash } from '../storage';
import { ImportDuplicateError, ImportError, ImportTooLargeError } from './errors';
import { sha256Hex } from './hash';
import { saveParsedBook } from './saveParsedBook';

export const MAX_TEXT_IMPORT_BYTES = 20 * 1024 * 1024;

const SEPARATOR_LINE = /^[ \t\u3000]*[-=]{4,}[ \t\u3000]*$/gmu;

/** Decodes UTF-8 / UTF-16 BOM-prefixed text, then falls back to Shift_JIS. */
export function decodeText(bytes: Uint8Array): string {
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return new TextDecoder('utf-8').decode(bytes.subarray(3));
  }
  if (bytes[0] === 0xff && bytes[1] === 0xfe) {
    return new TextDecoder('utf-16le').decode(bytes.subarray(2));
  }
  if (bytes[0] === 0xfe && bytes[1] === 0xff) {
    return new TextDecoder('utf-16be').decode(bytes.subarray(2));
  }

  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder('shift_jis').decode(bytes);
  }
}

function cleanLines(text: string): string {
  return text
    .replace(/\r\n?/gu, '\n')
    .replace(SEPARATOR_LINE, '')
    .replace(/\n{3,}/gu, '\n\n')
    .trim();
}

/** Splits prose into paragraphs, falling back to one paragraph per line. */
export function textToParagraphs(input: string): string[] {
  const text = cleanLines(input);
  if (text.length === 0) return [];

  const blocks = text
    .split(/\n[ \t\u3000]*\n+/u)
    .map((paragraph) => paragraph.replace(/\n/gu, ' ').trim())
    .filter((paragraph) => paragraph.length > 0);

  if (blocks.length > 1) return blocks;

  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  return lines.length > 1 ? lines : blocks.length === 1 ? blocks : [];
}

/** Converts plain text into reader blocks with normalized Japanese prose. */
export function textToBlocks(input: string): ChapterBlock[] {
  const blocks: ChapterBlock[] = [];
  for (const paragraph of textToParagraphs(input)) {
    const sentences = segmentSentences(paragraph);
    if (sentences.length > 0) blocks.push({ kind: 'paragraph', sentences });
  }
  return blocks;
}

export function titleFromFileName(fileName: string): string {
  const base = fileName.replace(/^.*[/\\]/u, '').replace(/\.[^.]+$/u, '').trim();
  return base.length > 0 ? base : 'Untitled';
}

function buildTextEpub(title: string, blocks: ChapterBlock[]): ParsedEpub {
  const textLength = blocks.reduce(
    (sum, block) => ('sentences' in block ? sum + block.sentences.join('').length : sum),
    0,
  );
  const chapter: ChapterRecord = {
    index: 0,
    href: 'text.txt',
    title,
    dir: '',
    blocks,
    imagePaths: [],
    textLength,
  };
  return {
    title,
    author: '',
    language: 'ja',
    cover: null,
    chapters: [chapter],
    toc: [{ title, chapterIndex: 0, fragment: null, depth: 0 }],
    assets: [],
  };
}

function looksLikeText(file: File): boolean {
  return (
    file.name.toLowerCase().endsWith('.txt') ||
    file.type === 'text/plain' ||
    file.type.startsWith('text/plain;')
  );
}

export async function importTextFile(file: File): Promise<ImportedBook> {
  if (!looksLikeText(file)) {
    throw new ImportError('Only plain text (.txt) files can be imported.');
  }
  if (file.size > MAX_TEXT_IMPORT_BYTES) {
    throw new ImportTooLargeError('This text file is larger than the 20 MB import limit.');
  }

  const decoded = decodeText(new Uint8Array(await file.arrayBuffer()));
  const blocks = textToBlocks(decoded);
  if (blocks.length === 0) {
    throw new ImportError('This text file has no readable text.');
  }

  const normalized = blocks
    .flatMap((block) => ('sentences' in block ? block.sentences : []))
    .join('\n');
  const fileHash = await sha256Hex(normalized);
  const existing = await findBookByHash(fileHash);
  if (existing !== null) throw new ImportDuplicateError(existing);

  const title = titleFromFileName(file.name);
  const parsed = buildTextEpub(title, blocks);
  const blob = new Blob([decoded], { type: 'text/plain;charset=utf-8' });
  return saveParsedBook({ parsed, blob, fileName: file.name, source: 'text', fileHash });
}
