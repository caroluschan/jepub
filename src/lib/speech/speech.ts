import { segmentSentences } from '../text/segmentSentences';

export interface SpeakOptions {
  signal?: AbortSignal;
  onStart?: () => void;
  onEnd?: () => void;
}

export class SpeechPlaybackError extends Error {
  readonly reason: string;

  constructor(reason = 'speech-error') {
    super(`Speech playback failed (${reason}).`);
    this.name = 'SpeechPlaybackError';
    this.reason = reason;
  }
}

let generation = 0;
let activeController: AbortController | null = null;

function speechAvailable(): boolean {
  return typeof speechSynthesis !== 'undefined' && typeof SpeechSynthesisUtterance !== 'undefined';
}

export function isSpeechSupported(): boolean {
  return speechAvailable();
}

export function splitForSpeech(text: string, max = 180): string[] {
  const sentences = segmentSentences(text);
  if (sentences.length === 0) return [];

  const chunks: string[] = [];
  let current = '';

  const flush = (): void => {
    if (current.length > 0) {
      chunks.push(current);
      current = '';
    }
  };

  for (const sentence of sentences) {
    const characters = Array.from(sentence);
    if (characters.length > max) {
      flush();
      for (let index = 0; index < characters.length; index += max) {
        const slice = characters.slice(index, index + max).join('');
        if (slice.length > 0) chunks.push(slice);
      }
      continue;
    }

    if (Array.from(current + sentence).length > max) {
      flush();
      current = sentence;
    } else {
      current += sentence;
    }
  }

  flush();
  return chunks;
}

export function getJapaneseVoices(): SpeechSynthesisVoice[] {
  if (!speechAvailable()) return [];
  return speechSynthesis.getVoices().filter((voice) => voice.lang.toLowerCase().startsWith('ja'));
}

export function pickJapaneseVoice(): SpeechSynthesisVoice | null {
  const voices = getJapaneseVoices();
  // Prefer on-device voices: remote browser voices can stream text to a vendor.
  const local = voices.filter((voice) => voice.localService === true);
  const exactLocal = local.find((voice) => voice.lang.toLowerCase() === 'ja-jp');
  if (exactLocal !== undefined) return exactLocal;
  const exact = voices.find((voice) => voice.lang.toLowerCase() === 'ja-jp');
  return exact ?? local[0] ?? voices[0] ?? null;
}

export function stopSpeaking(): void {
  generation += 1;
  if (activeController !== null) {
    activeController.abort();
    activeController = null;
  }
  if (typeof speechSynthesis !== 'undefined') {
    speechSynthesis.cancel();
  }
}

function speakChunk(
  text: string,
  voice: SpeechSynthesisVoice | null,
  signal: AbortSignal,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'ja-JP';
    utterance.rate = 1;
    if (voice !== null) utterance.voice = voice;

    let settled = false;
    const cleanup = (): boolean => {
      if (settled) return false;
      settled = true;
      signal.removeEventListener('abort', onAbort);
      utterance.onend = null;
      utterance.onerror = null;
      return true;
    };
    const finish = (): void => {
      if (cleanup()) resolve();
    };
    const fail = (event: SpeechSynthesisErrorEvent): void => {
      // An intentional abort surfaces as an `interrupted`/`canceled` error in
      // some engines; the abort signal is the source of truth.
      if (signal.aborted) {
        finish();
        return;
      }
      if (cleanup()) reject(new SpeechPlaybackError(event.error || 'speech-error'));
    };
    const onAbort = (): void => {
      speechSynthesis.cancel();
      finish();
    };

    signal.addEventListener('abort', onAbort, { once: true });
    utterance.onend = finish;
    utterance.onerror = fail;
    speechSynthesis.speak(utterance);
  });
}

export async function speakJapanese(text: string, options: SpeakOptions = {}): Promise<void> {
  stopSpeaking();

  if (!speechAvailable()) return;
  if (options.signal?.aborted === true) {
    options.onEnd?.();
    return;
  }

  const currentGeneration = generation;
  const controller = new AbortController();
  activeController = controller;

  const onCallerAbort = (): void => controller.abort();
  options.signal?.addEventListener('abort', onCallerAbort, { once: true });

  try {
    const chunks = splitForSpeech(text);
    if (chunks.length === 0) {
      options.onEnd?.();
      return;
    }

    const voice = pickJapaneseVoice();
    options.onStart?.();

    for (const chunk of chunks) {
      if (currentGeneration !== generation || controller.signal.aborted) break;
      await speakChunk(chunk, voice, controller.signal);
    }
  } finally {
    options.signal?.removeEventListener('abort', onCallerAbort);
    if (activeController === controller) activeController = null;
    options.onEnd?.();
  }
}
