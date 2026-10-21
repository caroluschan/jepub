import { Icon } from '../../components/Icon';
import { useObjectUrl } from '../../components/useObjectUrl';
import type { BookRecord } from '../../lib/types';

export function bookPercent(book: BookRecord): number {
  if (book.chapterCount <= 0) return 0;
  const raw = (book.progress.chapterIndex + book.progress.ratio) / book.chapterCount;
  return Math.min(100, Math.max(0, Math.round(raw * 100)));
}

interface BookCardProps {
  book: BookRecord;
  onDelete: (book: BookRecord) => void;
}

export function BookCard({ book, onDelete }: BookCardProps) {
  const coverUrl = useObjectUrl(book.cover);
  const percent = bookPercent(book);

  return (
    <article className="book-card" data-testid="book-card">
      <a className="book-card__link" href={`#/read/${encodeURIComponent(book.id)}`}>
        <div className="book-card__cover">
          {coverUrl === null ? (
            <div className="cover-fallback" aria-hidden="true">
              <span className="cover-fallback__mark">JEPUB</span>
              <span className="cover-fallback__title" lang="ja">
                {book.title}
              </span>
            </div>
          ) : (
            <img className="book-card__image" src={coverUrl} alt="" loading="lazy" />
          )}
        </div>
        <div className="book-card__body">
          <h3 className="book-card__title" lang="ja">
            {book.title}
          </h3>
          <p className="book-card__author" lang="ja">
            {book.author}
          </p>
          <div className="book-card__progress" aria-hidden="true">
            <span className="book-card__bar" style={{ width: `${percent}%` }} />
          </div>
          <p className="book-card__stats">
            <span>{percent}%</span>
            <span>
              {book.chapterCount} {book.chapterCount === 1 ? 'chapter' : 'chapters'}
            </span>
          </p>
        </div>
      </a>
      <button
        type="button"
        className="book-card__delete"
        aria-label={`Remove ${book.title}`}
        onClick={() => onDelete(book)}
      >
        <Icon name="trash" size={16} />
      </button>
    </article>
  );
}
