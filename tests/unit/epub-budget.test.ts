import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import {
  DecompressionBudget,
  MAX_CHAPTER_TEXT_LENGTH,
  MAX_ENTRY_UNCOMPRESSED_BYTES,
  MAX_SPINE_ITEMS,
  MAX_ZIP_ENTRIES,
  assertChapterTextLength,
  assertSpineItemCount,
  assertZipEntryCount,
} from '../../src/lib/epub/budget';
import { EpubParseError } from '../../src/lib/epub/errors';
import { openEpub } from '../../src/lib/epub/openEpub';

describe('untrusted EPUB budget', () => {
  it('ZIP-BUDGET rejects oversized entries and cumulative inflation', () => {
    const perEntry = new DecompressionBudget();
    expect(() =>
      perEntry.checkDeclared('huge.bin', MAX_ENTRY_UNCOMPRESSED_BYTES + 1),
    ).toThrow(EpubParseError);
    expect(() => perEntry.add('huge.bin', MAX_ENTRY_UNCOMPRESSED_BYTES + 1)).toThrow(
      EpubParseError,
    );

    const cumulative = new DecompressionBudget(100);
    cumulative.add('a', 60);
    cumulative.checkDeclared('b', 30);
    expect(() => cumulative.add('b', 50)).toThrow(/safety limit/u);
    expect(cumulative.usedBytes).toBe(60);
  });

  it('ZIP-ENTRY-LIMIT rejects archives with too many entries before reading', async () => {
    expect(() => assertZipEntryCount(MAX_ZIP_ENTRIES + 1)).toThrow(/too many files/u);

    const zip = new JSZip();
    for (let index = 0; index < MAX_ZIP_ENTRIES + 1; index += 1) {
      zip.file(`entry-${index}.txt`, 'x');
    }
    const bytes = await zip.generateAsync({ type: 'uint8array' });
    const buffer = new ArrayBuffer(bytes.byteLength);
    new Uint8Array(buffer).set(bytes);
    await expect(
      openEpub(new Blob([buffer], { type: 'application/epub+zip' })),
    ).rejects.toThrow(/too many files/u);
  });

  it('ZIP-SPINE-LIMIT and ZIP-CHAPTER-LIMIT reject runaway books', () => {
    expect(() => assertSpineItemCount(MAX_SPINE_ITEMS + 1)).toThrow(/spine items/u);
    expect(() =>
      assertChapterTextLength(MAX_CHAPTER_TEXT_LENGTH + 1, 'OEBPS/ch1.xhtml'),
    ).toThrow(/Chapter text is too large/u);
    expect(() => assertChapterTextLength(MAX_CHAPTER_TEXT_LENGTH, 'OEBPS/ch1.xhtml')).not.toThrow();
  });
});
