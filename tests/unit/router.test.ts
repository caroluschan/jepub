import { afterEach, describe, expect, it } from 'vitest';
import { navigateToBook, navigateToLibrary, parseRoute } from '../../src/lib/router';

afterEach(() => {
  window.location.hash = '';
});

describe('router', () => {
  it('ROUTE-LIBRARY resolves empty and unknown hashes to the library', () => {
    expect(parseRoute('')).toEqual({ name: 'library' });
    expect(parseRoute('#')).toEqual({ name: 'library' });
    expect(parseRoute('#/')).toEqual({ name: 'library' });
    expect(parseRoute('#/nope')).toEqual({ name: 'library' });
    expect(parseRoute('#/read')).toEqual({ name: 'library' });
    expect(parseRoute('#/read/')).toEqual({ name: 'library' });
  });

  it('ROUTE-READER parses a book id', () => {
    expect(parseRoute('#/read/abc')).toEqual({ name: 'reader', bookId: 'abc' });
  });

  it('ROUTE-FRAGMENT ignores non-app fragments such as the skip link', () => {
    expect(parseRoute('#reader-content')).toBeNull();
    expect(parseRoute('reader-content')).toBeNull();
    expect(parseRoute('/read/abc')).toBeNull();
  });

  it('ROUTE-ENCODE round-trips ids through the hash', () => {
    navigateToBook('id with space');
    expect(window.location.hash).toBe('#/read/id%20with%20space');
    expect(parseRoute(window.location.hash)).toEqual({ name: 'reader', bookId: 'id with space' });

    navigateToLibrary();
    expect(window.location.hash).toBe('#/');
    expect(parseRoute(window.location.hash)).toEqual({ name: 'library' });
  });

  it('ROUTE-MALFORMED falls back to the library for bad escapes', () => {
    expect(parseRoute('#/read/%E0%A4%A')).toEqual({ name: 'library' });
  });
});
