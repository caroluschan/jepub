import { expect, test } from '@playwright/test';
import { gotoLibrary, openAppMenu } from './helpers';

test('@menu contains library actions and opens the saved chat room', async ({ page }) => {
  await gotoLibrary(page);
  await openAppMenu(page);

  await expect(page.getByTestId('menu-chat')).toBeVisible();
  await expect(page.getByTestId('menu-mypedia')).toBeVisible();
  await expect(page.getByTestId('menu-guide')).toBeVisible();
  await expect(page.getByTestId('menu-quiz')).toHaveCount(0);
  await expect(page.getByTestId('menu-settings')).toBeVisible();
  await expect(page.getByTestId('menu-add-book')).toBeVisible();
  await expect(page.getByTestId('menu-theme')).toBeVisible();

  await page.getByTestId('menu-chat').click();
  await expect(page.getByTestId('chat-index')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'AI Chat' })).toBeVisible();
  await expect(page.getByText('No saved chats yet.')).toBeVisible();

  await page.locator('.chat-index__empty').getByRole('button', { name: 'New chat' }).click();
  await expect(page.getByTestId('chat-page')).toBeVisible();
});

test('@ai-chat-off keeps the entry and deep-links to AI settings', async ({ page }) => {
  await gotoLibrary(page);
  await openAppMenu(page);
  await page.getByTestId('menu-chat').click();
  await expect(page.getByTestId('ai-chat-setup')).toBeVisible();
  await page.getByTestId('ai-chat-setup').getByRole('button', { name: 'Open AI settings' }).click();
  await expect(page.getByTestId('settings-page')).toBeVisible();
  await expect(page.locator('#settings-ai')).toBeVisible();
  await expect
    .poll(() => page.locator('.settings-page__body').evaluate((element) => element.scrollTop))
    .toBeGreaterThan(100);
  await page.getByTestId('settings-close').click();
  await expect(page.getByTestId('chat-index')).toBeVisible();
});


test('@guide has a jump list and tutorial sections', async ({ page }) => {
  await gotoLibrary(page);
  await openAppMenu(page);
  await page.getByTestId('menu-guide').click();
  await expect(page.getByTestId('guide-page')).toBeVisible();
  await expect(page.getByTestId('guide-toc')).toBeVisible();
  await page.getByTestId('guide-toc').getByRole('button', { name: 'Add books' }).click();
  await expect(page.locator('#guide-add')).toBeVisible();
  await page.getByTestId('guide-toc').getByRole('button', { name: 'AI Chat' }).click();
  await expect(page.getByTestId('guide-page')).toBeVisible();
  await expect(page.locator('#guide-chat')).toBeVisible();
});
