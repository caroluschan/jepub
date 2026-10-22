import { expect, test, type Page } from '@playwright/test';
import { importSample, installApiMocks, openSentence } from './helpers';

async function installGpu(page: Page, supported: boolean): Promise<void> {
  await page.addInitScript((enabled: boolean) => {
    Object.defineProperty(Navigator.prototype, 'gpu', {
      configurable: true,
      get: () =>
        enabled
          ? {
              requestAdapter: async () => ({
                limits: {
                  maxBufferSize: 4 * 1024 ** 3,
                  maxStorageBufferBindingSize: 2 * 1024 ** 3,
                },
              }),
            }
          : undefined,
    });
    Object.defineProperty(StorageManager.prototype, 'estimate', {
      configurable: true,
      value: async () => ({ usage: 0, quota: 4 * 1024 ** 3 }),
    });
  }, supported);
}

test('@ai-gate hides local AI when the device has no WebGPU', async ({ page }) => {
  await installApiMocks(page, { translator: 'none' });
  await installGpu(page, false);
  await importSample(page);
  await openSentence(page);
  await expect(page.getByTestId('ask-ai')).toHaveCount(0);

  await page.getByTestId('sentence-close').click();
  await page.getByRole('button', { name: 'Reader settings' }).click();
  await expect(page.getByTestId('ai-status')).toHaveCount(0);
});

test('@ai-consent requires explicit consent before the model download', async ({ page }) => {
  await installApiMocks(page, { translator: 'none' });
  await installGpu(page, true);
  await importSample(page);
  await openSentence(page);

  await expect(page.getByTestId('ask-ai')).toBeVisible();
  await page.getByTestId('ask-ai-button').click();
  await expect(page.getByTestId('ai-consent')).toBeVisible();
  await expect(page.getByTestId('ai-consent')).toContainText('645 MB');
  await page.getByRole('button', { name: 'Not now' }).click();
  await expect(page.getByTestId('ai-consent')).toBeHidden();
  await expect(page.getByTestId('ask-ai')).toBeVisible();
});

test('@ai-chat gate prompts for consent on a direct chat route', async ({ page }) => {
  await installApiMocks(page, { translator: 'none' });
  await installGpu(page, true);
  await page.goto('/#/chat');
  await expect(page.getByTestId('chat-page')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Enable AI' })).toBeVisible();
  await page.getByRole('button', { name: 'Enable AI' }).click();
  await expect(page.getByTestId('ai-consent')).toBeVisible();
});
