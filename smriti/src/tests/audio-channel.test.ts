import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const findCachedSpeech = vi.fn();
vi.mock('@/lib/ai/speech-cache', () => ({ findCachedSpeech: (...a: unknown[]) => findCachedSpeech(...a), cacheSpeech: vi.fn() }));
vi.mock('@/lib/auth/deviceTrust', () => ({ getDeviceTrustToken: vi.fn().mockResolvedValue(null) }));

class FakeAudio {
  static instances: FakeAudio[] = [];
  src: string;
  paused = true;
  currentTime = 0;
  constructor(src: string) {
    this.src = src;
    FakeAudio.instances.push(this);
  }
  play = vi.fn(() => {
    this.paused = false;
    return Promise.resolve();
  });
  pause = vi.fn(() => {
    this.paused = true;
  });
  addEventListener = vi.fn();
}

const synth = { cancel: vi.fn(), speak: vi.fn(), getVoices: () => [{ lang: 'en-IN' }] };

beforeEach(() => {
  vi.resetModules();
  FakeAudio.instances = [];
  synth.cancel.mockClear();
  synth.speak.mockClear();
  findCachedSpeech.mockReset();
  vi.stubGlobal('Audio', FakeAudio);
  vi.stubGlobal('SpeechSynthesisUtterance', class {
    constructor(public text: string) {}
  });
  Object.defineProperty(window, 'speechSynthesis', { value: synth, configurable: true });
});

afterEach(() => vi.unstubAllGlobals());

const playing = () => FakeAudio.instances.filter((a) => !a.paused);

describe('audio channel', () => {
  it('stops the previous clip when a new one starts', async () => {
    const { playAudio } = await import('@/lib/audio/player');
    playAudio('/a.mp3');
    playAudio('/b.mp3');
    expect(playing().map((a) => a.src)).toEqual(['/b.mp3']);
  });

  it('stops a playing clip when the browser voice speaks', async () => {
    const { playAudio } = await import('@/lib/audio/player');
    const { speak } = await import('@/lib/audio/speech');
    playAudio('/a.mp3');
    speak('Good match', 'en');
    expect(playing()).toHaveLength(0);
    expect(synth.speak).toHaveBeenCalledTimes(1);
  });

  it('drops a narration that was overtaken while its audio was still loading', async () => {
    let resolveFirst: (v: unknown) => void = () => undefined;
    findCachedSpeech
      .mockImplementationOnce(() => new Promise((r) => (resolveFirst = r)))
      .mockResolvedValueOnce({ audioBase64: 'BBB', audioFormat: 'mp3' });
    const { narrate } = await import('@/lib/audio/narrate');

    const first = narrate('Instructions', 'en', true);
    await narrate('Which items did you see?', 'en', true);
    resolveFirst({ audioBase64: 'AAA', audioFormat: 'mp3' });
    await first;

    expect(FakeAudio.instances.map((a) => a.src)).toEqual(['data:audio/mp3;base64,BBB']);
    expect(playing()).toHaveLength(1);
  });

  it('stopAllAudio silences clips and the browser voice', async () => {
    const { playAudio } = await import('@/lib/audio/player');
    const { stopAllAudio } = await import('@/lib/audio/channel');
    playAudio('/a.mp3');
    synth.cancel.mockClear();
    stopAllAudio();
    expect(playing()).toHaveLength(0);
    expect(synth.cancel).toHaveBeenCalled();
  });
});
