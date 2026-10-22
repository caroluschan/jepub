import { expect, test, type Page } from '@playwright/test';
import { importSample, installApiMocks, openSentence, setSettingsBeforeLoad } from './helpers';

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
  await expect(page.getByTestId('ai-mode')).toBeVisible();
  await expect(page.getByTestId('ai-mode').locator('option[value="local"]')).toHaveCount(0);
  await expect(page.getByTestId('ai-mode').locator('option[value="byot"]')).toHaveCount(1);
});

test('@ai-consent requires explicit consent before the model download', async ({ page }) => {
  await installApiMocks(page, { translator: 'none' });
  await installGpu(page, true);
  await setSettingsBeforeLoad(page, { aiMode: 'local' });
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
  await setSettingsBeforeLoad(page, { aiMode: 'local' });
  await page.goto('/#/chat');
  await expect(page.getByTestId('chat-page')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Enable AI' })).toBeVisible();
  await page.getByRole('button', { name: 'Enable AI' }).click();
  await expect(page.getByTestId('ai-consent')).toBeVisible();
});


test('@ai-byot works without local WebGPU and disables online calls offline', async ({ page }) => {
  await installApiMocks(page, { translator: 'none' });
  await installGpu(page, false);
  await page.addInitScript(() => {
    Object.defineProperty(Navigator.prototype, 'onLine', {
      configurable: true,
      get: () => false,
    });
  });
  await setSettingsBeforeLoad(page, {
    aiMode: 'byot',
    aiProvider: 'openai',
    aiApiKey: 'test-key',
    aiModel: 'gpt-4o-mini',
  });
  await importSample(page);
  await openSentence(page);

  await expect(page.getByTestId('ask-ai')).toBeVisible();
  await expect(page.getByTestId('ask-ai-button')).toBeDisabled();
  await expect(page.getByTestId('ai-offline-note')).toBeVisible();

  await page.goto('/#/chat');
  await expect(page.getByTestId('chat-page')).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Message' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Send' })).toBeDisabled();
  await expect(page.getByTestId('ai-offline-note')).toBeVisible();
});

test('@ai-byot streams from a custom OpenAI-compatible provider', async ({ page }) => {
  await installApiMocks(page, { translator: 'none' });
  await installGpu(page, false);
  await setSettingsBeforeLoad(page, {
    aiMode: 'byot',
    aiProvider: 'custom',
    aiApiKey: 'test-key',
    aiModel: 'test-model',
    aiBaseUrl: 'https://example.test/v1',
  });
  await page.route('https://example.test/v1/chat/completions', async (route) => {
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({
        status: 204,
        headers: {
          'access-control-allow-origin': '*',
          'access-control-allow-methods': 'POST, OPTIONS',
          'access-control-allow-headers': 'content-type, authorization',
        },
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'text/event-stream',
      headers: { 'access-control-allow-origin': '*' },
      body: [
        'data: {"choices":[{"delta":{"content":"BYOT "}}]}',
        'data: {"choices":[{"delta":{"content":"answer."}}]}',
        'data: [DONE]',
        '',
      ].join('\n\n'),
    });
  });
  await importSample(page);
  await openSentence(page);
  await page.getByTestId('ask-ai-button').click();
  await expect(page.locator('.sentence-sheet__ai-answer')).toContainText('BYOT answer.');
});
