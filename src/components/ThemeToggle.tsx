import { Icon } from './Icon';
import { useSettings } from '../features/settings/SettingsProvider';

interface ThemeToggleProps {
  className?: string;
}

export function ThemeToggle({ className }: ThemeToggleProps) {
  const { settings, updateSettings } = useSettings();
  const nextTheme = settings.theme === 'light' ? 'dark' : 'light';

  return (
    <button
      type="button"
      className={className === undefined ? 'icon-button' : `icon-button ${className}`}
      data-testid="theme-toggle"
      aria-label={`Switch to ${nextTheme} theme`}
      onClick={() => updateSettings({ theme: nextTheme })}
    >
      <Icon name={settings.theme === 'light' ? 'moon' : 'sun'} />
    </button>
  );
}
