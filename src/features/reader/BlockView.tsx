import { memo } from 'react';
import type { ChapterBlock, FuriganaScript } from '../../lib/types';
import { SentenceSpan } from './SentenceSpan';
import { useFuriganaBlocks } from './useFuriganaBlocks';

interface BlockViewProps {
  block: ChapterBlock;
  blockIndex: number;
  furiganaEnabled: boolean;
  furiganaScript: FuriganaScript;
  retryNonce: number;
  assets: Map<string, string>;
  speakingId: string | null;
  onOpenSentence: (sentence: string, element: HTMLElement) => void;
}

function assertNever(value: never): never {
  throw new Error(`Unhandled block kind: ${String(value)}`);
}

function headingTag(level: 1 | 2 | 3 | 4 | 5 | 6): 'h2' | 'h3' | 'h4' {
  if (level === 1) return 'h2';
  if (level === 2 || level === 3) return 'h3';
  return 'h4';
}

function BlockViewImpl({
  block,
  blockIndex,
  furiganaEnabled,
  furiganaScript,
  retryNonce,
  assets,
  speakingId,
  onOpenSentence,
}: BlockViewProps) {
  const sentences = 'sentences' in block ? block.sentences : [];
  const { attachRef, html } = useFuriganaBlocks(
    sentences,
    furiganaEnabled && sentences.length > 0,
    furiganaScript,
    retryNonce,
  );

  const rendered =
    'sentences' in block
      ? block.sentences.map((sentence, sentenceIndex) => {
          const id = `${blockIndex}-${sentenceIndex}`;
          return (
            <SentenceSpan
              key={id}
              id={id}
              text={sentence}
              html={html?.[sentenceIndex] ?? null}
              speaking={speakingId === id}
              onOpen={onOpenSentence}
            />
          );
        })
      : null;

  switch (block.kind) {
    case 'paragraph':
      return (
        <p
          ref={attachRef}
          className="reader-block reader-paragraph"
          data-block-index={blockIndex}
          data-anchor={block.anchor}
        >
          {rendered}
        </p>
      );
    case 'quote':
      return (
        <blockquote
          ref={attachRef}
          className="reader-block reader-quote"
          data-block-index={blockIndex}
          data-anchor={block.anchor}
        >
          {rendered}
        </blockquote>
      );
    case 'heading': {
      const Tag = headingTag(block.level);
      return (
        <Tag
          ref={attachRef}
          className="reader-block reader-heading"
          data-block-index={blockIndex}
          data-anchor={block.anchor}
        >
          {rendered}
        </Tag>
      );
    }
    case 'listItem':
      return (
        <div
          ref={attachRef}
          className="reader-block reader-list-item"
          data-block-index={blockIndex}
          data-anchor={block.anchor}
          data-ordered={block.ordered ? 'true' : 'false'}
        >
          <span className="reader-list-item__marker" aria-hidden="true">
            {block.ordered ? '–' : '・'}
          </span>
          <span className="reader-list-item__text">{rendered}</span>
        </div>
      );
    case 'image': {
      const url = assets.get(block.path);
      return (
        <figure className="reader-block reader-figure" data-block-index={blockIndex}>
          {url === undefined ? (
            <div className="reader-image-missing" role="img" aria-label={block.alt || 'Image'}>
              <span lang="en">Image unavailable</span>
            </div>
          ) : (
            <img src={url} alt={block.alt} loading="lazy" />
          )}
        </figure>
      );
    }
    case 'separator':
      return (
        <div
          className="reader-block reader-separator"
          data-block-index={blockIndex}
          role="separator"
          aria-hidden="true"
        />
      );
    default:
      return assertNever(block);
  }
}

export const BlockView = memo(BlockViewImpl);
