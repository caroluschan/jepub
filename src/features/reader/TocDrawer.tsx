import { useRef } from 'react';
import { Icon } from '../../components/Icon';
import { Modal } from '../../components/Modal';
import type { ChapterRecord, TocEntry } from '../../lib/types';

interface TocDrawerProps {
  bookTitle: string;
  entries: TocEntry[];
  chapters: ChapterRecord[];
  currentIndex: number;
  onClose: () => void;
  onNavigate: (entry: TocEntry) => void;
}

export function TocDrawer({
  bookTitle,
  entries,
  chapters,
  currentIndex,
  onClose,
  onNavigate,
}: TocDrawerProps) {
  const closeRef = useRef<HTMLButtonElement | null>(null);

  const resolved: TocEntry[] =
    entries.length > 0
      ? entries
      : chapters.map((chapter, index) => ({
          title: chapter.title,
          chapterIndex: index,
          fragment: null,
          depth: 0,
        }));

  return (
    <Modal
      onClose={onClose}
      variant="drawer"
      className="toc-panel"
      ariaLabel="Contents"
      initialFocusRef={closeRef}
      panelTestId="toc-drawer"
    >
      <div className="toc">
        <div className="modal-header toc__head">
          <div>
            <span className="label">Contents</span>
            <p className="toc__book" lang="ja">
              {bookTitle}
            </p>
          </div>
          <button
            ref={closeRef}
            type="button"
            className="icon-button"
            aria-label="Close contents"
            data-testid="toc-close"
            onClick={onClose}
          >
            <Icon name="close" />
          </button>
        </div>

        {resolved.length === 0 ? (
          <p className="toc__empty">No contents were found in this book.</p>
        ) : (
          <nav aria-label="Book contents">
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
                      <span className="toc__index">{String(entry.chapterIndex + 1).padStart(2, '0')}</span>
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
          {chapters.length} {chapters.length === 1 ? 'chapter' : 'chapters'} · 日本語
        </p>
      </div>
    </Modal>
  );
}
