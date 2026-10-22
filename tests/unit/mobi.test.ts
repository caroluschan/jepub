import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  ImportDuplicateError,
  ImportError,
} from '../../src/lib/import/errors';
import { importMobiFile } from '../../src/lib/import/mobiBook';
import { closeDb, getChapterSet, listBooks } from '../../src/lib/storage';
import type { ChapterBlock } from '../../src/lib/types';

const FIXTURE = resolve(process.cwd(), 'tests/fixtures/rashomon.mobi');

async function resetDatabase(): Promise<void> {
  await closeDb();
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase('jepub');
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error ?? new Error('deleteDatabase failed'));
    request.onblocked = () => resolve();
  });
}

async function mobiFile(name = 'rashomon.mobi'): Promise<File> {
  const bytes = new Uint8Array(await readFile(FIXTURE));
  return new File([bytes], name, { type: 'application/x-mobipocket-ebook' });
}

function chapterText(blocks: readonly ChapterBlock[]): string {
  return blocks.flatMap((block) => ('sentences' in block ? block.sentences : [])).join('\n');
}

beforeEach(resetDatabase);
afterEach(resetDatabase);

describe('MOBI import', () => {
  it('MOBI-REAL parses the Rashomon fixture into readable chapters', async () => {
    const imported = await importMobiFile(await mobiFile());

    expect(imported.book.title).toBe('羅生門');
    expect(imported.book.author).toContain('Akutagawa');
    expect(imported.book.language).toBe('ja');
    expect(imported.book.source).toBe('mobi');
    expect(imported.book.cover).toBeNull();
    expect(imported.book.fileName).toBe('rashomon.mobi');
    expect(imported.chapterSet.chapters.length).toBeGreaterThanOrEqual(2);

    const text = imported.chapterSet.chapters
      .map((chapter) => chapterText(chapter.blocks))
      .join('\n');
    expect(text).toContain('或日の暮方の事である');
    expect(text).not.toContain('げにん');
    expect(text).not.toContain('らしょうもん');

    for (const chapter of imported.chapterSet.chapters) {
      expect(chapter.href).toMatch(/^mobi-/u);
      expect(chapter.dir).toBe('');
      expect(chapter.imagePaths).toEqual([]);
      expect(chapter.textLength).toBeGreaterThan(0);
    }
  });

  it('MOBI-TOC maps resolvable TOC labels to chapter indexes', async () => {
    const imported = await importMobiFile(await mobiFile());
    const { chapters, toc } = imported.chapterSet;

    const rashomon = toc.find((entry) => entry.title === 'RASHOMON');
    expect(rashomon).toBeDefined();
    expect(rashomon?.fragment).toBeNull();
    if (rashomon !== undefined) {
      const chapter = chapters[rashomon.chapterIndex];
      expect(chapter?.title).toBe('RASHOMON');
      expect(chapterText(chapter?.blocks ?? [])).toContain('或日の暮方の事である');
    }

    const license = toc.find((entry) => entry.title.includes('PROJECT GUTENBERG'));
    expect(license).toBeDefined();
    if (license !== undefined) {
      const chapter = chapters[license.chapterIndex];
      expect(chapter?.title).toContain('PROJECT GUTENBERG');
    }
  });

  it('MOBI-STORAGE persists the book and chapter set into IndexedDB', async () => {
    const imported = await importMobiFile(await mobiFile());

    const books = await listBooks();
    expect(books).toHaveLength(1);
    expect(books[0]?.id).toBe(imported.book.id);

    const stored = await getChapterSet(imported.book.id);
    expect(stored?.chapters.length).toBe(imported.chapterSet.chapters.length);
    expect(stored?.toc).toEqual(imported.chapterSet.toc);
  });

  it('MOBI-DUP rejects the same MOBI bytes twice', async () => {
    const first = await importMobiFile(await mobiFile());

    await expect(importMobiFile(await mobiFile('copy.mobi'))).rejects.toBeInstanceOf(
      ImportDuplicateError,
    );
    expect(await listBooks()).toHaveLength(1);
    expect((await listBooks())[0]?.id).toBe(first.book.id);
  });

  it('MOBI-INVALID rejects a damaged MOBI without storing anything', async () => {
    const file = new File([new Uint8Array([1, 2, 3, 4, 5])], 'broken.mobi', {
      type: 'application/x-mobipocket-ebook',
    });

    let failure: unknown;
    try {
      await importMobiFile(file);
    } catch (error) {
      failure = error;
    }

    expect(failure).toBeInstanceOf(ImportError);
    expect((failure as Error).message).toMatch(/could not be read/i);
    expect(await listBooks()).toHaveLength(0);
  });

  it('MOBI-INVALID rejects non-MOBI extensions', async () => {
    const file = new File([new Uint8Array([1, 2, 3])], 'book.epub', {
      type: 'application/epub+zip',
    });
    await expect(importMobiFile(file)).rejects.toThrow(/only mobi/i);
    expect(await listBooks()).toHaveLength(0);
  });
});
