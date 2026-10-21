import { expect, test } from '@playwright/test';
import {
  importSample,
  installApiMocks,
  setSettingsBeforeLoad,
  spokenEntries,
  waitForFurigana,
} from './helpers';

test('@render shows the chapter text in the reader', async ({ page }) => {
  await importSample(page);
  await expect(page.getByTestId('reader-page')).toBeVisible();
  const sentence = page.getByTestId('sentence-1-0');
  await expect(sentence).toHaveAttribute('data-raw', '吾輩は猫である。');
  await expect(sentence).toHaveAttribute('aria-label', '吾輩は猫である。');
  await expect(page.getByTestId('chapter-title')).toHaveText('第一章');
});

test('@furigana-ruby renders real ruby above kanji', async ({ page }) => {
  await importSample(page);
  await waitForFurigana(page, 'ネコ');
  const sentence = page.getByTestId('sentence-1-0');
  await expect(sentence.locator('rt').filter({ hasText: 'ネコ' })).toBeVisible();
  await expect(sentence.locator('rp').first()).toHaveCSS('display', 'none');
});

test('@furigana-off hides ruby and can be restored', async ({ page }) => {
  await importSample(page);
  await waitForFurigana(page, 'ネコ');
  await page.getByTestId('settings-button').click();
  await page.getByRole('switch', { name: 'Furigana' }).click();
  await page.getByTestId('settings-close').click();
  await expect(page.getByTestId('reader-page')).toHaveClass(/no-furigana/);
  await expect(page.locator('rt').first()).toBeHidden();

  await page.getByTestId('settings-button').click();
  await page.getByRole('switch', { name: 'Furigana' }).click();
  await page.getByTestId('settings-close').click();
  await expect(page.getByTestId('reader-page')).not.toHaveClass(/no-furigana/);
  await expect(page.locator('rt').filter({ hasText: 'ネコ' }).first()).toBeVisible();
});

test('@toc-navigate navigates to a chapter from the contents drawer', async ({ page }) => {
  await importSample(page);
  await page.getByTestId('toc-button').click();
  await expect(page.getByRole('dialog', { name: 'Contents' })).toBeVisible();
  await page.getByRole('button', { name: '第二章' }).click();
  await expect(page.getByTestId('chapter-title')).toHaveText('第二章');
  await expect(page.getByTestId('sentence-1-0')).toHaveAttribute(
    'data-raw',
    '名前はまだ無い。',
  );
  await expect(page.getByTestId('toc-drawer')).toBeHidden();
});

test('@font-size @font-persist increases the reading size and persists it', async ({ page }) => {
  await importSample(page);
  const scroller = page.locator('.reader-scroll');
  const before = await scroller.evaluate((element) => getComputedStyle(element).fontSize);
  await page.getByTestId('settings-button').click();
  await page.getByRole('button', { name: 'Larger text' }).click();
  await page.getByTestId('settings-close').click();
  const after = await scroller.evaluate((element) => getComputedStyle(element).fontSize);
  expect(Number.parseFloat(after)).toBeGreaterThan(Number.parseFloat(before));
  await page.reload();
  await expect(page.locator('.reader-scroll')).toBeVisible();
  const persisted = await page
    .locator('.reader-scroll')
    .evaluate((element) => getComputedStyle(element).fontSize);
  expect(Number.parseFloat(persisted)).toBeCloseTo(Number.parseFloat(after), 0);
});

test('@orientation-vertical switches to vertical writing with horizontal overflow', async ({
  page,
}) => {
  await setSettingsBeforeLoad(page, { fontSize: 32 });
  await page.setViewportSize({ width: 320, height: 600 });
  await importSample(page);
  await page.getByTestId('settings-button').click();
  await page.getByRole('button', { name: '縦書き Vertical' }).click();
  await page.getByTestId('settings-close').click();
  await expect(page.getByTestId('reader-page')).toHaveAttribute('data-orientation', 'vertical');
  const metrics = await page.locator('.reader-scroll').evaluate((element) => ({
    writingMode: getComputedStyle(element).writingMode,
    scrollWidth: element.scrollWidth,
    clientWidth: element.clientWidth,
  }));
  expect(metrics.writingMode).toBe('vertical-rl');
  expect(metrics.scrollWidth).toBeGreaterThan(metrics.clientWidth);
});

test('@progress-persist saves the reading position and restores it', async ({ page }) => {
  await setSettingsBeforeLoad(page, { fontSize: 32 });
  await page.setViewportSize({ width: 390, height: 600 });
  await importSample(page);
  const scroller = page.locator('.reader-scroll');
  const max = await scroller.evaluate((element) => element.scrollHeight - element.clientHeight);
  expect(max).toBeGreaterThan(0);
  await scroller.evaluate((element) => {
    element.scrollTop = (element.scrollHeight - element.clientHeight) * 0.55;
    element.dispatchEvent(new Event('scroll'));
  });
  await page.waitForTimeout(900);
  await page.reload();
  await expect(page.getByTestId('reader-page')).toBeVisible();
  await expect
    .poll(async () =>
      page.locator('.reader-scroll').evaluate((element) => element.scrollTop),
    )
    .toBeGreaterThan(max * 0.25);
});

test('@read-aloud highlights sentences and speaks ja-JP', async ({ page }) => {
  await installApiMocks(page);
  await importSample(page);
  await page.getByTestId('read-aloud-button').click();
  await expect(page.getByTestId('read-aloud-button')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.sentence.is-speaking').first()).toBeVisible();
  await expect
    .poll(async () => (await spokenEntries(page)).length)
    .toBeGreaterThan(0);
  await expect
    .poll(async () => (await spokenEntries(page)).some((entry) => entry.text.includes('吾輩')))
    .toBe(true);
  const spoken = await spokenEntries(page);
  expect(spoken[0]?.lang).toBe('ja-JP');
  expect(spoken[0]?.text).toBe('第一章');
  await page.getByTestId('read-aloud-button').click();
  await expect(page.getByTestId('read-aloud-button')).toHaveAttribute('aria-pressed', 'false');
});

test('@read-aloud-stop stops the sequence promptly', async ({ page }) => {
  await installApiMocks(page);
  await importSample(page);
  await page.getByTestId('read-aloud-button').click();
  await expect.poll(async () => (await spokenEntries(page)).length).toBeGreaterThan(0);
  await page.getByTestId('read-aloud-button').click();
  await expect(page.getByTestId('read-aloud-button')).toHaveAttribute('aria-pressed', 'false');
  const count = (await spokenEntries(page)).length;
  await page.waitForTimeout(450);
  const later = (await spokenEntries(page)).length;
  expect(later).toBeLessThanOrEqual(count + 1);
  await expect(page.locator('.sentence.is-speaking')).toHaveCount(0);
});
