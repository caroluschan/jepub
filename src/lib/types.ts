export type Theme = 'light' | 'dark';
export type Orientation = 'horizontal' | 'vertical';
export type FuriganaScript = 'katakana' | 'hiragana';

export type AiMode = 'off' | 'byot' | 'local';
export type ByotProviderId =
  | 'openai'
  | 'anthropic'
  | 'google'
  | 'openrouter'
  | 'groq'
  | 'mistral'
  | 'deepseek'
  | 'xai'
  | 'together'
  | 'cerebras'
  | 'perplexity'
  | 'fireworks'
  | 'qwen'
  | 'custom';

export interface Settings {
  llmConsent: boolean;
  aiMode: AiMode;
  aiProvider: ByotProviderId;
  aiApiKey: string;
  aiModel: string;
  aiBaseUrl: string;
  theme: Theme;
  fontSize: number;
  orientation: Orientation;
  furigana: boolean;
  furiganaScript: FuriganaScript;
  onlineTranslation: boolean;
  translationTarget: string;
  uiLanguage: string;
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
  coverDataUrl?: string | null;
  fileName: string;
  fileSize: number;
  fileHash: string;
  chapterCount: number;
  addedAt: number;
  lastOpenedAt: number | null;
  progress: BookProgress;
  source: 'file' | 'sample' | 'handler' | 'drop' | 'text' | 'aozora' | 'mobi';
  sourceUrl?: string | null;
}

export interface Bookmark {
  id: string;
  bookId: string;
  chapterIndex: number;
  ratio: number;
  chapterTitle: string;
  createdAt: number;
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

export type LlmUnsupportedReason =
  | 'no-webgpu'
  | 'os-version'
  | 'storage-buffer'
  | 'storage-space'
  | 'unknown';

export interface LlmSupport {
  supported: boolean;
  reason: LlmUnsupportedReason | null;
  maxBufferSize: number | null;
  maxStorageBufferBindingSize: number | null;
  freeStorage: number | null;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: number;
}

export type KnowledgeKind = 'translation' | 'ai';

export interface KnowledgeRecord {
  id: string;
  kind: KnowledgeKind;
  sentence: string;
  translation?: string;
  readings?: string;
  romaji?: string;
  targetLanguage?: string;
  question?: string;
  answer?: string;
  createdAt: number;
  fingerprint: string;
}

export interface QuizQuestion {
  question: string;
  options: [string, string, string, string];
  answer: number;
  explanation: string;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
  bookId?: string | null;
  sentence?: string | null;
}

export interface TranslationResult {
  text: string;
  provider: TranslationProvider;
  cached: boolean;
}
