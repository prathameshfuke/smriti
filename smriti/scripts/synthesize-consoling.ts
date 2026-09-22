/**
 * One-time synthesis of the consoling/grounding clips played when a patient
 * logs "Not so good" (src/lib/audio/consoling.ts). Run once per new or
 * edited message, not at request time — the whole point is a cached static
 * file, never a live TTS call at the moment someone taps "Not so good".
 *
 *   SARVAM_API_KEY=... npx tsx scripts/synthesize-consoling.ts
 *   SARVAM_API_KEY=... npx tsx scripts/synthesize-consoling.ts --lang hi,as
 *
 * Writes public/audio/consoling/<lang>/msg-<n>.m4a (1-indexed, matching
 * CONSOLING_MESSAGES' order in consoling.ts). Skips a clip whose file
 * already exists unless --force is given, so an interrupted run resumes
 * instead of re-spending API calls. The key is read from the environment
 * only, never written to a file.
 */
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { CONSOLING_TEXT_LANGUAGES, CONSOLING_MESSAGES, type ConsolingTextLanguage } from '../src/lib/audio/consoling';
import { validateAudio } from './synthesize-prompts.lib';

const SARVAM_CODES: Record<ConsolingTextLanguage, string> = {
  en: 'en-IN',
  hi: 'hi-IN',
  as: 'as-IN',
  bn: 'bn-IN',
  ne: 'ne-IN',
};

const URL = 'https://api.sarvam.ai/text-to-speech';
const AUDIO_DIR = path.resolve(__dirname, '..', 'public', 'audio', 'consoling');
const ATTEMPTS = 3;

interface Args {
  langs?: ConsolingTextLanguage[];
  force: boolean;
}

function parseArgs(argv: string[]): Args {
  const args: Args = { force: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--force') args.force = true;
    else if (a === '--lang') {
      const list = argv[++i].split(',').map((s) => s.trim());
      for (const l of list) if (!(l in SARVAM_CODES)) throw new Error(`unknown language: ${l}`);
      args.langs = list as ConsolingTextLanguage[];
    } else throw new Error(`unknown argument: ${a}`);
  }
  return args;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** afconvert (macOS) or ffmpeg, whichever exists — same fallback order
 * synthesize-prompts.ts already uses. Throws if neither is available: an
 * un-converted WAV would break the .m4a path every player expects. */
function wavToM4a(wavBytes: Uint8Array): Uint8Array {
  const dir = path.join(os.tmpdir(), `smriti-consoling-${process.pid}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  const src = path.join(dir, 'in.wav');
  const dst = path.join(dir, 'out.m4a');
  writeFileSync(src, wavBytes);
  try {
    let ran = spawnSync('afconvert', ['-f', 'm4af', '-d', 'aac', '-b', '32000', '-c', '1', src, dst], { stdio: 'ignore' });
    if (ran.error || ran.status !== 0 || !existsSync(dst)) {
      ran = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', src, '-ac', '1', '-c:a', 'aac', '-b:a', '32k', dst], {
        stdio: 'ignore',
      });
    }
    if (ran.error || ran.status !== 0 || !existsSync(dst)) {
      throw new Error('no working audio converter found (need afconvert or ffmpeg)');
    }
    const { readFileSync } = require('node:fs');
    return new Uint8Array(readFileSync(dst));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

async function synthesize(text: string, langCode: string, key: string): Promise<Uint8Array> {
  let lastError = 'unknown';
  for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
    try {
      const res = await fetch(URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'api-subscription-key': key },
        body: JSON.stringify({
          text,
          target_language_code: langCode,
          model: 'bulbul:v3',
          speaker: 'priya',
          speech_sample_rate: 22050,
          enable_preprocessing: true,
        }),
        signal: AbortSignal.timeout(30_000),
      });
      if (!res.ok) throw new Error(`Sarvam returned ${res.status}: ${await res.text().catch(() => '')}`);
      const body = (await res.json()) as { audios?: string[] };
      const b64 = body.audios?.[0];
      if (!b64) throw new Error(`Sarvam response had no audio: ${JSON.stringify(body).slice(0, 200)}`);
      const wav = new Uint8Array(Buffer.from(b64, 'base64'));
      const check = validateAudio(wav);
      if (!check.ok) throw new Error(`invalid audio: ${check.reason}`);
      return wav;
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      if (attempt < ATTEMPTS) await sleep(1000 * 2 ** (attempt - 1));
    }
  }
  throw new Error(`gave up after ${ATTEMPTS} attempts: ${lastError}`);
}

async function main() {
  const key = process.env.SARVAM_API_KEY;
  if (!key) {
    console.error('SARVAM_API_KEY is not set');
    process.exit(1);
  }
  let args: Args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (err) {
    console.error((err as Error).message);
    process.exit(1);
  }
  const langs = args.langs ?? [...CONSOLING_TEXT_LANGUAGES];

  let failed = 0;
  for (const lang of langs) {
    const dir = path.join(AUDIO_DIR, lang);
    mkdirSync(dir, { recursive: true });
    const messages = CONSOLING_MESSAGES[lang];
    for (let i = 0; i < messages.length; i++) {
      const file = path.join(dir, `msg-${i + 1}.m4a`);
      if (existsSync(file) && !args.force) {
        console.log(`${lang}/msg-${i + 1}: already exists, skipping`);
        continue;
      }
      try {
        const wav = await synthesize(messages[i], SARVAM_CODES[lang], key);
        const m4a = wavToM4a(wav);
        writeFileSync(file, m4a);
        console.log(`${lang}/msg-${i + 1}: wrote ${m4a.length} bytes`);
      } catch (err) {
        failed += 1;
        console.error(`${lang}/msg-${i + 1}: FAILED — ${(err as Error).message}`);
      }
    }
  }
  if (failed > 0) {
    console.error(`\n${failed} clip(s) failed. Rerun to retry (existing files are skipped).`);
    process.exitCode = 1;
  } else {
    console.log('\nAll consoling clips synthesized.');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
