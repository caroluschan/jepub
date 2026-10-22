import { useCallback, useMemo } from 'react';
import { useSettings } from '../../features/settings/SettingsProvider';
import {
  resolveUiLanguageSetting,
  type UiLanguageCode,
} from './languages';
import { translate, type TranslationKey } from './translations';

export type TranslateParams = Record<string, string | number>;
export type Translate = (source: TranslationKey, params?: TranslateParams) => string;

export interface I18n {
  t: Translate;
  language: UiLanguageCode;
}

export function useI18n(): I18n {
  const { settings, language } = useSettings();
  const resolved = language ?? resolveUiLanguageSetting(settings.uiLanguage);

  const t = useCallback<Translate>(
    (source, params) => translate(resolved, source, params),
    [resolved],
  );

  return useMemo(() => ({ t, language: resolved }), [resolved, t]);
}
