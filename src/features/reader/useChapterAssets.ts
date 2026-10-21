import { useEffect, useState } from 'react';
import { getAssets } from '../../lib/storage';
import type { ChapterRecord } from '../../lib/types';

export function useChapterAssets(
  bookId: string,
  chapter: ChapterRecord,
): Map<string, string> {
  const [urls, setUrls] = useState<Map<string, string>>(() => new Map());
  const pathsKey = chapter.imagePaths.join('|');

  useEffect(() => {
    const objectUrls: string[] = [];
    let cancelled = false;
    const paths = pathsKey.length === 0 ? [] : pathsKey.split('|');

    if (paths.length === 0) {
      setUrls(new Map());
      return;
    }

    void getAssets(bookId, paths)
      .then((blobs) => {
        if (cancelled) return;
        const next = new Map<string, string>();
        for (const [path, blob] of blobs) {
          const url = URL.createObjectURL(blob);
          objectUrls.push(url);
          next.set(path, url);
        }
        setUrls(next);
      })
      .catch(() => {
        if (!cancelled) setUrls(new Map());
      });

    return () => {
      cancelled = true;
      for (const url of objectUrls) URL.revokeObjectURL(url);
    };
  }, [bookId, pathsKey]);

  return urls;
}
