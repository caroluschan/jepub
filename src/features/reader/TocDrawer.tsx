import { useRef, useState } from 'react';
import { Icon } from '../../components/Icon';
import { Modal } from '../../components/Modal';
import { useI18n } from '../../lib/i18n/useI18n';
import type { Bookmark, ChapterRecord, TocEntry } from '../../lib/types';

interface TocDrawerProps {
  bookTitle: string;
  entries: TocEntry[];
  chapters: ChapterRecord[];
  currentIndex: number;
  bookmarks: Bookmark[];
  onClose: () => void;
  onNavigate: (entry: TocEntry) => void;
  onAddBookmark: () => void;
  onNavigateBookmark: (bookmark: Bookmark) => void;
  onDeleteBookmark: (bookmark: Bookmark) => void;
}

type TocTab = 'contents' | 'bookmarks';

export function TocDrawer({
  bookTitle,
  entries,
  chapters,
  currentIndex,
  bookmarks,
  onClose,
  onNavigate,
  onAddBookmark,
  onNavigateBookmark,
  onDeleteBookmark,
}: TocDrawerProps) {
  const { t } = useI18n();
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const [tab, setTab] = useState<TocTab>('contents');

  const resolved: TocEntry[] =
    entries.length > 0
      ? entries
      : chapters.map((chapter, index) => ({
          title: chapter.title,
          chapterIndex: index,
          fragment: null,
          depth: 0,
        }));

  const bookmarkPercent = (bookmark: Bookmark): number => {
    if (chapters.length === 0) return 0;
    const raw = (bookmark.chapterIndex + bookmark.ratio) / chapters.length;
    return Math.min(100, Math.max(0, Math.round(raw * 100)));
  };

  return (
    <Modal
      onClose={onClose}
      variant="drawer"
      className="toc-panel"
      ariaLabel={t('Contents')}
      initialFocusRef={closeRef}
      panelTestId="toc-drawer"
    >
      <div className="toc">
        <div className="modal-header toc__head">
          <div>
            <span className="label">{t('Contents')}</span>
            <p className="toc__book" lang="ja">
              {bookTitle}
            </p>
          </div>
          <button
            ref={closeRef}
            type="button"
            className="icon-button"
            aria-label={t('Close contents')}
            data-testid="toc-close"
            onClick={onClose}
          >
            <Icon name="close" />
          </button>
        </div>

        <div className="toc__tabs" role="tablist" aria-label={t('Contents')}>
          <button
            id="toc-tab-contents"
            type="button"
            role="tab"
            className="toc__tab"
            aria-selected={tab === 'contents'}
            aria-controls="toc-panel-contents"
            data-testid="toc-tab-contents"
            onClick={() => setTab('contents')}
          >
            {t('Contents')}
          </button>
          <button
            id="toc-tab-bookmarks"
            type="button"
            role="tab"
            className="toc__tab"
            aria-selected={tab === 'bookmarks'}
            aria-controls="toc-panel-bookmarks"
            data-testid="toc-tab-bookmarks"
            onClick={() => setTab('bookmarks')}
          >
            {t('Bookmarks')}
            {bookmarks.length > 0 ? <span className="toc__count">{bookmarks.length}</span> : null}
          </button>
        </div>

        {tab === 'contents' ? (
          <div
            id="toc-panel-contents"
            role="tabpanel"
            aria-labelledby="toc-tab-contents"
            className="toc__panel"
          >
            {resolved.length === 0 ? (
              <p className="toc__empty">{t('No contents were found in this book.')}</p>
            ) : (
              <nav aria-label={t('Book contents')}>
                <ol className="toc__list">
                  {resolved.map((entry, index) => {
                    const current = entry.chapterIndex === currentIndex;
                    return (
                      <li key={`${entry.chapterIndex}-${entry.fragment ?? 'start'}-${index}`}>
                        <button
                          type="button"
                          className="toc__entry"
                          aria-current={current ? 'true' : undefined}
                          style={{ paddingInlineStart: `${16 + Math.max(0, entry.depth) * 14}px` }}
                          onClick={() => onNavigate(entry)}
                        >
                          <span className="toc__marker" aria-hidden="true" />
                          <span className="toc__index">
                            {String(entry.chapterIndex + 1).padStart(2, '0')}
                          </span>
                          <span className="toc__title" lang="ja">
                            {entry.title}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ol>
              </nav>
            )}

            <p className="toc__footnote">
              {chapters.length === 1
                ? t('1 chapter · 日本語')
                : t('{count} chapters · 日本語', { count: chapters.length })}
            </p>
          </div>
        ) : (
          <div
            id="toc-panel-bookmarks"
            role="tabpanel"
            aria-labelledby="toc-tab-bookmarks"
            className="toc__panel"
          >
            <button
              type="button"
              className="button button--quiet toc__add-bookmark"
              data-testid="bookmark-add"
              onClick={onAddBookmark}
            >
              <Icon name="bookmark" size={16} />
              {t('Bookmark this spot')}
            </button>

            {bookmarks.length === 0 ? (
              <p className="toc__empty">{t('No bookmarks yet. Add one below or from the page.')}</p>
            ) : (
              <ul className="toc__bookmarks">
                {bookmarks.map((bookmark) => (
                  <li key={bookmark.id} className="toc__bookmark" data-testid="bookmark-entry">
                    <button
                      type="button"
                      className="toc__bookmark-jump"
                      data-testid="bookmark-jump"
                      aria-label={t('Jump to {title}', { title: bookmark.chapterTitle })}
                      onClick={() => onNavigateBookmark(bookmark)}
                    >
                      <span className="toc__marker" aria-hidden="true" />
                      <span className="toc__bookmark-copy">
                        <span className="toc__title" lang="ja">
                          {bookmark.chapterTitle}
                        </span>
                        <span className="toc__bookmark-meta">{bookmarkPercent(bookmark)}%</span>
                      </span>
                    </button>
                    <button
                      type="button"
                      className="icon-button toc__bookmark-delete"
                      data-testid="bookmark-delete"
                      aria-label={t('Delete bookmark at {title}', {
                        title: bookmark.chapterTitle,
                      })}
                      onClick={() => onDeleteBookmark(bookmark)}
                    >
                      <Icon name="trash" size={16} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
