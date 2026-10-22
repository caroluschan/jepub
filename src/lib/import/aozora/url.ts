import { ImportError } from '../errors';

export type AozoraUrlKind = 'card' | 'file';

export interface AozoraUrlInfo {
  kind: AozoraUrlKind;
  url: string;
  id: string;
}

function invalidUrl(): ImportError {
  return new ImportError('Paste a valid Aozora Bunko card or file URL.');
}

/**
 * Accepts only Aozora card/file URLs under https://www.aozora.gr.jp/cards/.
 * Plain http is upgraded; anything ending outside a card or file page is
 * rejected so the Jina proxy is never pointed at an arbitrary origin.
 */
export function validateAozoraUrl(raw: string): AozoraUrlInfo {
  const trimmed = raw.trim();
  if (trimmed.length === 0) throw invalidUrl();

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw invalidUrl();
  }

  if (url.protocol === 'http:') url.protocol = 'https:';
  if (url.protocol !== 'https:') throw invalidUrl();
  if (url.username.length > 0 || url.password.length > 0) throw invalidUrl();

  const host = url.hostname.toLowerCase();
  if (host !== 'aozora.gr.jp' && host !== 'www.aozora.gr.jp') throw invalidUrl();
  if (!url.pathname.startsWith('/cards/')) throw invalidUrl();
  if (!/\.html$/iu.test(url.pathname)) throw invalidUrl();

  url.search = '';
  url.hash = '';

  const fileMatch = /^\/cards\/([^/]+)\/files\/([^/]+)\.html$/iu.exec(url.pathname);
  if (fileMatch !== null) {
    return { kind: 'file', url: url.toString(), id: fileMatch[2] ?? 'file' };
  }

  const cardMatch = /^\/cards\/[^/]+\/card(\d+)\.html$/iu.exec(url.pathname);
  if (cardMatch !== null) {
    return { kind: 'card', url: url.toString(), id: cardMatch[1] ?? 'card' };
  }

  throw invalidUrl();
}
