import { expect, test } from '@playwright/test';
import { gotoLibrary, openAppMenu } from './helpers';

test('@menu contains library actions and opens the saved chat room', async ({ page }) => {
  await gotoLibrary(page);
  await openAppMenu(page);

  await expect(page.getByTestId('menu-chat')).toBeVisible();
  await expect(page.getByTestId('menu-mypedia')).toBeVisible();
  await expect(page.getByTestId('menu-quiz')).toHaveCount(0);
  await expect(page.getByTestId('menu-settings')).toBeVisible();
  await expect(page.getByTestId('menu-add-book')).toBeVisible();
  await expect(page.getByTestId('menu-theme')).toBeVisible();

  await page.getByTestId('menu-chat').click();
  await expect(page.getByTestId('chat-index')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Chat room' })).toBeVisible();
  await expect(page.getByText('No saved chats yet.')).toBeVisible();

  await page.locator('.chat-index__empty').getByRole('button', { name: 'New chat' }).click();
  await expect(page.getByTestId('chat-page')).toBeVisible();
});
