import { describe, expect, it } from 'vitest';
import { openEpub } from '../../src/lib/epub/openEpub';
import { EpubDrmError } from '../../src/lib/epub/errors';
import { buildSyntheticEpub, type SyntheticChapter } from '../fixtures/build-epub';

function chapter(
  href: string,
  body: string,
  extra: Partial<SyntheticChapter> = {},
): SyntheticChapter {
  return { href, body, ...extra };
}

describe('EPUB package parsing', () => {
  it('OPF-META reads DC metadata and skips the textless cover wrapper', async () => {
    const blob = await buildSyntheticEpub({
      title: '羅生門',
      author: '芥川龍之介',
      language: 'ja',
      chapters: [
        chapter('OEBPS/text/ch1.xhtml', '<h1>第一章</h1><p>ある日の暮方の事である。</p>', {
          title: '第一章',
        }),
      ],
    });

    const parsed = await openEpub(blob);
    expect(parsed.title).toBe('羅生門');
    expect(parsed.author).toBe('芥川龍之介');
    expect(parsed.language).toBe('ja');
    expect(parsed.chapters).toHaveLength(1);
    expect(parsed.chapters[0]?.title).toBe('第一章');
    expect(parsed.cover).not.toBeNull();
    expect(parsed.cover?.size).toBeGreaterThan(0);
  });

  it('OPF-PATHS decodes URL escapes and resolves ../ image paths', async () => {
    const blob = await buildSyntheticEpub({
      title: 'Paths',
      chapters: [
        chapter(
          'OEBPS/text/ch 1.xhtml',
          '<p><img src="../images/ill%20ustration.png" alt="絵"/>本文。</p>',
          { manifestHref: 'text/ch%201.xhtml', title: '一章' },
        ),
      ],
      images: [{ path: 'OEBPS/images/ill ustration.png', base64: undefined, text: 'png' }],
    });

    const parsed = await openEpub(blob);
    const parsedChapter = parsed.chapters[0];
    expect(parsedChapter?.href).toBe('OEBPS/text/ch 1.xhtml');
    expect(parsedChapter?.dir).toBe('OEBPS/text');
    expect(parsedChapter?.imagePaths).toEqual(['OEBPS/images/ill ustration.png']);
    expect(parsed.assets.map((asset) => asset.path)).toContain('OEBPS/images/ill ustration.png');
    const imageBlock = parsedChapter?.blocks.find((block) => block.kind === 'image');
    expect(imageBlock).toEqual({
      kind: 'image',
      path: 'OEBPS/images/ill ustration.png',
      alt: '絵',
    });
  });

  it('OPF-DRM rejects AES DRM but ignores font obfuscation', async () => {
    const drmXml = `<?xml version="1.0"?>
<encryption xmlns="urn:oasis:names:tc:opendocument:xmlns:container" xmlns:enc="http://www.w3.org/2001/04/xmlenc#">
  <enc:EncryptedData><enc:EncryptionMethod Algorithm="http://www.w3.org/2001/04/xmlenc#aes256-cbc"/></enc:EncryptedData>
</encryption>`;
    const encrypted = await buildSyntheticEpub({
      chapters: [chapter('OEBPS/ch1.xhtml', '<p>本文。</p>')],
      encryptionXml: drmXml,
    });
    await expect(openEpub(encrypted)).rejects.toBeInstanceOf(EpubDrmError);

    const fontXml = `<?xml version="1.0"?>
<encryption xmlns="urn:oasis:names:tc:opendocument:xmlns:container" xmlns:enc="http://www.w3.org/2001/04/xmlenc#">
  <enc:EncryptedData><enc:EncryptionMethod Algorithm="http://www.idpf.org/2008/embedding"/></enc:EncryptedData>
</encryption>`;
    const obfuscated = await buildSyntheticEpub({
      chapters: [chapter('OEBPS/ch1.xhtml', '<p>本文。</p>')],
      encryptionXml: fontXml,
    });
    const parsed = await openEpub(obfuscated);
    expect(parsed.chapters).toHaveLength(1);
  });

  it('OPF-SPINE ignores linear="no" items and reindexes chapters', async () => {
    const blob = await buildSyntheticEpub({
      chapters: [
        chapter('OEBPS/ch1.xhtml', '<h1>一</h1><p>最初。</p>', { id: 'ch1', title: '一' }),
        chapter('OEBPS/ch2.xhtml', '<h1>二</h1><p>補足。</p>', {
          id: 'ch2',
          title: '二',
          linear: 'no',
        }),
        chapter('OEBPS/ch3.xhtml', '<h1>三</h1><p>最後。</p>', { id: 'ch3', title: '三' }),
      ],
    });

    const parsed = await openEpub(blob);
    expect(parsed.chapters.map((item) => item.title)).toEqual(['一', '三']);
    expect(parsed.chapters.map((item) => item.index)).toEqual([0, 1]);
    expect(parsed.toc.map((entry) => entry.chapterIndex)).toEqual([0, 1]);
  });
});
