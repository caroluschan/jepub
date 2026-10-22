import { useCallback, useEffect, useRef, useState } from 'react';
import { Icon } from '../../components/Icon';
import { Modal } from '../../components/Modal';
import { Spinner } from '../../components/Spinner';
import { useToast } from '../../components/Toast';
import {
  getJapaneseVoices,
  isSpeechSupported,
  speakJapanese,
  stopSpeaking,
} from '../../lib/speech/speech';
import { useI18n } from '../../lib/i18n/useI18n';
import { TRANSLATION_LANGUAGES } from '../../lib/translate/languages';
import type { TranslationProvider } from '../../lib/types';
import { useSettings } from '../settings/SettingsProvider';
import { useSentenceDetails, type TranslationView } from './useSentenceDetails';

interface SentenceSheetProps {
  sentence: string;
  onClose: () => void;
  restoreFocus?: HTMLElement | null;
}

function providerLabel(
  provider: TranslationProvider,
  cached: boolean,
  t: ReturnType<typeof useI18n>['t'],
): string {
  const base = provider === 'on-device' ? t('On-device') : t('Online · MyMemory');
  return cached ? t('{base} · Cached', { base }) : base;
}

function LoadingDots() {
  return (
    <span className="loading-dots" aria-hidden="true">
      <span />
      <span />
      <span />
    </span>
  );
}

function TranslationBlock({
  translation,
  onRetry,
  onEnableOnline,
}: {
  translation: TranslationView;
  onRetry: () => void;
  onEnableOnline: () => void;
}) {
  const { t } = useI18n();
  if (translation.status === 'loading') {
    const percent =
      translation.progress === null ? null : Math.round(translation.progress * 100);
    return (
      <div className="sentence-sheet__translation-loading" data-testid="translation-loading">
        <p>
          {percent === null ? (
            <>
              {t('Translating')} <LoadingDots />
            </>
          ) : (
            <>{t('Preparing on-device translation… {percent}%', { percent })}</>
          )}
        </p>
        {percent === null ? null : (
          <div className="translation-progress" aria-hidden="true">
            <span style={{ width: `${percent}%` }} />
          </div>
        )}
      </div>
    );
  }

  if (translation.status === 'error') {
    if (translation.kind === 'online-disabled') {
      return (
        <div className="sentence-sheet__error" data-testid="translation-error">
          <p>{t('Online translation is turned off. On-device translation is unavailable.')}</p>
          <button type="button" className="button button--quiet" onClick={onEnableOnline}>
            {t('Enable online translation (sends this sentence to MyMemory)')}
          </button>
        </div>
      );
    }
    if (translation.kind === 'offline') {
      return (
        <div className="sentence-sheet__error" data-testid="translation-error">
          <p>{t("You're offline. Cached translations are available.")}</p>
          <button type="button" className="button button--quiet" onClick={onRetry}>
            {t('Retry')}
          </button>
        </div>
      );
    }
    if (translation.kind === 'too-long') {
      return (
        <div className="sentence-sheet__error" data-testid="translation-error">
          <p>{t('This sentence is too long to translate online.')}</p>
        </div>
      );
    }
    return (
      <div className="sentence-sheet__error" data-testid="translation-error">
        <p>{t('Translation failed.')}</p>
        <button type="button" className="button button--quiet" onClick={onRetry}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <p className="sentence-sheet__translation" dir="auto" data-testid="sentence-translation">
      {translation.text}
    </p>
  );
}

export function SentenceSheet({ sentence, onClose, restoreFocus }: SentenceSheetProps) {
  const { settings, updateSettings } = useSettings();
  const { push } = useToast();
  const { t } = useI18n();
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const mountedRef = useRef(true);
  const [playing, setPlaying] = useState(false);
  const {
    translation,
    rubyHtml,
    romaji,
    romajiState,
    retryTranslation,
    enableOnline,
    retryRomaji,
  } = useSentenceDetails(sentence);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      stopSpeaking();
    };
  }, []);

  const close = useCallback(() => {
    stopSpeaking();
    setPlaying(false);
    onClose();
  }, [onClose]);

  const togglePlay = (): void => {
    if (playing) {
      stopSpeaking();
      setPlaying(false);
      return;
    }
    if (!isSpeechSupported()) {
      push(t('Speech is not available on this device.'), { tone: 'error' });
      return;
    }
    const voices = speechSynthesis.getVoices();
    if (voices.length > 0 && getJapaneseVoices().length === 0) {
      push(t('No Japanese voice is available on this device.'), { tone: 'error' });
      return;
    }
    setPlaying(true);
    void speakJapanese(sentence)
      .catch(() => {
        if (mountedRef.current) push(t('This sentence could not be played.'), { tone: 'error' });
      })
      .finally(() => {
        if (mountedRef.current) setPlaying(false);
      });
  };

  const copySentence = (): void => {
    if (navigator.clipboard === undefined) {
      push(t('Could not copy this sentence.'), { tone: 'error' });
      return;
    }
    void navigator.clipboard
      .writeText(sentence)
      .then(() => push(t('Copied.')))
      .catch(() => push(t('Could not copy this sentence.'), { tone: 'error' }));
  };

  const provider = translation.status === 'ready' ? translation.provider : null;

  return (
    <Modal
      onClose={close}
      variant="center"
      className="sentence-sheet"
      ariaLabel={t('Sentence details')}
      restoreFocus={restoreFocus}
      initialFocusRef={closeRef}
      backdropTestId="sentence-backdrop"
      panelTestId="sentence-sheet"
    >
      <div className="sentence-sheet__grabber" aria-hidden="true" />
      <div className="sentence-sheet__head">
        <span className="label">{t('Sentence')}</span>
        <button
          ref={closeRef}
          type="button"
          className="icon-button"
          aria-label={t('Close sentence details')}
          data-testid="sentence-close"
          onClick={close}
        >
          <Icon name="close" />
        </button>
      </div>

      <div className="sentence-sheet__body">
        <p className="sentence-sheet__jp" lang="ja" data-testid="sentence-japanese">
          {rubyHtml === null ? (
            sentence
          ) : (
            <span dangerouslySetInnerHTML={{ __html: rubyHtml }} />
          )}
        </p>

        <div className="sentence-sheet__line">
          <span className="label">{t('Romaji')}</span>
          <p className="sentence-sheet__romaji" data-testid="sentence-romaji">
            {romajiState === 'ready' ? romaji : romajiState === 'error' ? '—' : '…'}
          </p>
          {romajiState === 'error' ? (
            <button type="button" className="button--text" onClick={retryRomaji}>
              {t('Retry romaji')}
            </button>
          ) : null}
        </div>

        <div className="sentence-sheet__rule" aria-hidden="true" />

        <div className="sentence-sheet__line">
          <div className="sentence-sheet__translation-head">
            <label className="label" htmlFor="translation-language">
              {t('Translate to')}
            </label>
            <select
              id="translation-language"
              className="translation-language-select"
              value={settings.translationTarget}
              data-testid="translation-language"
              onChange={(event) => updateSettings({ translationTarget: event.currentTarget.value })}
            >
              {TRANSLATION_LANGUAGES.map((language) => (
                <option value={language.code} key={language.code}>
                  {language.label}
                </option>
              ))}
            </select>
            {translation.status === 'ready' ? (
              <span className="provider-chip" data-testid="translation-provider">
                {providerLabel(translation.provider, translation.cached, t)}
              </span>
            ) : null}
          </div>
          <div aria-live="polite">
            <TranslationBlock
              translation={translation}
              onRetry={retryTranslation}
              onEnableOnline={enableOnline}
            />
          </div>
        </div>
      </div>

      <div className="sentence-sheet__foot">
        <div className="sentence-sheet__actions">
          <button
            type="button"
            className="play-button"
            aria-pressed={playing}
            aria-label={playing ? t('Stop reading this sentence') : t('Listen to this sentence')}
            data-testid="sentence-play"
            onClick={togglePlay}
          >
            <Icon name={playing ? 'stop' : 'play'} size={22} />
            <span>{playing ? t('Stop') : t('Listen')}</span>
          </button>
          <button
            type="button"
            className="button button--quiet copy-button"
            data-testid="sentence-copy"
            onClick={copySentence}
          >
            {t('Copy sentence')}
          </button>
        </div>
        {provider === 'on-device' ? (
          <p className="sentence-sheet__note">{t('Stays on this device.')}</p>
        ) : provider === 'mymemory' ? (
          <p className="sentence-sheet__note">{t('Sent to MyMemory.')}</p>
        ) : translation.status === 'loading' ? (
          <p className="sentence-sheet__note">
            <Spinner /> {t('Trying on-device translation first.')}
          </p>
        ) : null}
      </div>
    </Modal>
  );
}
