import { Icon } from '../../components/Icon';
import { useI18n } from '../../lib/i18n/useI18n';
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
  const { t } = useI18n();
  const coverUrl = book.coverDataUrl ?? null;
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
          {book.author.length > 0 ? (
            <p className="book-card__author" lang="ja">
              {book.author}
            </p>
          ) : null}
          <div className="book-card__progress" aria-hidden="true">
            <span className="book-card__bar" style={{ width: `${percent}%` }} />
          </div>
          <p className="book-card__stats">
            <span>{percent}%</span>
            <span>
              {book.chapterCount === 1
                ? t('1 chapter')
                : t('{count} chapters', { count: book.chapterCount })}
            </span>
          </p>
        </div>
      </a>
      <button
        type="button"
        className="book-card__delete"
        aria-label={t('Remove {title}', { title: book.title })}
        onClick={() => onDelete(book)}
      >
        <Icon name="trash" size={16} />
      </button>
    </article>
  );
}
