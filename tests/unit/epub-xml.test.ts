import { describe, expect, it } from 'vitest';
import { parseContainerXml } from '../../src/lib/epub/container';
import { parseOpf } from '../../src/lib/epub/opf';
import { parseToc } from '../../src/lib/epub/toc';
import type { OpfDocument } from '../../src/lib/epub/types';

const CONTAINER = `<?xml version="1.0" encoding="UTF-8"?>
<container xmlns="urn:oasis:names:tc:opendocument:xmlns:container" version="1.0">
  <rootfiles>
    <rootfile full-path="OPS/package.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`;

const OPF = `<?xml version="1.0" encoding="utf-8"?>
<package xmlns="http://www.idpf.org/2007/opf" xmlns:dc="http://purl.org/dc/elements/1.1/" version="3.0">
  <metadata>
    <dc:title>羅生門</dc:title>
    <dc:creator>芥川龍之介</dc:creator>
    <dc:language>ja</dc:language>
  </metadata>
  <manifest>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
    <item id="ch1" href="ch1.xhtml" media-type="application/xhtml+xml"/>
  </manifest>
  <spine>
    <itemref idref="ch1"/>
  </spine>
</package>`;

const NAV = `<?xml version="1.0" encoding="utf-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
  <body>
    <nav epub:type="toc"><ol><li><a href="ch1.xhtml">第一章</a></li></ol></nav>
  </body>
</html>`;

function opfDocument(): OpfDocument {
  return {
    title: '羅生門',
    author: '芥川龍之介',
    language: 'ja',
    coverPath: null,
    manifest: [
      {
        id: 'nav',
        href: 'nav.xhtml',
        path: 'OEBPS/nav.xhtml',
        mediaType: 'application/xhtml+xml',
        properties: ['nav'],
      },
      {
        id: 'ch1',
        href: 'ch1.xhtml',
        path: 'OEBPS/ch1.xhtml',
        mediaType: 'application/xhtml+xml',
        properties: [],
      },
    ],
    spine: [
      { idref: 'ch1', path: 'OEBPS/ch1.xhtml', mediaType: 'application/xhtml+xml' },
    ],
    tocId: null,
  };
}

describe('XML prefix tolerance', () => {
  it('CONTAINER-BOM reads a BOM-prefixed container.xml', () => {
    expect(parseContainerXml(`\uFEFF${CONTAINER}`)).toBe('OPS/package.opf');
  });

  it('OPF-BOM reads a BOM-prefixed package document', () => {
    const parsed = parseOpf(`\uFEFF\n  ${OPF}`, 'OEBPS/content.opf');
    expect(parsed.title).toBe('羅生門');
    expect(parsed.author).toBe('芥川龍之介');
    expect(parsed.language).toBe('ja');
    expect(parsed.spine.map((entry) => entry.path)).toEqual(['OEBPS/ch1.xhtml']);
  });

  it('TOC-BOM reads a BOM-prefixed navigation document', async () => {
    const entries = await parseToc({
      opf: opfDocument(),
      spineIndexByPath: new Map([['oebps/ch1.xhtml', 0]]),
      getText: async (path) => (path === 'OEBPS/nav.xhtml' ? `\uFEFF${NAV}` : null),
    });

    expect(entries).toEqual([
      { title: '第一章', chapterIndex: 0, fragment: null, depth: 0 },
    ]);
  });
});
