import { beforeEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_SETTINGS,
  SETTINGS_KEY,
  loadSettings,
  saveSettings,
} from '../../src/lib/settings/settings';

beforeEach(() => {
  localStorage.clear();
});

describe('settings', () => {
  it('SET-DEFAULTS returns the documented defaults when nothing is stored', () => {
    expect(loadSettings()).toEqual({
      theme: 'light',
      fontSize: 19,
      orientation: 'horizontal',
      furigana: true,
      furiganaScript: 'katakana',
      onlineTranslation: false,
      llmConsent: false,
      aiMode: 'off',
      aiProvider: 'openai',
      aiApiKey: '',
      aiModel: '',
      aiBaseUrl: '',
      translationTarget: 'en',
      uiLanguage: 'system',
    });
    expect(DEFAULT_SETTINGS.onlineTranslation).toBe(false);
    expect(DEFAULT_SETTINGS.llmConsent).toBe(false);
    expect(DEFAULT_SETTINGS.aiMode).toBe('off');
    expect(DEFAULT_SETTINGS.furiganaScript).toBe('katakana');
    expect(DEFAULT_SETTINGS.translationTarget).toBe('en');
  });

  it('SET-AI preserves local consent as Local mode and persists BYOT fields', () => {
    localStorage.setItem(
      SETTINGS_KEY,
      JSON.stringify({ llmConsent: true, aiMode: 'invalid', aiProvider: 'invalid' }),
    );
    expect(loadSettings().aiMode).toBe('local');
    expect(loadSettings().aiProvider).toBe('openai');

    saveSettings({
      aiMode: 'byot',
      aiProvider: 'openrouter',
      aiApiKey: 'test-key',
      aiModel: 'openai/gpt-4o-mini',
      aiBaseUrl: 'https://example.test/v1',
    });
    const reloaded = loadSettings();
    expect(reloaded.aiMode).toBe('byot');
    expect(reloaded.aiProvider).toBe('openrouter');
    expect(reloaded.aiApiKey).toBe('test-key');
    expect(reloaded.aiModel).toBe('openai/gpt-4o-mini');
    expect(reloaded.aiBaseUrl).toBe('https://example.test/v1');
  });

  it('SET-CORRUPT ignores invalid JSON and invalid individual keys', () => {
    localStorage.setItem(SETTINGS_KEY, '{not json');
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS);

    localStorage.setItem(
      SETTINGS_KEY,
      JSON.stringify({ theme: 'blue', fontSize: 'huge', orientation: 'diagonal', furigana: false }),
    );
    expect(loadSettings()).toEqual({
      ...DEFAULT_SETTINGS,
      furigana: false,
    });
  });

  it('SET-PERSIST writes a partial update and reads it back', () => {
    const saved = saveSettings({ theme: 'dark', fontSize: 24 });
    expect(saved.theme).toBe('dark');
    expect(saved.fontSize).toBe(24);

    const reloaded = loadSettings();
    expect(reloaded.theme).toBe('dark');
    expect(reloaded.fontSize).toBe(24);
    expect(reloaded.orientation).toBe('horizontal');
  });

  it('SET-ONLINE-OFF defaults online translation off and persists an opt-in', () => {
    expect(loadSettings().onlineTranslation).toBe(false);
    saveSettings({ onlineTranslation: true });
    expect(loadSettings().onlineTranslation).toBe(true);
    expect(JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}')).toMatchObject({
      onlineTranslation: true,
    });
  });

  it('SET-SCRIPT defaults to katakana and persists a hiragana choice', () => {
    expect(loadSettings().furiganaScript).toBe('katakana');
    saveSettings({ furiganaScript: 'hiragana' });
    expect(loadSettings().furiganaScript).toBe('hiragana');
    saveSettings({ furiganaScript: 'katakana' });
    expect(loadSettings().furiganaScript).toBe('katakana');

    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ furiganaScript: 'romaji' }));
    expect(loadSettings().furiganaScript).toBe('katakana');
  });

  it('SET-TARGET persists a supported target and rejects an unknown one', () => {
    saveSettings({ translationTarget: 'fr' });
    expect(loadSettings().translationTarget).toBe('fr');

    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ translationTarget: 'xx' }));
    expect(loadSettings().translationTarget).toBe('en');
  });

  it('SET-UI-LANGUAGE defaults to system and persists a supported language', () => {
    expect(loadSettings().uiLanguage).toBe('system');

    saveSettings({ uiLanguage: 'ja' });
    expect(loadSettings().uiLanguage).toBe('ja');

    saveSettings({ uiLanguage: 'zh-TW' });
    expect(loadSettings().uiLanguage).toBe('zh-TW');

    saveSettings({ uiLanguage: 'not-a-language' });
    expect(loadSettings().uiLanguage).toBe('zh-TW');

    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ uiLanguage: 'xx' }));
    expect(loadSettings().uiLanguage).toBe('system');
  });

  it('SET-CLAMP clamps font size to 14..32 and rejects non-numbers', () => {
    expect(saveSettings({ fontSize: 100 }).fontSize).toBe(32);
    expect(saveSettings({ fontSize: 1 }).fontSize).toBe(14);

    // Reset first: otherwise this reads the 14 from the previous line rather
    // than proving NaN falls back to the documented default.
    localStorage.clear();
    expect(saveSettings({ fontSize: Number.NaN }).fontSize).toBe(DEFAULT_SETTINGS.fontSize);

    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ fontSize: Number.NaN }));
    expect(loadSettings().fontSize).toBe(19);
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ fontSize: 13 }));
    expect(loadSettings().fontSize).toBe(14);
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ fontSize: 99 }));
    expect(loadSettings().fontSize).toBe(32);
  });
});
