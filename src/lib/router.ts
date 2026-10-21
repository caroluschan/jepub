export type Route = { name: 'library' } | { name: 'reader'; bookId: string };

const LIBRARY: Route = { name: 'library' };

/**
 * Parses an in-app hash route. Returns null for a fragment that is not an
 * app route (for example `#reader-content`) so the shell can ignore it
 * instead of silently unmounting the reader.
 */
export function parseRoute(hash: string): Route | null {
  if (hash === '' || hash === '#' || hash === '#/') return LIBRARY;
  if (!hash.startsWith('#/')) return null;

  const path = hash.slice(1);
  const segments = path.split('/').filter((segment) => segment.length > 0);

  if (segments[0] !== 'read' || segments[1] === undefined) {
    return LIBRARY;
  }

  try {
    const bookId = decodeURIComponent(segments[1]);
    if (bookId.length === 0) return LIBRARY;
    return { name: 'reader', bookId };
  } catch {
    return LIBRARY;
  }
}

export function navigateToLibrary(): void {
  window.location.hash = '#/';
}

export function navigateToBook(id: string): void {
  window.location.hash = `#/read/${encodeURIComponent(id)}`;
}
