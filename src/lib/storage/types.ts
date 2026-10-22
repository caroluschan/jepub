export type {
  Bookmark,
  BookProgress,
  BookRecord,
  ChapterBlock,
  ChapterRecord,
  ChapterSet,
  ImportedBook,
  ParsedEpub,
  Settings,
  TocEntry,
  TranslationProvider,
  TranslationResult,
} from '../types';

import type { TranslationProvider } from '../types';

export interface AssetInput {
  path: string;
  blob: Blob;
  mime: string;
}

export interface StoredAsset extends AssetInput {
  key: string;
  bookId: string;
}

export interface StoredFile {
  id: string;
  blob: Blob;
}

export interface StoredTranslation {
  key: string;
  text: string;
  provider: TranslationProvider;
  createdAt: number;
}
