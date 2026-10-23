# AGENTS.md

JEPUB is an offline-first Japanese EPUB reader PWA: React 19 + Vite 7 + TypeScript, no backend. Books, covers, chat, and MyPedia live in IndexedDB; settings live in localStorage. Product/feature detail is in `README.md`.

## Setup and commands

- Requires Node >=22.22.2 (`.nvmrc` is 22.23.3). On Node 20, `npm test` / `npm run verify` crash in `node_modules/undici/lib/interceptor/decompress.js` with `Cannot read properties of undefined (reading 'bind')`. Run `nvm use` first.
- `npm install`, then `npm run dev` → http://localhost:5173/jepub/ (the app is served under `/jepub/`, not `/`).
- `npm run verify` is the check gate: `tsc --noEmit` + Vitest. There is no ESLint/Prettier config and no CI.
- Single unit file: `npx vitest run tests/unit/router.test.ts`. Single case: `npx vitest run -t 'ROUTE-'` (test titles start with stable IDs).
- E2E: `npm run test:e2e` builds first, then runs Playwright against the built `docs/` via `vite preview` at `http://127.0.0.1:4173/jepub/` (installed Chrome, `channel: 'chrome'`, 1 worker). Filter a fresh run with `npm run test:e2e -- -g '@bookmark'`; a bare `npx playwright test` reuses whatever is already in `docs/`.
- `npm run build` = `tsc --noEmit` + Vite → `docs/`, then `postbuild` (`scripts/clean-ort-assets.mjs`) patches the output.
- `prepare:assets` runs automatically via `predev`/`prebuild`; it requires `npm install` first and generates kuromoji dictionary copies, ORT wasm/mjs, icons, and the sample EPUB.

## Committed build output

- `docs/` is the production build committed for GitHub Pages (`main` → `/docs`). Never hand-edit it.
- App commits in this repo include the rebuilt `docs/` in the same commit. After changing `src/`, run `npm run build` and stage `docs/` too. README/assets-only changes do not rebuild.
- Deploying is pushing `main`; Pages serves `docs/`.

## Architecture

- Entry: `src/main.tsx` → `src/App.tsx`. Shared UI is in `src/components/`, feature screens/hooks in `src/features/<area>/`, framework-free logic in `src/lib/<area>/`.
- Routing is hand-written hash routing in `src/lib/router.ts` (`#/`, `#/read/:id`, `#/chat[/:id]`, `#/mypedia`, `#/quiz`). `parseRoute()` returns `null` for non-route fragments such as `#reader-content`; preserve that so skip links do not unmount the reader.
- IndexedDB database `jepub` version 4 (`src/lib/storage/db.ts`) stores books, files, chapterSets, assets, translations, bookmarks, chatSessions, and knowledge records. Settings use localStorage key `jepub:settings:v1`.
- `index.html` reads `jepub:settings:v1` inline before paint to apply the dark theme. If that key or theme shape changes, update the inline script too.
- AI modes are `off`, `byot`, and `local`. BYOT calls providers directly from the browser (`src/lib/llm/byot.ts`); the local Qwen model runs in a Web Worker (`src/lib/llm/worker.ts`) behind the capability gate in `src/lib/llm/capabilities.ts`. No server proxies API keys.
- The `/jepub/` base path is hard-coded in `vite.config.ts`, the PWA manifest `start_url`/`scope`, and `index.html` links. If the repo path changes, update all of them together.

## Conventions and traps

- TypeScript is strict and `tsconfig.json` includes `tests/` plus the config files, so unused locals/params and test type errors fail `npm run build`. `verbatimModuleSyntax` is on; use `import type` for type-only imports.
- Every UI string goes through `src/lib/i18n/translations.ts`; English source strings are the lookup keys. Add or change the source in `ENGLISH_SOURCES` and in all eight language dictionaries. `tests/unit/i18n.test.ts` fails unless keys and `{placeholder}` sets match everywhere. Use `t()` from `useI18n`; do not hardcode labels.
- CSS is plain (no CSS modules). Add a stylesheet under `src/styles/` and import it in `src/main.tsx`; design tokens are in `src/styles/tokens.css`.
- Kuromoji is patched for the browser: Vite aliases `NodeDictionaryLoader`/`BrowserDictionaryLoader` to `src/lib/furigana/kuromoji-loader.cjs` in both dev and `optimizeDeps`, and `path` is aliased to `path-browserify`. Furigana reads from `${BASE_URL}kuromoji-dict/`; keep the trailing slash. A unit test covers this wiring.
- Vitest only collects `tests/unit/**/*.test.ts` (jsdom + fake-indexeddb from `tests/setup.ts`; globals are off, so import `describe/it/expect` from `vitest`).
- E2E tests live in `tests/e2e/*.spec.ts`, are named `@tag ...`, and drive the UI through `data-testid` hooks; keep test IDs stable. Shared mocks (Translator, speechSynthesis, MyMemory, Jina Reader) are in `tests/e2e/helpers.ts`. Furigana waits can take up to 90s.
- Service-worker/PWA behavior exists only in production (`devOptions.enabled: false`). Exercise it via `npm run build` + `npm run preview` or the PWA e2e specs, not `npm run dev`.
- `scripts/clean-ort-assets.mjs` intentionally deletes unused asyncify ORT assets and renames the literal `Mistral3ForConditionalGeneration` because GitHub push protection misclassifies it as an API key. Do not "simplify" it away.
- Generated dirs `public/kuromoji-dict/` and `public/ort/` are gitignored. Icons and `public/sample/jepub-sample.epub` are generated too but committed. Keep ZIP timestamps fixed in generated archives (`epub-determinism.test.ts` checks fixture byte equality).
- `tests/materials/` is gitignored user-supplied copyrighted content; never commit it. Add reusable test inputs to `tests/fixtures/`.
- Follow Conventional Commits (`feat:`, `fix:`, `docs:`, `chore:`); a docs-only publish commit uses `chore: publish pages build`.
