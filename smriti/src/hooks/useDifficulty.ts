'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { GameType } from '@/lib/supabase/types';
import { db } from '@/lib/db/schema';
import {
  SCORE_WINDOW_DAYS,
  computeCognitiveScore,
  shiftDate,
  type ScoreRow,
} from '@/lib/dashboard/cognitiveScore';
import { decideNextLevel, type CognitiveProfile, type DifficultyDecision } from '@/lib/engine/adaptive';
import type { DifficultyState } from '@/lib/engine/difficulty';
import { usePatientStore } from '@/stores/patientStore';
import { useGameStore } from '@/stores/gameStore';

/**
 * The one way a game page reads and changes its difficulty level.
 *
 * Every game used to hold its own `DifficultyState`, call `adjustDifficulty`
 * and then remember to persist the result — fourteen copies of the same four
 * lines, each free to drift. More to the point, none of them could see the
 * patient: the level moved on session accuracy alone, with no idea whether
 * the last fortnight had gone well or badly. That judgement lives in
 * `lib/engine/adaptive.ts`; this hook is what hands it the patient.
 */
export interface UseDifficulty {
  /** The level to play at right now. */
  level: number;
  state: DifficultyState;
  /** Call once per completed session (or round) with its accuracy, 0-100. */
  applySession: (sessionAccuracy: number) => Promise<DifficultyDecision>;
  /** The last decision, for a "why did this change?" line. Null until one is made. */
  lastDecision: DifficultyDecision | null;
}

/** The patient's recent standing, which decides how freely the level may rise. */
async function loadProfile(patientId: string | undefined, today: string): Promise<CognitiveProfile> {
  if (!patientId) return { band: null, educationYears: 12 };
  const patient = await db.patients.get(patientId);
  const from = shiftDate(today, -(2 * SCORE_WINDOW_DAYS - 1));
  const summaries = await db.dailySummaries
    .toCollection()
    .filter((r) => r.patientId === patientId && r.summaryDate >= from && r.summaryDate <= today && r.totalRounds > 0)
    .toArray();
  const rows: ScoreRow[] = summaries.map((r) => ({
    date: r.summaryDate,
    gameType: r.gameType,
    correctRounds: r.correctRounds,
    totalRounds: r.totalRounds,
    maxDifficultyReached: r.maxDifficultyReached,
  }));
  const score = computeCognitiveScore(rows, today);
  return {
    // Null while there is too little history — the guard then stays out of
    // the way rather than treating a new patient as a struggling one.
    band: score?.enoughData ? score.band : null,
    educationYears: patient?.educationYears ?? 12,
  };
}

export function useDifficulty(gameType: GameType): UseDifficulty {
  const currentPatient = usePatientStore((s) => s.currentPatient);
  const patientId = currentPatient?.id;

  const [state, setState] = useState<DifficultyState>(() => ({
    currentLevel: currentPatient?.currentDifficulty?.[gameType] ?? 1,
    consecutiveHighScores: 0,
    consecutiveLowScores: 0,
  }));
  const [lastDecision, setLastDecision] = useState<DifficultyDecision | null>(null);
  // Null until the patient's recent standing has actually been read.
  const profileRef = useRef<CognitiveProfile | null>(null);

  // Deliberately read once, at mount, exactly as every game page did
  // before this hook existed. Re-reading the saved level while the page is
  // open would move it under a round already in progress — the board is
  // built from it — so a patient who arrives late (shared-phone picker)
  // takes effect when the game page next mounts, not mid-play.

  // Warmed on mount so the decision at the end of the session is instant,
  // but never relied on: `applySession` reads it again below. A session that
  // ended before this resolved was otherwise judged with `band: null`, which
  // skips the guard that protects a struggling patient.
  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    void loadProfile(patientId, today).then((p) => {
      profileRef.current = p;
    });
  }, [patientId]);

  const applySession = useCallback(
    async (sessionAccuracy: number) => {
      // The warmed profile is used when it is ready, and only awaited when
      // it is not. The level must change in the same tick the round ends:
      // awaiting anything first leaves the game rendering at the old level
      // for a frame, which regenerates the board under the patient.
      const profile =
        profileRef.current ?? (await loadProfile(patientId, new Date().toISOString().slice(0, 10)));
      profileRef.current = profile;

      const decision = decideNextLevel({
        state,
        gameType,
        sessionAccuracy,
        sessionEvents: useGameStore.getState().sessionEvents,
        profile,
      });
      setState(decision.next);
      setLastDecision(decision);
      if (patientId) {
        // Awaited, unlike the fire-and-forget calls this replaces: a level
        // that never reached Dexie is a level the next session plays at the
        // old value, and nothing anywhere would have said so.
        await usePatientStore.getState().updateDifficulty(patientId, gameType, decision.next.currentLevel);
      }
      return decision;
    },
    [state, gameType, patientId],
  );

  return { level: state.currentLevel, state, applySession, lastDecision };
}
