import type { ChapterBlock } from '../types';
import { segmentSentences } from '../text/segmentSentences';
import { hasXmlParseError, stripXmlPrefix } from './xml';

export interface ChapterContent {
  blocks: ChapterBlock[];
  imagePaths: string[];
  firstHeading: string | null;
  textLength: number;
}

export interface ChapterContentInput {
  xhtml: string;
  chapterPath: string;
  resolveImage: (rawSrc: string) => string | null;
}

type TextKind = 'paragraph' | 'quote' | 'heading' | 'listItem';

interface BlockContext {
  kind: TextKind;
  level: 1 | 2 | 3 | 4 | 5 | 6;
  ordered: boolean;
}

const BLOCK_TAGS = new Set([
  'p',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'blockquote',
  'li',
  'pre',
  'figcaption',
  'td',
  'th',
  'dt',
  'dd',
]);

const CONTAINER_TAGS = new Set(['div', 'section', 'article', 'main', 'header', 'footer', 'aside']);

const REMOVED_TAGS = ['script', 'style', 'noscript', 'head', 'rt', 'rp'];

function tagName(element: Element): string {
  return element.localName.toLowerCase();
}

function parseDocument(xhtml: string): Document {
  const normalized = stripXmlPrefix(xhtml);
  const parser = new DOMParser();
  const xml = parser.parseFromString(normalized, 'application/xhtml+xml');
  if (!hasXmlParseError(xml)) return xml;
  return parser.parseFromString(normalized, 'text/html');
}

function headingLevel(tag: string): 1 | 2 | 3 | 4 | 5 | 6 {
  switch (tag) {
    case 'h1':
      return 1;
    case 'h2':
      return 2;
    case 'h3':
      return 3;
    case 'h4':
      return 4;
    case 'h5':
      return 5;
    case 'h6':
      return 6;
    default:
      return 1;
  }
}

function blockAnchor(element: Element): string | undefined {
  const own = element.getAttribute('id');
  if (own !== null && own.length > 0) return own;
  const childId = element.firstElementChild?.getAttribute('id') ?? null;
  return childId !== null && childId.length > 0 ? childId : undefined;
}

function hasBlockDescendant(element: Element): boolean {
  for (const child of Array.from(element.children)) {
    const tag = tagName(child);
    if (BLOCK_TAGS.has(tag)) return true;
    if (CONTAINER_TAGS.has(tag) && hasBlockDescendant(child)) return true;
  }
  return false;
}

function nearestListOrdered(element: Element): boolean {
  let current: Element | null = element.parentElement;
  while (current !== null) {
    const tag = tagName(current);
    if (tag === 'ol') return true;
    if (tag === 'ul') return false;
    current = current.parentElement;
  }
  return false;
}

export function parseChapterContent(input: ChapterContentInput): ChapterContent {
  const doc = parseDocument(input.xhtml);
  for (const tag of REMOVED_TAGS) {
    for (const element of Array.from(doc.getElementsByTagName(tag))) {
      element.remove();
    }
  }

  const root = doc.body ?? doc.documentElement;
  const blocks: ChapterBlock[] = [];
  const imagePaths: string[] = [];
  const seenImages = new Set<string>();
  let firstHeading: string | null = null;
  let textLength = 0;

  const addImage = (rawSrc: string, alt: string): void => {
    const resolved = input.resolveImage(rawSrc);
    if (resolved === null) return;
    blocks.push({ kind: 'image', path: resolved, alt });
    if (!seenImages.has(resolved)) {
      seenImages.add(resolved);
      imagePaths.push(resolved);
    }
  };

  const makeBlock = (
    kind: TextKind,
    sentences: string[],
    anchor: string | undefined,
    level: 1 | 2 | 3 | 4 | 5 | 6,
    ordered: boolean,
  ): ChapterBlock => {
    if (kind === 'heading') {
      return anchor ? { kind, level, sentences, anchor } : { kind, level, sentences };
    }
    if (kind === 'listItem') {
      return anchor ? { kind, sentences, ordered, anchor } : { kind, sentences, ordered };
    }
    return anchor ? { kind, sentences, anchor } : { kind, sentences };
  };

  const flushText = (
    state: { text: string },
    context: BlockContext,
    anchor: string | undefined,
  ): void => {
    if (state.text.trim().length === 0) {
      state.text = '';
      return;
    }
    const sentences = segmentSentences(state.text);
    state.text = '';
    if (sentences.length === 0) return;
    if (context.kind === 'heading' && firstHeading === null) {
      firstHeading = sentences.join('');
    }
    textLength += sentences.reduce((sum, sentence) => sum + sentence.length, 0);
    blocks.push(
      makeBlock(context.kind, sentences, anchor, context.level, context.ordered),
    );
  };

  const scanChildren = (
    element: Element,
    state: { text: string },
    context: BlockContext,
    anchor: string | undefined,
  ): void => {
    for (const node of Array.from(element.childNodes)) {
      if (node.nodeType === 3) {
        state.text += node.nodeValue ?? '';
        continue;
      }
      if (node.nodeType !== 1) continue;
      const child = node as Element;
      const tag = tagName(child);

      if (tag === 'br') {
        state.text += ' ';
        continue;
      }
      if (tag === 'img') {
        flushText(state, context, anchor);
        const src = child.getAttribute('src');
        if (src !== null) addImage(src, child.getAttribute('alt') ?? '');
        continue;
      }
      if (tag === 'image') {
        flushText(state, context, anchor);
        const href =
          child.getAttribute('xlink:href') ??
          child.getAttribute('href') ??
          child.getAttributeNS('http://www.w3.org/1999/xlink', 'href');
        if (href !== null) addImage(href, child.getAttribute('alt') ?? '');
        continue;
      }
      if (tag === 'hr') {
        flushText(state, context, anchor);
        blocks.push({ kind: 'separator' });
        continue;
      }
      if (BLOCK_TAGS.has(tag)) {
        flushText(state, context, anchor);
        processBlock(child, context);
        continue;
      }

      if (CONTAINER_TAGS.has(tag)) {
        flushText(state, context, anchor);
        if (hasBlockDescendant(child)) {
          scanChildren(child, state, context, blockAnchor(child) ?? anchor);
        } else {
          const containerState = { text: '' };
          const containerAnchor = blockAnchor(child) ?? anchor;
          scanChildren(child, containerState, context, containerAnchor);
          flushText(containerState, context, containerAnchor);
        }
        continue;
      }

      scanChildren(child, state, context, anchor);
    }
  };

  const processBlock = (element: Element, parent: BlockContext): void => {
    const tag = tagName(element);
    let context: BlockContext;
    if (tag.startsWith('h')) {
      context = { kind: 'heading', level: headingLevel(tag), ordered: false };
    } else if (tag === 'blockquote') {
      context = { kind: 'quote', level: 1, ordered: false };
    } else if (tag === 'li') {
      context = { kind: 'listItem', level: 1, ordered: nearestListOrdered(element) };
    } else if (parent.kind === 'quote') {
      context = { kind: 'quote', level: 1, ordered: false };
    } else if (parent.kind === 'listItem') {
      context = { kind: 'listItem', level: 1, ordered: parent.ordered };
    } else {
      context = { kind: 'paragraph', level: 1, ordered: false };
    }

    const anchor = blockAnchor(element);
    const state = { text: '' };
    scanChildren(element, state, context, anchor);
    flushText(state, context, anchor);
  };

  const topState = { text: '' };
  const topContext: BlockContext = { kind: 'paragraph', level: 1, ordered: false };
  scanChildren(root, topState, topContext, undefined);
  flushText(topState, topContext, undefined);

  return { blocks, imagePaths, firstHeading, textLength };
}
