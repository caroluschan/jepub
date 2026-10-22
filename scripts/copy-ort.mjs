import { copyFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const candidates = [
  path.join(root, 'node_modules', 'onnxruntime-web', 'dist'),
  path.join(root, 'node_modules', '@huggingface', 'transformers', 'node_modules', 'onnxruntime-web', 'dist'),
];
const source = candidates.find((candidate) => existsSync(candidate));
if (source === undefined) {
  throw new Error('onnxruntime-web is not installed; run npm install first.');
}

const target = path.join(root, 'public', 'ort');
await mkdir(target, { recursive: true });
for (const file of ['ort-wasm-simd-threaded.asyncify.wasm', 'ort-wasm-simd-threaded.asyncify.mjs']) {
  await copyFile(path.join(source, file), path.join(target, file));
}
