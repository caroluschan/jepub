import type { TocEntry } from '../types';
import { EpubParseError } from './errors';
import {
  buildCaseInsensitiveLookup,
  decodeUriPart,
  dirname,
  resolveZipPath,
  splitHref,
} from './paths';
import type { ManifestItem, OpfDocument } from './types';
import { hasXmlParseError, parseXmlDocument } from './xml';

export interface TocParseInput {
  opf: OpfDocument;
  spineIndexByPath: Map<string, number>;
  getText: (path: string) => Promise<string | null>;
}

function directChildren(element: Element, name: string): Element[] {
  return Array.from(element.children).filter(
    (child) => child.localName.toLowerCase() === name.toLowerCase(),
  );
}

function normalizeLabel(element: Element): string {
  return element.textContent?.replace(/\s+/gu, ' ').trim() ?? '';
}

function parseHref(
  rawHref: string,
  baseDir: string,
  spineIndexByPath: Map<string, number>,
  sameDocumentPath: string,
): { chapterIndex: number; fragment: string | null } | null {
  const { path, fragment } = splitHref(rawHref);
  const decodedFragment = fragment !== null ? decodeUriPart(fragment) : null;
  if (path.length === 0) {
    // A bare fragment points into the navigation/current document itself.
    const selfIndex = spineIndexByPath.get(sameDocumentPath.toLowerCase());
    if (selfIndex === undefined || decodedFragment === null || decodedFragment.length === 0) {
      return null;
    }
    return { chapterIndex: selfIndex, fragment: decodedFragment };
  }
  const resolved = resolveZipPath(baseDir, path);
  const chapterIndex = spineIndexByPath.get(resolved.toLowerCase());
  if (chapterIndex === undefined) return null;
  return {
    chapterIndex,
    fragment: decodedFragment !== null && decodedFragment.length > 0 ? decodedFragment : null,
  };
}

function findNavItem(opf: OpfDocument): ManifestItem | null {
  return opf.manifest.find((item) => item.properties.includes('nav')) ?? null;
}

function findNcxItem(opf: OpfDocument): ManifestItem | null {
  if (opf.tocId !== null) {
    const byId = opf.manifest.find((item) => item.id === opf.tocId);
    if (byId) return byId;
  }
  return opf.manifest.find((item) => item.mediaType === 'application/x-dtbncx+xml') ?? null;
}

function parseNavDocument(
  doc: Document,
  navPath: string,
  spineIndexByPath: Map<string, number>,
): TocEntry[] {
  const navs = Array.from(doc.getElementsByTagName('nav'));
  const nav =
    navs.find((element) => {
      const type = element.getAttribute('epub:type') ?? element.getAttribute('type') ?? '';
      const role = element.getAttribute('role') ?? '';
      return type.split(/\s+/u).includes('toc') || role === 'doc-toc';
    }) ?? navs[0];
  if (!nav) return [];

  const entries: TocEntry[] = [];
  const navDir = dirname(navPath);

  const visitList = (list: Element, depth: number): void => {
    for (const item of directChildren(list, 'li')) {
      const anchor =
        directChildren(item, 'a')[0] ??
        Array.from(item.querySelectorAll('a')).find(
          (candidate) => candidate.closest('li') === item,
        ) ??
        null;

      if (anchor) {
        const href = anchor.getAttribute('href');
        const resolved = href
          ? parseHref(href, navDir, spineIndexByPath, navPath)
          : null;
        if (resolved) {
          entries.push({
            title: normalizeLabel(anchor) || href || '',
            chapterIndex: resolved.chapterIndex,
            fragment: resolved.fragment,
            depth,
          });
        }
      }

      for (const nested of directChildren(item, 'ol')) visitList(nested, depth + 1);
    }
  };

  for (const list of directChildren(nav, 'ol')) visitList(list, 0);
  return entries;
}

function parseNcxDocument(
  doc: Document,
  ncxPath: string,
  spineIndexByPath: Map<string, number>,
): TocEntry[] {
  const navMap = Array.from(doc.getElementsByTagName('navMap'))[0];
  if (!navMap) return [];

  const entries: TocEntry[] = [];
  const ncxDir = dirname(ncxPath);

  const visitPoint = (point: Element, depth: number): void => {
    const label = directChildren(point, 'navLabel')[0];
    const content = directChildren(point, 'content')[0];
    const src = content?.getAttribute('src') ?? null;
    const resolved = src ? parseHref(src, ncxDir, spineIndexByPath, ncxPath) : null;
    const title = label
      ? normalizeLabel(directChildren(label, 'text')[0] ?? label)
      : '';
    if (resolved) {
      entries.push({
        title: title || src || '',
        chapterIndex: resolved.chapterIndex,
        fragment: resolved.fragment,
        depth,
      });
    }
    for (const nested of directChildren(point, 'navPoint')) visitPoint(nested, depth + 1);
  };

  for (const point of directChildren(navMap, 'navPoint')) visitPoint(point, 0);
  return entries;
}

export async function parseToc(input: TocParseInput): Promise<TocEntry[]> {
  const { opf, spineIndexByPath, getText } = input;
  const indexLookup = new Map(spineIndexByPath);

  const navItem = findNavItem(opf);
  if (navItem) {
    const xml = await getText(navItem.path);
    if (xml === null) {
      throw new EpubParseError(`Navigation document is missing: ${navItem.path}`);
    }
    const doc = parseXmlDocument(xml, 'application/xhtml+xml');
    if (!hasXmlParseError(doc)) {
      const entries = parseNavDocument(doc, navItem.path, indexLookup);
      if (entries.length > 0) return entries;
    }
  }

  const ncxItem = findNcxItem(opf);
  if (ncxItem) {
    const xml = await getText(ncxItem.path);
    if (xml !== null) {
      const doc = parseXmlDocument(xml);
      if (!hasXmlParseError(doc)) {
        const entries = parseNcxDocument(doc, ncxItem.path, indexLookup);
        if (entries.length > 0) return entries;
      }
    }
  }

  return [];
}

export function buildSpineIndex(spinePaths: readonly string[]): Map<string, number> {
  const lookup = buildCaseInsensitiveLookup(spinePaths);
  const result = new Map<string, number>();
  spinePaths.forEach((path, index) => {
    const actual = lookup.get(path.toLowerCase());
    if (actual !== undefined) result.set(actual.toLowerCase(), index);
  });
  return result;
}
