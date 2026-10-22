import { describe, expect, it } from 'vitest';
import {
  DEFAULT_UI_LANGUAGE,
  UI_LANGUAGES,
  resolveUiLanguage,
  resolveUiLanguageSetting,
  uiLanguageLabel,
} from '../../src/lib/i18n/languages';
import {
  ENGLISH_SOURCES,
  TRANSLATIONS,
  translate,
} from '../../src/lib/i18n/translations';

describe('i18n', () => {
  it('I18N-SYSTEM resolves system languages with Chinese variants and English fallback', () => {
    expect(resolveUiLanguage([])).toBe('en');
    expect(resolveUiLanguage(['xx-YY'])).toBe('en');
    expect(resolveUiLanguage(['ja-JP'])).toBe('ja');
    expect(resolveUiLanguage(['ko-KR', 'ja-JP'])).toBe('ko');
    expect(resolveUiLanguage(['zh'])).toBe('zh-CN');
    expect(resolveUiLanguage(['zh-CN'])).toBe('zh-CN');
    expect(resolveUiLanguage(['zh-Hant'])).toBe('zh-TW');
    expect(resolveUiLanguage(['zh-Hant-TW'])).toBe('zh-TW');
    expect(resolveUiLanguage(['zh-TW'])).toBe('zh-TW');
    expect(resolveUiLanguage(['zh-HK'])).toBe('zh-TW');
    expect(resolveUiLanguage(['fr-CA', 'ja-JP'])).toBe('fr');
    expect(resolveUiLanguage(['xx', 'de-DE'])).toBe('de');

    expect(DEFAULT_UI_LANGUAGE).toBe('system');
    expect(UI_LANGUAGES.map((language) => language.code)).toEqual([
      'en',
      'ja',
      'zh-CN',
      'zh-TW',
      'ko',
      'es',
      'fr',
      'de',
    ]);
    expect(uiLanguageLabel('ja')).toBe('日本語');
    expect(resolveUiLanguageSetting('system', ['ko-KR'])).toBe('ko');
    expect(resolveUiLanguageSetting('de', ['ko-KR'])).toBe('de');
    expect(resolveUiLanguageSetting('bogus', ['es-ES'])).toBe('es');
  });

  it('I18N-TRANSLATE translates, interpolates, and falls back to English', () => {
    expect(translate('en', 'Add book')).toBe('Add book');
    expect(translate('ja', 'Add book')).toBe('本を追加');
    expect(translate('zh-CN', 'Bookmarks')).toBe('书签');
    expect(translate('zh-TW', 'Bookmarks')).toBe('書籤');
    expect(translate('ko', 'Settings')).toBe('설정');
    expect(translate('es', 'Settings')).toBe('Ajustes');
    expect(translate('fr', 'Settings')).toBe('Réglages');
    expect(translate('de', 'Settings')).toBe('Einstellungen');

    expect(translate('en', '{count} volumes', { count: 3 })).toBe('3 volumes');
    expect(translate('ja', '{count} volumes', { count: 3 })).toBe('3冊');
    expect(translate('ja', 'Missing source string')).toBe('Missing source string');
  });

  it('I18N-TRANSLATE covers every English source in all eight languages', () => {
    for (const language of UI_LANGUAGES) {
      const dictionary = TRANSLATIONS[language.code];
      expect(Object.keys(dictionary).sort()).toEqual([...ENGLISH_SOURCES].sort());
      for (const source of ENGLISH_SOURCES) {
        expect(dictionary[source].length).toBeGreaterThan(0);
        const placeholders = [...source.matchAll(/\{(\w+)\}/gu)].map((match) => match[1]);
        const translated = [...dictionary[source].matchAll(/\{(\w+)\}/gu)].map(
          (match) => match[1],
        );
        expect(translated.sort()).toEqual(placeholders.sort());
      }
    }
  });
});
