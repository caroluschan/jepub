import { copyFile, mkdir, readdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url));
const source = path.join(root, 'node_modules', 'kuromoji', 'dict');
const destination = path.join(root, 'public', 'kuromoji-dict');
const EXPECTED_FILES = 12;
const MIN_TOTAL_BYTES = 15 * 1024 * 1024;

async function main() {
  if (!existsSync(source)) {
    throw new Error(
      `Kuromoji dictionary not found at ${source}. Run "npm install" before preparing assets.`,
    );
  }

  const entries = await readdir(source);
  const dictFiles = entries.filter((name) => name.endsWith('.dat.gz')).sort();
  if (dictFiles.length !== EXPECTED_FILES) {
    throw new Error(
      `Expected ${EXPECTED_FILES} kuromoji dictionary files in ${source}, found ${dictFiles.length}.`,
    );
  }

  await mkdir(destination, { recursive: true });
  let totalBytes = 0;
  for (const name of dictFiles) {
    const from = path.join(source, name);
    const to = path.join(destination, name);
    await copyFile(from, to);
    const info = await stat(to);
    totalBytes += info.size;
  }

  if (totalBytes < MIN_TOTAL_BYTES) {
    throw new Error(
      `Kuromoji dictionary is too small (${totalBytes} bytes); expected more than ${MIN_TOTAL_BYTES}.`,
    );
  }

  const copied = (await readdir(destination)).filter((name) => name.endsWith('.dat.gz'));
  if (copied.length !== EXPECTED_FILES) {
    throw new Error(`Dictionary copy incomplete: ${copied.length}/${EXPECTED_FILES} files.`);
  }

  console.log(
    `kuromoji dictionary: ${copied.length} files, ${(totalBytes / 1024 / 1024).toFixed(1)} MB`,
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
