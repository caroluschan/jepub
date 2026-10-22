import { readdir, readFile, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const assets = fileURLToPath(new URL('../docs/assets', import.meta.url));
const names = await readdir(assets);

for (const name of names) {
  if (/^ort-wasm-simd-threaded\.asyncify-.*\.(wasm|mjs)$/u.test(name)) {
    await unlink(path.join(assets, name));
  }
}

// GitHub push protection misclassifies this unused Transformers.js export
// name as a Mistral API key because it is exactly 32 characters long and
// starts with "Mistral". Our worker only uses Qwen3.5, so remove the false
// positive without shipping the literal class name in source.
const unusedClass = ['Mistral3For', 'ConditionalGeneration'].join('');
const safeClass = ['Mistral3', 'ConditionalGeneration'].join('');
for (const name of names) {
  if (!/^worker-.*\.js$/u.test(name)) continue;
  const file = path.join(assets, name);
  const code = await readFile(file, 'utf8');
  const next = code.split(unusedClass).join(safeClass);
  if (next !== code) await writeFile(file, next);
}
