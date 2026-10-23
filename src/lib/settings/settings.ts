import type { Settings } from '../types';
import { isUiLanguageSetting, DEFAULT_UI_LANGUAGE } from '../i18n/languages';
import {
  DEFAULT_TRANSLATION_TARGET,
  isTranslationTarget,
} from '../translate/languages';

export const SETTINGS_KEY = 'jepub:settings:v1';

export const DEFAULT_SETTINGS: Settings = Object.freeze({
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
  translationTarget: DEFAULT_TRANSLATION_TARGET,
  uiLanguage: DEFAULT_UI_LANGUAGE,
});

export const MIN_FONT_SIZE = 14;
export const MAX_FONT_SIZE = 32;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function clampFontSize(value: number): number {
  return Math.min(MAX_FONT_SIZE, Math.max(MIN_FONT_SIZE, Math.round(value)));
}

function readStorage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

function parseSettings(raw: unknown): Settings {
  if (!isRecord(raw)) return { ...DEFAULT_SETTINGS };

  const theme = raw['theme'];
  const fontSize = raw['fontSize'];
  const orientation = raw['orientation'];
  const furigana = raw['furigana'];
  const furiganaScript = raw['furiganaScript'];
  const onlineTranslation = raw['onlineTranslation'];
  const llmConsent = raw['llmConsent'];
  const aiMode = raw['aiMode'];
  const aiProvider = raw['aiProvider'];
  const aiApiKey = raw['aiApiKey'];
  const aiModel = raw['aiModel'];
  const aiBaseUrl = raw['aiBaseUrl'];
  const translationTarget = raw['translationTarget'];
  const uiLanguage = raw['uiLanguage'];

  return {
    theme: theme === 'light' || theme === 'dark' ? theme : DEFAULT_SETTINGS.theme,
    fontSize:
      typeof fontSize === 'number' && Number.isFinite(fontSize)
        ? clampFontSize(fontSize)
        : DEFAULT_SETTINGS.fontSize,
    orientation:
      orientation === 'horizontal' || orientation === 'vertical'
        ? orientation
        : DEFAULT_SETTINGS.orientation,
    furigana: typeof furigana === 'boolean' ? furigana : DEFAULT_SETTINGS.furigana,
    furiganaScript:
      furiganaScript === 'katakana' || furiganaScript === 'hiragana' || furiganaScript === 'romaji'
        ? furiganaScript
        : DEFAULT_SETTINGS.furiganaScript,
    onlineTranslation:
      typeof onlineTranslation === 'boolean'
        ? onlineTranslation
        : DEFAULT_SETTINGS.onlineTranslation,
    llmConsent: typeof llmConsent === 'boolean' ? llmConsent : DEFAULT_SETTINGS.llmConsent,
    aiMode:
      aiMode === 'off' || aiMode === 'byot' || aiMode === 'local'
        ? aiMode
        : typeof llmConsent === 'boolean' && llmConsent
          ? 'local'
          : DEFAULT_SETTINGS.aiMode,
    aiProvider:
      aiProvider === 'openai' ||
      aiProvider === 'anthropic' ||
      aiProvider === 'google' ||
      aiProvider === 'openrouter' ||
      aiProvider === 'groq' ||
      aiProvider === 'mistral' ||
      aiProvider === 'deepseek' ||
      aiProvider === 'xai' ||
      aiProvider === 'together' ||
      aiProvider === 'cerebras' ||
      aiProvider === 'perplexity' ||
      aiProvider === 'fireworks' ||
      aiProvider === 'qwen' ||
      aiProvider === 'custom'
        ? aiProvider
        : DEFAULT_SETTINGS.aiProvider,
    aiApiKey: typeof aiApiKey === 'string' ? aiApiKey : '',
    aiModel: typeof aiModel === 'string' ? aiModel : '',
    aiBaseUrl: typeof aiBaseUrl === 'string' ? aiBaseUrl : '',
    translationTarget: isTranslationTarget(translationTarget)
      ? translationTarget
      : DEFAULT_TRANSLATION_TARGET,
    uiLanguage: isUiLanguageSetting(uiLanguage)
      ? uiLanguage
      : DEFAULT_SETTINGS.uiLanguage,
  };
}

export function loadSettings(): Settings {
  const storage = readStorage();
  if (storage === null) return { ...DEFAULT_SETTINGS };

  try {
    const raw = storage.getItem(SETTINGS_KEY);
    if (raw === null) return { ...DEFAULT_SETTINGS };
    const parsed: unknown = JSON.parse(raw);
    return parseSettings(parsed);
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

function applyPatch(current: Settings, patch: Partial<Settings>): Settings {
  const next: Settings = { ...current };

  if (patch.theme === 'light' || patch.theme === 'dark') next.theme = patch.theme;
  if (patch.orientation === 'horizontal' || patch.orientation === 'vertical') {
    next.orientation = patch.orientation;
  }
  if (typeof patch.fontSize === 'number' && Number.isFinite(patch.fontSize)) {
    next.fontSize = clampFontSize(patch.fontSize);
  }
  if (typeof patch.furigana === 'boolean') next.furigana = patch.furigana;
  if (patch.furiganaScript === 'katakana' || patch.furiganaScript === 'hiragana' || patch.furiganaScript === 'romaji') {
    next.furiganaScript = patch.furiganaScript;
  }
  if (typeof patch.onlineTranslation === 'boolean') {
    next.onlineTranslation = patch.onlineTranslation;
  }
  if (typeof patch.llmConsent === 'boolean') {
    next.llmConsent = patch.llmConsent;
  }
  if (patch.aiMode === 'off' || patch.aiMode === 'byot' || patch.aiMode === 'local') {
    next.aiMode = patch.aiMode;
  }
  if (
    patch.aiProvider === 'openai' ||
    patch.aiProvider === 'anthropic' ||
    patch.aiProvider === 'google' ||
    patch.aiProvider === 'openrouter' ||
    patch.aiProvider === 'groq' ||
    patch.aiProvider === 'mistral' ||
    patch.aiProvider === 'deepseek' ||
    patch.aiProvider === 'xai' ||
    patch.aiProvider === 'together' ||
    patch.aiProvider === 'cerebras' ||
    patch.aiProvider === 'perplexity' ||
    patch.aiProvider === 'fireworks' ||
    patch.aiProvider === 'qwen' ||
    patch.aiProvider === 'custom'
  ) {
    next.aiProvider = patch.aiProvider;
  }
  if (typeof patch.aiApiKey === 'string') next.aiApiKey = patch.aiApiKey;
  if (typeof patch.aiModel === 'string') next.aiModel = patch.aiModel;
  if (typeof patch.aiBaseUrl === 'string') next.aiBaseUrl = patch.aiBaseUrl;
  if (isTranslationTarget(patch.translationTarget)) {
    next.translationTarget = patch.translationTarget;
  }
  if (isUiLanguageSetting(patch.uiLanguage)) {
    next.uiLanguage = patch.uiLanguage;
  }

  return next;
}

export function saveSettings(patch: Partial<Settings>): Settings {
  const next = applyPatch(loadSettings(), patch);
  const storage = readStorage();
  if (storage !== null) {
    try {
      storage.setItem(SETTINGS_KEY, JSON.stringify(next));
    } catch (error) {
      // Storage can be full or blocked in private mode; keep the in-memory result.
      console.warn('JEPUB: settings could not be persisted.', error);
    }
  }
  return next;
}
