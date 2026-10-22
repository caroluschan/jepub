import { expect, test } from '@playwright/test';
import {
  importSample,
  installApiMocks,
  openAppMenu,
  openSentence,
  setSettingsBeforeLoad,
} from './helpers';

test('@mypedia saves a checked translation and deletes it', async ({ page }) => {
  await installApiMocks(page, { translator: 'available', translation: 'I am a cat.' });
  await importSample(page);
  await openSentence(page);
  await page.getByTestId('add-to-mypedia').click();
  await expect(page.getByText('Added to MyPedia.')).toBeVisible();
  await page.getByTestId('sentence-close').click();
  await page.getByTestId('back-button').click();

  await openAppMenu(page);
  await page.getByTestId('menu-mypedia').click();
  await expect(page.getByTestId('mypedia-page')).toBeVisible();
  await expect(page.getByTestId('mypedia-record')).toHaveCount(1);
  await expect(page.getByTestId('mypedia-record')).toContainText('I am a cat.');

  page.once('dialog', (dialog) => void dialog.accept());
  await page.getByTestId('mypedia-record').getByRole('button').click();
  await expect(page.getByTestId('mypedia-record')).toHaveCount(0);
});

test('@quiz asks a generated multiple-choice question and shows the result', async ({ page }) => {
  await installApiMocks(page, { translator: 'available' });
  await setSettingsBeforeLoad(page, {
    aiMode: 'byot',
    aiProvider: 'custom',
    aiApiKey: 'test-key',
    aiModel: 'test-model',
    aiBaseUrl: 'https://example.test/v1',
  });
  let quizPrompt = '';
  const quiz = JSON.stringify({
    question: 'What does 猫 mean?',
    options: ['cat', 'dog', 'bird', 'fish'],
    answer: 0,
    explanation: '猫 means cat.',
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
    quizPrompt = route.request().postData() ?? '';
    await route.fulfill({
      status: 200,
      contentType: 'text/event-stream',
      headers: { 'access-control-allow-origin': '*' },
      body: `data: ${JSON.stringify({ choices: [{ delta: { content: quiz } }] })}\n\ndata: [DONE]\n\n`,
    });
  });

  await importSample(page);
  await openSentence(page);
  await page.getByTestId('add-to-mypedia').click();
  await page.getByTestId('sentence-close').click();
  await page.getByTestId('back-button').click();
  await openAppMenu(page);
  await expect(page.getByTestId('menu-quiz')).toBeVisible();
  await page.getByTestId('menu-quiz').click();

  await expect(page.getByTestId('quiz-page')).toBeVisible();
  await expect(page.getByText('What does 猫 mean?')).toBeVisible();
  await page.locator('.quiz-option').filter({ hasText: 'cat' }).click();
  await expect(page.getByText('Correct')).toBeVisible();
  await expect(page.getByText('猫 means cat.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Next question' })).toBeVisible();
  expect(quizPrompt).toContain('in English');
});

test('@mypedia stores an AI summary instead of the raw answer', async ({ page }) => {
  await installApiMocks(page, { translator: 'available', translation: 'I am a cat.' });
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
    const body = route.request().postData() ?? '';
    const content = body.includes('durable Japanese-learning knowledge')
      ? '- **吾輩** means “I” in this literary context.'
      : 'The full raw AI answer should not be inserted.';
    await route.fulfill({
      status: 200,
      contentType: 'text/event-stream',
      headers: { 'access-control-allow-origin': '*' },
      body: `data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\ndata: [DONE]\n\n`,
    });
  });

  await importSample(page);
  await openSentence(page);
  await page.getByTestId('ask-ai-button').click();
  await expect(page.locator('.sentence-sheet__ai-answer')).toContainText('raw AI answer');
  await page.getByTestId('sentence-close').click();
  await page.getByTestId('back-button').click();
  await openAppMenu(page);
  await page.getByTestId('menu-mypedia').click();

  await expect(page.getByTestId('mypedia-record')).toHaveCount(1);
  await expect(page.getByTestId('mypedia-record')).toContainText('吾輩 means');
  await expect(page.getByTestId('mypedia-record')).not.toContainText('full raw AI answer');
});
