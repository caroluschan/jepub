declare module 'kuroshiro' {
  export interface KuromojiToken {
    surface_form: string;
    reading?: string;
    pronunciation?: string;
    pos?: string;
  }

  export interface KuroshiroConvertOptions {
    to: 'hiragana' | 'katakana' | 'romaji';
    mode?: 'normal' | 'spaced' | 'okurigana' | 'furigana';
  }

  export default class Kuroshiro {
    constructor();
    init(analyzer: { init(): Promise<void> }): Promise<void>;
    convert(text: string, options: KuroshiroConvertOptions): Promise<string>;
    _analyzer: {
      parse(text: string): Promise<KuromojiToken[]>;
    };
  }
}

declare module 'kuroshiro-analyzer-kuromoji' {
  export interface KuromojiAnalyzerOptions {
    dictPath: string;
  }

  export default class KuromojiAnalyzer {
    constructor(options: KuromojiAnalyzerOptions);
    init(): Promise<void>;
  }
}
