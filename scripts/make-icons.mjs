import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import sharp from 'sharp';

const root = fileURLToPath(new URL('..', import.meta.url));
const iconPath = path.join(root, 'assets', 'icon.svg');
const outputDir = path.join(root, 'public', 'icons');
const publicDir = path.join(root, 'public');

function maskableSvg(baseSvg) {
  return baseSvg.replace(
    /<g fill="none"/u,
    '<g transform="translate(102.4 102.4) scale(0.6)" fill="none"',
  );
}

async function render(svg, size, file) {
  await sharp(Buffer.from(svg))
    .resize(size, size, { fit: 'contain', background: '#f4f1e8' })
    .png({ compressionLevel: 9, palette: true })
    .toFile(path.join(outputDir, file));
}

async function main() {
  const sourceSvg = await readFile(iconPath, 'utf8');
  await mkdir(outputDir, { recursive: true });

  await render(sourceSvg, 192, 'icon-192.png');
  await render(sourceSvg, 512, 'icon-512.png');
  await render(maskableSvg(sourceSvg), 512, 'maskable-512.png');
  await render(sourceSvg, 180, 'apple-touch-icon-180.png');

  await writeFile(path.join(publicDir, 'favicon.svg'), sourceSvg, 'utf8');
  console.log('icons: icon-192, icon-512, maskable-512, apple-touch-icon-180, favicon.svg');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
