import { useCallback, useEffect, useRef, useState } from 'react';
import { Icon } from '../../components/Icon';
import { Modal } from '../../components/Modal';
import { Spinner } from '../../components/Spinner';
import { useToast } from '../../components/Toast';
import {
  getFuriganaStatus,
  onFuriganaStatusChange,
  preload,
  type FuriganaStatus,
} from '../../lib/furigana/service';
import { UI_LANGUAGES } from '../../lib/i18n/languages';
import { TRANSLATION_LANGUAGES } from '../../lib/translate/languages';
import { MAX_FONT_SIZE, MIN_FONT_SIZE } from '../../lib/settings/settings';
import { useI18n } from '../../lib/i18n/useI18n';
import { useSettings } from './SettingsProvider';
import { AiSettingsSection } from '../ai/AiSettingsSection';

const VERSION = '0.1.0';
const GITHUB_URL = 'https://github.com/caroluschan/jepub';

function ToggleSwitch({
  checked,
  label,
  onChange,
}: {
  checked: boolean;
  label: string;
  onChange: (next: boolean) => void;
}) {
  return (
    <button
      type="button"
      className="switch"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
    >
      <span className="switch__track" aria-hidden="true" />
    </button>
  );
}

interface StorageState {
  used: number;
  quota: number;
  persisted: boolean | null;
}

const KILOBYTE = 1024;
const MEGABYTE = 1024 * KILOBYTE;
const GIGABYTE = 1024 * MEGABYTE;

function formatSize(bytes: number): string {
  if (bytes >= GIGABYTE) return `${(bytes / GIGABYTE).toFixed(1)} GB`;
  if (bytes >= MEGABYTE) {
    const mb = bytes / MEGABYTE;
    return `${mb < 10 ? mb.toFixed(1) : String(Math.round(mb))} MB`;
  }
  return `${Math.max(1, Math.round(bytes / KILOBYTE))} KB`;
}

function useStorageState(): StorageState | null {
  const [state, setState] = useState<StorageState | null>(null);

  useEffect(() => {
    if (typeof navigator === 'undefined' || navigator.storage === undefined) return;
    let active = true;

    const load = async (): Promise<void> => {
      try {
        const estimate =
          typeof navigator.storage.estimate === 'function'
            ? await navigator.storage.estimate()
            : {};
        const persisted =
          typeof navigator.storage.persisted === 'function'
            ? await navigator.storage.persisted()
            : null;
        if (!active) return;
        setState({
          used: estimate.usage ?? 0,
          quota: estimate.quota ?? 0,
          persisted,
        });
      } catch {
        if (active) setState(null);
      }
    };

    void load();
    return () => {
      active = false;
    };
  }, []);

  return state;
}

function FuriganaStatusLine({ status }: { status: FuriganaStatus }) {
  const { t } = useI18n();
  if (status === 'error') {
    return (
      <div className="status-line" data-testid="furigana-status">
        <span className="status-line__dot status-line__dot--error" aria-hidden="true" />
        <span>{t("Furigana couldn't load.")}</span>
      </div>
    );
  }
  if (status === 'loading') {
    return (
      <div className="status-line" data-testid="furigana-status">
        <Spinner />
        <span>{t('Preparing furigana…')}</span>
      </div>
    );
  }
  if (status === 'ready') {
    return (
      <div className="status-line" data-testid="furigana-status">
        <span className="status-line__dot" aria-hidden="true" />
        <span>{t('Furigana ready.')}</span>
      </div>
    );
  }
  return (
    <div className="status-line" data-testid="furigana-status">
      <span className="status-line__dot" aria-hidden="true" />
      <span>{t('Readings load as you reach each page.')}</span>
    </div>
  );
}

export function SettingsPage() {
  const { settings, updateSettings, closeSettings, settingsTrigger } = useSettings();
  const { t } = useI18n();
  const { push } = useToast();
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const [status, setStatus] = useState<FuriganaStatus>(() => getFuriganaStatus());
  const storage = useStorageState();

  useEffect(() => onFuriganaStatusChange(setStatus), []);

  const setFontSize = (value: number): void => {
    updateSettings({ fontSize: Math.min(MAX_FONT_SIZE, Math.max(MIN_FONT_SIZE, value)) });
  };

  const retryFurigana = useCallback(() => {
    void preload()
      .then(() => {
        push(t('Furigana ready.'), { tone: 'success' });
      })
      .catch(() => {
        push(t("Furigana couldn't load. Try again."), { tone: 'error' });
      });
  }, [push, t]);

  return (
    <Modal
      onClose={closeSettings}
      variant="full"
      ariaLabel={t('Settings')}
      restoreFocus={settingsTrigger}
      initialFocusRef={closeRef}
      panelTestId="settings-page"
    >
      <div className="settings-page">
        <header className="settings-page__header">
          <div className="settings-page__heading">
            <span className="label">JEPUB</span>
            <h2 className="settings-page__title">{t('Settings')}</h2>
          </div>
          <button
            ref={closeRef}
            type="button"
            className="icon-button"
            aria-label={t('Close settings')}
            data-testid="settings-close"
            onClick={closeSettings}
          >
            <Icon name="close" />
          </button>
        </header>

        <div className="settings-page__body">
          <section className="settings-group" aria-labelledby="settings-appearance">
            <div className="settings-group__head">
              <h3 className="settings-group__title" id="settings-appearance">
                {t('Appearance')}
              </h3>
            </div>

            <div className="settings-section">
              <span className="label">{t('Theme')}</span>
              <div className="segmented" role="group" aria-label={t('Theme')}>
                <button
                  type="button"
                  className="segmented__option"
                  aria-pressed={settings.theme === 'light'}
                  onClick={() => updateSettings({ theme: 'light' })}
                >
                  <Icon name="sun" size={16} /> {t('Light')}
                </button>
                <button
                  type="button"
                  className="segmented__option"
                  aria-pressed={settings.theme === 'dark'}
                  onClick={() => updateSettings({ theme: 'dark' })}
                >
                  <Icon name="moon" size={16} /> {t('Dark')}
                </button>
              </div>
            </div>

            <div className="settings-section">
              <div className="settings-row__copy">
                <label className="settings-row__title" htmlFor="ui-language">
                  {t('UI language')}
                </label>
                <span className="settings-row__note">{t('Choose the language used across JEPUB.')}</span>
              </div>
              <select
                id="ui-language"
                className="settings-select"
                data-testid="ui-language"
                value={settings.uiLanguage}
                onChange={(event) => updateSettings({ uiLanguage: event.currentTarget.value })}
              >
                <option value="system">{t('System')}</option>
                {UI_LANGUAGES.map((language) => (
                  <option value={language.code} key={language.code}>
                    {language.label}
                  </option>
                ))}
              </select>
            </div>
          </section>

          <section className="settings-group" aria-labelledby="settings-reading">
            <div className="settings-group__head">
              <h3 className="settings-group__title" id="settings-reading">
                {t('Reading')}
              </h3>
            </div>

            <div className="settings-section" aria-label={t('Text size')}>
              <div className="settings-section__head">
                <span className="label">{t('Text size')}</span>
                <span className="settings-value">{settings.fontSize}</span>
              </div>
              <div className="settings-row">
                <div className="stepper">
                  <button
                    type="button"
                    aria-label={t('Smaller text')}
                    disabled={settings.fontSize <= MIN_FONT_SIZE}
                    onClick={() => setFontSize(settings.fontSize - 1)}
                  >
                    −
                  </button>
                  <output className="stepper__value" aria-live="polite">
                    {settings.fontSize}
                  </output>
                  <button
                    type="button"
                    aria-label={t('Larger text')}
                    disabled={settings.fontSize >= MAX_FONT_SIZE}
                    onClick={() => setFontSize(settings.fontSize + 1)}
                  >
                    +
                  </button>
                </div>
              </div>
              <input
                className="range"
                type="range"
                min={MIN_FONT_SIZE}
                max={MAX_FONT_SIZE}
                step={1}
                value={settings.fontSize}
                aria-label={t('Font size')}
                onChange={(event) => setFontSize(Number(event.currentTarget.value))}
              />
            </div>

            <div className="settings-section" aria-label={t('Orientation')}>
              <span className="label">{t('Orientation')}</span>
              <div className="segmented" role="group" aria-label={t('Orientation')}>
                <button
                  type="button"
                  className="segmented__option"
                  aria-pressed={settings.orientation === 'horizontal'}
                  aria-label={t('横書き Horizontal')}
                  onClick={() => updateSettings({ orientation: 'horizontal' })}
                >
                  {t('横書き Horizontal')}
                </button>
                <button
                  type="button"
                  className="segmented__option"
                  aria-pressed={settings.orientation === 'vertical'}
                  aria-label={t('縦書き Vertical')}
                  onClick={() => updateSettings({ orientation: 'vertical' })}
                >
                  {t('縦書き Vertical')}
                </button>
              </div>
            </div>

            <div className="settings-section" aria-label={t('Furigana')}>
              <div className="settings-row">
                <div className="settings-row__copy">
                  <span className="settings-row__title">{t('Furigana')}</span>
                  <span className="settings-row__note">{t('Readings above kanji, added as you read.')}</span>
                </div>
                <ToggleSwitch
                  checked={settings.furigana}
                  label={t('Furigana')}
                  onChange={(next) => updateSettings({ furigana: next })}
                />
              </div>
              <div className="settings-row__copy">
                <span className="settings-row__title">{t('Readings')}</span>
                <span className="settings-row__note">
                  {t('Kana shown above kanji. Katakana is the default.')}
                </span>
              </div>
              <div className="segmented" role="group" aria-label={t('Readings')}>
                <button
                  type="button"
                  className="segmented__option"
                  data-testid="readings-katakana"
                  aria-pressed={settings.furiganaScript === 'katakana'}
                  onClick={() => updateSettings({ furiganaScript: 'katakana' })}
                >
                  {t('カタカナ Katakana')}
                </button>
                <button
                  type="button"
                  className="segmented__option"
                  data-testid="readings-hiragana"
                  aria-pressed={settings.furiganaScript === 'hiragana'}
                  onClick={() => updateSettings({ furiganaScript: 'hiragana' })}
                >
                  {t('ひらがな Hiragana')}
                </button>
              </div>
              <FuriganaStatusLine status={status} />
              {status === 'error' ? (
                <button type="button" className="button--text settings-retry" onClick={retryFurigana}>
                  {t('Retry')}
                </button>
              ) : null}
            </div>
          </section>

          <section className="settings-group" aria-labelledby="settings-translation">
            <div className="settings-group__head">
              <h3 className="settings-group__title" id="settings-translation">
                {t('Translation')}
              </h3>
            </div>

            <div className="settings-section">
              <div className="settings-row__copy">
                <label className="settings-row__title" htmlFor="settings-translation-language">
                  {t('Translate to')}
                </label>
                <span className="settings-row__note">
                  {t('On-device translation is always tried first. Books stay on your device unless you enable this.')}
                </span>
              </div>
              <select
                id="settings-translation-language"
                className="settings-select"
                data-testid="translation-language"
                value={settings.translationTarget}
                onChange={(event) =>
                  updateSettings({ translationTarget: event.currentTarget.value })
                }
              >
                {TRANSLATION_LANGUAGES.map((language) => (
                  <option value={language.code} key={language.code}>
                    {language.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="settings-section">
              <div className="settings-row">
                <div className="settings-row__copy">
                  <span className="settings-row__title">{t('Online translation')}</span>
                  <span className="settings-row__note">
                    {t('Off by default. When enabled, sentences that the on-device translator cannot handle are sent to MyMemory, a third-party service.')}
                  </span>
                </div>
                <ToggleSwitch
                  checked={settings.onlineTranslation}
                  label={t('Online translation')}
                  onChange={(next) => updateSettings({ onlineTranslation: next })}
                />
              </div>
            </div>
          </section>

          <AiSettingsSection />

          <section className="settings-group" aria-labelledby="settings-storage">
            <div className="settings-group__head">
              <h3 className="settings-group__title" id="settings-storage">
                {t('Storage')}
              </h3>
            </div>
            <div className="settings-section">
              <p className="settings-row__title">{t('Books are stored only on this device.')}</p>
              <div aria-live="polite" data-testid="settings-storage">
                {storage === null ? (
                  <p className="settings-row__note">{t('Checking storage…')}</p>
                ) : (
                  <>
                    {storage.quota > 0 ? (
                      <p className="settings-row__note">
                        {t('Using {size}. {quota} available.', {
                          size: formatSize(storage.used),
                          quota: formatSize(storage.quota),
                        })}
                      </p>
                    ) : null}
                    <p className="settings-row__note">
                      {storage.persisted === true
                        ? t('Storage is protected from automatic cleanup.')
                        : t('Storage is not yet protected. It may be cleared if the device runs low.')}
                    </p>
                  </>
                )}
              </div>
            </div>
          </section>

          <section className="settings-group" aria-labelledby="settings-about">
            <div className="settings-group__head">
              <h3 className="settings-group__title" id="settings-about">
                {t('About')}
              </h3>
            </div>
            <div className="settings-section">
              <p className="settings-row__title">{t('Version {version}', { version: VERSION })}</p>
              <a
                className="button--text settings-link"
                href={GITHUB_URL}
                target="_blank"
                rel="noreferrer"
              >
                {t('View source on GitHub')} ↗
              </a>
            </div>
          </section>
        </div>
      </div>
    </Modal>
  );
}
