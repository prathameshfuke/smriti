import { describe, it, expect, vi, beforeEach } from 'vitest';

const findCachedSpeech = vi.fn();
const cacheSpeech = vi.fn();
vi.mock('@/lib/ai/speech-cache', () => ({
  findCachedSpeech: (...a: unknown[]) => findCachedSpeech(...a),
  cacheSpeech: (...a: unknown[]) => cacheSpeech(...a),
}));
vi.mock('@/lib/auth/deviceTrust', () => ({ getDeviceTrustToken: vi.fn().mockResolvedValue(null) }));

class FakeAudio {
  static instances: FakeAudio[] = [];
  static failSrc: RegExp | null = null;
  static hold = false;
  src: string;
  paused = true;
  currentTime = 0;
  listeners: Record<string, (() => void)[]> = {};
  constructor(src: string) {
    this.src = src;
    FakeAudio.instances.push(this);
  }
  play = vi.fn(() => {
    if (FakeAudio.failSrc?.test(this.src)) return Promise.reject(Object.assign(new Error('x'), { name: 'NotSupportedError' }));
    if (FakeAudio.hold) return new Promise<void>(() => {});
    this.paused = false;
    return Promise.resolve();
  });
  pause = vi.fn();
  addEventListener = vi.fn((ev: string, fn: () => void) => {
    (this.listeners[ev] ??= []).push(fn);
  });
}

const synth = { cancel: vi.fn(), speak: vi.fn(), getVoices: vi.fn(() => [{ lang: 'en-IN' }]) };
const fetchMock = vi.fn();

async function setup(bundled: Record<string, Record<string, string>>) {
  vi.resetModules();
  const bundledMod = await import('@/lib/audio/bundled');
  const { promptHash } = await import('@/lib/audio/prompts');
  const languages: Record<string, Record<string, { h: string; ext: string }>> = {};
  for (const [lang, texts] of Object.entries(bundled)) {
    languages[lang] = {};
    for (const [id, text] of Object.entries(texts)) languages[lang][id] = { h: promptHash(text), ext: 'm4a' };
  }
  bundledMod.__setBundledManifestForTests({ version: 1, languages });
  const { narrate } = await import('@/lib/audio/narrate');
  const { speak } = await import('@/lib/audio/speech');
  return { narrate, speak };
}

beforeEach(() => {
  FakeAudio.instances = [];
  FakeAudio.failSrc = null;
  FakeAudio.hold = false;
  findCachedSpeech.mockReset().mockResolvedValue(null);
  cacheSpeech.mockReset().mockResolvedValue(undefined);
  synth.cancel.mockClear();
  synth.speak.mockClear();
  synth.getVoices.mockReset().mockReturnValue([{ lang: 'en-IN' }]);
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  vi.stubGlobal('Audio', FakeAudio);
  vi.stubGlobal('SpeechSynthesisUtterance', class { constructor(public text: string) {} });
  Object.defineProperty(window, 'speechSynthesis', { value: synth, configurable: true });
});

const audioRes = { ok: true, json: async () => ({ audioBase64: 'AAAA', audioFormat: 'wav' }) };

describe('narrate() playback order: bundled -> Dexie cache -> live Bhashini -> Web Speech -> silent', () => {
  it('1. plays the bundled file first and touches nothing else', async () => {
    const { narrate } = await setup({ as: { 'game.correct': 'শুদ্ধ!' } });
    await narrate('শুদ্ধ!', 'as', true);
    expect(FakeAudio.instances).toHaveLength(1);
    expect(FakeAudio.instances[0].src).toBe('/audio/as/game.correct.m4a');
    expect(findCachedSpeech).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(synth.speak).not.toHaveBeenCalled();
  });

  it('bundled audio is used offline, with no network attempt', async () => {
    const { narrate } = await setup({ hi: { x: 'नमस्ते' } });
    await narrate('नमस्ते', 'hi', false);
    expect(FakeAudio.instances[0].src).toBe('/audio/hi/x.m4a');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('2. no bundled clip -> Dexie speech cache', async () => {
    const { narrate } = await setup({});
    findCachedSpeech.mockResolvedValue({ audioBase64: 'CACHED', audioFormat: 'wav' });
    await narrate('Hello', 'en', true);
    expect(FakeAudio.instances[0].src).toBe('data:audio/wav;base64,CACHED');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('3. no bundled clip, no cache -> live Bhashini via /api/ai/speak, then cached', async () => {
    const { narrate } = await setup({});
    fetchMock.mockResolvedValue(audioRes);
    await narrate('Hello', 'en', true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe('/api/ai/speak');
    expect(FakeAudio.instances[0].src).toBe('data:audio/wav;base64,AAAA');
    expect(cacheSpeech).toHaveBeenCalled();
  });

  it('4. live TTS fails -> Web Speech voice', async () => {
    const { narrate } = await setup({});
    fetchMock.mockResolvedValue({ ok: false, json: async () => ({}) });
    await narrate('Hello', 'en', true);
    expect(synth.speak).toHaveBeenCalledTimes(1);
  });

  it('4b. offline and nothing stored -> Web Speech voice, no fetch', async () => {
    const { narrate } = await setup({});
    await narrate('Hello', 'en', false);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(synth.speak).toHaveBeenCalledTimes(1);
  });

  it('5. no bundle, no cache, no network, no matching voice (Assamese) -> silent, never throws', async () => {
    const { narrate } = await setup({});
    await expect(narrate('শুদ্ধ!', 'as', false)).resolves.toBeUndefined();
    expect(synth.speak).not.toHaveBeenCalled();
    expect(FakeAudio.instances).toHaveLength(0);
  });

  it('a bundled clip that fails to play falls through to the next tier instead of going silent', async () => {
    const { narrate } = await setup({ en: { x: 'Hello' } });
    FakeAudio.failSrc = /\/audio\/en\//;
    fetchMock.mockResolvedValue(audioRes);
    await narrate('Hello', 'en', true);
    expect(FakeAudio.instances.map((a) => a.src)).toEqual(['/audio/en/x.m4a', 'data:audio/wav;base64,AAAA']);
  });

  it('a bundled clip whose file errors on load falls through as well', async () => {
    const { narrate } = await setup({ en: { x: 'Hello' } });
    FakeAudio.hold = true;
    const p = narrate('Hello', 'en', false);
    await vi.waitFor(() => expect(FakeAudio.instances).toHaveLength(1));
    for (const fn of FakeAudio.instances[0].listeners.error ?? []) fn();
    await p;
    await vi.waitFor(() => expect(synth.speak).toHaveBeenCalledTimes(1));
  });
});

describe('no cross-language substitution', () => {
  it('Bodo never plays Hindi audio even when Hindi has the identical string', async () => {
    const { narrate } = await setup({ hi: { x: 'नमस्ते' } });
    await narrate('नमस्ते', 'brx', false);
    expect(FakeAudio.instances.some((a) => a.src.includes('/audio/hi/'))).toBe(false);
    expect(FakeAudio.instances).toHaveLength(0);
  });

  it('findBundledAudio only searches the requested language bucket', async () => {
    await setup({ hi: { x: 'नमस्ते' }, mni: {} });
    const { findBundledAudio } = await import('@/lib/audio/bundled');
    expect(findBundledAudio('hi', 'नमस्ते')).toBe('/audio/hi/x.m4a');
    expect(findBundledAudio('brx', 'नमस्ते')).toBeNull();
    expect(findBundledAudio('mni', 'नमस्ते')).toBeNull();
    expect(findBundledAudio('as', 'नमस्ते')).toBeNull();
  });

  it('speak() with no Manipuri voice stays silent instead of reading with another language', async () => {
    const { speak } = await setup({ hi: { x: 'नमस्ते' } });
    speak('नमस्ते', 'mni');
    expect(synth.speak).not.toHaveBeenCalled();
    expect(FakeAudio.instances).toHaveLength(0);
  });
});

describe('Khasi and Mizo are text-only', () => {
  it.each(['kha', 'lus'] as const)('%s online: no request to the speech service, silent with only an English voice installed', async (code) => {
    const { narrate } = await setup({});
    await expect(narrate('Ka jingpyrshang', code, true)).resolves.toBeUndefined();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(synth.speak).not.toHaveBeenCalled();
    expect(FakeAudio.instances).toHaveLength(0);
  });

  it.each(['kha', 'lus'] as const)('%s uses a device voice only when one for exactly that language is installed', async (code) => {
    synth.getVoices.mockReturnValue([{ lang: 'en-IN' }, { lang: 'hi-IN' }, { lang: `${code}-IN` }]);
    const { narrate } = await setup({});
    await narrate('Hello', code, true);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(synth.speak).toHaveBeenCalledTimes(1);
  });
});

describe('speak() (game feedback lines) also prefers bundled clips', () => {
  it('plays the bundled clip when the line is bundled', async () => {
    const { speak } = await setup({ as: { 'game.correct': 'শুদ্ধ!' } });
    speak('শুদ্ধ!', 'as');
    expect(FakeAudio.instances[0].src).toBe('/audio/as/game.correct.m4a');
    expect(synth.speak).not.toHaveBeenCalled();
  });

  it('uses the Web Speech voice when the line is not bundled (behaviour unchanged)', async () => {
    const { speak } = await setup({});
    speak('Hello', 'en');
    expect(synth.speak).toHaveBeenCalledTimes(1);
  });

  it('falls back to the voice when the bundled clip cannot play', async () => {
    const { speak } = await setup({ en: { x: 'Hello' } });
    FakeAudio.failSrc = /\/audio\/en\//;
    speak('Hello', 'en');
    await vi.waitFor(() => expect(synth.speak).toHaveBeenCalledTimes(1));
  });
});
