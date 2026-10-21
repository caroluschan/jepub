let translatorPromise: Promise<TranslatorInstance | null> | null = null;

function getTranslatorApi(): TranslatorApi | undefined {
  const scope = globalThis as typeof globalThis & { Translator?: TranslatorApi };
  return scope.Translator;
}

export async function translateOnDevice(
  text: string,
  onProgress?: (progress: TranslatorDownloadProgress) => void,
): Promise<string | null> {
  const api = getTranslatorApi();
  if (api === undefined) return null;

  const availability = await api.availability({ sourceLanguage: 'ja', targetLanguage: 'en' });
  if (availability === 'unavailable') return null;

  if (translatorPromise === null) {
    translatorPromise = api
      .create({
        sourceLanguage: 'ja',
        targetLanguage: 'en',
        monitor: (monitor) => {
          monitor.addEventListener('downloadprogress', (event) => {
            onProgress?.({ loaded: event.loaded, total: event.total });
          });
        },
      })
      .catch((error: unknown) => {
        translatorPromise = null;
        throw error;
      });
  }

  const translator = await translatorPromise;
  if (translator === null) return null;
  return translator.translate(text);
}

export async function destroyOnDeviceTranslator(): Promise<void> {
  const pending = translatorPromise;
  translatorPromise = null;
  if (pending === null) return;
  const translator = await pending.catch(() => null);
  translator?.destroy();
}
