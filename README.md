# JEPUB

### A quiet Japanese EPUB reader for the web.

[**Open JEPUB →**](https://caroluschan.github.io/jepub/) · [Features](#features) · [Add books](#add-books) · [Install](#install-as-an-app) · [Run locally](#run-locally)

JEPUB is a small, monochrome reading room for Japanese books. It keeps your library on your device, puts readings above kanji, and lets you tap any sentence to see how it sounds, what it means, and hear it spoken aloud.

<p align="center">
  <img src="assets/readme/library.png" width="250" alt="JEPUB library with a book cover">
  <img src="assets/readme/reader-vertical.png" width="250" alt="Vertical Japanese text with katakana furigana">
  <img src="assets/readme/sentence.png" width="250" alt="Sentence panel with ruby, romaji, translation, and playback">
</p>

<p align="center">
  <img src="assets/readme/settings.png" width="620" alt="JEPUB settings page with appearance, reading, translation, storage, and about sections">
</p>

<p align="center"><sub>Screenshots use the bundled public-domain sample book.</sub></p>

## Features

**A shelf that stays yours**
- Import EPUB and MOBI files from your device, or drag and drop them onto the shelf. Open EPUB files from another app on supported browsers.
- Add plain `.txt` files in UTF-8, UTF-16, or Shift_JIS.
- Download public-domain works directly from Aozora Bunko.
- Books, covers, chapters, reading positions, and translated sentences are stored locally in IndexedDB.
- JEPUB asks the browser for persistent storage, so your shelf survives ordinary browser restarts.

**A reader made for Japanese**
- Kuroshiro furigana above kanji. Katakana readings by default, with a Hiragana option.
- Vertical Japanese (`vertical-rl`) or horizontal layout.
- Adjustable text size from 14–32px.
- Light and dark monochrome themes.
- Table of contents, chapter navigation, illustrations, bookmarks, and restored reading positions.
- A full Settings page, opened from the library or the reader, with appearance, reading, translation, storage, and about sections.
- Eight interface languages: English, Japanese, Simplified Chinese, Traditional Chinese, Korean, Spanish, French, and German. System language is used by default.
- Share the stored EPUB/MOBI/TXT file, or the Aozora Bunko card link, with the native share sheet.
- Lazy furigana: readings are prepared as you reach each part of the book, not all at once.

**Bookmarks and sharing**
- Add or remove a bookmark from the reading footer; bookmarks store the chapter and exact scroll position.
- Open the Contents drawer and switch to **Bookmarks** to jump to or delete saved places. Bookmarks persist across reloads.
- Share the original EPUB/MOBI/TXT file through the browser's share sheet, with a download fallback where file sharing is unavailable.
- Aozora Bunko imports share their source card link instead of a downloaded file.

**Tap a sentence**
- Ruby readings, spaced romaji, and a translation panel.
- Choose from 39 target languages supported by Chrome’s on-device translator.
- On-device translation is used first when available.
- MyMemory is available as an explicit opt-in fallback when on-device translation is not available.
- Translations are cached per language, so a translated sentence can be revisited instantly, even offline.
- Play or stop the sentence with a Japanese (`ja-JP`) voice.

**Listen**
- Read a sentence aloud from the sentence panel.
- Start chapter read-aloud from the toolbar; JEPUB highlights the active sentence and scrolls with the voice.
- Uses the voices installed on your device.

**A proper little PWA**
- Installable on desktop and mobile.
- Offline app shell after install.
- The Japanese dictionary needed for furigana is cached for offline reading.
- EPUB file handling where the browser supports it, with a normal file picker everywhere else.
- A quiet update prompt when a new version is ready.

## Add books

| Source | How it works |
|---|---|
| **EPUB / MOBI** | Choose one or more `.epub` or `.mobi` files, or drop them onto the shelf. |
| **Text** | Choose `.txt` files. The filename becomes the title; paragraphs become the chapter. |
| **Aozora Bunko** | Open a work on [aozora.gr.jp](https://www.aozora.gr.jp/), copy its card URL (or a direct `.html` file URL), and paste it into the Aozora tab. |

Aozora downloads are fetched through [Jina Reader](https://jina.ai/reader/) because browsers cannot call Aozora directly. This means the Aozora import needs an internet connection.

## Install as an app

- **iPhone / iPad:** open the site in Safari → Share → **Add to Home Screen**.
- **Android / Chrome:** open the browser menu → **Install app** or **Add to Home screen**.
- **Desktop Chrome / Edge:** use the install icon in the address bar.

Once installed, the app opens without browser chrome and the dictionary is prepared for offline furigana.

## iPhone and offline translation

Safari on iPhone does not expose an on-device translation API to websites or home-screen PWAs. The 39-language selector still works there, but translations use **MyMemory online** when you enable the online fallback.

Offline translation on iPhone would require a native wrapper using Apple’s Translation framework, or a large local translation model. Neither is part of this PWA.

## Browser support

| Browser | Library & reader | On-device translation | Online fallback |
|---|---|---|---|
| Chrome / Edge desktop | Yes | Yes, 39 language packs | Optional |
| Chrome Android | Yes | Not available from the web API | Optional |
| Safari / iOS Safari | Yes | Not available from the web API | Optional |
| Firefox | Yes | Not available from the web API | Optional |

The app itself works across modern browsers. Translation providers and installed speech voices vary by device.

## Privacy

- **No account, no analytics, no JEPUB server.** Your books stay in your browser’s storage.
- **Online translation is opt-in.** When enabled, the selected sentence is sent to MyMemory and the provider is labeled in the sentence panel. With online translation off, only on-device translation and cached results are used.
- **Aozora imports** send the public Aozora URL through Jina Reader. Aozora works are public-domain texts.
- **Speech** uses the operating system’s speech voices. Depending on the installed voice, the OS may use a local or cloud-backed voice.
- **GitHub Pages** serves the app from a shared `github.io` origin. As with any project page, other pages on the same origin share browser storage permissions. Use a dedicated origin if you need stronger isolation.

## Run locally

Requirements: **Node 22.22.2+** and npm. The repository includes `.nvmrc` (`22.23.3`).

```bash
git clone https://github.com/caroluschan/jepub.git
cd jepub
nvm use
npm install
npm run dev
```

The dev server runs at `http://localhost:5173/jepub/`.

`npm run dev` and `npm run build` run `prepare:assets` automatically. It:

- copies the 12 kuromoji dictionary files into `public/kuromoji-dict/`
- generates the PWA icons
- builds the bundled public-domain sample EPUB

## Scripts

```bash
npm run dev          # development server
npm run typecheck    # TypeScript
npm test             # Vitest unit tests
npm run build        # typecheck + production build into docs/
npm run preview      # preview the production build
npx playwright test  # end-to-end tests (uses installed Chrome)
npm run prepare:assets
```

## Deploying

The production build is written to `docs/` and can be served directly by GitHub Pages.

```bash
npm run build
git add docs
git commit -m "chore: publish pages build"
git push origin main
```

In the repository settings, set **Pages → Build and deployment → Source** to **Deploy from a branch**, branch `main`, folder `/docs`.

The app is built for the project path `/jepub/`. If you fork it under a different repository name, update `base` in `vite.config.ts`, the manifest `start_url`/`scope`, and the route links accordingly.

## Tech

- React 19 + Vite 7 + TypeScript
- `vite-plugin-pwa` / Workbox for offline support
- IndexedDB via `idb`
- EPUB parsing with JSZip
- MOBI/KF8 parsing with `@lingo-reader/mobi-parser`
- Kuroshiro + kuromoji for furigana and romaji, with a custom browser dictionary loader
- DOMPurify for sanitized ruby markup
- Chrome built-in Translator API and MyMemory for translation
- Web Speech API for Japanese speech
- Vitest and Playwright for tests

## Project map

```
src/lib/epub/        EPUB container, OPF, TOC, content extraction
src/lib/import/      EPUB, MOBI, text, Aozora, and persistence pipelines
src/lib/furigana/    Kuroshiro, dictionary loader, queue, sanitizer
src/lib/translate/   language list, providers, cache
src/lib/reader/      scroll behavior
src/features/        library, reader, sentence panel, settings
src/pwa/             service worker update and file handling
scripts/             dictionary, icons, and sample EPUB generation
tests/               unit and end-to-end tests
docs/                committed production build
```

## Credits

- Sample text: Natsume Sōseki, *Wagahai wa Neko de Aru* (public domain); sample cover and illustration generated for this project.
- [Kuroshiro](https://github.com/hexenq/kuroshiro) and [kuromoji](https://github.com/takuyaa/kuromoji.js)
- [@lingo-reader/mobi-parser](https://github.com/hhk-png/lingo-reader) for MOBI/KF8 parsing
- [JSZip](https://stuk.github.io/jszip/), [idb](https://github.com/jakearchibald/idb), [DOMPurify](https://github.com/cure53/DOMPurify)
- [Vite](https://vite.dev/), [React](https://react.dev/), [Vitest](https://vitest.dev/), [Playwright](https://playwright.dev/)
- [Aozora Bunko](https://www.aozora.gr.jp/) for public-domain Japanese literature
- [Jina Reader](https://jina.ai/reader/) for Aozora fetching
- [MyMemory](https://mymemory.translated.net/) for optional online translation

Third-party dependencies retain their own licenses.

---

<p align="center"><em>日本語を、ゆっくり。</em></p>
