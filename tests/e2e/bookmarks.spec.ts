import { expect, test, type Page } from '@playwright/test';
import { importSample, setSettingsBeforeLoad, waitForReader } from './helpers';

async function scrollToRatio(page: Page, ratio: number): Promise<void> {
  await page.locator('.reader-scroll').evaluate((element, target) => {
    element.scrollTop = (element.scrollHeight - element.clientHeight) * target;
    element.dispatchEvent(new Event('scroll'));
  }, ratio);
  await page.waitForTimeout(400);
}

test('@bookmark-add adds a bookmark and lists it in the Bookmarks tab', async ({ page }) => {
  await importSample(page);
  await page.getByTestId('bookmark-button').click();

  await expect(page.getByTestId('toast').filter({ hasText: 'Bookmark added.' })).toBeVisible();
  await expect(page.getByTestId('bookmark-button')).toHaveAttribute('aria-pressed', 'true');

  await page.getByTestId('toc-button').click();
  await page.getByTestId('toc-tab-bookmarks').click();
  const entry = page.getByTestId('bookmark-entry');
  await expect(entry).toHaveCount(1);
  await expect(entry).toContainText('第一章');
});

test('@bookmark-navigate-delete jumps to a bookmark and deletes it', async ({ page }) => {
  await setSettingsBeforeLoad(page, { fontSize: 32 });
  await page.setViewportSize({ width: 390, height: 600 });
  await importSample(page);

  await scrollToRatio(page, 0.55);
  await page.getByTestId('bookmark-button').click();
  await expect(page.getByTestId('bookmark-button')).toHaveAttribute('aria-pressed', 'true');

  await scrollToRatio(page, 0);
  await page.getByTestId('toc-button').click();
  await page.getByTestId('toc-tab-bookmarks').click();
  await page.getByTestId('bookmark-jump').click();
  await expect(page.getByTestId('toc-drawer')).toBeHidden();
  await expect
    .poll(async () =>
      page.locator('.reader-scroll').evaluate((element) => element.scrollTop),
    )
    .toBeGreaterThan(100);

  await page.getByTestId('toc-button').click();
  await page.getByTestId('toc-tab-bookmarks').click();
  await page.getByTestId('bookmark-delete').click();
  await expect(page.getByTestId('bookmark-entry')).toHaveCount(0);
  await expect(page.getByTestId('toast').filter({ hasText: 'Bookmark removed.' })).toBeVisible();
});

test('@bookmark-persist keeps bookmarks across reloads', async ({ page }) => {
  await setSettingsBeforeLoad(page, { fontSize: 32 });
  await page.setViewportSize({ width: 390, height: 600 });
  await importSample(page);
  await scrollToRatio(page, 0.5);
  await page.getByTestId('bookmark-button').click();
  await expect(page.getByTestId('toast').filter({ hasText: 'Bookmark added.' })).toBeVisible();

  await page.reload();
  await waitForReader(page);
  await page.getByTestId('toc-button').click();
  await page.getByTestId('toc-tab-bookmarks').click();
  await expect(page.getByTestId('bookmark-entry')).toHaveCount(1);
  await expect(page.getByTestId('bookmark-entry')).toContainText('第一章');
});
