export type Theme = 'light' | 'dark';
export type Orientation = 'horizontal' | 'vertical';
export type FuriganaScript = 'katakana' | 'hiragana';

export interface Settings {
  theme: Theme;
  fontSize: number;
  orientation: Orientation;
  furigana: boolean;
  furiganaScript: FuriganaScript;
  onlineTranslation: boolean;
}

export interface BookProgress {
  chapterIndex: number;
  ratio: number;
}

export interface BookRecord {
  id: string;
  title: string;
  author: string;
  language: string;
  cover: Blob | null;
  fileName: string;
  fileSize: number;
  fileHash: string;
  chapterCount: number;
  addedAt: number;
  lastOpenedAt: number | null;
  progress: BookProgress;
  source: 'file' | 'sample' | 'handler' | 'drop' | 'text' | 'aozora';
}

export interface TocEntry {
  title: string;
  chapterIndex: number;
  fragment: string | null;
  depth: number;
}

export interface ChapterBlockBase {
  anchor?: string;
}

export type ChapterBlock =
  | (ChapterBlockBase & { kind: 'paragraph' | 'quote'; sentences: string[] })
  | (ChapterBlockBase & { kind: 'heading'; level: 1 | 2 | 3 | 4 | 5 | 6; sentences: string[] })
  | (ChapterBlockBase & { kind: 'listItem'; sentences: string[]; ordered: boolean })
  | { kind: 'image'; path: string; alt: string }
  | { kind: 'separator' };

export interface ChapterRecord {
  index: number;
  href: string;
  title: string;
  dir: string;
  blocks: ChapterBlock[];
  imagePaths: string[];
  textLength: number;
}

export interface ChapterSet {
  bookId: string;
  version: 1;
  chapters: ChapterRecord[];
  toc: TocEntry[];
}

export interface ParsedEpub {
  title: string;
  author: string;
  language: string;
  cover: Blob | null;
  chapters: ChapterRecord[];
  toc: TocEntry[];
  assets: Array<{ path: string; blob: Blob; mime: string }>;
}

export interface ImportedBook {
  book: BookRecord;
  chapterSet: ChapterSet;
}

export type TranslationProvider = 'on-device' | 'mymemory';

export interface TranslationResult {
  text: string;
  provider: TranslationProvider;
  cached: boolean;
}
