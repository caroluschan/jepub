import { useEffect, useRef, useState } from 'react';
import { Modal } from '../../components/Modal';
import { Icon } from '../../components/Icon';
import { Spinner } from '../../components/Spinner';
import {
  getFuriganaStatus,
  onFuriganaStatusChange,
  type FuriganaStatus,
} from '../../lib/furigana/service';
import { MAX_FONT_SIZE, MIN_FONT_SIZE } from '../../lib/settings/settings';
import { useSettings } from './SettingsProvider';

interface SettingsSheetProps {
  onClose: () => void;
  restoreFocus?: HTMLElement | null;
  onRetryFurigana: () => void;
}

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

function FuriganaStatusLine({ status, onRetry }: { status: FuriganaStatus; onRetry: () => void }) {
  if (status === 'error') {
    return (
      <div className="status-line">
        <span className="status-line__dot status-line__dot--error" aria-hidden="true" />
        <span>Furigana couldn&apos;t load.</span>
        <button type="button" className="button--text" onClick={onRetry}>
          Retry
        </button>
      </div>
    );
  }
  if (status === 'loading') {
    return (
      <div className="status-line">
        <Spinner />
        <span>Preparing furigana…</span>
      </div>
    );
  }
  if (status === 'ready') {
    return (
      <div className="status-line">
        <span className="status-line__dot" aria-hidden="true" />
        <span>Furigana ready.</span>
      </div>
    );
  }
  return (
    <div className="status-line">
      <span className="status-line__dot" aria-hidden="true" />
      <span>Readings load as you reach each page.</span>
    </div>
  );
}

export function SettingsSheet({ onClose, restoreFocus, onRetryFurigana }: SettingsSheetProps) {
  const { settings, updateSettings } = useSettings();
  const [status, setStatus] = useState<FuriganaStatus>(() => getFuriganaStatus());
  const closeRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => onFuriganaStatusChange(setStatus), []);

  const setFontSize = (value: number): void => {
    updateSettings({ fontSize: Math.min(MAX_FONT_SIZE, Math.max(MIN_FONT_SIZE, value)) });
  };

  return (
    <Modal
      onClose={onClose}
      variant="drawer"
      className="settings-sheet-panel"
      ariaLabel="Reader settings"
      restoreFocus={restoreFocus}
      initialFocusRef={closeRef}
      panelTestId="settings-sheet"
    >
      <div className="settings-sheet">
        <div className="modal-header">
          <div>
            <span className="label">Reading</span>
            <h2 className="modal-title">Settings</h2>
          </div>
          <button
            ref={closeRef}
            type="button"
            className="icon-button"
            aria-label="Close settings"
            data-testid="settings-close"
            onClick={onClose}
          >
            <Icon name="close" />
          </button>
        </div>

        <section className="settings-section" aria-label="Text">
          <div className="settings-section__head">
            <span className="label">Text size</span>
            <span className="settings-value">{settings.fontSize}</span>
          </div>
          <div className="settings-row">
            <div className="stepper">
              <button
                type="button"
                aria-label="Smaller text"
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
                aria-label="Larger text"
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
            aria-label="Font size"
            onChange={(event) => setFontSize(Number(event.currentTarget.value))}
          />
        </section>

        <section className="settings-section" aria-label="Orientation">
          <span className="label">Orientation</span>
          <div className="segmented" role="group" aria-label="Orientation">
            <button
              type="button"
              className="segmented__option"
              aria-pressed={settings.orientation === 'horizontal'}
              aria-label="横書き Horizontal"
              onClick={() => updateSettings({ orientation: 'horizontal' })}
            >
              横書き
            </button>
            <button
              type="button"
              className="segmented__option"
              aria-pressed={settings.orientation === 'vertical'}
              aria-label="縦書き Vertical"
              onClick={() => updateSettings({ orientation: 'vertical' })}
            >
              縦書き
            </button>
          </div>
        </section>

        <section className="settings-section" aria-label="Furigana">
          <div className="settings-row">
            <div className="settings-row__copy">
              <span className="settings-row__title">Furigana</span>
              <span className="settings-row__note">Readings above kanji, added as you read.</span>
            </div>
            <ToggleSwitch
              checked={settings.furigana}
              label="Furigana"
              onChange={(next) => updateSettings({ furigana: next })}
            />
          </div>
          <div className="settings-row__copy">
            <span className="settings-row__title">Readings</span>
            <span className="settings-row__note">
              Kana shown above kanji. Katakana is the default.
            </span>
          </div>
          <div className="segmented" role="group" aria-label="Readings">
            <button
              type="button"
              className="segmented__option"
              data-testid="readings-katakana"
              aria-pressed={settings.furiganaScript === 'katakana'}
              onClick={() => updateSettings({ furiganaScript: 'katakana' })}
            >
              カタカナ Katakana
            </button>
            <button
              type="button"
              className="segmented__option"
              data-testid="readings-hiragana"
              aria-pressed={settings.furiganaScript === 'hiragana'}
              onClick={() => updateSettings({ furiganaScript: 'hiragana' })}
            >
              ひらがな Hiragana
            </button>
          </div>
          <FuriganaStatusLine status={status} onRetry={onRetryFurigana} />
        </section>

        <section className="settings-section" aria-label="Translation">
          <div className="settings-row">
            <div className="settings-row__copy">
              <span className="settings-row__title">Online translation</span>
              <span className="settings-row__note">
                Off by default. When enabled, sentences that the on-device translator cannot
                handle are sent to MyMemory, a third-party service.
              </span>
            </div>
            <ToggleSwitch
              checked={settings.onlineTranslation}
              label="Online translation"
              onChange={(next) => updateSettings({ onlineTranslation: next })}
            />
          </div>
          <p className="settings-row__note">
            On-device translation is always tried first. Books stay on your device unless you
            enable this.
          </p>
        </section>

        <section className="settings-section" aria-label="Theme">
          <span className="label">Theme</span>
          <div className="segmented" role="group" aria-label="Theme">
            <button
              type="button"
              className="segmented__option"
              aria-pressed={settings.theme === 'light'}
              onClick={() => updateSettings({ theme: 'light' })}
            >
              <Icon name="sun" size={16} /> Light
            </button>
            <button
              type="button"
              className="segmented__option"
              aria-pressed={settings.theme === 'dark'}
              onClick={() => updateSettings({ theme: 'dark' })}
            >
              <Icon name="moon" size={16} /> Dark
            </button>
          </div>
        </section>
      </div>
    </Modal>
  );
}
