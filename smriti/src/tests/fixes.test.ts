import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import 'fake-indexeddb/auto';
import { db, SmritiDB, type LocalPatient } from '@/lib/db/schema';
import { usePatientStore } from '@/stores/patientStore';
import { useGameStore } from '@/stores/gameStore';
import { hashPin, checkPin } from '@/stores/settingsStore';

const patient = (over: Partial<LocalPatient> = {}): LocalPatient => ({
  id: 'p1',
  caregiverId: 'c1',
  displayName: 'Aai',
  ageYears: 72,
  gender: 'female',
  educationYears: 4,
  primaryLanguage: 'as',
  sessionDurationMinutes: 10,
  isActive: true,
  currentDifficulty: {},
  updatedAt: '2026-08-31T00:00:00.000Z',
  syncedAt: null,
  ...over,
});

beforeEach(async () => {
  await db.patients.clear();
  await db.syncQueue.clear();
  await db.gameSessions.clear();
  await db.telemetryEvents.clear();
  useGameStore.setState(useGameStore.getInitialState(), true);
  usePatientStore.setState(usePatientStore.getInitialState(), true);
});

describe('H1 — service worker runtime caching', () => {
  it('matches absolute asset URLs, not just bare paths', async () => {
    // Workbox runs regExp.exec(url.href), so an anchored pattern never fires.
    const { readFileSync } = await import('node:fs');
    const source = readFileSync('next.config.js', 'utf8');

    const patterns = [...source.matchAll(/urlPattern:\s*\/(.+?)\/,/g)].map(
      (m) => new RegExp(m[1]),
    );
    expect(patterns.length).toBe(3);

    const audio = patterns.find((p) => p.source.includes('audio'));
    const images = patterns.find((p) => p.source.includes('images'));
    expect(audio?.test('https://smriti.app/audio/as/greeting.mp3')).toBe(true);
    expect(images?.test('https://smriti.app/images/games/cow.png')).toBe(true);
    for (const p of patterns) expect(p.source.startsWith('^')).toBe(false);
  });
});

// M2's original placeholder-501 check was retired once alerts/health/patients/sync
// got real handlers — see src/tests/sync.test.ts for their actual behavior.

describe('M3/M4 — caregiver PIN', () => {
  it('stretches the PIN with PBKDF2 at 100k iterations', async () => {
    const stored = await hashPin('1234');
    const [scheme, iterations, salt, digest] = stored.split('$');
    expect(scheme).toBe('pbkdf2');
    expect(Number(iterations)).toBeGreaterThanOrEqual(100_000);
    expect(salt).toHaveLength(32);
    expect(digest).toHaveLength(64);
  });

  it('accepts the right PIN and rejects a wrong one', async () => {
    const stored = await hashPin('1234');
    expect(await checkPin('1234', stored)).toBe(true);
    expect(await checkPin('4321', stored)).toBe(false);
  });

  it('salts each PIN separately', async () => {
    expect(await hashPin('1234')).not.toBe(await hashPin('1234'));
  });

  it('still verifies PINs stored in the pre-PBKDF2 format', async () => {
    const salt = 'a'.repeat(64);
    const buf = await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(`${salt}1234`),
    );
    const legacy = `${salt}:${Array.from(new Uint8Array(buf), (b) =>
      b.toString(16).padStart(2, '0'),
    ).join('')}`;
    expect(await checkPin('1234', legacy)).toBe(true);
    expect(await checkPin('9999', legacy)).toBe(false);
  });

  it('explains itself when Web Crypto is missing instead of throwing a TypeError', async () => {
    const { isPinCryptoAvailable, PinCryptoUnavailableError } = await import(
      '@/stores/settingsStore'
    );
    const original = globalThis.crypto.subtle;
    Object.defineProperty(globalThis.crypto, 'subtle', {
      value: undefined,
      configurable: true,
    });
    try {
      expect(isPinCryptoAvailable()).toBe(false);
      await expect(hashPin('1234')).rejects.toBeInstanceOf(PinCryptoUnavailableError);
    } finally {
      Object.defineProperty(globalThis.crypto, 'subtle', {
        value: original,
        configurable: true,
      });
    }
  });
});

describe('M5 — telemetry with no open session', () => {
  it('counts the dropped round instead of discarding it silently', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    useGameStore.getState().logEvent({
      gameType: 'quick_tap',
      difficultyLevel: 1,
      roundNumber: 1,
      isCorrect: true,
      responseTimeMs: 500,
      metadata: {},
    });
    expect(useGameStore.getState().droppedEvents).toBe(1);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});

describe('M6 — patient reads are caregiver-scoped', () => {
  it('never returns another caregiver on a shared device', async () => {
    await db.patients.bulkAdd([
      patient({ id: 'p1', caregiverId: 'c1' }),
      patient({ id: 'p2', caregiverId: 'c2' }),
      patient({ id: 'p3', caregiverId: 'c1', isActive: false }),
    ]);
    await usePatientStore.getState().loadPatients('c1');
    expect(usePatientStore.getState().allPatients.map((p) => p.id)).toEqual(['p1']);
  });
});

describe('L4 — sync queue', () => {
  it('queues a patient write', async () => {
    await usePatientStore.getState().addPatient(patient());
    const queued = await db.syncQueue.toArray();
    expect(queued.map((q) => q.tableName)).toEqual(['patients']);
    expect(queued[0].recordId).toBe('p1');
  });

  it('queues the session and every telemetry row it closes with', async () => {
    useGameStore.getState().startSession('p1');
    useGameStore.getState().logEvent({
      gameType: 'object_hunt',
      difficultyLevel: 1,
      roundNumber: 1,
      isCorrect: true,
      responseTimeMs: 700,
      metadata: {},
    });
    await useGameStore.getState().endSession();

    const tables = (await db.syncQueue.toArray()).map((q) => q.tableName).sort();
    expect(tables).toEqual(['game_sessions', 'telemetry_events']);
  });
});

describe('L3 — English locale', () => {
  it('greets in English, not with a Hindi loanword', async () => {
    const en = (await import('@/lib/i18n/locales/en.json')).default;
    expect(en.home.greeting).toBe('Hello');
  });
});

afterEach(async () => {
  await SmritiDB.deleteDatabase().catch(() => undefined);
});
