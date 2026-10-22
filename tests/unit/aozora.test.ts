import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  importAozoraBook,
  parseAozoraCard,
  parseAozoraFileHtml,
  validateAozoraUrl,
} from '../../src/lib/import/aozora';
import { ImportDuplicateError, ImportError } from '../../src/lib/import/errors';
import { closeDb, getChapterSet, listBooks } from '../../src/lib/storage';

const CARD_MARKDOWN = `Title: 羅生門 (芥川 竜之介)

URL Source: https://www.aozora.gr.jp/cards/000879/card127.html

Markdown Content:
## 図書カード：No.127

作品名：羅生門
作品名読み：らしょうもん
著者名：[芥川 竜之介](https://www.aozora.gr.jp/index_pages/person879.html)

* * *

https://www.aozora.gr.jp/cards/000879/files/127_15260.html
https://www.aozora.gr.jp/cards/000879/files/127_15260.html
`;

const FILE_HTML = `<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="ja">
<head>
  <meta name="DC.Title" content="羅生門">
  <meta name="DC.Creator" content="芥川龍之介">
</head>
<body>
  <div class="main_text">
    ある日の暮方の事である。一人の<ruby><rb>下人</rb><rp>（</rp><rt>げにん</rt><rp>）</rp></ruby>が、<ruby><rb>羅生門</rb><rp>（</rp><rt>らしょうもん</rt><rp>）</rp></ruby>の下で雨やみを待っていた。
  </div>
</body>
</html>`;

async function resetDatabase(): Promise<void> {
  await closeDb();
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase('jepub');
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error ?? new Error('deleteDatabase failed'));
    request.onblocked = () => resolve();
  });
}

beforeEach(resetDatabase);
afterEach(resetDatabase);

interface FetchCall {
  url: string;
  headers: Record<string, string>;
}

function mockFetch(responses: (url: string) => Response): {
  fetchImpl: typeof fetch;
  calls: FetchCall[];
} {
  const calls: FetchCall[] = [];
  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const headers = (init?.headers ?? {}) as Record<string, string>;
    calls.push({ url, headers });
    return responses(url);
  }) as typeof fetch;
  return { fetchImpl, calls };
}

function body(text: string, status = 200): Response {
  return new Response(text, {
    status,
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}

describe('Aozora URL validation', () => {
  it('AOZORA-URL-VALIDATION accepts card and file URLs and rejects everything else', () => {
    expect(
      validateAozoraUrl('https://www.aozora.gr.jp/cards/000879/card127.html'),
    ).toEqual({
      kind: 'card',
      url: 'https://www.aozora.gr.jp/cards/000879/card127.html',
      id: '127',
    });

    const upgraded = validateAozoraUrl(
      'http://www.aozora.gr.jp/cards/000879/files/127_15260.html',
    );
    expect(upgraded.kind).toBe('file');
    expect(upgraded.id).toBe('127_15260');
    expect(upgraded.url.startsWith('https://')).toBe(true);

    for (const invalid of [
      '',
      'not a url',
      'ftp://www.aozora.gr.jp/cards/000879/card127.html',
      'https://example.com/cards/000879/card127.html',
      'https://www.aozora.gr.jp/index.html',
      'https://www.aozora.gr.jp/cards/000879/notes.html',
      'https://www.aozora.gr.jp/cards/000879/files/127_15260.xhtml',
    ]) {
      expect(() => validateAozoraUrl(invalid)).toThrow(ImportError);
    }
  });
});

describe('Aozora parsing', () => {
  it('AOZORA-CARD-PARSE reads title, author, and unique file links', () => {
    const card = parseAozoraCard(CARD_MARKDOWN);
    expect(card.title).toBe('羅生門');
    expect(card.author).toBe('芥川 竜之介');
    expect(card.fileUrls).toEqual([
      'https://www.aozora.gr.jp/cards/000879/files/127_15260.html',
    ]);

    const manyLinks = Array.from(
      { length: 7 },
      (_, index) => `https://www.aozora.gr.jp/cards/000879/files/127_${index + 1}.html`,
    ).join('\n');
    expect(parseAozoraCard(`${CARD_MARKDOWN}\n${manyLinks}`).fileUrls).toHaveLength(5);
  });

  it('AOZORA-BR-PARAGRAPHS preserves Aozora line breaks as separate paragraphs', () => {
    const parsed = parseAozoraFileHtml(`<!DOCTYPE html><html><body><div class="main_text">
一行目である。<br>
二行目である。<br>
三行目である。
</div></body></html>`);
    const paragraphs = parsed.blocks.filter(
      (block) => block.kind === 'paragraph',
    );
    expect(paragraphs).toHaveLength(3);
    expect(
      paragraphs.flatMap((block) => ('sentences' in block ? block.sentences : [])),
    ).toEqual(['一行目である。', '二行目である。', '三行目である。']);
  });

  it('AOZORA-HTML-PARSE extracts metadata and strips ruby readings', () => {
    const parsed = parseAozoraFileHtml(FILE_HTML);
    expect(parsed.title).toBe('羅生門');
    expect(parsed.author).toBe('芥川龍之介');
    expect(parsed.cleanedHtml).toContain('下人');
    expect(parsed.cleanedHtml).toContain('rt');

    const text = parsed.blocks
      .flatMap((block) => ('sentences' in block ? block.sentences : []))
      .join('');
    expect(text).toContain('下人');
    expect(text).toContain('羅生門の下で雨やみを待っていた');
    expect(text).not.toContain('げにん');
    expect(text).not.toContain('らしょうもん');
  });
});

describe('Aozora import', () => {
  it('AOZORA-FETCH-MOCK requests the card as markdown and the file as HTML', async () => {
    const { fetchImpl, calls } = mockFetch((url) =>
      url.includes('/files/') ? body(FILE_HTML) : body(CARD_MARKDOWN),
    );

    const imported = await importAozoraBook(
      'https://www.aozora.gr.jp/cards/000879/card127.html',
      { fetchImpl },
    );

    expect(calls).toHaveLength(2);
    expect(calls[0]?.url).toBe(
      'https://r.jina.ai/https://www.aozora.gr.jp/cards/000879/card127.html',
    );
    expect(calls[1]?.url).toBe(
      'https://r.jina.ai/https://www.aozora.gr.jp/cards/000879/files/127_15260.html',
    );
    expect(calls[1]?.headers['X-Return-Format']).toBe('html');
    expect(imported.book.title).toBe('羅生門');
    expect(imported.book.author).toBe('芥川 竜之介');
  });

  it('AOZORA-FILE-URL imports a direct file URL without fetching a card', async () => {
    const { fetchImpl, calls } = mockFetch(() => body(FILE_HTML));

    const imported = await importAozoraBook(
      'https://www.aozora.gr.jp/cards/000879/files/127_15260.html',
      { fetchImpl },
    );

    expect(calls).toHaveLength(1);
    expect(calls[0]?.headers['X-Return-Format']).toBe('html');
    expect(imported.book.title).toBe('羅生門');
    expect(imported.book.author).toBe('芥川龍之介');
    expect(imported.book.fileName).toBe('aozora-127_15260.html');
    expect(imported.book.sourceUrl).toBe(
      'https://www.aozora.gr.jp/cards/000879/files/127_15260.html',
    );
  });

  it('IMP-AOZORA-MOCK persists the parsed work and deduplicates it', async () => {
    const { fetchImpl } = mockFetch((url) =>
      url.includes('/files/') ? body(FILE_HTML) : body(CARD_MARKDOWN),
    );

    const imported = await importAozoraBook(
      'https://www.aozora.gr.jp/cards/000879/card127.html',
      { fetchImpl },
    );

    expect(imported.book.source).toBe('aozora');
    expect(imported.book.sourceUrl).toBe(
      'https://www.aozora.gr.jp/cards/000879/card127.html',
    );
    expect(imported.book.language).toBe('ja');
    expect(imported.book.cover).toBeNull();
    expect(imported.book.fileName).toBe('aozora-127.html');
    expect(imported.book.chapterCount).toBe(1);
    expect(await listBooks()).toHaveLength(1);

    const stored = await getChapterSet(imported.book.id);
    const text =
      stored?.chapters[0]?.blocks
        .flatMap((block) => ('sentences' in block ? block.sentences : []))
        .join('') ?? '';
    expect(text).toContain('ある日の暮方');
    expect(text).not.toContain('げにん');

    await expect(
      importAozoraBook('https://www.aozora.gr.jp/cards/000879/card127.html', {
        fetchImpl,
      }),
    ).rejects.toBeInstanceOf(ImportDuplicateError);
    expect(await listBooks()).toHaveLength(1);
  });
});
