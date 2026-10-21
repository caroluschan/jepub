import JSZip from 'jszip';

export interface SyntheticNavEntry {
  title: string;
  href?: string;
  children?: SyntheticNavEntry[];
}

export interface SyntheticChapter {
  href: string;
  id?: string;
  title?: string;
  body: string;
  manifestHref?: string;
  linear?: 'yes' | 'no';
}

export interface SyntheticImage {
  path: string;
  base64?: string;
  text?: string;
  mediaType?: string;
}

export interface SyntheticEpubOptions {
  title?: string;
  author?: string;
  language?: string;
  opfPath?: string;
  chapters: SyntheticChapter[];
  nav?: boolean;
  ncx?: boolean;
  navEntries?: SyntheticNavEntry[];
  includeCoverWrapper?: boolean;
  coverPath?: string;
  images?: SyntheticImage[];
  encryptionXml?: string;
}

const FIXED_DATE = new Date(2020, 0, 1, 12, 0, 0);
const ZIP_ENTRY = { date: FIXED_DATE };

const PNG_1X1 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAFgwJ/lVn9WQAAAABJRU5ErkJggg==';

function escapeXml(value: string): string {
  return value
    .replace(/&/gu, '&amp;')
    .replace(/</gu, '&lt;')
    .replace(/>/gu, '&gt;')
    .replace(/"/gu, '&quot;');
}

function dirname(path: string): string {
  const index = path.lastIndexOf('/');
  return index < 0 ? '' : path.slice(0, index);
}

function relativeTo(baseDir: string, path: string): string {
  if (baseDir.length === 0) return path;
  if (path.startsWith(`${baseDir}/`)) return path.slice(baseDir.length + 1);
  const baseParts = baseDir.split('/');
  const pathParts = path.split('/');
  let shared = 0;
  while (
    shared < baseParts.length &&
    shared < pathParts.length &&
    baseParts[shared] === pathParts[shared]
  ) {
    shared += 1;
  }
  const ups = baseParts.length - shared;
  return [...Array.from({ length: ups }, () => '..'), ...pathParts.slice(shared)].join('/');
}

function renderNav(
  entries: SyntheticNavEntry[],
  depth = 0,
): string {
  const items = entries
    .map((entry) => {
      const anchor =
        entry.href !== undefined
          ? `<a href="${escapeXml(entry.href)}">${escapeXml(entry.title)}</a>`
          : `<span>${escapeXml(entry.title)}</span>`;
      const nested = entry.children && entry.children.length > 0
        ? renderNav(entry.children, depth + 1)
        : '';
      return `<li>${anchor}${nested}</li>`;
    })
    .join('');
  return `<ol>${items}</ol>`;
}

function renderNcxPoints(entries: SyntheticNavEntry[], counter: { value: number }): string {
  return entries
    .map((entry) => {
      const playOrder = (counter.value += 1);
      const src =
        entry.href !== undefined
          ? `<content src="${escapeXml(entry.href)}"/>`
          : '';
      const nested = entry.children ? renderNcxPoints(entry.children, counter) : '';
      return `<navPoint id="np-${playOrder}" playOrder="${playOrder}"><navLabel><text>${escapeXml(
        entry.title,
      )}</text></navLabel>${src}${nested}</navPoint>`;
    })
    .join('');
}

function wrapXhtml(title: string, body: string): string {
  return `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xmlns:svg="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
<head><title>${escapeXml(title)}</title></head>
<body>${body}</body>
</html>`;
}

function mimeFor(path: string, explicit?: string): string {
  if (explicit) return explicit;
  const ext = path.slice(path.lastIndexOf('.') + 1).toLowerCase();
  if (ext === 'png') return 'image/png';
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
  if (ext === 'svg') return 'image/svg+xml';
  if (ext === 'gif') return 'image/gif';
  if (ext === 'webp') return 'image/webp';
  return 'application/octet-stream';
}

export async function buildSyntheticEpub(options: SyntheticEpubOptions): Promise<Blob> {
  const opfPath = options.opfPath ?? 'OEBPS/content.opf';
  const opfDir = dirname(opfPath);
  const navPath = opfDir.length > 0 ? `${opfDir}/nav.xhtml` : 'nav.xhtml';
  const ncxPath = opfDir.length > 0 ? `${opfDir}/toc.ncx` : 'toc.ncx';
  const coverPath = options.coverPath ?? (opfDir.length > 0 ? `${opfDir}/images/cover.png` : 'images/cover.png');
  const includeCover = options.includeCoverWrapper ?? true;

  const zip = new JSZip();
  zip.file('mimetype', 'application/epub+zip', { ...ZIP_ENTRY, compression: 'STORE' });
  zip.file(
    'META-INF/container.xml',
    `<?xml version="1.0" encoding="utf-8"?>
<container xmlns="urn:oasis:names:tc:opendocument:xmlns:container" version="1.0">
  <rootfiles>
    <rootfile full-path="${escapeXml(opfPath)}" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`,
    ZIP_ENTRY,
  );

  if (options.encryptionXml !== undefined) {
    zip.file('META-INF/encryption.xml', options.encryptionXml, ZIP_ENTRY);
  }

  const manifest: string[] = [];
  const spine: string[] = [];

  const autoNavEntries: SyntheticNavEntry[] =
    options.navEntries ??
    options.chapters.map((chapter) => ({
      title: chapter.title ?? chapter.id ?? 'Chapter',
      href: relativeTo(opfDir, chapter.href),
    }));

  const navEnabled = options.nav ?? true;
  const ncxEnabled = options.ncx ?? true;

  if (navEnabled) {
    manifest.push(
      `<item id="nav" href="${escapeXml(relativeTo(opfDir, navPath))}" media-type="application/xhtml+xml" properties="nav"/>`,
    );
    zip.file(
      navPath,
      wrapXhtml(
        'Contents',
        `<nav epub:type="toc" role="doc-toc"><h1>Contents</h1>${renderNav(autoNavEntries)}</nav>`,
      ),
      ZIP_ENTRY,
    );
  }

  if (ncxEnabled) {
    const counter = { value: 0 };
    manifest.push(
      `<item id="ncx" href="${escapeXml(relativeTo(opfDir, ncxPath))}" media-type="application/x-dtbncx+xml"/>`,
    );
    zip.file(
      ncxPath,
      `<?xml version="1.0" encoding="utf-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <head><meta name="dtb:uid" content="synthetic"/></head>
  <docTitle><text>${escapeXml(options.title ?? 'Synthetic')}</text></docTitle>
  <navMap>${renderNcxPoints(autoNavEntries, counter)}</navMap>
</ncx>`,
      ZIP_ENTRY,
    );
  }

  if (includeCover) {
    const coverHref = relativeTo(opfDir, coverPath);
    manifest.push(
      `<item id="cover-image" href="${escapeXml(coverHref)}" media-type="image/png" properties="cover-image"/>`,
    );
    manifest.push(
      '<item id="cover-wrapper" href="cover.xhtml" media-type="application/xhtml+xml"/>',
    );
    const coverWrapperPath = opfDir.length > 0 ? `${opfDir}/cover.xhtml` : 'cover.xhtml';
    zip.file(
      coverWrapperPath,
      wrapXhtml(
        'Cover',
        `<div class="cover"><svg viewBox="0 0 1 1"><image width="1" height="1" xlink:href="${escapeXml(
          relativeTo(dirname(coverWrapperPath), coverPath),
        )}"/></svg></div>`,
      ),
      ZIP_ENTRY,
    );
  }

  for (const chapter of options.chapters) {
    const id = chapter.id ?? `ch-${chapter.href.replace(/[^a-z0-9]+/giu, '-')}`;
    const href = chapter.manifestHref ?? relativeTo(opfDir, chapter.href);
    manifest.push(
      `<item id="${escapeXml(id)}" href="${escapeXml(href)}" media-type="application/xhtml+xml"/>`,
    );
    zip.file(chapter.href, wrapXhtml(chapter.title ?? id, chapter.body), ZIP_ENTRY);
    if (chapter.linear !== 'no') {
      spine.push(`<itemref idref="${escapeXml(id)}"/>`);
    } else {
      spine.push(`<itemref idref="${escapeXml(id)}" linear="no"/>`);
    }
  }

  for (const image of options.images ?? []) {
    const id = `img-${image.path.replace(/[^a-z0-9]+/giu, '-')}`;
    manifest.push(
      `<item id="${escapeXml(id)}" href="${escapeXml(relativeTo(opfDir, image.path))}" media-type="${mimeFor(
        image.path,
        image.mediaType,
      )}"/>`,
    );
    if (image.base64 !== undefined) {
      zip.file(image.path, image.base64, { ...ZIP_ENTRY, base64: true });
    } else {
      zip.file(image.path, image.text ?? '', ZIP_ENTRY);
    }
  }

  if (!(options.images ?? []).some((image) => image.path === coverPath)) {
    zip.file(coverPath, PNG_1X1, { ...ZIP_ENTRY, base64: true });
  }

  if (includeCover) {
    spine.unshift('<itemref idref="cover-wrapper"/>');
  }

  const opf = `<?xml version="1.0" encoding="utf-8"?>
<package xmlns="http://www.idpf.org/2007/opf" xmlns:dc="http://purl.org/dc/elements/1.1/" version="3.0" unique-identifier="book-id">
  <metadata>
    <dc:identifier id="book-id">urn:uuid:synthetic-book</dc:identifier>
    <dc:title>${escapeXml(options.title ?? 'Synthetic Book')}</dc:title>
    <dc:creator>${escapeXml(options.author ?? 'Test Author')}</dc:creator>
    <dc:language>${escapeXml(options.language ?? 'ja')}</dc:language>
    <meta name="cover" content="cover-image"/>
  </metadata>
  <manifest>
    ${manifest.join('\n    ')}
  </manifest>
  <spine${ncxEnabled ? ' toc="ncx"' : ''}>
    ${spine.join('\n    ')}
  </spine>
</package>`;

  zip.file(opfPath, opf, ZIP_ENTRY);
  // Pin auto-created folder entries too, otherwise their current timestamps
  // leak into the archive and break determinism.
  for (const entry of Object.values(zip.files)) entry.date = FIXED_DATE;
  return zip.generateAsync({ type: 'blob', mimeType: 'application/epub+zip' });
}
