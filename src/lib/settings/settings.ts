import type { Settings } from '../types';

export const SETTINGS_KEY = 'jepub:settings:v1';

export const DEFAULT_SETTINGS: Settings = Object.freeze({
  theme: 'light',
  fontSize: 19,
  orientation: 'horizontal',
  furigana: true,
  furiganaScript: 'katakana',
  onlineTranslation: false,
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
      furiganaScript === 'katakana' || furiganaScript === 'hiragana'
        ? furiganaScript
        : DEFAULT_SETTINGS.furiganaScript,
    onlineTranslation:
      typeof onlineTranslation === 'boolean'
        ? onlineTranslation
        : DEFAULT_SETTINGS.onlineTranslation,
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
  if (patch.furiganaScript === 'katakana' || patch.furiganaScript === 'hiragana') {
    next.furiganaScript = patch.furiganaScript;
  }
  if (typeof patch.onlineTranslation === 'boolean') {
    next.onlineTranslation = patch.onlineTranslation;
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
