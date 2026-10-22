import { describe, expect, it } from 'vitest';
import {
  DEFAULT_TRANSLATION_TARGET,
  TRANSLATION_LANGUAGES,
  getTranslationLanguage,
  isTranslationTarget,
} from '../../src/lib/translate/languages';

describe('translation languages', () => {
  it('LANG-SUPPORT exposes every Chrome on-device target and maps Chinese variants', () => {
    expect(TRANSLATION_LANGUAGES).toHaveLength(39);
    expect(DEFAULT_TRANSLATION_TARGET).toBe('en');
    expect(isTranslationTarget('en')).toBe(true);
    expect(isTranslationTarget('zh-Hant')).toBe(true);
    expect(isTranslationTarget('xx')).toBe(false);
    expect(getTranslationLanguage('zh').myMemoryCode).toBe('zh-CN');
    expect(getTranslationLanguage('zh-Hant').myMemoryCode).toBe('zh-TW');
    expect(getTranslationLanguage('xx').code).toBe('en');
  });
});
