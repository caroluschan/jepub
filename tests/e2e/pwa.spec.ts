import { expect, test } from '@playwright/test';
import { importSample, waitForFurigana } from './helpers';

test('@manifest exposes file handlers, icons, and the JEPUB scope', async ({ page }) => {
  await page.goto('/');
  const manifest = await page.evaluate(async () => {
    const response = await fetch(`${location.origin}/jepub/manifest.webmanifest`);
    return (await response.json()) as {
      name: string;
      start_url: string;
      scope: string;
      display: string;
      file_handlers?: Array<{ action: string; accept: Record<string, string[]> }>;
      icons: Array<{ sizes: string }>;
    };
  });
  expect(manifest.name).toContain('JEPUB');
  expect(manifest.start_url).toBe('/jepub/');
  expect(manifest.scope).toBe('/jepub/');
  expect(manifest.display).toBe('standalone');
  expect(manifest.file_handlers?.[0]?.accept['application/epub+zip']).toContain('.epub');
  expect(manifest.icons.some((icon) => icon.sizes === '192x192')).toBe(true);
  expect(manifest.icons.some((icon) => icon.sizes === '512x512')).toBe(true);
});

test('@sw-cache precaches the kuroshiro dictionary', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await expect
    .poll(
      async () =>
        page.evaluate(async () => {
          const names = await caches.keys();
          const urls: string[] = [];
          for (const name of names) {
            const cache = await caches.open(name);
            for (const request of await cache.keys()) urls.push(request.url);
          }
          return urls.filter((url) => url.includes('kuromoji-dict')).length;
        }),
      { timeout: 90_000 },
    )
    .toBe(12);
});

test('@offline-reload opens a stored book with furigana while offline', async ({
  page,
  context,
}) => {
  await page.goto('/');
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect
    .poll(async () => page.evaluate(() => navigator.serviceWorker.controller !== null), {
      timeout: 30_000,
    })
    .toBe(true);

  await importSample(page);
  await waitForFurigana(page, 'ネコ');
  await page.getByTestId('back-button').click();
  await expect(page.getByTestId('book-card')).toHaveCount(1);

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByTestId('library-page')).toBeVisible();
  await expect(page.getByTestId('book-card')).toHaveCount(1);
  await page.getByTestId('book-card').click();
  await expect(page.getByTestId('reader-page')).toBeVisible();
  await waitForFurigana(page, 'ネコ');
  await context.setOffline(false);
});
