import { EpubParseError } from './errors';
import { dirname, resolveZipPath } from './paths';
import type { ManifestItem, OpfDocument, SpineEntry } from './types';

function elementsByLocalName(root: ParentNode, name: string): Element[] {
  return Array.from(root.querySelectorAll('*')).filter(
    (element) => element.localName.toLowerCase() === name.toLowerCase(),
  );
}

function firstByLocalName(root: ParentNode, name: string): Element | null {
  const elements = elementsByLocalName(root, name);
  return elements[0] ?? null;
}

function textOf(element: Element | null): string {
  return element?.textContent?.replace(/\s+/gu, ' ').trim() ?? '';
}

function findMetadata(doc: Document): Element | null {
  return firstByLocalName(doc, 'metadata');
}

export function parseOpf(xml: string, opfPath: string): OpfDocument {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length > 0) {
    throw new EpubParseError(`Package document is not valid XML: ${opfPath}`);
  }

  const baseDir = dirname(opfPath);
  const metadata = findMetadata(doc);
  const title = textOf(metadata ? firstByLocalName(metadata, 'title') : null) || 'Untitled';
  const author = textOf(metadata ? firstByLocalName(metadata, 'creator') : null);
  const language = textOf(metadata ? firstByLocalName(metadata, 'language') : null) || 'und';

  const manifestElements = elementsByLocalName(doc, 'item');
  const manifest: ManifestItem[] = [];
  for (const element of manifestElements) {
    const id = element.getAttribute('id');
    const href = element.getAttribute('href');
    if (id === null || href === null || href.trim().length === 0) continue;
    const properties = (element.getAttribute('properties') ?? '')
      .split(/\s+/u)
      .filter((value) => value.length > 0);
    manifest.push({
      id,
      href: href.trim(),
      path: resolveZipPath(baseDir, href),
      mediaType: element.getAttribute('media-type') ?? '',
      properties,
    });
  }

  const byId = new Map(manifest.map((item) => [item.id, item]));

  let coverPath: string | null = null;
  const coverImage = manifest.find((item) => item.properties.includes('cover-image'));
  if (coverImage) {
    coverPath = coverImage.path;
  } else {
    const coverMeta = elementsByLocalName(metadata ?? doc, 'meta').find(
      (element) => element.getAttribute('name') === 'cover',
    );
    const coverId = coverMeta?.getAttribute('content');
    if (coverId) coverPath = byId.get(coverId)?.path ?? null;
  }
  if (coverPath === null) {
    const heuristic = manifest.find(
      (item) => item.mediaType.startsWith('image/') && /cover/iu.test(`${item.id} ${item.href}`),
    );
    coverPath = heuristic?.path ?? null;
  }

  const spine: SpineEntry[] = [];
  const spineElement = firstByLocalName(doc, 'spine');
  if (spineElement) {
    for (const itemref of elementsByLocalName(spineElement, 'itemref')) {
      if (itemref.getAttribute('linear') === 'no') continue;
      const idref = itemref.getAttribute('idref');
      if (idref === null) continue;
      const item = byId.get(idref);
      if (!item) continue;
      spine.push({ idref, path: item.path, mediaType: item.mediaType });
    }
  }

  if (spine.length === 0) {
    throw new EpubParseError('Package document has no readable spine.');
  }

  return {
    title,
    author,
    language,
    coverPath,
    manifest,
    spine,
    tocId: spineElement?.getAttribute('toc') ?? null,
  };
}
