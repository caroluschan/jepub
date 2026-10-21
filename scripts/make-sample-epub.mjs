import { mkdir, stat, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import JSZip from 'jszip';
import sharp from 'sharp';

const root = fileURLToPath(new URL('..', import.meta.url));
const outputDir = path.join(root, 'public', 'sample');
const outputFile = path.join(outputDir, 'jepub-sample.epub');

// Fixed timestamp on every ZIP entry keeps `prepare:assets` byte-identical.
const FIXED_DATE = new Date(2020, 0, 1, 12, 0, 0);

const INK = '#141311';
const PAPER = '#f4f1e8';

const coverSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="900" viewBox="0 0 600 900">
  <rect width="600" height="900" fill="${PAPER}"/>
  <rect x="46" y="46" width="508" height="808" fill="none" stroke="${INK}" stroke-width="3"/>
  <rect x="62" y="62" width="476" height="776" fill="none" stroke="${INK}" stroke-width="1"/>
  <g fill="${INK}">
    <text x="300" y="322" text-anchor="middle" font-family="Hiragino Mincho ProN, Yu Mincho, serif" font-size="54" letter-spacing="3" textLength="430" lengthAdjust="spacingAndGlyphs">吾輩は猫である</text>
    <text x="300" y="392" text-anchor="middle" font-family="Hiragino Mincho ProN, Yu Mincho, serif" font-size="26" letter-spacing="6">（抄）</text>
    <text x="300" y="704" text-anchor="middle" font-family="Hiragino Mincho ProN, Yu Mincho, serif" font-size="28" letter-spacing="10">夏目漱石</text>
  </g>
  <path d="M180 500h240" stroke="${INK}" stroke-width="2"/>
  <path d="M240 540h120" stroke="${INK}" stroke-width="1"/>
</svg>`;

const illustrationSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="320" viewBox="0 0 480 320">
  <rect width="480" height="320" fill="${PAPER}"/>
  <g fill="none" stroke="${INK}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round">
    <path d="M150 210c0-52 40-88 90-88s90 36 90 88"/>
    <path d="M158 150l-8-52 54 26"/>
    <path d="M322 150l8-52-54 26"/>
    <path d="M186 196c10-12 28-12 38 0"/>
    <path d="M256 196c10-12 28-12 38 0"/>
    <path d="M240 214v14"/>
    <path d="M215 238c16 14 34 14 50 0"/>
    <path d="M226 246l-42 22M240 252l-20 34M254 246l42 22M240 248l20 34"/>
    <path d="M120 280h240"/>
  </g>
</svg>`;

const chapter1 = `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="ja">
<head><title>第一章</title></head>
<body>
  <h1 id="start">第一章</h1>
  <p>　吾輩は<ruby>猫<rt>ねこ</rt></ruby>である。名前はまだ無い。</p>
  <p>　どこで生れたかとんと見当がつかぬ。何でも薄暗いじめじめした所で
ニャーニャー泣いていた事だけは記憶している。</p>
  <p>　吾輩はここで始めて人間というものを見た。しかもあとで聞くと、
それは書生という人間中で一番獰悪な種族であったそうだ。</p>
</body>
</html>`;

const chapter2 = `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="ja">
<head><title>第二章</title></head>
<body>
  <h1 id="chapter2">第二章</h1>
  <p>　名前はまだ無い。どこで生れたかとんと見当がつかぬ。</p>
  <p>　吾輩は猫である。名前はまだ無い。どこで生れたかとんと見当がつかぬ。</p>
  <img src="images/illustration.png" alt="猫の挿絵"/>
  <p>　吾輩はここで始めて人間というものを見た。</p>
</body>
</html>`;

const coverXhtml = `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xmlns:xlink="http://www.w3.org/1999/xlink">
<head><title>Cover</title></head>
<body>
  <div class="cover">
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 900" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
      <image width="600" height="900" xlink:href="images/cover.png"/>
    </svg>
  </div>
</body>
</html>`;

const navXhtml = `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="ja">
<head><title>目次</title></head>
<body>
  <nav epub:type="toc" role="doc-toc">
    <h1>目次</h1>
    <ol>
      <li><a href="chapter1.xhtml#start">第一章</a></li>
      <li><a href="chapter2.xhtml">第二章</a></li>
    </ol>
  </nav>
</body>
</html>`;

const tocNcx = `<?xml version="1.0" encoding="utf-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <head><meta name="dtb:uid" content="urn:uuid:jepub-sample-0001"/></head>
  <docTitle><text>吾輩は猫である（抄）</text></docTitle>
  <navMap>
    <navPoint id="np-1" playOrder="1">
      <navLabel><text>第一章</text></navLabel>
      <content src="chapter1.xhtml#start"/>
    </navPoint>
    <navPoint id="np-2" playOrder="2">
      <navLabel><text>第二章</text></navLabel>
      <content src="chapter2.xhtml"/>
    </navPoint>
  </navMap>
</ncx>`;

const opf = `<?xml version="1.0" encoding="utf-8"?>
<package xmlns="http://www.idpf.org/2007/opf" xmlns:dc="http://purl.org/dc/elements/1.1/" version="3.0" unique-identifier="book-id" xml:lang="ja">
  <metadata>
    <dc:identifier id="book-id">urn:uuid:jepub-sample-0001</dc:identifier>
    <dc:title>吾輩は猫である（抄）</dc:title>
    <dc:creator>夏目漱石</dc:creator>
    <dc:language>ja</dc:language>
    <meta name="cover" content="cover-image"/>
  </metadata>
  <manifest>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
    <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
    <item id="cover-image" href="images/cover.png" media-type="image/png" properties="cover-image"/>
    <item id="cover-page" href="cover.xhtml" media-type="application/xhtml+xml" properties="svg"/>
    <item id="chapter1" href="chapter1.xhtml" media-type="application/xhtml+xml"/>
    <item id="chapter2" href="chapter2.xhtml" media-type="application/xhtml+xml"/>
    <item id="illustration" href="images/illustration.png" media-type="image/png"/>
  </manifest>
  <spine toc="ncx">
    <itemref idref="cover-page"/>
    <itemref idref="chapter1"/>
    <itemref idref="chapter2"/>
  </spine>
</package>`;

const container = `<?xml version="1.0" encoding="utf-8"?>
<container xmlns="urn:oasis:names:tc:opendocument:xmlns:container" version="1.0">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`;

async function main() {
  await mkdir(outputDir, { recursive: true });

  const coverPng = await sharp(Buffer.from(coverSvg))
    .png({ compressionLevel: 9, palette: true, colours: 16 })
    .toBuffer();
  const illustrationPng = await sharp(Buffer.from(illustrationSvg))
    .png({ compressionLevel: 9, palette: true, colours: 16 })
    .toBuffer();

  const zip = new JSZip();
  const entry = { date: FIXED_DATE };
  zip.file('mimetype', 'application/epub+zip', { ...entry, compression: 'STORE' });
  zip.file('META-INF/container.xml', container, entry);
  zip.file('OEBPS/content.opf', opf, entry);
  zip.file('OEBPS/nav.xhtml', navXhtml, entry);
  zip.file('OEBPS/toc.ncx', tocNcx, entry);
  zip.file('OEBPS/cover.xhtml', coverXhtml, entry);
  zip.file('OEBPS/chapter1.xhtml', chapter1, entry);
  zip.file('OEBPS/chapter2.xhtml', chapter2, entry);
  zip.file('OEBPS/images/cover.png', coverPng, entry);
  zip.file('OEBPS/images/illustration.png', illustrationPng, entry);

  // JSZip auto-creates parent folder entries with the current date; pin every
  // entry (files and folders) so consecutive builds are byte-identical.
  for (const entry of Object.values(zip.files)) entry.date = FIXED_DATE;

  const bytes = await zip.generateAsync({
    type: 'nodebuffer',
    mimeType: 'application/epub+zip',
    compression: 'DEFLATE',
    compressionOptions: { level: 9 },
  });

  await writeFile(outputFile, bytes);
  const info = await stat(outputFile);
  if (info.size >= 150 * 1024) {
    throw new Error(`Sample EPUB is too large: ${info.size} bytes (limit 150KB).`);
  }
  console.log(`sample epub: ${outputFile} (${(info.size / 1024).toFixed(1)} KB)`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
