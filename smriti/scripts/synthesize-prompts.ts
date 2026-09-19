/**
 * Pre-synthesizes the app's fixed spoken phrases with Bhashini TTS and writes
 * them to public/audio/<lang>/<id>.<ext> plus public/audio/manifest.json.
 *
 * Run (Node 20+, from smriti/):
 *   set -a; source .env.local; set +a          # exports BHASHINI_* into THIS shell only
 *   npm run audio:synthesize -- --dry-run      # see the plan, no network
 *   npm run audio:synthesize                   # generate everything missing/changed
 *   npm run audio:synthesize -- --lang brx,mni # only some languages
 *   npm run audio:synthesize -- --only tutorial --force
 *
 * Safe to re-run at any time: clips whose source text is unchanged are skipped
 * (resume after an interruption or a rate-limit stop), changed strings are
 * detected by hash and redone, and clips whose prompt or translation has been
 * removed are deleted. The manifest is rewritten after every clip.
 *
 * It calls the same `synthesizeSpeech()` the /api/ai/speak route uses, so
 * discovery, the legacy-key fallback and the one-retry-on-5xx behave exactly
 * as in production. Credentials come only from process.env (BHASHINI_USER_ID
 * + BHASHINI_ULCA_API_KEY, or the legacy BHASHINI_INFERENCE_API_KEY); this
 * script never reads a .env file.
 *
 * A language whose string is missing from its catalog is NOT synthesized from
 * English or from another language. It is listed in docs/audio-coverage.json
 * as needing a translation. A language whose TTS fails or produces invalid
 * audio is listed there as needing a human recording.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { buildExpectedEntries, NO_TTS_LANGUAGES, TTS_LANGUAGES } from '../src/lib/audio/prompts';
import { synthesizeSpeech } from '../src/lib/ai/bhashini-client';
import type { UILanguage } from '../src/lib/i18n/languages';
import {
  EMPTY_MANIFEST,
  addToManifest,
  decodeBase64,
  planWork,
  removeFromManifest,
  serializeManifest,
  validateAudio,
  type Manifest,
} from './synthesize-prompts.lib';

const ROOT = path.resolve(__dirname, '..');
const AUDIO_DIR = path.join(ROOT, 'public', 'audio');
const MANIFEST_PATH = path.join(AUDIO_DIR, 'manifest.json');
const COVERAGE_PATH = path.join(ROOT, 'docs', 'audio-coverage.json');

interface Args {
  dryRun: boolean;
  force: boolean;
  langs?: string[];
  only?: string;
  delayMs: number;
  maxAttempts: number;
  convert: boolean;
  limit?: number;
}

function parseArgs(argv: string[]): Args {
  const args: Args = { dryRun: false, force: false, delayMs: 1500, maxAttempts: 3, convert: true };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => argv[++i];
    if (a === '--dry-run') args.dryRun = true;
    else if (a === '--force') args.force = true;
    else if (a === '--no-convert') args.convert = false;
    else if (a === '--lang') args.langs = next().split(',').map((s) => s.trim());
    else if (a === '--only') args.only = next();
    else if (a === '--delay-ms') args.delayMs = Number(next());
    else if (a === '--attempts') args.maxAttempts = Number(next());
    else if (a === '--limit') args.limit = Number(next());
    else throw new Error(`Unknown argument: ${a}`);
  }
  return args;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function loadManifest(): Manifest {
  if (!existsSync(MANIFEST_PATH)) return EMPTY_MANIFEST;
  const parsed = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8'));
  return { version: 1, languages: parsed.languages ?? {} };
}

function saveManifest(m: Manifest): void {
  const tmp = `${MANIFEST_PATH}.tmp`;
  writeFileSync(tmp, serializeManifest(m));
  renameSync(tmp, MANIFEST_PATH);
}

const clipPath = (lang: string, id: string, ext: string) => path.join(AUDIO_DIR, lang, `${id}.${ext}`);

/** Compresses a WAV to mono AAC in an .m4a when a converter is installed
 * (afconvert ships with macOS; ffmpeg is used if present). Returns null when
 * no tool exists, and the caller keeps the WAV as delivered. */
function convertWav(wavBytes: Uint8Array): { bytes: Uint8Array; ext: string } | null {
  const dir = path.join(os.tmpdir(), `smriti-audio-${process.pid}`);
  mkdirSync(dir, { recursive: true });
  const src = path.join(dir, 'in.wav');
  const dst = path.join(dir, 'out.m4a');
  writeFileSync(src, wavBytes);
  try {
    rmSync(dst, { force: true });
    let ran = spawnSync('afconvert', ['-f', 'm4af', '-d', 'aac', '-b', '32000', '-c', '1', src, dst], { stdio: 'ignore' });
    if (ran.error || ran.status !== 0 || !existsSync(dst)) {
      rmSync(dst, { force: true });
      ran = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', src, '-ac', '1', '-c:a', 'aac', '-b:a', '32k', dst], {
        stdio: 'ignore',
      });
    }
    if (ran.error || ran.status !== 0 || !existsSync(dst)) return null;
    const bytes = new Uint8Array(readFileSync(dst));
    return bytes.length > 200 && bytes.length < wavBytes.length ? { bytes, ext: 'm4a' } : null;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

interface Failure {
  lang: string;
  id: string;
  reason: string;
}

async function synthesizeWithRetry(text: string, lang: UILanguage, args: Args): Promise<Uint8Array> {
  let lastError = 'unknown';
  for (let attempt = 1; attempt <= args.maxAttempts; attempt++) {
    try {
      const result = await synthesizeSpeech(text, lang);
      const bytes = decodeBase64(result.audioBase64);
      const check = validateAudio(bytes);
      if (!check.ok) throw new Error(`invalid audio: ${check.reason}`);
      return bytes;
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      if (attempt < args.maxAttempts) {
        // Rate limited (PoC tier) or a transient 5xx: back off harder each time.
        const backoff = args.delayMs * attempt * (/429|rate/i.test(lastError) ? 8 : 3);
        console.warn(`    attempt ${attempt} failed (${lastError}); waiting ${Math.round(backoff / 1000)}s`);
        await sleep(backoff);
      }
    }
  }
  throw new Error(lastError);
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const hasCreds =
    Boolean(process.env.BHASHINI_USER_ID && process.env.BHASHINI_ULCA_API_KEY) ||
    Boolean(process.env.BHASHINI_INFERENCE_API_KEY);

  const wanted = (args.langs ?? [...TTS_LANGUAGES]) as UILanguage[];
  for (const l of wanted) {
    if ((NO_TTS_LANGUAGES as readonly string[]).includes(l)) {
      console.warn(`! ${l}: Bhashini has no TTS for this language; skipped (needs a human recording).`);
    }
  }
  const languages = wanted.filter((l) => (TTS_LANGUAGES as readonly string[]).includes(l));

  const expected = buildExpectedEntries(TTS_LANGUAGES);
  let manifest = loadManifest();
  const plan = planWork(
    expected.entries,
    manifest,
    (lang, id, ext) => existsSync(clipPath(lang, id, ext)) && statSync(clipPath(lang, id, ext)).size > 200,
    { force: args.force, langs: languages, only: args.only },
  );

  console.log('Plan');
  for (const lang of languages) {
    const total = expected.entries.filter((e) => e.lang === lang).length;
    const todo = plan.todo.filter((w) => w.entry.lang === lang).length;
    const missing = expected.missing.filter((m) => m.lang === lang).length;
    console.log(
      `  ${lang.padEnd(4)} translated ${String(total).padStart(3)} | to synthesize ${String(todo).padStart(3)} | up to date ${String(total - todo).padStart(3)} | no translation yet ${String(missing).padStart(3)}`,
    );
  }
  console.log(`  orphans to delete: ${plan.orphans.length}`);

  if (args.dryRun) {
    console.log(`\nDry run: nothing written. Credentials present in this shell: ${hasCreds ? 'yes' : 'NO'}.`);
    if (!hasCreds) {
      console.log('Real run needs BHASHINI_USER_ID + BHASHINI_ULCA_API_KEY (or BHASHINI_INFERENCE_API_KEY) exported.');
    }
    return;
  }
  if (!hasCreds && plan.todo.length > 0) {
    throw new Error(
      'No Bhashini credentials in the environment. Export BHASHINI_USER_ID and BHASHINI_ULCA_API_KEY ' +
        '(for example: set -a; source .env.local; set +a) and rerun. Use --dry-run to preview without them.',
    );
  }

  for (const o of plan.orphans) {
    rmSync(clipPath(o.lang, o.id, o.ext), { force: true });
    manifest = removeFromManifest(manifest, o.lang, o.id);
  }
  if (plan.orphans.length) saveManifest(manifest);

  const failures: Failure[] = [];
  const abortedLangs = new Set<string>();
  const consecutiveFailures: Record<string, number> = {};
  const bytesWritten: Record<string, number> = {};
  let done = 0;
  const work = args.limit ? plan.todo.slice(0, args.limit) : plan.todo;

  for (const { entry, reason } of work) {
    if (abortedLangs.has(entry.lang)) continue;
    done += 1;
    process.stdout.write(`[${done}/${work.length}] ${entry.lang}/${entry.id} (${reason}) `);
    try {
      let bytes = await synthesizeWithRetry(entry.text, entry.lang, args);
      let ext = 'wav';
      if (args.convert) {
        const converted = convertWav(bytes);
        if (converted) ({ bytes, ext } = converted);
      }
      const previous = manifest.languages[entry.lang]?.[entry.id];
      mkdirSync(path.join(AUDIO_DIR, entry.lang), { recursive: true });
      writeFileSync(clipPath(entry.lang, entry.id, ext), bytes);
      if (previous && previous.ext !== ext) rmSync(clipPath(entry.lang, entry.id, previous.ext), { force: true });
      manifest = addToManifest(manifest, entry.lang, entry.id, { h: entry.hash, ext });
      saveManifest(manifest);
      bytesWritten[entry.lang] = (bytesWritten[entry.lang] ?? 0) + bytes.length;
      consecutiveFailures[entry.lang] = 0;
      console.log(`ok ${bytes.length}B .${ext}`);
    } catch (err) {
      const reasonText = err instanceof Error ? err.message : String(err);
      failures.push({ lang: entry.lang, id: entry.id, reason: reasonText });
      consecutiveFailures[entry.lang] = (consecutiveFailures[entry.lang] ?? 0) + 1;
      console.log(`FAILED (${reasonText})`);
      if (consecutiveFailures[entry.lang] >= 5) {
        abortedLangs.add(entry.lang);
        console.warn(`! ${entry.lang}: 5 failures in a row, stopping this language. Rerun later to resume.`);
      }
    }
    await sleep(args.delayMs);
  }

  const coverage = {
    generatedAt: new Date().toISOString(),
    /** Prompts with no genuine translation in that language's catalog. Fix the locale file, rerun. */
    needsTranslation: Object.fromEntries(
      TTS_LANGUAGES.map((l) => [l, expected.missing.filter((m) => m.lang === l).map((m) => m.id)]),
    ),
    /** Synthesis failed or returned invalid audio. Needs a rerun or a human recording. */
    needsRecording: failures,
    /** No Bhashini TTS exists for these languages at all. */
    noTtsAvailable: NO_TTS_LANGUAGES,
  };
  mkdirSync(path.dirname(COVERAGE_PATH), { recursive: true });
  writeFileSync(COVERAGE_PATH, JSON.stringify(coverage, null, 2) + '\n');

  const total = Object.values(bytesWritten).reduce((a, b) => a + b, 0);
  console.log(`\nDone. ${work.length - failures.length} written, ${failures.length} failed, ${(total / 1e6).toFixed(2)} MB new audio.`);
  console.log(`Coverage report: ${path.relative(ROOT, COVERAGE_PATH)}`);
  if (failures.length) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
