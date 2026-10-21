import JSZip from 'jszip';
import type { ChapterRecord, ParsedEpub, TocEntry } from '../types';
import {
  DecompressionBudget,
  assertChapterTextLength,
  assertSpineItemCount,
  assertZipEntryCount,
  MAX_ASSET_BYTES,
} from './budget';
import { parseContainerXml, CONTAINER_PATH } from './container';
import { parseChapterContent } from './content';
import { EpubDrmError, EpubParseError } from './errors';
import { parseOpf } from './opf';
import {
  buildCaseInsensitiveLookup,
  dirname,
  findActualPath,
  mimeForPath,
  resolveZipPath,
  splitHref,
} from './paths';
import { buildSpineIndex, parseToc } from './toc';

const FONT_OBFUSCATION_ALGORITHMS = [
  'idpf.org/2008/embedding',
  'ns.adobe.com/pdf/enc',
];

function isFontObfuscation(algorithm: string): boolean {
  return FONT_OBFUSCATION_ALGORITHMS.some((needle) => algorithm.includes(needle));
}

function detectDrm(encryptionXml: string): boolean {
  const doc = new DOMParser().parseFromString(encryptionXml, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length > 0) {
    return /EncryptedData/iu.test(encryptionXml);
  }

  const encryptedData = Array.from(doc.getElementsByTagName('*')).filter(
    (element) => element.localName === 'EncryptedData',
  );
  if (encryptedData.length === 0) return false;

  const algorithms = Array.from(doc.getElementsByTagName('*'))
    .filter((element) => element.localName === 'EncryptionMethod')
    .map((element) => element.getAttribute('Algorithm') ?? '')
    .filter((algorithm) => algorithm.length > 0);

  if (algorithms.length === 0) return true;
  return algorithms.some((algorithm) => !isFontObfuscation(algorithm));
}

function toBlob(bytes: Uint8Array, mime: string): Blob {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return new Blob([buffer], { type: mime });
}

interface ZipEntryInternals {
  _data?: { uncompressedSize?: number };
}

function declaredUncompressedSize(entry: JSZip.JSZipObject): number | null {
  const internals = entry as unknown as ZipEntryInternals;
  const size = internals._data?.uncompressedSize;
  return typeof size === 'number' && Number.isFinite(size) ? size : null;
}

function hasTextBlock(blocks: ChapterRecord['blocks']): boolean {
  return blocks.some(
    (block) => block.kind === 'paragraph' || block.kind === 'quote' || block.kind === 'heading' || block.kind === 'listItem',
  );
}

export async function openEpub(input: Blob): Promise<ParsedEpub> {
  let zip: JSZip;
  try {
    const buffer = await input.arrayBuffer();
    zip = await JSZip.loadAsync(buffer);
  } catch {
    throw new EpubParseError('The file is not a readable ZIP/EPUB archive.');
  }

  const allEntries = Object.keys(zip.files);
  assertZipEntryCount(allEntries.length);
  const zipPaths = allEntries.filter((path) => !zip.files[path]?.dir);
  const lookup = buildCaseInsensitiveLookup(zipPaths);
  const budget = new DecompressionBudget();
  const encoder = new TextEncoder();

  const readText = async (path: string): Promise<string | null> => {
    const actual = findActualPath(lookup, path);
    if (actual === null) return null;
    const entry = zip.file(actual);
    if (entry === null) return null;
    budget.checkDeclared(actual, declaredUncompressedSize(entry));
    const text = await entry.async('string');
    budget.add(actual, encoder.encode(text).byteLength);
    return text;
  };

  const readBytes = async (
    path: string,
    maxBytes: number = MAX_ASSET_BYTES,
  ): Promise<Uint8Array | null> => {
    const actual = findActualPath(lookup, path);
    if (actual === null) return null;
    const entry = zip.file(actual);
    if (entry === null) return null;
    const declared = declaredUncompressedSize(entry);
    budget.checkDeclared(actual, declared);
    if (declared !== null && declared > maxBytes) {
      throw new EpubParseError(
        `Archive entry is too large: ${actual} (limit ${Math.round(maxBytes / (1024 * 1024))} MB).`,
      );
    }
    const bytes = await entry.async('uint8array');
    if (bytes.byteLength > maxBytes) {
      throw new EpubParseError(
        `Archive entry is too large: ${actual} (limit ${Math.round(maxBytes / (1024 * 1024))} MB).`,
      );
    }
    budget.add(actual, bytes.byteLength);
    return bytes;
  };

  const containerXml = await readText(CONTAINER_PATH);
  if (containerXml === null) {
    throw new EpubParseError('META-INF/container.xml is missing.');
  }
  const opfPath = parseContainerXml(containerXml);

  const encryptionXml = await readText('META-INF/encryption.xml');
  if (encryptionXml !== null && detectDrm(encryptionXml)) {
    throw new EpubDrmError();
  }

  const opfXml = await readText(opfPath);
  if (opfXml === null) {
    throw new EpubParseError(`Package document is missing: ${opfPath}`);
  }
  const opf = parseOpf(opfXml, opfPath);
  assertSpineItemCount(opf.spine.length);

  const actualSpinePaths = opf.spine.map((entry) => {
    const actual = findActualPath(lookup, entry.path);
    if (actual === null) {
      throw new EpubParseError(`Spine item is missing from the archive: ${entry.path}`);
    }
    return actual;
  });

  const spineIndexByPath = buildSpineIndex(actualSpinePaths);
  const tocEntries = await parseToc({
    opf,
    spineIndexByPath,
    getText: async (path) => readText(path),
  });

  const tocTitleBySpine = new Map<number, string>();
  for (const entry of tocEntries) {
    if (!tocTitleBySpine.has(entry.chapterIndex) && entry.title.length > 0) {
      tocTitleBySpine.set(entry.chapterIndex, entry.title);
    }
  }

  const mimeByPath = new Map<string, string>();
  for (const item of opf.manifest) {
    if (item.mediaType.length > 0) mimeByPath.set(item.path.toLowerCase(), item.mediaType);
  }

  const coverPath =
    opf.coverPath !== null ? findActualPath(lookup, opf.coverPath) : null;
  const coverBytes = coverPath !== null ? await readBytes(coverPath) : null;
  const cover =
    coverBytes !== null && coverPath !== null
      ? toBlob(coverBytes, mimeByPath.get(coverPath.toLowerCase()) ?? mimeForPath(coverPath))
      : null;

  const coverKey = coverPath?.toLowerCase() ?? null;
  const chapters: ChapterRecord[] = [];
  const spineToChapter = new Map<number, number>();

  for (let spineIndex = 0; spineIndex < actualSpinePaths.length; spineIndex += 1) {
    const chapterPath = actualSpinePaths[spineIndex];
    if (chapterPath === undefined) continue;
    const xhtml = await readText(chapterPath);
    if (xhtml === null) {
      throw new EpubParseError(`Chapter is missing from the archive: ${chapterPath}`);
    }

    const content = parseChapterContent({
      xhtml,
      chapterPath,
      resolveImage: (rawSrc) => {
        const { path } = splitHref(rawSrc);
        if (path.length === 0) return null;
        return findActualPath(lookup, resolveZipPath(dirname(chapterPath), path));
      },
    });
    assertChapterTextLength(content.textLength, chapterPath);

    if (content.blocks.length === 0) continue;

    const isTextless = !hasTextBlock(content.blocks) && content.imagePaths.length > 0;
    const coverOnly =
      isTextless &&
      coverKey !== null &&
      content.imagePaths.every((imagePath) => imagePath.toLowerCase() === coverKey);
    if (coverOnly) continue;

    const index = chapters.length;
    const title =
      tocTitleBySpine.get(spineIndex) ?? content.firstHeading ?? `第${index + 1}章`;

    chapters.push({
      index,
      href: chapterPath,
      title,
      dir: dirname(chapterPath),
      blocks: content.blocks,
      imagePaths: content.imagePaths,
      textLength: content.textLength,
    });
    spineToChapter.set(spineIndex, index);
  }

  const remappedToc: TocEntry[] = [];
  for (const entry of tocEntries) {
    const chapterIndex = spineToChapter.get(entry.chapterIndex);
    if (chapterIndex === undefined) continue;
    remappedToc.push({ ...entry, chapterIndex });
  }

  const toc: TocEntry[] =
    remappedToc.length > 0
      ? remappedToc
      : chapters.map((chapter) => ({
          title: chapter.title,
          chapterIndex: chapter.index,
          fragment: null,
          depth: 0,
        }));

  const assetPaths: string[] = [];
  const seenAssets = new Set<string>();
  for (const chapter of chapters) {
    for (const imagePath of chapter.imagePaths) {
      if (!seenAssets.has(imagePath)) {
        seenAssets.add(imagePath);
        assetPaths.push(imagePath);
      }
    }
  }

  const assets: ParsedEpub['assets'] = [];
  for (const path of assetPaths) {
    const bytes = await readBytes(path);
    if (bytes === null) continue;
    assets.push({
      path,
      blob: toBlob(bytes, mimeByPath.get(path.toLowerCase()) ?? mimeForPath(path)),
      mime: mimeByPath.get(path.toLowerCase()) ?? mimeForPath(path),
    });
  }

  return {
    title: opf.title,
    author: opf.author,
    language: opf.language,
    cover,
    chapters,
    toc,
    assets,
  };
}

