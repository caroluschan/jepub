import { expect, test, type Page } from '@playwright/test';
import {
  SAMPLE_EPUB,
  gotoLibrary,
  openAddBookFromMenu,
  installAozoraMocks,
  waitForReader,
} from './helpers';

interface SharedPayload {
  title?: string;
  url?: string;
  files: Array<{ name: string; type: string }>;
}

async function mockNativeShare(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const scope = window as Window & { __shared?: SharedPayload[] };
    scope.__shared = [];
    Object.defineProperty(navigator, 'canShare', {
      configurable: true,
      value: () => true,
    });
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: async (data: ShareData) => {
        scope.__shared?.push({
          title: data.title,
          url: data.url,
          files: (data.files ?? []).map((file) => ({ name: file.name, type: file.type })),
        });
      },
    });
  });
}

async function sharedPayloads(page: Page): Promise<SharedPayload[]> {
  return page.evaluate(
    () => (window as Window & { __shared?: SharedPayload[] }).__shared ?? [],
  );
}

test('@share-epub shares the stored EPUB file with its title', async ({ page }) => {
  await mockNativeShare(page);
  await gotoLibrary(page);
  await page.getByTestId('epub-input').setInputFiles(SAMPLE_EPUB);
  await waitForReader(page);

  await page.getByTestId('share-button').click();
  await expect(page.getByTestId('toast').filter({ hasText: 'Shared.' })).toBeVisible();

  const shared = await sharedPayloads(page);
  expect(shared).toHaveLength(1);
  expect(shared[0]?.title).toBe('吾輩は猫である（抄）');
  expect(shared[0]?.files[0]?.name).toMatch(/\.epub$/u);
  expect(shared[0]?.files[0]?.type).toBe('application/epub+zip');
});

test('@share-aozora shares the Aozora card URL instead of a file', async ({ page }) => {
  await mockNativeShare(page);
  await installAozoraMocks(page);
  await gotoLibrary(page);
  await openAddBookFromMenu(page);
  await page.getByRole('tab', { name: 'Aozora' }).click();
  await page
    .getByPlaceholder('https://www.aozora.gr.jp/cards/.../card....html')
    .fill('https://www.aozora.gr.jp/cards/000879/card127.html');
  await page.getByRole('button', { name: 'Download & add' }).click();
  await waitForReader(page);

  await page.getByTestId('share-button').click();
  await expect(page.getByTestId('toast').filter({ hasText: 'Shared.' })).toBeVisible();

  const shared = await sharedPayloads(page);
  expect(shared).toHaveLength(1);
  expect(shared[0]?.url).toBe('https://www.aozora.gr.jp/cards/000879/card127.html');
  expect(shared[0]?.files).toEqual([]);
});
