import { expect, test } from '@playwright/test';
import {
  gotoLibrary,
  importSample,
  setSettingsBeforeLoad,
  waitForReader,
} from './helpers';

test('@settings-page opens from the library and restores focus', async ({ page }) => {
  await gotoLibrary(page);
  const trigger = page.getByTestId('library-settings-button');
  await trigger.click();

  const settings = page.getByRole('dialog', { name: 'Settings' });
  await expect(settings).toBeVisible();
  await expect(page.getByTestId('settings-page')).toBeVisible();
  await expect(page.getByTestId('ui-language')).toHaveValue('system');
  await expect(page.getByTestId('translation-language')).toBeVisible();
  await expect(page.getByRole('switch', { name: 'Furigana' })).toBeVisible();

  await page.getByTestId('settings-close').click();
  await expect(settings).toBeHidden();
  await expect(trigger).toBeFocused();
});

test('@settings-page opens from the reader without unmounting it', async ({ page }) => {
  await setSettingsBeforeLoad(page, { fontSize: 28 });
  await page.setViewportSize({ width: 390, height: 600 });
  await importSample(page);

  const scroller = page.locator('.reader-scroll');
  await scroller.evaluate((element) => {
    element.scrollTop = (element.scrollHeight - element.clientHeight) * 0.45;
    element.dispatchEvent(new Event('scroll'));
  });
  await page.waitForTimeout(300);
  const before = await scroller.evaluate((element) => element.scrollTop);
  expect(before).toBeGreaterThan(0);

  await page.getByTestId('settings-button').click();
  await expect(page.getByRole('dialog', { name: 'Settings' })).toBeVisible();
  await expect(page.getByTestId('reader-page')).toHaveCount(1);

  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Settings' })).toBeHidden();
  await expect(page.getByTestId('settings-button')).toBeFocused();
  const after = await page
    .locator('.reader-scroll')
    .evaluate((element) => element.scrollTop);
  expect(Math.abs(after - before)).toBeLessThanOrEqual(2);
});

test('@ui-language switches to Japanese, persists, and sets document lang', async ({ page }) => {
  await gotoLibrary(page);
  await page.getByTestId('library-settings-button').click();

  await page.getByTestId('ui-language').selectOption('ja');
  await expect(page.getByRole('heading', { name: '設定', exact: true })).toBeVisible();
  await expect(page.getByText('外観')).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'ja');
  await page.getByTestId('settings-close').click();

  await expect(
    page.locator('.library-header').getByRole('button', { name: '本を追加' }),
  ).toBeVisible();
  await expect(page.getByText('日本語 EPUB リーダー')).toBeVisible();

  await page.reload();
  await expect(page.getByTestId('library-page')).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'ja');
  await expect(
    page.locator('.library-header').getByRole('button', { name: '本を追加' }),
  ).toBeVisible();
  await expect(page.getByText('日本語 EPUB リーダー')).toBeVisible();

  await page.getByTestId('library-settings-button').click();
  await expect(page.getByTestId('ui-language')).toHaveValue('ja');
});

test('@settings-page keeps reader controls working after closing', async ({ page }) => {
  await importSample(page);
  await page.getByTestId('settings-button').click();
  await page.getByTestId('readings-hiragana').click();
  await page.getByTestId('settings-close').click();
  await waitForReader(page);
  await expect(page.getByTestId('settings-page')).toHaveCount(0);
});
