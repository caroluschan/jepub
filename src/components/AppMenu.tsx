import { useRef, useState } from 'react';
import { Icon } from './Icon';
import { Modal } from './Modal';
import { useI18n } from '../lib/i18n/useI18n';
import { navigateToChatRoom, navigateToMyPedia, navigateToQuiz } from '../lib/router';
import { useSettings } from '../features/settings/SettingsProvider';
import { useLlm } from '../features/ai/LlmProvider';

interface AppMenuProps {
  onAddBook?: () => void;
}

export function AppMenu({ onAddBook }: AppMenuProps) {
  const { t } = useI18n();
  const { settings, updateSettings, openSettings } = useSettings();
  const llm = useLlm();
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);

  const close = (): void => setOpen(false);

  const openSettingsPage = (): void => {
    close();
    openSettings(buttonRef.current);
  };

  const addBook = (): void => {
    close();
    onAddBook?.();
  };

  const openChatRoom = (): void => {
    close();
    navigateToChatRoom();
  };

  const openMyPedia = (): void => {
    close();
    navigateToMyPedia();
  };

  const openQuiz = (): void => {
    close();
    navigateToQuiz();
  };

  const toggleTheme = (): void => {
    updateSettings({ theme: settings.theme === 'light' ? 'dark' : 'light' });
    close();
  };

  const nextTheme = settings.theme === 'light' ? t('Dark') : t('Light');

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className="icon-button app-menu-button"
        aria-label={t('Open menu')}
        aria-expanded={open}
        data-testid="app-menu-button"
        onClick={() => setOpen(true)}
      >
        <Icon name="menu" />
      </button>

      {open ? (
        <Modal
          onClose={close}
          variant="drawer"
          ariaLabel={t('Menu')}
          className="app-menu"
          panelTestId="app-menu"
          initialFocusRef={closeRef}
          restoreFocus={buttonRef.current}
        >
          <div className="app-menu__head">
            <span className="label">{t('Menu')}</span>
            <button
              ref={closeRef}
              type="button"
              className="icon-button"
              aria-label={t('Close menu')}
              onClick={close}
            >
              <Icon name="close" />
            </button>
          </div>
          <nav className="app-menu__list" aria-label={t('Menu')}>
            <button type="button" className="app-menu__item" data-testid="menu-chat" onClick={openChatRoom}>
              <Icon name="chat" />
              <span>{t('AI Chat')}</span>
            </button>
            <button type="button" className="app-menu__item" data-testid="menu-mypedia" onClick={openMyPedia}>
              <Icon name="book" />
              <span>{t('MyPedia')}</span>
            </button>
            {llm.canUse ? (
              <button type="button" className="app-menu__item" data-testid="menu-quiz" onClick={openQuiz}>
                <Icon name="quiz" />
                <span>{t('Quiz')}</span>
              </button>
            ) : null}
            <button type="button" className="app-menu__item" data-testid="menu-settings" onClick={openSettingsPage}>
              <Icon name="gear" />
              <span>{t('Settings')}</span>
            </button>
            {onAddBook === undefined ? null : (
              <button type="button" className="app-menu__item" data-testid="menu-add-book" onClick={addBook}>
                <Icon name="plus" />
                <span>{t('Add book')}</span>
              </button>
            )}
            <button type="button" className="app-menu__item" data-testid="menu-theme" onClick={toggleTheme}>
              <Icon name={settings.theme === 'light' ? 'moon' : 'sun'} />
              <span>{nextTheme}</span>
            </button>
          </nav>
        </Modal>
      ) : null}
    </>
  );
}
