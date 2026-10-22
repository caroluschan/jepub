export interface TranslationLanguage {
  code: string;
  label: string;
  myMemoryCode: string;
}

export const DEFAULT_TRANSLATION_TARGET = 'en';

export const TRANSLATION_LANGUAGES: readonly TranslationLanguage[] = [
  { code: 'en', label: 'English', myMemoryCode: 'en' },
  { code: 'ar', label: 'Arabic', myMemoryCode: 'ar' },
  { code: 'bg', label: 'Bulgarian', myMemoryCode: 'bg' },
  { code: 'bn', label: 'Bengali', myMemoryCode: 'bn' },
  { code: 'cs', label: 'Czech', myMemoryCode: 'cs' },
  { code: 'da', label: 'Danish', myMemoryCode: 'da' },
  { code: 'de', label: 'German', myMemoryCode: 'de' },
  { code: 'el', label: 'Greek', myMemoryCode: 'el' },
  { code: 'es', label: 'Spanish', myMemoryCode: 'es' },
  { code: 'fi', label: 'Finnish', myMemoryCode: 'fi' },
  { code: 'fr', label: 'French', myMemoryCode: 'fr' },
  { code: 'he', label: 'Hebrew', myMemoryCode: 'he' },
  { code: 'hi', label: 'Hindi', myMemoryCode: 'hi' },
  { code: 'hr', label: 'Croatian', myMemoryCode: 'hr' },
  { code: 'hu', label: 'Hungarian', myMemoryCode: 'hu' },
  { code: 'id', label: 'Indonesian', myMemoryCode: 'id' },
  { code: 'it', label: 'Italian', myMemoryCode: 'it' },
  { code: 'ja', label: 'Japanese', myMemoryCode: 'ja' },
  { code: 'kn', label: 'Kannada', myMemoryCode: 'kn' },
  { code: 'ko', label: 'Korean', myMemoryCode: 'ko' },
  { code: 'lt', label: 'Lithuanian', myMemoryCode: 'lt' },
  { code: 'mr', label: 'Marathi', myMemoryCode: 'mr' },
  { code: 'nl', label: 'Dutch', myMemoryCode: 'nl' },
  { code: 'no', label: 'Norwegian', myMemoryCode: 'no' },
  { code: 'pl', label: 'Polish', myMemoryCode: 'pl' },
  { code: 'pt', label: 'Portuguese', myMemoryCode: 'pt' },
  { code: 'ro', label: 'Romanian', myMemoryCode: 'ro' },
  { code: 'ru', label: 'Russian', myMemoryCode: 'ru' },
  { code: 'sk', label: 'Slovak', myMemoryCode: 'sk' },
  { code: 'sl', label: 'Slovenian', myMemoryCode: 'sl' },
  { code: 'sv', label: 'Swedish', myMemoryCode: 'sv' },
  { code: 'ta', label: 'Tamil', myMemoryCode: 'ta' },
  { code: 'te', label: 'Telugu', myMemoryCode: 'te' },
  { code: 'th', label: 'Thai', myMemoryCode: 'th' },
  { code: 'tr', label: 'Turkish', myMemoryCode: 'tr' },
  { code: 'uk', label: 'Ukrainian', myMemoryCode: 'uk' },
  { code: 'vi', label: 'Vietnamese', myMemoryCode: 'vi' },
  { code: 'zh', label: 'Chinese (Simplified)', myMemoryCode: 'zh-CN' },
  { code: 'zh-Hant', label: 'Chinese (Traditional)', myMemoryCode: 'zh-TW' },
];

const byCode = new Map(TRANSLATION_LANGUAGES.map((language) => [language.code, language]));

export function isTranslationTarget(value: unknown): value is string {
  return typeof value === 'string' && byCode.has(value);
}

export function getTranslationLanguage(code: string): TranslationLanguage {
  const match = byCode.get(code);
  if (match !== undefined) return match;
  const fallback = byCode.get(DEFAULT_TRANSLATION_TARGET);
  if (fallback === undefined) throw new Error('Default translation language is missing.');
  return fallback;
}
