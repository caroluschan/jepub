export {};

declare global {
  type TranslatorAvailability = 'unavailable' | 'downloadable' | 'downloading' | 'available';

  interface TranslatorDownloadProgress {
    loaded: number;
    total: number;
  }

  interface TranslatorMonitor {
    addEventListener(
      type: 'downloadprogress',
      listener: (event: TranslatorDownloadProgress) => void,
    ): void;
  }

  interface TranslatorInstance {
    translate(text: string): Promise<string>;
    destroy(): void;
  }

  interface TranslatorApi {
    availability(options: {
      sourceLanguage: string;
      targetLanguage: string;
    }): Promise<TranslatorAvailability>;
    create(options: {
      sourceLanguage: string;
      targetLanguage: string;
      monitor?: (monitor: TranslatorMonitor) => void;
    }): Promise<TranslatorInstance>;
  }

  interface Window {
    Translator?: TranslatorApi;
  }
}
