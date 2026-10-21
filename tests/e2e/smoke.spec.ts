import { expect, test } from '@playwright/test';

test('loads the JEPUB shell', async ({ page }) => {
  await page.goto('/jepub/');
  await expect(page.getByRole('heading', { name: 'JEPUB' })).toBeVisible();
  await expect(page.getByText('Japanese EPUB reader')).toBeVisible();
  await expect(page.locator('#root')).toBeAttached();
});
