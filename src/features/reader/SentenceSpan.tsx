import type { KeyboardEvent, MouseEvent } from 'react';

interface SentenceSpanProps {
  id: string;
  text: string;
  html: string | null;
  speaking: boolean;
  onOpen: (sentence: string, element: HTMLElement) => void;
}

export function SentenceSpan({ id, text, html, speaking, onOpen }: SentenceSpanProps) {
  const open = (element: HTMLElement): void => {
    const selection = window.getSelection()?.toString().trim() ?? '';
    if (selection.length > 0) return;
    onOpen(text, element);
  };

  const handleClick = (event: MouseEvent<HTMLSpanElement>): void => {
    open(event.currentTarget);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLSpanElement>): void => {
    if (event.key === 'Enter') {
      event.preventDefault();
      open(event.currentTarget);
      return;
    }
    if (event.key === ' ') {
      event.preventDefault();
      open(event.currentTarget);
    }
  };

  return (
    <span
      className={speaking ? 'sentence is-speaking' : 'sentence'}
      data-sentence-id={id}
      data-testid={`sentence-${id}`}
      data-raw={text}
      role="button"
      tabIndex={0}
      aria-label={text}
      lang="ja"
      onClick={handleClick}
      onKeyDown={handleKeyDown}
    >
      {html === null ? (
        text
      ) : (
        <span className="sentence__ruby" dangerouslySetInnerHTML={{ __html: html }} />
      )}
    </span>
  );
}
