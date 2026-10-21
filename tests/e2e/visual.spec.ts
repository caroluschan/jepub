import { expect, test, type Page } from '@playwright/test';
import {
  gotoLibrary,
  importSample,
  installApiMocks,
  openSentence,
  setSettingsBeforeLoad,
  waitForFurigana,
} from './helpers';

const QA_DIR = '.artifacts/qa';

async function stabilize(page: Page): Promise<void> {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addStyleTag({
    content:
      '*,*::before,*::after{animation:none !important;transition:none !important;caret-color:transparent !important}',
  });
  await page.mouse.move(0, 0);
  await page.waitForTimeout(300);
  // Toasts sit below the modal backdrop by design, so dismiss them
  // programmatically rather than through hit-testing.
  await page.evaluate(() => {
    for (const button of document.querySelectorAll<HTMLElement>('.toast__dismiss')) {
      button.click();
    }
  });
  await page.waitForTimeout(60);
  await page.mouse.move(0, 0);
}

async function noBodyOverflow(page: Page): Promise<void> {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth + 1,
  );
  expect(overflow).toBe(false);
}

async function expectReaderGeometry(page: Page): Promise<void> {
  const geometry = await page.evaluate(() => {
    const toolbar = document.querySelector('[data-testid="reader-toolbar"]');
    const scroller = document.querySelector('.reader-scroll');
    if (toolbar === null || scroller === null) return null;
    const toolbarRect = toolbar.getBoundingClientRect();
    const scrollerRect = scroller.getBoundingClientRect();
    return {
      toolbarBottom: toolbarRect.bottom,
      scrollerTop: scrollerRect.top,
      toolbarHeight: toolbarRect.height,
      scrollerHeight: scrollerRect.height,
    };
  });
  expect(geometry).not.toBeNull();
  if (geometry === null) return;
  expect(geometry.toolbarHeight).toBeGreaterThan(40);
  expect(geometry.scrollerHeight).toBeGreaterThan(200);
  expect(geometry.scrollerTop).toBeGreaterThanOrEqual(geometry.toolbarBottom - 1);
}

test('visual: library mobile light', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await importSample(page);
  await page.getByTestId('back-button').click();
  await expect(page.getByTestId('book-card')).toHaveCount(1);
  await stabilize(page);
  await noBodyOverflow(page);
  await page.screenshot({ path: `${QA_DIR}/library-mobile-light.png` });
});

test('visual: library mobile dark', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await importSample(page);
  await page.getByTestId('back-button').click();
  await page.getByTestId('theme-toggle').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await stabilize(page);
  await noBodyOverflow(page);
  await page.screenshot({ path: `${QA_DIR}/library-mobile-dark.png` });
});

test('visual: library desktop', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await importSample(page);
  await page.getByTestId('back-button').click();
  await expect(page.getByTestId('book-card')).toHaveCount(1);
  await stabilize(page);
  await noBodyOverflow(page);
  await page.screenshot({ path: `${QA_DIR}/library-desktop.png` });
});

test('visual: library desktop dark', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await importSample(page);
  await page.getByTestId('back-button').click();
  await page.getByTestId('theme-toggle').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await stabilize(page);
  await noBodyOverflow(page);
  await page.screenshot({ path: `${QA_DIR}/library-desktop-dark.png` });
});

test('visual: reader horizontal mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await importSample(page);
  await waitForFurigana(page, 'ネコ');
  await stabilize(page);
  await noBodyOverflow(page);
  await expectReaderGeometry(page);
  await expect(page.locator('rt').filter({ hasText: 'ネコ' }).first()).toBeVisible();
  await page.screenshot({ path: `${QA_DIR}/reader-horizontal-mobile.png` });
});

test('visual: reader vertical mobile', async ({ page }) => {
  await setSettingsBeforeLoad(page, { orientation: 'vertical' });
  await page.setViewportSize({ width: 390, height: 844 });
  await importSample(page);
  await waitForFurigana(page, 'ネコ');
  await stabilize(page);
  await noBodyOverflow(page);
  await expectReaderGeometry(page);
  await expect(page.locator('.reader-scroll')).toHaveCSS('writing-mode', 'vertical-rl');
  await page.screenshot({ path: `${QA_DIR}/reader-vertical-mobile.png` });
});

test('visual: chapter 2 illustration upright in vertical mode', async ({ page }) => {
  await setSettingsBeforeLoad(page, { orientation: 'vertical' });
  await page.setViewportSize({ width: 1440, height: 900 });
  await importSample(page);
  await page.getByTestId('toc-button').click();
  await page.getByRole('button', { name: '第二章' }).click();
  await expect(page.getByTestId('chapter-title')).toHaveText('第二章');
  const image = page.locator('.reader-figure img');
  await expect(image).toBeVisible({ timeout: 30_000 });
  await expect(image).toHaveCSS('writing-mode', 'horizontal-tb');
  const upright = await image.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return { width: rect.width, height: rect.height };
  });
  expect(upright.width).toBeGreaterThan(upright.height);
  await stabilize(page);
  await noBodyOverflow(page);
  await expectReaderGeometry(page);
  await page.screenshot({ path: `${QA_DIR}/reader-vertical-chapter2.png` });
});

test('visual: reader horizontal desktop', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await importSample(page);
  await waitForFurigana(page, 'ネコ');
  await stabilize(page);
  await noBodyOverflow(page);
  await expectReaderGeometry(page);
  await page.screenshot({ path: `${QA_DIR}/reader-horizontal-desktop.png` });
});

test('visual: sentence mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await installApiMocks(page, {
    translator: 'available',
    translation: 'I am a cat.',
  });
  await importSample(page);
  await openSentence(page);
  await expect(page.getByTestId('sentence-translation')).toContainText('I am a cat.');
  await expect(page.getByTestId('sentence-romaji')).toContainText('wagahai', { timeout: 90_000 });
  await stabilize(page);
  await noBodyOverflow(page);
  await page.screenshot({ path: `${QA_DIR}/sentence-mobile.png` });
});

test('visual: sentence desktop', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await installApiMocks(page, {
    translator: 'available',
    translation: 'I am a cat.',
  });
  await importSample(page);
  await openSentence(page);
  await expect(page.getByTestId('sentence-translation')).toContainText('I am a cat.');
  await expect(page.getByTestId('sentence-romaji')).toContainText('wagahai', { timeout: 90_000 });
  await stabilize(page);
  await noBodyOverflow(page);
  await page.screenshot({ path: `${QA_DIR}/sentence-desktop.png` });
});

test('visual: narrow 320px layout has no body overflow', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await importSample(page);
  await expectReaderGeometry(page);
  await noBodyOverflow(page);
  await page.getByTestId('back-button').click();
  await expect(page.getByTestId('book-card')).toHaveCount(1);
  await noBodyOverflow(page);
});

test('visual: empty library dark', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await gotoLibrary(page);
  await page.getByTestId('theme-toggle').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.getByTestId('empty-state')).toBeVisible();
  await stabilize(page);
  await noBodyOverflow(page);
  await page.screenshot({ path: `${QA_DIR}/empty-dark.png` });
});

test('visual: empty library', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await gotoLibrary(page);
  await expect(page.getByTestId('empty-state')).toBeVisible();
  await stabilize(page);
  await noBodyOverflow(page);
  await page.screenshot({ path: `${QA_DIR}/empty.png` });
});
