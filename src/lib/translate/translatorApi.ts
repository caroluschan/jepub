const translatorPromises = new Map<string, Promise<TranslatorInstance | null>>();

function getTranslatorApi(): TranslatorApi | undefined {
  const scope = globalThis as typeof globalThis & { Translator?: TranslatorApi };
  return scope.Translator;
}

export async function translateOnDevice(
  text: string,
  targetLanguage: string,
  onProgress?: (progress: TranslatorDownloadProgress) => void,
): Promise<string | null> {
  const api = getTranslatorApi();
  if (api === undefined) return null;

  const availability = await api.availability({
    sourceLanguage: 'ja',
    targetLanguage,
  });
  if (availability === 'unavailable') return null;

  let translatorPromise = translatorPromises.get(targetLanguage);
  if (translatorPromise === undefined) {
    translatorPromise = api
      .create({
        sourceLanguage: 'ja',
        targetLanguage,
        monitor: (monitor) => {
          monitor.addEventListener('downloadprogress', (event) => {
            onProgress?.({ loaded: event.loaded, total: event.total });
          });
        },
      })
      .catch((error: unknown) => {
        translatorPromises.delete(targetLanguage);
        throw error;
      });
    translatorPromises.set(targetLanguage, translatorPromise);
  }

  const translator = await translatorPromise;
  if (translator === null) return null;
  return translator.translate(text);
}

export async function destroyOnDeviceTranslator(): Promise<void> {
  const pending = Array.from(translatorPromises.values());
  translatorPromises.clear();
  const translators = await Promise.all(pending.map((promise) => promise.catch(() => null)));
  for (const translator of translators) translator?.destroy();
}
