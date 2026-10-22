import type { MouseEvent } from 'react';
import { useI18n } from '../lib/i18n/useI18n';

export function SkipLink() {
  const { t } = useI18n();
  const handleClick = (event: MouseEvent<HTMLAnchorElement>): void => {
    event.preventDefault();
    const target = document.getElementById('reader-content');
    if (target === null) return;
    target.focus({ preventScroll: true });
    target.scrollIntoView({ block: 'start', inline: 'start' });
  };

  return (
    <a className="skip-link" href="#reader-content" onClick={handleClick}>
      {t('Skip to book text')}
    </a>
  );
}
