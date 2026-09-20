import { describe, it, expect, vi, beforeEach } from 'vitest';
import { speak, resetVoiceWait } from '@/lib/audio/speech';

interface FakeSynth {
  speak: ReturnType<typeof vi.fn>;
  cancel: ReturnType<typeof vi.fn>;
  getVoices: () => SpeechSynthesisVoice[];
  addEventListener: (type: string, listener: () => void) => void;
  removeEventListener: (type: string, listener: () => void) => void;
  fireVoicesChanged: () => void;
}

function voice(lang: string): SpeechSynthesisVoice {
  return { lang, name: `voice-${lang}`, default: false, localService: true, voiceURI: lang } as SpeechSynthesisVoice;
}

function installSynth(initial: SpeechSynthesisVoice[]): FakeSynth {
  let voices = initial;
  const listeners: (() => void)[] = [];
  const synth: FakeSynth = {
    speak: vi.fn(),
    cancel: vi.fn(),
    getVoices: () => voices,
    addEventListener: (_type, listener) => listeners.push(listener),
    removeEventListener: (_type, listener) => {
      const i = listeners.indexOf(listener);
      if (i >= 0) listeners.splice(i, 1);
    },
    fireVoicesChanged: () => {
      voices = [voice('hi-IN'), voice('en-US')];
      for (const l of [...listeners]) l();
    },
  };
  vi.stubGlobal('speechSynthesis', synth);
  Object.defineProperty(window, 'speechSynthesis', { value: synth, configurable: true });
  class FakeUtterance {
    voice: SpeechSynthesisVoice | null = null;
    lang = '';
    constructor(public text: string) {}
  }
  vi.stubGlobal('SpeechSynthesisUtterance', FakeUtterance);
  Object.defineProperty(window, 'SpeechSynthesisUtterance', { value: FakeUtterance, configurable: true });
  return synth;
}

beforeEach(() => {
  vi.unstubAllGlobals();
  resetVoiceWait();
});

describe('speak', () => {
  it('speaks at once when a matching voice is already installed', () => {
    const synth = installSynth([voice('hi-IN')]);
    speak('नमस्ते', 'hi');
    expect(synth.speak).toHaveBeenCalledTimes(1);
  });

  it('waits for the voice list instead of going silent when it is empty on the first call', async () => {
    // Chrome and most Android browsers populate getVoices() asynchronously:
    // the first call on a fresh page returns [], which used to mean every
    // non-English line was dropped for good.
    const synth = installSynth([]);
    speak('नमस्ते', 'hi');
    expect(synth.speak).not.toHaveBeenCalled();

    synth.fireVoicesChanged();
    await vi.waitFor(() => expect(synth.speak).toHaveBeenCalledTimes(1));

    const utterance = synth.speak.mock.calls[0][0] as SpeechSynthesisUtterance;
    expect(utterance.voice?.lang).toBe('hi-IN');
  });

  it('still says nothing when the voice list arrives without that language', async () => {
    const synth = installSynth([]);
    speak('মই ভাল আছোঁ', 'as');
    synth.fireVoicesChanged(); // brings hi and en only
    await vi.waitFor(() => expect(synth.cancel).toHaveBeenCalled());
    expect(synth.speak).not.toHaveBeenCalled();
  });

  it('speaks English even with no voice list, where the default voice is right anyway', () => {
    const synth = installSynth([]);
    speak('Well done', 'en');
    expect(synth.speak).toHaveBeenCalledTimes(1);
  });

  it('does nothing at all where speech is unavailable', () => {
    Object.defineProperty(window, 'speechSynthesis', { value: undefined, configurable: true });
    expect(() => speak('anything', 'hi')).not.toThrow();
  });
});
