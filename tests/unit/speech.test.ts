import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  getJapaneseVoices,
  isSpeechSupported,
  pickJapaneseVoice,
  speakJapanese,
  SpeechPlaybackError,
  splitForSpeech,
  stopSpeaking,
} from '../../src/lib/speech/speech';

class FakeUtterance {
  text: string;
  lang = '';
  rate = 1;
  voice: SpeechSynthesisVoice | null = null;
  onend: (() => void) | null = null;
  onerror: ((event: unknown) => void) | null = null;

  constructor(text: string) {
    this.text = text;
  }
}

interface FakeSynth {
  getVoices: () => SpeechSynthesisVoice[];
  speak: (utterance: SpeechSynthesisUtterance) => void;
  cancel: () => void;
  spoken: FakeUtterance[];
  autoEnd: boolean;
  canceled: number;
}

function installSynth(voices: SpeechSynthesisVoice[], autoEnd = true): FakeSynth {
  const spoken: FakeUtterance[] = [];
  const fake: FakeSynth = {
    spoken,
    autoEnd,
    canceled: 0,
    getVoices: () => voices,
    speak: (utterance) => {
      const fakeUtterance = utterance as unknown as FakeUtterance;
      spoken.push(fakeUtterance);
      if (fake.autoEnd) queueMicrotask(() => fakeUtterance.onend?.());
    },
    cancel: () => {
      fake.canceled += 1;
    },
  };
  vi.stubGlobal('speechSynthesis', fake);
  vi.stubGlobal('SpeechSynthesisUtterance', FakeUtterance);
  return fake;
}

function voice(lang: string, name: string, localService = true): SpeechSynthesisVoice {
  return { lang, name, default: false, localService, voiceURI: name } as SpeechSynthesisVoice;
}

afterEach(() => {
  stopSpeaking();
  vi.unstubAllGlobals();
});

describe('speech', () => {
  it('SP-VOICE-JA prefers exact ja-JP then ja-* voices', () => {
    const voices = [voice('ja', 'Japanese'), voice('en-US', 'English'), voice('ja-JP', 'Kyoko')];
    installSynth(voices);
    expect(getJapaneseVoices().map((item) => item.name)).toEqual(['Japanese', 'Kyoko']);
    expect(pickJapaneseVoice()?.name).toBe('Kyoko');

    stopSpeaking();
    installSynth([voice('ja', 'Japanese'), voice('en-US', 'English')]);
    expect(pickJapaneseVoice()?.name).toBe('Japanese');

    stopSpeaking();
    installSynth([]);
    expect(pickJapaneseVoice()).toBeNull();
    expect(isSpeechSupported()).toBe(true);
  });

  it('SP-VOICE-LOCAL prefers on-device Japanese voices over remote ones', () => {
    installSynth([
      voice('ja-JP', 'Remote Google', false),
      voice('ja-JP', 'Local Kyoko', true),
    ]);
    expect(pickJapaneseVoice()?.name).toBe('Local Kyoko');
  });

  it('SP-CHUNK splits at sentence punctuation and speaks each chunk', async () => {
    expect(splitForSpeech('一つ。二つ。三つ。四つ。', 6)).toEqual(['一つ。二つ。', '三つ。四つ。']);
    expect(splitForSpeech('', 20)).toEqual([]);
    expect(splitForSpeech('   ', 20)).toEqual([]);
    expect(splitForSpeech('あ'.repeat(25), 10)).toEqual(['あ'.repeat(10), 'あ'.repeat(10), 'あ'.repeat(5)]);

    const fake = installSynth([voice('ja-JP', 'Kyoko')]);
    const starts: number[] = [];
    const ends: number[] = [];
    await speakJapanese('一つ。二つ。三つ。', {
      onStart: () => starts.push(1),
      onEnd: () => ends.push(1),
    });

    expect(fake.spoken.map((utterance) => utterance.text)).toEqual(['一つ。二つ。三つ。']);
    expect(fake.spoken[0]?.lang).toBe('ja-JP');
    expect(fake.spoken[0]?.rate).toBe(1);
    expect(fake.spoken[0]?.voice?.name).toBe('Kyoko');
    expect(starts).toHaveLength(1);
    expect(ends).toHaveLength(1);
  });

  it('SP-CANCEL cancels the active utterance and resolves cleanly', async () => {
    const fake = installSynth([voice('ja-JP', 'Kyoko')], false);
    const promise = speakJapanese('長い文。もう一つの文。');
    await vi.waitFor(() => expect(fake.spoken.length).toBe(1));

    stopSpeaking();
    await expect(promise).resolves.toBeUndefined();
    expect(fake.canceled).toBeGreaterThanOrEqual(1);
  });

  it('SP-ERROR rejects with a typed playback error and still calls onEnd', async () => {
    const fake = installSynth([voice('ja-JP', 'Kyoko')], false);
    const ends: number[] = [];
    const promise = speakJapanese('失敗する文。', { onEnd: () => ends.push(1) });
    await vi.waitFor(() => expect(fake.spoken.length).toBe(1));

    fake.spoken[0]?.onerror?.({ error: 'network' });
    await expect(promise).rejects.toBeInstanceOf(SpeechPlaybackError);
    expect(ends).toHaveLength(1);
  });

  it('SP-NO-VOICE still speaks with lang fallback', async () => {
    const fake = installSynth([]);
    await speakJapanese('猫である。');
    expect(fake.spoken).toHaveLength(1);
    expect(fake.spoken[0]?.lang).toBe('ja-JP');
    expect(fake.spoken[0]?.voice).toBeNull();
  });
});
