export class EpubError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EpubError';
  }
}

export class EpubParseError extends EpubError {
  constructor(message: string) {
    super(message);
    this.name = 'EpubParseError';
  }
}

export class EpubDrmError extends EpubParseError {
  constructor(message = 'This EPUB is protected by DRM and cannot be opened.') {
    super(message);
    this.name = 'EpubDrmError';
  }
}
