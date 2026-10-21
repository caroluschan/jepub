import { EpubParseError } from './errors';

/** Hard limits for untrusted EPUB archives. Exported so tests pin them. */
export const MAX_ZIP_ENTRIES = 4000;
export const MAX_SPINE_ITEMS = 2000;
export const MAX_ENTRY_UNCOMPRESSED_BYTES = 32 * 1024 * 1024;
export const MAX_TOTAL_UNCOMPRESSED_BYTES = 250 * 1024 * 1024;
export const MAX_CHAPTER_TEXT_LENGTH = 2_000_000;
export const MAX_ASSET_BYTES = 32 * 1024 * 1024;

function megabytes(bytes: number): string {
  return `${Math.round(bytes / (1024 * 1024))} MB`;
}

export function assertZipEntryCount(count: number): void {
  if (count > MAX_ZIP_ENTRIES) {
    throw new EpubParseError(
      `This EPUB contains too many files (${count}; limit ${MAX_ZIP_ENTRIES}).`,
    );
  }
}

export function assertSpineItemCount(count: number): void {
  if (count > MAX_SPINE_ITEMS) {
    throw new EpubParseError(
      `This EPUB has too many spine items (${count}; limit ${MAX_SPINE_ITEMS}).`,
    );
  }
}

export function assertChapterTextLength(length: number, path: string): void {
  if (length > MAX_CHAPTER_TEXT_LENGTH) {
    throw new EpubParseError(
      `Chapter text is too large: ${path} (${length} characters; limit ${MAX_CHAPTER_TEXT_LENGTH}).`,
    );
  }
}

/**
 * Tracks cumulative decompressed bytes across a single archive. The declared
 * size is checked before inflating when the ZIP entry exposes it, and the
 * actual byte length is charged after every read so a lying header cannot
 * bypass the limit.
 */
export class DecompressionBudget {
  private readonly limit: number;
  private used = 0;

  constructor(limit: number = MAX_TOTAL_UNCOMPRESSED_BYTES) {
    this.limit = limit;
  }

  checkDeclared(path: string, declaredBytes: number | null): void {
    if (declaredBytes === null || !Number.isFinite(declaredBytes) || declaredBytes <= 0) {
      return;
    }
    if (declaredBytes > MAX_ENTRY_UNCOMPRESSED_BYTES) {
      throw new EpubParseError(
        `Archive entry is too large: ${path} (${megabytes(declaredBytes)}; limit ${megabytes(
          MAX_ENTRY_UNCOMPRESSED_BYTES,
        )}).`,
      );
    }
    if (this.used + declaredBytes > this.limit) {
      throw new EpubParseError(
        `This EPUB expands to more than the ${megabytes(this.limit)} safety limit.`,
      );
    }
  }

  add(path: string, byteLength: number): void {
    if (byteLength > MAX_ENTRY_UNCOMPRESSED_BYTES) {
      throw new EpubParseError(
        `Archive entry is too large: ${path} (${megabytes(byteLength)}; limit ${megabytes(
          MAX_ENTRY_UNCOMPRESSED_BYTES,
        )}).`,
      );
    }
    const next = this.used + byteLength;
    if (next > this.limit) {
      throw new EpubParseError(
        `This EPUB expands to more than the ${megabytes(this.limit)} safety limit.`,
      );
    }
    this.used = next;
  }

  get usedBytes(): number {
    return this.used;
  }
}
