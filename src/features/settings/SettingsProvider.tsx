import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  resolveUiLanguageSetting,
  type UiLanguageCode,
} from '../../lib/i18n/languages';
import { loadSettings, saveSettings } from '../../lib/settings/settings';
import type { Settings } from '../../lib/types';

interface SettingsContextValue {
  settings: Settings;
  updateSettings: (patch: Partial<Settings>) => void;
  language: UiLanguageCode;
  settingsOpen: boolean;
  settingsTrigger: HTMLElement | null;
  settingsSection: string | null;
  openSettings: (trigger?: HTMLElement | null, section?: string | null) => void;
  closeSettings: () => void;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

function applyThemeMeta(theme: Settings['theme']): void {
  document.documentElement.dataset['theme'] = theme;
  let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (meta === null) {
    meta = document.createElement('meta');
    meta.name = 'theme-color';
    document.head.appendChild(meta);
  }
  meta.content = theme === 'light' ? '#f4f1e8' : '#0d0d0c';
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(() => loadSettings());
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsTrigger, setSettingsTrigger] = useState<HTMLElement | null>(null);
  const [settingsSection, setSettingsSection] = useState<string | null>(null);
  const language = resolveUiLanguageSetting(settings.uiLanguage);

  useEffect(() => {
    applyThemeMeta(settings.theme);
  }, [settings.theme]);

  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = 'ltr';
  }, [language]);

  const updateSettings = useCallback((patch: Partial<Settings>) => {
    const next = saveSettings(patch);
    setSettings(next);
  }, []);

  const openSettings = useCallback((trigger?: HTMLElement | null, section?: string | null) => {
    const active =
      trigger ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
    setSettingsTrigger(active);
    setSettingsSection(section ?? null);
    setSettingsOpen(true);
  }, []);

  const closeSettings = useCallback(() => {
    setSettingsOpen(false);
    setSettingsSection(null);
  }, []);

  const value = useMemo<SettingsContextValue>(
    () => ({
      settings,
      updateSettings,
      language,
      settingsOpen,
      settingsTrigger,
      settingsSection,
      openSettings,
      closeSettings,
    }),
    [closeSettings, language, openSettings, settings, settingsOpen, settingsSection, settingsTrigger, updateSettings],
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsContextValue {
  const context = useContext(SettingsContext);
  if (context === null) {
    throw new Error('useSettings must be used inside a SettingsProvider.');
  }
  return context;
}
