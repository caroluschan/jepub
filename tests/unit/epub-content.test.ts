import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { openEpub } from '../../src/lib/epub/openEpub';
import { parseToc } from '../../src/lib/epub/toc';
import type { OpfDocument } from '../../src/lib/epub/types';
import { buildSyntheticEpub } from '../fixtures/build-epub';

function blobFromFile(path: string): Blob {
  const bytes = readFileSync(path);
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return new Blob([buffer], { type: 'application/epub+zip' });
}

describe('EPUB content extraction', () => {
  it('CONTENT-BLOCKS preserves document order and block kinds', async () => {
    const blob = await buildSyntheticEpub({
      chapters: [
        {
          href: 'OEBPS/ch1.xhtml',
          id: 'ch1',
          body: `<h1 id="top">第一章</h1>
<p id="p1">広い門<br/>の下には、雨が降っていた。</p>
<blockquote><p>「そうか。」</p></blockquote>
<ul><li>一つ</li><li>二つ</li></ul>
<ol><li>第一</li></ol>
<div>第一段。</div>
<div>第二段。</div>
<hr/>`,
        },
      ],
      nav: false,
      ncx: false,
    });

    const parsed = await openEpub(blob);
    const chapter = parsed.chapters[0];
    expect(chapter).toBeDefined();
    expect(chapter?.blocks.map((block) => block.kind)).toEqual([
      'heading',
      'paragraph',
      'quote',
      'listItem',
      'listItem',
      'listItem',
      'paragraph',
      'paragraph',
      'separator',
    ]);

    const heading = chapter?.blocks[0];
    expect(heading).toEqual({ kind: 'heading', level: 1, sentences: ['第一章'], anchor: 'top' });

    const paragraph = chapter?.blocks[1];
    expect(paragraph?.kind).toBe('paragraph');
    if (paragraph?.kind === 'paragraph') {
      expect(paragraph.anchor).toBe('p1');
      expect(paragraph.sentences).toEqual(['広い門の下には、雨が降っていた。']);
    }

    const listItems = chapter?.blocks.filter((block) => block.kind === 'listItem') ?? [];
    expect(listItems.map((block) => (block.kind === 'listItem' ? block.ordered : null))).toEqual([
      false,
      false,
      true,
    ]);

    const divParagraphs = chapter?.blocks.filter(
      (block) => block.kind === 'paragraph' && block.sentences.length === 1,
    );
    const divTexts = divParagraphs?.map((block) =>
      block.kind === 'paragraph' ? block.sentences[0] : '',
    );
    expect(divTexts).toEqual(['広い門の下には、雨が降っていた。', '第一段。', '第二段。']);
  });

  it('CONTENT-RUBY-STRIP keeps the ruby base and drops readings', async () => {
    const blob = await buildSyntheticEpub({
      chapters: [
        {
          href: 'OEBPS/ch1.xhtml',
          body: '<p><ruby>猫<rp>(</rp><rt>ねこ</rt><rp>)</rp></ruby>である。名前はまだ無い。</p>',
        },
      ],
      nav: false,
      ncx: false,
    });

    const parsed = await openEpub(blob);
    const serialized = JSON.stringify(parsed.chapters[0]?.blocks ?? []);
    expect(serialized).not.toContain('ねこ');
    expect(serialized).not.toContain('(猫)');
    const paragraph = parsed.chapters[0]?.blocks[0];
    expect(paragraph?.kind).toBe('paragraph');
    if (paragraph?.kind === 'paragraph') {
      expect(paragraph.sentences.join('')).toBe('猫である。名前はまだ無い。');
    }
  });

  it('CONTENT-IMG-XLINK extracts HTML and SVG images in order', async () => {
    const blob = await buildSyntheticEpub({
      chapters: [
        {
          href: 'OEBPS/text/ch1.xhtml',
          body: `<p>前。</p>
<img src="../images/a.png" alt="A"/>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"><image xlink:href="../images/b.png" width="1" height="1"/></svg>`,
        },
      ],
      images: [
        { path: 'OEBPS/images/a.png', text: 'a' },
        { path: 'OEBPS/images/b.png', text: 'b' },
      ],
      nav: false,
      ncx: false,
    });

    const parsed = await openEpub(blob);
    const blocks = parsed.chapters[0]?.blocks ?? [];
    const images = blocks.filter((block) => block.kind === 'image');
    expect(images).toEqual([
      { kind: 'image', path: 'OEBPS/images/a.png', alt: 'A' },
      { kind: 'image', path: 'OEBPS/images/b.png', alt: '' },
    ]);
    expect(parsed.chapters[0]?.imagePaths).toEqual([
      'OEBPS/images/a.png',
      'OEBPS/images/b.png',
    ]);
  });

  it('TOC-NAV-FRAG maps nested nav entries to spine indexes and fragments', async () => {
    const blob = await buildSyntheticEpub({
      chapters: [
        { href: 'OEBPS/text/ch1.xhtml', id: 'ch1', title: '第一章', body: '<p>本文。</p>' },
        { href: 'OEBPS/text/ch2.xhtml', id: 'ch2', title: '第二章', body: '<p>続き。</p>' },
      ],
      nav: true,
      ncx: false,
      navEntries: [
        {
          title: '第一章',
          href: 'text/ch1.xhtml#start',
          children: [{ title: '節', href: 'text/ch1.xhtml#section-1' }],
        },
        { title: '第二章', href: 'text/ch2.xhtml' },
      ],
    });

    const parsed = await openEpub(blob);
    expect(parsed.toc).toEqual([
      { title: '第一章', chapterIndex: 0, fragment: 'start', depth: 0 },
      { title: '節', chapterIndex: 0, fragment: 'section-1', depth: 1 },
      { title: '第二章', chapterIndex: 1, fragment: null, depth: 0 },
    ]);
  });

  it('TOC-SAME-DOC resolves a bare fragment against the navigation document', async () => {
    const opf: OpfDocument = {
      title: 'Same doc',
      author: '',
      language: 'ja',
      coverPath: null,
      manifest: [
        {
          id: 'nav',
          href: 'ch1.xhtml',
          path: 'OEBPS/ch1.xhtml',
          mediaType: 'application/xhtml+xml',
          properties: ['nav'],
        },
      ],
      spine: [],
      tocId: null,
    };
    const navXml = `<?xml version="1.0" encoding="utf-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops"><body>
<nav epub:type="toc"><ol><li><a href="#section">節</a></li></ol></nav>
</body></html>`;

    const entries = await parseToc({
      opf,
      spineIndexByPath: new Map([['oebps/ch1.xhtml', 0]]),
      getText: async (path) => (path === 'OEBPS/ch1.xhtml' ? navXml : null),
    });

    expect(entries).toEqual([
      { title: '節', chapterIndex: 0, fragment: 'section', depth: 0 },
    ]);
  });

  it('TOC-NCX falls back to the NCX navMap with nested depth', async () => {
    const blob = await buildSyntheticEpub({
      chapters: [
        { href: 'OEBPS/ch1.xhtml', id: 'ch1', title: '一', body: '<p>本文。</p>' },
        { href: 'OEBPS/ch2.xhtml', id: 'ch2', title: '二', body: '<p>続き。</p>' },
      ],
      nav: false,
      ncx: true,
      navEntries: [
        {
          title: '第一',
          href: 'ch1.xhtml#one',
          children: [{ title: '第一節', href: 'ch1.xhtml#two' }],
        },
        { title: '第二', href: 'ch2.xhtml' },
      ],
    });

    const parsed = await openEpub(blob);
    expect(parsed.toc).toEqual([
      { title: '第一', chapterIndex: 0, fragment: 'one', depth: 0 },
      { title: '第一節', chapterIndex: 0, fragment: 'two', depth: 1 },
      { title: '第二', chapterIndex: 1, fragment: null, depth: 0 },
    ]);
  });

  it('COVER-SKIP skips the cover wrapper but keeps other image-only chapters', async () => {
    const blob = await buildSyntheticEpub({
      chapters: [
        { href: 'OEBPS/text/ch1.xhtml', title: '本文', body: '<p>最初の文。</p>' },
        {
          href: 'OEBPS/text/art.xhtml',
          title: '挿絵',
          body: '<img src="../images/art.png" alt="挿絵"/>',
        },
      ],
      images: [{ path: 'OEBPS/images/art.png', text: 'art' }],
      includeCoverWrapper: true,
    });

    const parsed = await openEpub(blob);
    expect(parsed.chapters).toHaveLength(2);
    expect(parsed.chapters.map((chapter) => chapter.title)).toEqual(['本文', '挿絵']);
    expect(parsed.chapters[1]?.blocks).toEqual([
      { kind: 'image', path: 'OEBPS/images/art.png', alt: '挿絵' },
    ]);
  });

  it('RASHOMON-REAL parses the Project Gutenberg fixture', async () => {
    const parsed = await openEpub(blobFromFile('tests/fixtures/rashomon.epub'));

    expect(parsed.title).toBe('羅生門');
    expect(parsed.author).toContain('Akutagawa');
    expect(parsed.language).toBe('ja');
    expect(parsed.chapters.length).toBeGreaterThanOrEqual(1);
    expect(parsed.cover).not.toBeNull();
    expect(parsed.cover?.size ?? 0).toBeGreaterThan(1000);

    const firstChapter = parsed.chapters[0];
    expect(firstChapter).toBeDefined();
    const text = (firstChapter?.blocks ?? [])
      .flatMap((block) =>
        block.kind === 'paragraph' || block.kind === 'quote' || block.kind === 'heading' || block.kind === 'listItem'
          ? block.sentences
          : [],
      )
      .join('');
    expect(text).toContain('或日の暮方');
    expect(text).toContain('下人');
    expect(firstChapter?.textLength ?? 0).toBeGreaterThan(5_000);
    expect(parsed.toc[0]?.title).toBe('RASHOMON');
    expect(parsed.toc[0]?.chapterIndex).toBe(0);
  });

  it('SAMPLE-PARSE parses the generated sample EPUB', async () => {
    const parsed = await openEpub(blobFromFile('public/sample/jepub-sample.epub'));

    expect(parsed.title).toContain('吾輩は猫である');
    expect(parsed.author).toBe('夏目漱石');
    expect(parsed.language).toBe('ja');
    expect(parsed.chapters.length).toBeGreaterThanOrEqual(2);
    expect(parsed.toc[0]).toEqual({
      title: '第一章',
      chapterIndex: 0,
      fragment: 'start',
      depth: 0,
    });
    expect(parsed.toc[1]?.title).toBe('第二章');

    const first = parsed.chapters[0];
    const firstText =
      first?.blocks
        .flatMap((block) =>
          block.kind === 'paragraph' || block.kind === 'quote' || block.kind === 'heading' || block.kind === 'listItem'
            ? block.sentences
            : [],
        )
        .join('') ?? '';
    expect(firstText).toContain('吾輩は猫である');
    expect(firstText).not.toContain('わがはい');
    expect(firstText).not.toContain('\n');

    const imageChapter = parsed.chapters.find((chapter) =>
      chapter.blocks.some((block) => block.kind === 'image'),
    );
    expect(imageChapter).toBeDefined();
  });
});
