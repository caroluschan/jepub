import { Icon } from '../../components/Icon';

interface ReaderToolbarProps {
  bookTitle: string;
  chapterTitle: string;
  isReading: boolean;
  onBack: () => void;
  onToggleReadAloud: () => void;
  onOpenToc: () => void;
  onOpenSettings: () => void;
}

export function ReaderToolbar({
  bookTitle,
  chapterTitle,
  isReading,
  onBack,
  onToggleReadAloud,
  onOpenToc,
  onOpenSettings,
}: ReaderToolbarProps) {
  return (
    <header className="reader-toolbar" data-testid="reader-toolbar">
      <button
        type="button"
        className="icon-button"
        aria-label="Back to library"
        data-testid="back-button"
        onClick={onBack}
      >
        <Icon name="arrow-left" />
      </button>

      <div className="reader-toolbar__titles">
        <p className="reader-toolbar__book" lang="ja">
          {bookTitle}
        </p>
        <p className="reader-toolbar__chapter" data-testid="chapter-title" lang="ja">
          {chapterTitle}
        </p>
      </div>

      <div className="reader-toolbar__actions">
        <button
          type="button"
          className="icon-button"
          aria-label={isReading ? 'Stop reading aloud' : 'Read aloud'}
          aria-pressed={isReading}
          data-testid="read-aloud-button"
          onClick={onToggleReadAloud}
        >
          <Icon name={isReading ? 'stop' : 'volume'} />
        </button>
        <button
          type="button"
          className="icon-button"
          aria-label="Contents"
          data-testid="toc-button"
          onClick={onOpenToc}
        >
          <Icon name="list" />
        </button>
        <button
          type="button"
          className="icon-button reader-toolbar__type"
          aria-label="Reader settings"
          data-testid="settings-button"
          onClick={onOpenSettings}
        >
          Aa
        </button>
      </div>
    </header>
  );
}
