import { parseChapterContent } from '../../epub/content';
import type { ChapterBlock } from '../../types';
import { textToBlocks } from '../textBook';
import { validateAozoraUrl, type AozoraUrlInfo } from './url';

const MAX_AOZORA_FILES = 5;

export interface AozoraCard {
  title: string;
  author: string;
  fileUrls: string[];
}

export interface ParsedAozoraFile {
  title: string;
  author: string;
  blocks: ChapterBlock[];
  textLength: number;
  cleanedHtml: string;
}

function stripMarkdownLink(value: string): string {
  return value
    .replace(/\[([^\]]*)\]\([^)]*\)/gu, '$1')
    .replace(/\*\*/gu, '')
    .trim();
}

function labelValue(markdown: string, label: string): string {
  const match = new RegExp(`^${label}[：:]\\s*(.+)$`, 'mu').exec(markdown);
  return match?.[1] === undefined ? '' : stripMarkdownLink(match[1]);
}

const FILE_LINK =
  /https?:\/\/(?:www\.)?aozora\.gr\.jp\/cards\/[^\s)\]"'<>]+\/files\/[^\s)\]"'<>]+\.html/giu;

/** Parses the Jina markdown version of a work card. */
export function parseAozoraCard(markdown: string): AozoraCard {
  const title = labelValue(markdown, '作品名');
  const author = labelValue(markdown, '著者名');

  const fileUrls: string[] = [];
  const seen = new Set<string>();
  for (const match of markdown.matchAll(FILE_LINK)) {
    let info: AozoraUrlInfo;
    try {
      info = validateAozoraUrl(match[0]);
    } catch {
      continue;
    }
    if (info.kind !== 'file' || seen.has(info.url)) continue;
    seen.add(info.url);
    fileUrls.push(info.url);
    if (fileUrls.length >= MAX_AOZORA_FILES) break;
  }

  return { title, author, fileUrls };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/gu, '&amp;')
    .replace(/</gu, '&lt;')
    .replace(/>/gu, '&gt;')
    .replace(/"/gu, '&quot;');
}

/** Removes Jina's markdown framing and converts the remaining prose to paragraphs. */
export function markdownToHtml(raw: string): string {
  const contentMatch = /^Markdown Content:\s*$/mu.exec(raw);
  const start = contentMatch === null ? 0 : raw.indexOf('\n', contentMatch.index) + 1;
  const body = raw
    .slice(start)
    .replace(/!\[[^\]]*\]\([^)]*\)/gu, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/gu, '$1')
    .replace(/^#{1,6}\s*/gmu, '')
    .replace(/^\s*>\s?/gmu, '')
    .replace(/^\s*([-*_])\1{2,}\s*$/gmu, '')
    .replace(/^\s*[-*+]\s+/gmu, '')
    .trim();

  return body
    .split(/\n[ \t\u3000]*\n+/u)
    .map((paragraph) => paragraph.replace(/\n/gu, ' ').trim())
    .filter((paragraph) => paragraph.length > 0)
    .map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`)
    .join('\n');
}

function metaContent(doc: Document, name: string): string {
  const element = doc.querySelector(`meta[name="${name}"]`);
  return element?.getAttribute('content')?.trim() ?? '';
}

interface ExtractedFile {
  title: string;
  author: string;
  cleanedHtml: string;
}

function linesToParagraphs(html: string): string {
  return html
    .split(/<br\s*\/?>/iu)
    .map((line) => `<p>${line.trim()}</p>`)
    .join('');
}

function extractFileHtml(raw: string): ExtractedFile {
  const doc = new DOMParser().parseFromString(raw, 'text/html');
  const title = metaContent(doc, 'DC.Title');
  const author = metaContent(doc, 'DC.Creator');
  const main = doc.querySelector('div.main_text');
  if (main !== null) {
    return { title, author, cleanedHtml: linesToParagraphs(main.innerHTML) };
  }

  const looksLikeHtml = /<html|<body|<\/p>|<\/div>/iu.test(raw);
  if (looksLikeHtml && doc.body !== null) {
    return { title, author, cleanedHtml: linesToParagraphs(doc.body.innerHTML) };
  }

  return { title, author, cleanedHtml: markdownToHtml(raw) };
}

/** Parses one Aozora file page into reader blocks. Ruby is dropped by the EPUB content parser. */
export function parseAozoraFileHtml(raw: string): ParsedAozoraFile {
  const extracted = extractFileHtml(raw);
  const content = parseChapterContent({
    xhtml: extracted.cleanedHtml,
    chapterPath: 'aozora',
    resolveImage: () => null,
  });
  const blocks =
    content.blocks.length > 0
      ? content.blocks
      : textToBlocks(
          extracted.cleanedHtml.replace(/<[^>]+>/gu, ' ').replace(/&[a-z]+;/giu, ' '),
        );
  const textLength = blocks.reduce(
    (sum, block) => ('sentences' in block ? sum + block.sentences.join('').length : sum),
    0,
  );
  return {
    title: extracted.title,
    author: extracted.author,
    blocks,
    textLength,
    cleanedHtml: extracted.cleanedHtml,
  };
}
