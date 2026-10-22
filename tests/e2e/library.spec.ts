import { expect, test } from '@playwright/test';
import { SAMPLE_EPUB, gotoLibrary, importSample, waitForReader } from './helpers';

test('@sample-import adds the sample and opens the reader', async ({ page }) => {
  await importSample(page);
  await expect(page.getByTestId('chapter-title')).toHaveText('第一章');
  await page.getByTestId('back-button').click();
  await expect(page.getByTestId('library-page')).toBeVisible();
  await expect(page.getByTestId('book-card')).toHaveCount(1);
  await expect(page.getByTestId('book-card')).toContainText('吾輩は猫である');
  const overlapsCover = await page.evaluate(() => {
    const cover = document.querySelector('.book-card__cover');
    const remove = document.querySelector('.book-card__delete');
    if (cover === null || remove === null) return true;
    const coverRect = cover.getBoundingClientRect();
    const removeRect = remove.getBoundingClientRect();
    return !(
      removeRect.right <= coverRect.left ||
      removeRect.left >= coverRect.right ||
      removeRect.bottom <= coverRect.top ||
      removeRect.top >= coverRect.bottom
    );
  });
  expect(overlapsCover).toBe(false);
});

test('@file-import imports a chosen EPUB file', async ({ page }) => {
  await gotoLibrary(page);
  await page.getByTestId('epub-input').setInputFiles(SAMPLE_EPUB);
  await waitForReader(page);
  await page.getByTestId('back-button').click();
  await expect(page.getByTestId('book-card')).toHaveCount(1);
});

test('@corrupt shows a friendly error and adds no card', async ({ page }) => {
  await gotoLibrary(page);
  await page.getByTestId('epub-input').setInputFiles({
    name: 'broken.epub',
    mimeType: 'application/epub+zip',
    buffer: Buffer.from('this is not an epub archive'),
  });
  await expect(page.getByTestId('toast').first()).toBeVisible();
  await expect(page.getByTestId('toast').first()).toContainText(/could not|invalid|not a readable|epub/i);
  await expect(page.getByTestId('book-card')).toHaveCount(0);
  await expect(page.getByTestId('empty-state')).toBeVisible();
});

test('@delete removes a book and the removal persists', async ({ page }) => {
  await importSample(page);
  await page.getByTestId('back-button').click();
  const card = page.getByTestId('book-card');
  await expect(card).toHaveCount(1);
  await card.hover();
  await card.getByRole('button', { name: /Remove/ }).click();
  await expect(page.getByRole('dialog', { name: 'Remove this book?' })).toBeVisible();
  await page.getByRole('button', { name: 'Remove', exact: true }).click();
  await expect(page.getByTestId('empty-state')).toBeVisible();
  await expect(page.getByTestId('book-card')).toHaveCount(0);
  await page.reload();
  await expect(page.getByTestId('empty-state')).toBeVisible();
});

test('@theme-library toggles and persists the theme', async ({ page }) => {
  await gotoLibrary(page);
  await page.getByTestId('theme-toggle').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.getByTestId('theme-toggle').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
});
