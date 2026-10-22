import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url));
const scripts = ['copy-dict.mjs', 'copy-ort.mjs', 'make-icons.mjs', 'make-sample-epub.mjs'];

function run(script) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(root, 'scripts', script)], {
      cwd: root,
      stdio: 'inherit',
    });
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${script} failed with exit code ${code ?? 'unknown'}`));
    });
  });
}

async function main() {
  for (const script of scripts) {
    await run(script);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
