import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  ImportDuplicateError,
  ImportError,
} from '../../src/lib/import/errors';
import {
  decodeText,
  importTextFile,
  textToBlocks,
  textToParagraphs,
} from '../../src/lib/import/textBook';
import { closeDb, listBooks } from '../../src/lib/storage';

async function resetDatabase(): Promise<void> {
  await closeDb();
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase('jepub');
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error ?? new Error('deleteDatabase failed'));
    request.onblocked = () => resolve();
  });
}

beforeEach(resetDatabase);
afterEach(resetDatabase);

function textFile(name: string, text: string): File {
  return new File([text], name, { type: 'text/plain' });
}

describe('plain text decoding', () => {
  it('TEXT-DECODE-UTF8 decodes UTF-8 with and without a BOM', () => {
    const body = new TextEncoder().encode('吾輩は猫である。');
    const withBom = new Uint8Array(3 + body.length);
    withBom.set([0xef, 0xbb, 0xbf]);
    withBom.set(body, 3);

    expect(decodeText(body)).toBe('吾輩は猫である。');
    expect(decodeText(withBom)).toBe('吾輩は猫である。');
  });

  it('TEXT-DECODE-SHIFTJIS falls back to Shift_JIS for unlabelled bytes', () => {
    expect(decodeText(new Uint8Array([0x82, 0xa0]))).toBe('あ');
  });

  it('TEXT-PARAGRAPHS splits blank lines, strips separators, and segments sentences', () => {
    expect(textToParagraphs('第一段。\n\n第二段。\n----- \n続き。')).toEqual([
      '第一段。',
      '第二段。',
      '続き。',
    ]);
    expect(textToParagraphs('一行目。\n二行目。')).toEqual(['一行目。', '二行目。']);

    const blocks = textToBlocks('第一段。\n\n第二段。続き。');
    expect(blocks).toEqual([
      { kind: 'paragraph', sentences: ['第一段。'] },
      { kind: 'paragraph', sentences: ['第二段。', '続き。'] },
    ]);
  });

  it('TEXT-EMPTY rejects an empty text file without storing a book', async () => {
    await expect(importTextFile(textFile('empty.txt', '\n\n----\n'))).rejects.toBeInstanceOf(
      ImportError,
    );
    expect(await listBooks()).toHaveLength(0);
  });
});

describe('importTextFile', () => {
  it('IMP-TEXT imports UTF-8 text with the filename as title', async () => {
    const imported = await importTextFile(
      textFile('吾輩は猫である.txt', '吾輩は猫である。\n\n名前はまだ無い。'),
    );

    expect(imported.book.title).toBe('吾輩は猫である');
    expect(imported.book.author).toBe('');
    expect(imported.book.language).toBe('ja');
    expect(imported.book.source).toBe('text');
    expect(imported.book.cover).toBeNull();
    expect(imported.book.chapterCount).toBe(1);
    expect(imported.book.fileHash).toMatch(/^[0-9a-f]{64}$/u);
    expect(imported.chapterSet.chapters[0]?.title).toBe('吾輩は猫である');
    expect(imported.chapterSet.chapters[0]?.blocks).toEqual([
      { kind: 'paragraph', sentences: ['吾輩は猫である。'] },
      { kind: 'paragraph', sentences: ['名前はまだ無い。'] },
    ]);
    expect(await listBooks()).toHaveLength(1);
  });

  it('IMP-TEXT-DUP rejects the same text with a different filename', async () => {
    await importTextFile(textFile('one.txt', '同じ本文です。'));

    let duplicate: unknown = null;
    try {
      await importTextFile(textFile('two.txt', '同じ本文です。'));
    } catch (error) {
      duplicate = error;
    }

    expect(duplicate).toBeInstanceOf(ImportDuplicateError);
    if (duplicate instanceof ImportDuplicateError) {
      expect(duplicate.message).toBe('This book is already in your library.');
    }
    expect(await listBooks()).toHaveLength(1);
  });
});
