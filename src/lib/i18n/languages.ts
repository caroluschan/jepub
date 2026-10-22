export const UI_LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'ja', label: '日本語' },
  { code: 'zh-CN', label: '简体中文' },
  { code: 'zh-TW', label: '繁體中文' },
  { code: 'ko', label: '한국어' },
  { code: 'es', label: 'Español' },
  { code: 'fr', label: 'Français' },
  { code: 'de', label: 'Deutsch' },
] as const;

export type UiLanguageCode = (typeof UI_LANGUAGES)[number]['code'];
export type UiLanguageSetting = 'system' | UiLanguageCode;

export const DEFAULT_UI_LANGUAGE: UiLanguageSetting = 'system';
export const FALLBACK_UI_LANGUAGE: UiLanguageCode = 'en';

const LANGUAGE_CODES = new Set<string>(UI_LANGUAGES.map((language) => language.code));

export function isUiLanguage(value: unknown): value is UiLanguageCode {
  return typeof value === 'string' && LANGUAGE_CODES.has(value);
}

export function isUiLanguageSetting(value: unknown): value is UiLanguageSetting {
  return value === 'system' || isUiLanguage(value);
}

export function uiLanguageLabel(code: UiLanguageCode): string {
  const language = UI_LANGUAGES.find((entry) => entry.code === code);
  return language?.label ?? 'English';
}

/**
 * Resolves the best supported interface language from an ordered list of
 * BCP-47 preferences. Traditional Chinese variants map to zh-TW; every other
 * Chinese variant maps to Simplified Chinese.
 */
export function resolveUiLanguage(preferred: readonly string[]): UiLanguageCode {
  for (const raw of preferred) {
    const tag = raw.trim().toLowerCase();
    if (tag.length === 0) continue;

    if (tag === 'zh' || tag.startsWith('zh-') || tag.startsWith('zh_')) {
      if (/(hant|tw|hk|mo)/u.test(tag)) return 'zh-TW';
      return 'zh-CN';
    }
    if (tag === 'en' || tag.startsWith('en-') || tag.startsWith('en_')) return 'en';
    if (tag === 'ja' || tag.startsWith('ja-') || tag.startsWith('ja_')) return 'ja';
    if (tag === 'ko' || tag.startsWith('ko-') || tag.startsWith('ko_')) return 'ko';
    if (tag === 'es' || tag.startsWith('es-') || tag.startsWith('es_')) return 'es';
    if (tag === 'fr' || tag.startsWith('fr-') || tag.startsWith('fr_')) return 'fr';
    if (tag === 'de' || tag.startsWith('de-') || tag.startsWith('de_')) return 'de';
  }
  return FALLBACK_UI_LANGUAGE;
}

export function browserLanguages(): readonly string[] {
  if (typeof navigator === 'undefined') return [];
  if (Array.isArray(navigator.languages) && navigator.languages.length > 0) {
    return navigator.languages;
  }
  return typeof navigator.language === 'string' ? [navigator.language] : [];
}

export function resolveUiLanguageSetting(
  setting: string,
  preferred: readonly string[] = browserLanguages(),
): UiLanguageCode {
  if (isUiLanguage(setting)) return setting;
  return resolveUiLanguage(preferred);
}
