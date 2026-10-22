import { Icon } from './Icon';
import { useSettings } from '../features/settings/SettingsProvider';
import { useI18n } from '../lib/i18n/useI18n';

interface ThemeToggleProps {
  className?: string;
}

export function ThemeToggle({ className }: ThemeToggleProps) {
  const { settings, updateSettings } = useSettings();
  const { t } = useI18n();
  const nextTheme = settings.theme === 'light' ? 'dark' : 'light';

  return (
    <button
      type="button"
      className={className === undefined ? 'icon-button' : `icon-button ${className}`}
      data-testid="theme-toggle"
      aria-label={nextTheme === 'dark' ? t('Switch to dark theme') : t('Switch to light theme')}
      onClick={() => updateSettings({ theme: nextTheme })}
    >
      <Icon name={settings.theme === 'light' ? 'moon' : 'sun'} />
    </button>
  );
}
