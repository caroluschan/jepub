interface CachedCover {
  blob: Blob;
  url: string;
}

const coverUrls = new Map<string, CachedCover>();

/**
 * Returns a stable object URL for a book cover.
 *
 * The library and reader are separate routes, so a per-mount hook revokes the
 * cover URL as soon as the reader opens. The next library mount then races the
 * image element while a fresh URL is created, which can leave the card showing
 * a broken image. Caching by book id keeps the same URL alive across route
 * changes; IndexedDB returns a new Blob instance on every read, so identity is
 * deliberately keyed on the book rather than the Blob.
 */
export function getCoverUrl(bookId: string, cover: Blob | null): string | null {
  if (cover === null) return null;
  const cached = coverUrls.get(bookId);
  if (cached !== undefined) return cached.url;

  const url = URL.createObjectURL(cover);
  coverUrls.set(bookId, { blob: cover, url });
  return url;
}

export function releaseCoverUrl(bookId: string): void {
  const cached = coverUrls.get(bookId);
  if (cached === undefined) return;
  URL.revokeObjectURL(cached.url);
  coverUrls.delete(bookId);
}

export function clearCoverUrls(): void {
  for (const cached of coverUrls.values()) URL.revokeObjectURL(cached.url);
  coverUrls.clear();
}
