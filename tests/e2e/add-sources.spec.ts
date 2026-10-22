import { expect, test } from '@playwright/test';
import {
  gotoLibrary,
  openAddBookFromMenu,
  importSample,
  installAozoraMocks,
  waitForReader,
} from './helpers';

test('@add-sheet opens, switches between three sources, and closes', async ({ page }) => {
  await gotoLibrary(page);
  await openAddBookFromMenu(page);

  const sheet = page.getByRole('dialog', { name: 'Add a book' });
  await expect(sheet).toBeVisible();
  await expect(page.getByRole('tab', { name: 'EPUB / MOBI' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByTestId('add-epub')).toBeVisible();

  await page.getByRole('tab', { name: 'EPUB / MOBI' }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('tab', { name: 'Aozora' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('tab', { name: 'Aozora' })).toBeFocused();
  await expect(
    sheet.getByPlaceholder('https://www.aozora.gr.jp/cards/.../card....html'),
  ).toBeVisible();
  await expect(sheet.getByRole('link', { name: /Open Aozora Bunko/ })).toHaveAttribute(
    'target',
    '_blank',
  );

  await page.getByRole('tab', { name: 'Text' }).click();
  await expect(page.getByTestId('add-text')).toBeVisible();

  await page.getByTestId('add-book-close').click();
  await expect(sheet).toBeHidden();
});

test('@txt-import imports a text file from the Text tab', async ({ page }) => {
  await gotoLibrary(page);
  await openAddBookFromMenu(page);
  await page.getByRole('tab', { name: 'Text' }).click();

  await page.getByTestId('text-input').setInputFiles({
    name: '吾輩は猫である.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('吾輩は猫である。\n\n名前はまだ無い。', 'utf8'),
  });

  await waitForReader(page);
  await expect(page.getByTestId('chapter-title')).toHaveText('吾輩は猫である');
  await expect(page.getByTestId('sentence-0-0')).toHaveAttribute('data-raw', '吾輩は猫である。');

  await page.getByTestId('back-button').click();
  const card = page.getByTestId('book-card');
  await expect(card).toHaveCount(1);
  await expect(card).toContainText('吾輩は猫である');
  await expect(card.locator('.book-card__author')).toHaveCount(0);
});

test('@aozora-import downloads a mocked card and renders its ruby text', async ({ page }) => {
  await installAozoraMocks(page);
  await gotoLibrary(page);
  await openAddBookFromMenu(page);
  await page.getByRole('tab', { name: 'Aozora' }).click();
  await page
    .getByPlaceholder('https://www.aozora.gr.jp/cards/.../card....html')
    .fill('https://www.aozora.gr.jp/cards/000879/card127.html');
  await page.getByRole('button', { name: 'Download & add' }).click();

  await waitForReader(page);
  const firstSentence = page.getByTestId('sentence-0-0');
  await expect(firstSentence).toHaveAttribute('data-raw', /ある日の暮方の事である/);
  await expect(firstSentence).not.toHaveAttribute('data-raw', /げにん/);
  await expect(page.locator('rt').filter({ hasText: 'ゲニン' }).first()).toBeVisible({
    timeout: 90_000,
  });

  await page.getByTestId('back-button').click();
  const card = page.getByTestId('book-card');
  await expect(card).toHaveCount(1);
  await expect(card).toContainText('羅生門');
  await expect(card).toContainText('芥川 竜之介');
});

test('@aozora-invalid shows an inline error and adds no card', async ({ page }) => {
  await installAozoraMocks(page, { status: 404 });
  await gotoLibrary(page);
  await openAddBookFromMenu(page);
  await page.getByRole('tab', { name: 'Aozora' }).click();
  await page
    .getByPlaceholder('https://www.aozora.gr.jp/cards/.../card....html')
    .fill('https://www.aozora.gr.jp/cards/000879/card127.html');
  await page.getByRole('button', { name: 'Download & add' }).click();

  await expect(page.getByRole('alert')).toContainText(/could not be found/i);
  await expect(page.getByRole('dialog', { name: 'Add a book' })).toBeVisible();
  await expect(page.getByTestId('book-card')).toHaveCount(0);
});

test('@cover-after-reader keeps the library cover alive after leaving the reader', async ({
  page,
}) => {
  await importSample(page);
  await page.getByTestId('back-button').click();

  const cover = page.locator('.book-card__image');
  await expect(cover).toBeVisible();
  await expect(cover).toHaveAttribute('src', /^data:image\//);
  await expect
    .poll(async () => cover.evaluate((image) => (image as HTMLImageElement).naturalWidth))
    .toBeGreaterThan(0);

  await page.getByTestId('book-card').click();
  await waitForReader(page);
  await page.getByTestId('back-button').click();

  await expect(cover).toBeVisible();
  await expect
    .poll(async () =>
      cover.evaluate((image) => {
        const element = image as HTMLImageElement;
        return element.complete ? element.naturalWidth : 0;
      }),
    )
    .toBeGreaterThan(0);

  await page.reload();
  const reloaded = page.locator('.book-card__image');
  await expect(reloaded).toBeVisible();
  await expect(reloaded).toHaveAttribute('src', /^data:image\//);
  await expect
    .poll(async () => reloaded.evaluate((image) => (image as HTMLImageElement).naturalWidth))
    .toBeGreaterThan(0);
});

test('@legacy-cover-migration replaces an existing blob-only cover with a data URL', async ({
  page,
}) => {
  await importSample(page);
  await page.getByTestId('back-button').click();

  await page.evaluate(async () => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('jepub');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction('books', 'readwrite');
      const store = transaction.objectStore('books');
      const all = store.getAll();
      all.onsuccess = () => {
        for (const book of all.result) {
          delete book.coverDataUrl;
          store.put(book);
        }
      };
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
    database.close();
  });

  await page.reload();
  const cover = page.locator('.book-card__image');
  await expect(cover).toBeVisible();
  await expect(cover).toHaveAttribute('src', /^data:image\//);
  await expect
    .poll(async () => cover.evaluate((image) => (image as HTMLImageElement).naturalWidth))
    .toBeGreaterThan(0);
});
