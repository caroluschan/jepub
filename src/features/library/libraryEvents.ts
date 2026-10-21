const LIBRARY_EVENT = 'jepub:library-changed';

export function notifyLibraryChanged(): void {
  window.dispatchEvent(new Event(LIBRARY_EVENT));
}

export function onLibraryChanged(listener: () => void): () => void {
  window.addEventListener(LIBRARY_EVENT, listener);
  return () => window.removeEventListener(LIBRARY_EVENT, listener);
}
