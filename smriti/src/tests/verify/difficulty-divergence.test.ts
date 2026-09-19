import { describe, it, expect, vi, afterEach } from 'vitest';
import 'fake-indexeddb/auto';
import { v4 as uuid } from 'uuid';
import { adjustDifficulty, MAX_LEVEL, type DifficultyState } from '@/lib/engine/difficulty';
import * as ml from '@/lib/games/difficulty-ml';
import { db, type LocalPatient, type LocalTelemetryEvent } from '@/lib/db/schema';
import { usePatientStore } from '@/stores/patientStore';
import type { GameType } from '@/lib/supabase/types';

/** Deterministic PRNG so the run is reproducible. */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 2 ** 32);
}

function session(game: GameType, level: number, p: number, rounds: number, r: () => number) {
  const events: LocalTelemetryEvent[] = [];
  for (let i = 0; i < rounds; i++) {
    events.push({
      id: uuid(), sessionId: 's', patientId: 'x', gameType: game, difficultyLevel: level,
      roundNumber: i + 1, isCorrect: r() < p, responseTimeMs: 900 + Math.round(r() * 600),
      eventTimestamp: new Date().toISOString(), metadata: {}, synced: false,
    });
  }
  const acc = (events.filter((e) => e.isCorrect).length / rounds) * 100;
  return { events, acc };
}

const say = (...a: unknown[]) => process.stderr.write(a.join(" ") + "\n");
const GAMES = Object.keys(MAX_LEVEL) as GameType[];

function play(game: GameType, p: number, sessions: number, rounds: number, seed: number) {
  const r = rng(seed);
  let st: DifficultyState = { currentLevel: 1, consecutiveHighScores: 0, consecutiveLowScores: 0 };
  const trace: number[] = [];
  for (let i = 0; i < sessions; i++) {
    const { events, acc } = session(game, st.currentLevel, p, rounds, r);
    st = adjustDifficulty(st, game, acc, events);
    trace.push(st.currentLevel);
  }
  return trace;
}

afterEach(() => vi.restoreAllMocks());

describe('ITEM 1: strong vs struggling patient diverge (engine level)', () => {
  for (const rounds of [1, 8]) {
    it(`every levelling game separates strong (p=.92) and struggling (p=.25) with ${rounds} round(s)/session`, () => {
      const rows: string[] = [];
      for (const g of GAMES) {
        const strong = play(g, 0.92, 40, rounds, 1);
        const weak = play(g, 0.25, 40, rounds, 2);
        rows.push(`${g.padEnd(18)} max=${MAX_LEVEL[g]} strong_end=${strong.at(-1)} weak_end=${weak.at(-1)} strong_peak=${Math.max(...strong)}`);
        if (MAX_LEVEL[g] === 1) continue;
        expect(strong.at(-1)!, g).toBeGreaterThan(weak.at(-1)!);
      }
      say(`rounds=${rounds}\n` + rows.join('\n'));
    });
  }
});

describe('ITEM 1: ML vs rule path really selected', () => {
  const st: DifficultyState = { currentLevel: 3, consecutiveHighScores: 0, consecutiveLowScores: 0 };
  const evs = (n: number, ok: boolean) => session('n_back', 3, ok ? 1 : 0, n, rng(9)).events;

  it('no events -> model never consulted', () => {
    const spy = vi.spyOn(ml, 'predictDifficultyClass');
    adjustDifficulty(st, 'n_back', 95);
    adjustDifficulty(st, 'n_back', 95, []);
    expect(spy).not.toHaveBeenCalled();
  });
  it('events -> model consulted; confident result applied w/o streak', () => {
    const spy = vi.spyOn(ml, 'predictDifficultyClass').mockReturnValue({ predictedClass: 'increase', confidence: 0.9 });
    expect(adjustDifficulty(st, 'n_back', 10, evs(6, true)).currentLevel).toBe(4);
    expect(spy).toHaveBeenCalledTimes(1);
  });
  it('low confidence -> rule engine result (streak needed)', () => {
    vi.spyOn(ml, 'predictDifficultyClass').mockReturnValue({ predictedClass: 'increase', confidence: 0.3 });
    expect(adjustDifficulty(st, 'n_back', 95, evs(6, true)).currentLevel).toBe(3);
  });
  it('real weights: which real inputs are confident vs fall back', () => {
    const out: string[] = [];
    for (const n of [1, 3, 8, 20]) for (const ok of [true, false]) {
      const f = ml.computeFeatures(evs(n, ok))!;
      const p = ml.predictDifficultyClass(f);
      out.push(`n=${n} allCorrect=${ok} -> ${p.predictedClass} ${p.confidence.toFixed(2)}`);
    }
    say(out.join('\n'));
  });
});

const patient = (id: string): LocalPatient => ({
  id, caregiverId: 'c1', displayName: id, ageYears: 70, gender: 'female', educationYears: 5,
  primaryLanguage: 'en', sessionDurationMinutes: 10, isActive: true, currentDifficulty: {},
  updatedAt: '2026-09-01T00:00:00.000Z', syncedAt: null,
});

describe('ITEM 1: persistence is per patient (real Dexie)', () => {
  it('two patients on one phone keep separate levels, surviving a store reset ("reload")', async () => {
    const strong = patient(uuid()); const weak = patient(uuid());
    await db.patients.bulkPut([strong, weak]);
    const store = usePatientStore.getState();
    for (const [p, prob, seed] of [[strong, 0.92, 1], [weak, 0.25, 2]] as const) {
      const r = rng(seed);
      let st: DifficultyState = { currentLevel: 1, consecutiveHighScores: 0, consecutiveLowScores: 0 };
      for (let i = 0; i < 25; i++) {
        const { events, acc } = session('object_hunt', st.currentLevel, prob, 6, r);
        st = adjustDifficulty(st, 'object_hunt', acc, events);
        await store.updateDifficulty(p.id, 'object_hunt', st.currentLevel);
      }
    }
    usePatientStore.setState({ currentPatient: null, allPatients: [] }); // simulate reload: memory gone
    const s = (await db.patients.get(strong.id))!.currentDifficulty.object_hunt;
    const w = (await db.patients.get(weak.id))!.currentDifficulty.object_hunt;
    say('persisted strong=', s, 'weak=', w);
    expect(s).toBeGreaterThan(w);
    expect(Object.keys(localStorage).filter((k) => /difficult/i.test(k))).toEqual([]);
  });
});
