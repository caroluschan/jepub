import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  ImportDuplicateError,
  ImportError,
  ImportTooLargeError,
  importEpubFile,
} from '../../src/lib/import/importEpub';
import { closeDb, listBooks } from '../../src/lib/storage';
import { buildSyntheticEpub } from '../fixtures/build-epub';

async function resetDatabase(): Promise<void> {
  await closeDb();
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase('jepub');
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error ?? new Error('deleteDatabase failed'));
    request.onblocked = () => resolve();
  });
}

beforeEach(async () => {
  await resetDatabase();
});

afterEach(async () => {
  await resetDatabase();
});

async function sampleFile(name = 'book.epub'): Promise<File> {
  const blob = await buildSyntheticEpub({
    title: '吾輩は猫である',
    author: '夏目漱石',
    language: 'ja',
    chapters: [
      {
        href: 'OEBPS/ch1.xhtml',
        title: '第一章',
        body: '<h1>第一章</h1><p>吾輩は猫である。名前はまだ無い。</p>',
      },
    ],
  });
  return new File([blob], name, { type: 'application/epub+zip' });
}

describe('importEpubFile', () => {
  it('IMP-ONE imports a valid EPUB into the database', async () => {
    const file = await sampleFile();
    const phases: string[] = [];
    const imported = await importEpubFile(file, {
      source: 'file',
      onPhase: (phase) => phases.push(phase),
    });

    expect(imported.book.title).toBe('吾輩は猫である');
    expect(imported.book.author).toBe('夏目漱石');
    expect(imported.book.language).toBe('ja');
    expect(imported.book.fileName).toBe('book.epub');
    expect(imported.book.fileSize).toBe(file.size);
    expect(imported.book.fileHash).toMatch(/^[0-9a-f]{64}$/u);
    expect(imported.book.chapterCount).toBe(1);
    expect(imported.book.source).toBe('file');
    expect(imported.book.cover).not.toBeNull();
    expect(imported.book.progress).toEqual({ chapterIndex: 0, ratio: 0 });
    expect(imported.chapterSet.bookId).toBe(imported.book.id);
    expect(imported.chapterSet.chapters).toHaveLength(1);

    expect(phases).toEqual(['hashing', 'parsing', 'saving']);
    expect(await listBooks()).toHaveLength(1);
  });

  it('IMP-DUP rejects a duplicate hash and reports the existing book', async () => {
    const file = await sampleFile();
    const first = await importEpubFile(file, { source: 'file' });

    let duplicate: unknown = null;
    try {
      await importEpubFile(await sampleFile('copy.epub'), { source: 'drop' });
    } catch (error) {
      duplicate = error;
    }

    expect(duplicate).toBeInstanceOf(ImportDuplicateError);
    if (duplicate instanceof ImportDuplicateError) {
      expect(duplicate.existing.id).toBe(first.book.id);
      expect(duplicate.existing.title).toBe('吾輩は猫である');
    }
    expect(await listBooks()).toHaveLength(1);
  });

  it('IMP-CORRUPT rejects a non-EPUB file without storing anything', async () => {
    const file = new File([new Uint8Array([1, 2, 3, 4, 5])], 'broken.epub', {
      type: 'application/epub+zip',
    });
    await expect(importEpubFile(file, { source: 'file' })).rejects.toBeInstanceOf(ImportError);
    expect(await listBooks()).toHaveLength(0);
  });

  it('IMP-ZERO-CHAPTER rejects a cover-only EPUB without storing anything', async () => {
    const blob = await buildSyntheticEpub({
      title: 'Cover only',
      chapters: [],
      includeCoverWrapper: true,
    });
    const file = new File([blob], 'cover-only.epub', { type: 'application/epub+zip' });

    await expect(importEpubFile(file, { source: 'file' })).rejects.toThrow(
      /no readable chapters/i,
    );
    expect(await listBooks()).toHaveLength(0);
  });

  it('IMP-DRM rejects a DRM-protected EPUB without storing anything', async () => {
    const blob = await buildSyntheticEpub({
      chapters: [{ href: 'OEBPS/ch1.xhtml', body: '<p>本文。</p>' }],
      encryptionXml: `<?xml version="1.0"?>
<encryption xmlns="urn:oasis:names:tc:opendocument:xmlns:container" xmlns:enc="http://www.w3.org/2001/04/xmlenc#">
  <enc:EncryptedData><enc:EncryptionMethod Algorithm="http://www.w3.org/2001/04/xmlenc#aes256-cbc"/></enc:EncryptedData>
</encryption>`,
    });
    const file = new File([blob], 'drm.epub', { type: 'application/epub+zip' });

    await expect(importEpubFile(file, { source: 'file' })).rejects.toBeInstanceOf(ImportError);
    expect(await listBooks()).toHaveLength(0);
  });

  it('IMP-CAP rejects files larger than 100MB before hashing', async () => {
    const file = new File([new Uint8Array([1])], 'huge.epub', {
      type: 'application/epub+zip',
    });
    Object.defineProperty(file, 'size', {
      value: 100 * 1024 * 1024 + 1,
      configurable: true,
    });

    await expect(importEpubFile(file, { source: 'file' })).rejects.toBeInstanceOf(
      ImportTooLargeError,
    );
    expect(await listBooks()).toHaveLength(0);
  });
});
