import { memo } from 'react';
import type { ChapterRecord, FuriganaScript } from '../../lib/types';
import { useI18n } from '../../lib/i18n/useI18n';
import { BlockView } from './BlockView';

interface ChapterViewProps {
  chapter: ChapterRecord;
  furiganaEnabled: boolean;
  furiganaScript: FuriganaScript;
  retryNonce: number;
  assets: Map<string, string>;
  speakingId: string | null;
  hasNext: boolean;
  onOpenSentence: (sentence: string, element: HTMLElement) => void;
  onNextChapter: () => void;
}

function ChapterViewImpl({
  chapter,
  furiganaEnabled,
  furiganaScript,
  retryNonce,
  assets,
  speakingId,
  hasNext,
  onOpenSentence,
  onNextChapter,
}: ChapterViewProps) {
  const { t } = useI18n();
  return (
    <article
      className="reader-content"
      id="reader-content"
      aria-label={chapter.title}
      lang="ja"
      tabIndex={-1}
    >
      {chapter.blocks.map((block, blockIndex) => (
        <BlockView
          key={`${chapter.index}-${blockIndex}`}
          block={block}
          blockIndex={blockIndex}
          furiganaEnabled={furiganaEnabled}
          furiganaScript={furiganaScript}
          retryNonce={retryNonce}
          assets={assets}
          speakingId={speakingId}
          onOpenSentence={onOpenSentence}
        />
      ))}
      {hasNext ? (
        <button type="button" className="next-chapter" onClick={onNextChapter}>
          <span lang="ja">次の章へ</span>
          <span className="next-chapter__label" lang="en">
            {t('Next chapter')}
          </span>
        </button>
      ) : null}
    </article>
  );
}

export const ChapterView = memo(ChapterViewImpl);
