import type { BookRecord } from '../types';

export class ImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ImportError';
  }
}

export class ImportTooLargeError extends ImportError {
  constructor(message = 'This EPUB is larger than the 100 MB import limit.') {
    super(message);
    this.name = 'ImportTooLargeError';
  }
}

export class ImportDuplicateError extends ImportError {
  readonly existing: BookRecord;

  constructor(existing: BookRecord) {
    super('This book is already in your library.');
    this.name = 'ImportDuplicateError';
    this.existing = existing;
  }
}
