import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

const at = (p: string) => resolve(process.cwd(), p);
const exists = (p: string) => existsSync(at(p));

describe('project structure', () => {
  it.each([
    'src/app',
    'src/app/games/object-hunt',
    'src/app/games/word-stream',
    'src/app/games/quick-tap',
    'src/app/games/path-match',
    'src/app/reminders',
    'src/app/caregiver/dashboard',
    'src/app/caregiver/patients',
    'src/app/caregiver/login',
    'src/app/caregiver/onboarding',
    'src/app/caregiver/settings',
    'src/app/api/sync',
    'src/app/api/health',
    'src/app/api/patients',
    'src/app/api/alerts',
    'src/components/ui',
    'src/components/games',
    'src/components/layout',
    'src/lib/db',
    'src/lib/engine',
    'src/lib/audio',
    'src/lib/i18n/locales',
    'src/lib/supabase',
    'src/hooks',
    'src/stores',
    'src/tests',
  ])('has directory %s', (dir) => {
    expect(exists(dir)).toBe(true);
  });

  it.each([
    'public/audio/as',
    'public/audio/hi',
    'public/audio/en',
    'public/icons',
    'public/images',
  ])('has public asset directory %s', (dir) => {
    expect(exists(dir)).toBe(true);
  });

  it('keeps empty asset directories alive in git via .gitkeep', () => {
    // Git does not track empty directories; without .gitkeep the next-pwa
    // CacheFirst rules for /audio/* and /images/* point at paths that do not
    // survive a fresh clone.
    for (const dir of [
      'public/audio/as',
      'public/audio/hi',
      'public/audio/en',
      'public/icons',
      'public/images',
    ]) {
      expect(exists(`${dir}/.gitkeep`), `${dir}/.gitkeep missing`).toBe(true);
    }
  });

  it.each([
    'src/lib/db/schema.ts',
    'src/lib/db/sync.ts',
    'src/lib/engine/difficulty.ts',
    'src/lib/engine/scoring.ts',
    'src/lib/engine/telemetry.ts',
    'src/lib/engine/alerts.ts',
    'src/lib/audio/player.ts',
    'src/lib/audio/prompts.ts',
    'src/lib/i18n/provider.tsx',
    'src/lib/supabase/client.ts',
    'src/lib/supabase/types.ts',
    'src/hooks/useOfflineStatus.ts',
    'src/hooks/useAudioPrompt.ts',
    'src/hooks/useGameSession.ts',
    'src/hooks/useDifficulty.ts',
    'src/hooks/useSync.ts',
    'src/stores/patientStore.ts',
    'src/stores/gameStore.ts',
    'src/stores/settingsStore.ts',
    'src/tests/setup.ts',
  ])('has module %s', (file) => {
    expect(exists(file)).toBe(true);
  });

  it.each(['as', 'hi', 'en'])('has a %s locale file', (locale) => {
    expect(exists(`src/lib/i18n/locales/${locale}.json`)).toBe(true);
  });

  it('has config files at the project root', () => {
    expect(exists('next.config.js')).toBe(true);
    expect(exists('tailwind.config.ts')).toBe(true);
    expect(exists('vitest.config.ts')).toBe(true);
    expect(exists('public/manifest.json')).toBe(true);
    expect(exists('.env.local.example')).toBe(true);
  });

  it('tracks .env.local.example in git rather than ignoring it', () => {
    // The Next.js default .gitignore has a broad `.env*` rule that silently
    // swallows the committed template, leaving a fresh clone with no
    // Supabase env reference.
    let ignored: boolean;
    try {
      execFileSync('git', ['check-ignore', '-q', '.env.local.example'], {
        cwd: process.cwd(),
        stdio: 'ignore',
      });
      ignored = true;
    } catch {
      ignored = false;
    }
    expect(ignored, '.env.local.example is excluded by .gitignore').toBe(false);
  });
});
