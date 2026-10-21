import type { MouseEvent } from 'react';

export function SkipLink() {
  const handleClick = (event: MouseEvent<HTMLAnchorElement>): void => {
    event.preventDefault();
    const target = document.getElementById('reader-content');
    if (target === null) return;
    target.focus({ preventScroll: true });
    target.scrollIntoView({ block: 'start', inline: 'start' });
  };

  return (
    <a className="skip-link" href="#reader-content" onClick={handleClick}>
      Skip to book text
    </a>
  );
}
