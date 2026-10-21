export type TranslationUnavailableReason = 'online-disabled' | 'offline' | 'failed';

export class TranslationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TranslationError';
  }
}

export class TranslationTimeoutError extends TranslationError {
  constructor(message = 'Translation request timed out.') {
    super(message);
    this.name = 'TranslationTimeoutError';
  }
}

export class TranslationTooLongError extends TranslationError {
  constructor(message = 'This sentence is too long for the online translator.') {
    super(message);
    this.name = 'TranslationTooLongError';
  }
}

export class TranslationAbortedError extends TranslationError {
  constructor(message = 'Translation was cancelled.') {
    super(message);
    this.name = 'TranslationAbortedError';
  }
}

export class TranslationUnavailableError extends TranslationError {
  readonly reason: TranslationUnavailableReason;

  constructor(reason: TranslationUnavailableReason) {
    super(`Translation is unavailable (${reason}).`);
    this.name = 'TranslationUnavailableError';
    this.reason = reason;
  }
}
