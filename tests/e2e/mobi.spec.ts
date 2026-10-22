import { expect, test } from '@playwright/test';
import path from 'node:path';
import { gotoLibrary, waitForFurigana, waitForReader } from './helpers';

const MOBI_FIXTURE = path.resolve(process.cwd(), 'tests/fixtures/rashomon.mobi');

test('@mobi-import imports a real MOBI file with Japanese text and furigana', async ({ page }) => {
  await gotoLibrary(page);
  await page.getByTestId('epub-input').setInputFiles(MOBI_FIXTURE);
  await waitForReader(page);

  await page.getByTestId('toc-button').click();
  await page.getByRole('button', { name: /RASHOMON/u }).click();
  await expect(page.getByTestId('chapter-title')).toHaveText('RASHOMON');

  const body = page.locator('[data-raw*="或日の暮方の事である"]').first();
  await body.scrollIntoViewIfNeeded();
  await expect(body).toBeVisible();
  await expect(body).not.toHaveAttribute('data-raw', /げにん/);
  await waitForFurigana(page, 'ゲニン');

  await page.getByTestId('back-button').click();
  const card = page.getByTestId('book-card');
  await expect(card).toHaveCount(1);
  await expect(card).toContainText('羅生門');
  await expect(card).toContainText('Akutagawa');
});
