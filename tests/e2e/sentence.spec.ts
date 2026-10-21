import { expect, test } from '@playwright/test';
import {
  importSample,
  installApiMocks,
  openSentence,
  routeMyMemory,
  setSettingsBeforeLoad,
  spokenEntries,
} from './helpers';

test('@sheet-open opens the sentence sheet and restores focus on escape', async ({ page }) => {
  await installApiMocks(page, { translator: 'none' });
  await importSample(page);
  await openSentence(page);
  const dialog = page.getByRole('dialog', { name: 'Sentence details' });
  await expect(dialog).toContainText(/sentence/i);
  await expect(page.getByTestId('sentence-japanese')).toContainText('吾輩');
  await expect(page.getByTestId('sentence-japanese')).toContainText('猫');
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(page.getByTestId('sentence-1-0')).toBeFocused();
});

test('@romaji renders spaced romaji cleaned of stray periods', async ({ page }) => {
  await installApiMocks(page, { translator: 'none' });
  await importSample(page);
  await openSentence(page);
  const romaji = page.getByTestId('sentence-romaji');
  await expect(romaji).toContainText('wagahai', { timeout: 90_000 });
  const text = (await romaji.textContent()) ?? '';
  expect(text).not.toMatch(/\s\./);
  expect(text).toContain('neko');
});

test('@translate-on-device uses the on-device translator when available', async ({ page }) => {
  await installApiMocks(page, {
    translator: 'available',
    translation: 'I am a cat.',
  });
  await importSample(page);
  await openSentence(page);
  await expect(page.getByTestId('sentence-translation')).toContainText('I am a cat.');
  await expect(page.getByTestId('translation-provider')).toContainText('On-device');
});

test('@translate-online-fallback falls back to MyMemory when on-device is unavailable', async ({
  page,
}) => {
  await installApiMocks(page, { translator: 'none' });
  await routeMyMemory(page, 'I am a cat.');
  await setSettingsBeforeLoad(page, { onlineTranslation: true });
  await importSample(page);
  await openSentence(page);
  await expect(page.getByTestId('sentence-translation')).toContainText('I am a cat.');
  await expect(page.getByTestId('translation-provider')).toContainText('MyMemory');
});

test('@translate-disabled offers an explicit enable action and retries', async ({ page }) => {
  await installApiMocks(page, { translator: 'none' });
  await routeMyMemory(page, 'I am a cat.');
  await importSample(page);
  await openSentence(page);
  const enable = page.getByRole('button', { name: /Enable online translation/ });
  await expect(enable).toContainText('sends this sentence to MyMemory');
  await enable.click();
  await expect(page.getByTestId('sentence-translation')).toContainText('I am a cat.');
  await expect(page.getByTestId('translation-provider')).toContainText('MyMemory');
});

test('@speech-sentence speaks the raw sentence in ja-JP', async ({ page }) => {
  await installApiMocks(page, { translator: 'none' });
  await importSample(page);
  await openSentence(page);
  await page.getByTestId('sentence-play').click();
  await expect.poll(async () => (await spokenEntries(page)).length).toBeGreaterThan(0);
  const spoken = await spokenEntries(page);
  expect(spoken[0]).toEqual({ text: '吾輩は猫である。', lang: 'ja-JP' });
  await expect(page.getByTestId('sentence-play')).toHaveAttribute('aria-pressed', 'true');
  await page.getByTestId('sentence-play').click();
  await expect(page.getByTestId('sentence-play')).toHaveAttribute('aria-pressed', 'false');
});

test('@stale never shows a translation for a sentence that is no longer selected', async ({
  page,
}) => {
  await installApiMocks(page, { translator: 'available', staleDelay: 900 });
  await importSample(page);
  await openSentence(page, 'sentence-1-0');
  await page.getByTestId('sentence-close').click();
  await openSentence(page, 'sentence-1-1');
  const translation = page.getByTestId('sentence-translation');
  await expect(translation).toContainText('FRESH_TRANSLATION');
  await page.waitForTimeout(1100);
  await expect(translation).not.toContainText('STALE_TRANSLATION');
  await expect(page.getByTestId('sentence-1-1')).toBeVisible();
});

test('@focus-trap keeps tab focus inside the sheet and closes on backdrop', async ({ page }) => {
  await installApiMocks(page, { translator: 'none' });
  await importSample(page);
  await openSentence(page);
  const dialog = page.getByRole('dialog', { name: 'Sentence details' });
  for (let index = 0; index < 10; index += 1) {
    await page.keyboard.press('Tab');
  }
  const inside = await page.evaluate(
    () => document.activeElement?.closest('[role="dialog"]') !== null,
  );
  expect(inside).toBe(true);
  await page.getByTestId('sentence-backdrop').click({ position: { x: 4, y: 4 } });
  await expect(dialog).toBeHidden();
});
