import { expect, test } from '@playwright/test';
import { buildSyntheticEpub } from '../fixtures/build-epub';
import {
  gotoLibrary,
  importSample,
  installApiMocks,
  openSentence,
  setSettingsBeforeLoad,
  waitForFurigana,
  waitForReader,
} from './helpers';

async function syntheticFileBuffer(
  options: Parameters<typeof buildSyntheticEpub>[0],
): Promise<Buffer> {
  const blob = await buildSyntheticEpub(options);
  return Buffer.from(await blob.arrayBuffer());
}

test('@skip-link keeps the reader mounted and focuses the book text', async ({ page }) => {
  await importSample(page);
  await expect(page.getByTestId('reader-page')).toBeVisible();
  const hashBefore = await page.evaluate(() => window.location.hash);
  expect(hashBefore).toMatch(/^#\/read\//u);

  const skip = page.getByRole('link', { name: 'Skip to book text' });
  await skip.focus();
  await page.keyboard.press('Enter');

  await expect(page.getByTestId('reader-page')).toBeVisible();
  await expect(page.getByTestId('reader-scroll')).toBeVisible();
  expect(await page.evaluate(() => window.location.hash)).toBe(hashBefore);
  expect(await page.evaluate(() => document.activeElement?.id)).toBe('reader-content');
});

test('@zero-chapter rejects a cover-only EPUB and adds no card', async ({ page }) => {
  await gotoLibrary(page);
  await page.locator('input[type="file"]').setInputFiles({
    name: 'cover-only.epub',
    mimeType: 'application/epub+zip',
    buffer: await syntheticFileBuffer({
      title: 'Cover only',
      chapters: [],
      includeCoverWrapper: true,
    }),
  });

  await expect(page.getByTestId('toast').first()).toContainText(/no readable chapters/i);
  await expect(page.getByTestId('book-card')).toHaveCount(0);
  await expect(page.getByTestId('empty-state')).toBeVisible();
});

test('@furi-offscreen adds ruby only when the block approaches the viewport', async ({ page }) => {
  const paragraphs = Array.from(
    { length: 40 },
    (_, index) => `<p>猫である。${index + 1}番目の段落。</p>`,
  ).join('');
  await gotoLibrary(page);
  await page.locator('input[type="file"]').setInputFiles({
    name: 'long.epub',
    mimeType: 'application/epub+zip',
    buffer: await syntheticFileBuffer({
      title: '長い本',
      chapters: [
        {
          href: 'OEBPS/ch1.xhtml',
          title: '第一章',
          body: `<h1>第一章</h1>${paragraphs}`,
        },
      ],
    }),
  });
  await waitForReader(page);
  await waitForFurigana(page, 'ネコ');

  const last = page.locator('[data-block-index]').last();
  await expect(last).toBeAttached();
  expect(await last.locator('rt').count()).toBe(0);

  await last.scrollIntoViewIfNeeded();
  await expect
    .poll(async () => last.locator('rt').count(), { timeout: 30_000 })
    .toBeGreaterThan(0);
  await expect(last.locator('rt').filter({ hasText: 'ネコ' }).first()).toBeVisible();
});

test('@edge-vertical-progress starts at 0, reaches the end, and restores after reload', async ({
  page,
}) => {
  await setSettingsBeforeLoad(page, { orientation: 'vertical', fontSize: 32 });
  await page.setViewportSize({ width: 390, height: 600 });
  await importSample(page);
  const scroller = page.locator('.reader-scroll');
  const start = await scroller.evaluate((element) => {
    const max = element.scrollWidth - element.clientWidth;
    return { max, scrollLeft: element.scrollLeft };
  });
  expect(start.max).toBeGreaterThan(0);
  expect(Math.abs(start.scrollLeft)).toBeLessThanOrEqual(2);

  await scroller.evaluate((element) => {
    element.scrollLeft = -(element.scrollWidth - element.clientWidth);
    element.dispatchEvent(new Event('scroll'));
  });
  await page.waitForTimeout(900);
  await page.reload();
  await expect(page.getByTestId('reader-page')).toBeVisible();
  await expect
    .poll(
      async () =>
        scroller.evaluate((element) => {
          const max = element.scrollWidth - element.clientWidth;
          return max <= 0 ? 0 : -element.scrollLeft / max;
        }),
      { timeout: 30_000 },
    )
    .toBeGreaterThan(0.85);
});

test('@orientation-persist keeps vertical writing after reload', async ({ page }) => {
  await importSample(page);
  await page.getByTestId('settings-button').click();
  await page.getByRole('button', { name: '縦書き Vertical' }).click();
  await page.getByTestId('settings-close').click();
  await expect(page.getByTestId('reader-page')).toHaveAttribute('data-orientation', 'vertical');
  await page.reload();
  await expect(page.getByTestId('reader-page')).toHaveAttribute('data-orientation', 'vertical');
  await expect(page.locator('.reader-scroll')).toHaveCSS('writing-mode', 'vertical-rl');
});

test('@theme-persist keeps the reader dark after reload', async ({ page }) => {
  await importSample(page);
  await page.getByTestId('settings-button').click();
  await page.getByRole('button', { name: /Dark/u }).click();
  await page.getByTestId('settings-close').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.reload();
  await expect(page.getByTestId('reader-page')).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});

test('@speech-error reports a failure and never claims the chapter ended', async ({ page }) => {
  await installApiMocks(page, { translator: 'none', speechError: 'network' });
  await importSample(page);
  await page.getByTestId('read-aloud-button').click();

  await expect(page.getByTestId('toast').filter({ hasText: 'Read-aloud stopped because speech failed.' })).toBeVisible();
  await expect(page.getByTestId('toast').filter({ hasText: 'End of chapter.' })).toHaveCount(0);
  await expect(page.getByTestId('read-aloud-button')).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('.sentence.is-speaking')).toHaveCount(0);
});

test('@katakana @hiragana-setting defaults to katakana and switches to hiragana', async ({
  page,
}) => {
  await importSample(page);
  await waitForFurigana(page, 'ネコ');
  const sentence = page.getByTestId('sentence-1-0');
  await expect(sentence.locator('rt').filter({ hasText: 'ネコ' }).first()).toBeVisible();
  await expect(sentence.locator('rt').filter({ hasText: 'ワガハイ' }).first()).toBeVisible();

  await page.getByTestId('settings-button').click();
  await page.getByTestId('readings-hiragana').click();
  await page.getByTestId('settings-close').click();
  await expect(sentence.locator('rt').filter({ hasText: 'ねこ' }).first()).toBeVisible({
    timeout: 30_000,
  });

  await page.reload();
  await waitForFurigana(page, 'ねこ');
  await expect(
    page.getByTestId('sentence-1-0').locator('rt').filter({ hasText: 'ねこ' }).first(),
  ).toBeVisible();
  await expect(page.locator('rt').filter({ hasText: 'ネコ' })).toHaveCount(0);
});

test('@speech-play-error sentence play reports a playback failure', async ({ page }) => {
  await installApiMocks(page, { translator: 'none', speechError: 'network' });
  await importSample(page);
  await openSentence(page);
  await page.getByTestId('sentence-play').click();
  await expect(
    page.getByTestId('toast').filter({ hasText: 'This sentence could not be played.' }),
  ).toBeVisible();
  await expect(page.getByTestId('sentence-play')).toHaveAttribute('aria-pressed', 'false');
});

test('@short-final-progress treats a non-scrollable final chapter as complete', async ({ page }) => {
  await gotoLibrary(page);
  await page.locator('input[type="file"]').setInputFiles({
    name: 'short.epub',
    mimeType: 'application/epub+zip',
    buffer: await syntheticFileBuffer({
      title: '短い本',
      chapters: [
        {
          href: 'OEBPS/ch1.xhtml',
          title: '第一章',
          body: '<h1>第一章</h1><p>短い本文。</p>',
        },
      ],
    }),
  });
  await waitForReader(page);
  await expect(page.locator('.reader-status__chapter')).toContainText('100%');
});

test('@translation-too-long shows the specific message instead of Retry', async ({ page }) => {
  await installApiMocks(page, { translator: 'none' });
  await setSettingsBeforeLoad(page, { onlineTranslation: true });
  await gotoLibrary(page);
  await page.locator('input[type="file"]').setInputFiles({
    name: 'long-sentence.epub',
    mimeType: 'application/epub+zip',
    buffer: await syntheticFileBuffer({
      title: '長文',
      chapters: [
        {
          href: 'OEBPS/ch1.xhtml',
          title: '第一章',
          body: `<p>${'あ'.repeat(451)}</p>`,
        },
      ],
    }),
  });
  await waitForReader(page);
  await openSentence(page, 'sentence-0-0');
  await expect(page.getByTestId('translation-error')).toContainText(/too long/i);
  await expect(page.getByTestId('translation-error').getByRole('button')).toHaveCount(0);
});
