import { existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

const loaderPath = fileURLToPath(new URL('./src/lib/furigana/kuromoji-loader.cjs', import.meta.url));
const dictDir = fileURLToPath(new URL('./public/kuromoji-dict', import.meta.url));

const dictManifestEntries = existsSync(dictDir)
  ? readdirSync(dictDir)
      .filter((name) => name.endsWith('.dat.gz'))
      .sort()
      .map((name) => ({ url: `/jepub/kuromoji-dict/${name}`, revision: null }))
  : [];

export default defineConfig({
  base: '/jepub/',
  build: {
    outDir: 'docs',
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    strictPort: true,
  },
  preview: {
    port: 4173,
    strictPort: true,
  },
  plugins: [
    {
      name: 'kuromoji-browser-loader',
      enforce: 'pre',
      resolveId(source) {
        if (/loader[/\\](Node|Browser)DictionaryLoader(\.js)?$/.test(source)) {
          return loaderPath;
        }
        return null;
      },
    },
    react(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      devOptions: {
        enabled: false,
      },
      manifest: {
        name: 'JEPUB — Japanese EPUB Reader',
        short_name: 'JEPUB',
        description: 'A quiet Japanese EPUB reader.',
        start_url: '/jepub/',
        scope: '/jepub/',
        display: 'standalone',
        lang: 'en',
        theme_color: '#111111',
        background_color: '#f4f1e8',
        icons: [
          { src: '/jepub/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/jepub/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: '/jepub/icons/maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
        file_handlers: [
          {
            action: '/jepub/',
            accept: {
              'application/epub+zip': ['.epub'],
            },
          },
        ],
        launch_handler: {
          client_mode: 'navigate-existing',
        },
      },
      workbox: {
        globPatterns: ['**/*.{js,mjs,css,html,png,svg,webp,woff2,epub,wasm}'],
        globIgnores: ['kuromoji-dict/**', 'assets/ort-wasm-*.wasm', 'assets/ort-wasm-*.mjs'],
        additionalManifestEntries: dictManifestEntries,
        maximumFileSizeToCacheInBytes: 40 * 1024 * 1024,
        cleanupOutdatedCaches: true,
        skipWaiting: false,
        clientsClaim: false,
        navigateFallback: '/jepub/index.html',
        navigateFallbackDenylist: [/\/jepub\/kuromoji-dict\//],
      },
    }),
  ],
  resolve: {
    alias: [{ find: /^path$/, replacement: 'path-browserify' }],
  },
  optimizeDeps: {
    esbuildOptions: {
      plugins: [
        {
          name: 'kuromoji-browser-loader-prebundle',
          setup(build) {
            build.onResolve({ filter: /loader[/\\](Node|Browser)DictionaryLoader(\.js)?$/ }, () => ({
              path: loaderPath,
            }));
          },
        },
      ],
    },
  },
});
