import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { renderHook, act, waitFor } from '@testing-library/react';
import { db, type LocalPatient } from '@/lib/db/schema';
import { useDifficulty } from '@/hooks/useDifficulty';
import { usePatientStore } from '@/stores/patientStore';
import { useGameStore } from '@/stores/gameStore';

function patient(over: Partial<LocalPatient> = {}): LocalPatient {
  return {
    id: 'p1',
    caregiverId: 'c1',
    displayName: 'Asha',
    ageYears: 72,
    gender: 'female',
    educationYears: 10,
    primaryLanguage: 'hi',
    sessionDurationMinutes: 10,
    isActive: true,
    currentDifficulty: { object_hunt: 4 },
    updatedAt: new Date().toISOString(),
    syncedAt: null,
    ...over,
  };
}

beforeEach(async () => {
  await db.patients.clear();
  await db.dailySummaries.clear();
  await db.syncQueue.clear();
  usePatientStore.setState(usePatientStore.getInitialState(), true);
  useGameStore.setState(useGameStore.getInitialState(), true);
});

describe('useDifficulty', () => {
  it('starts at the level saved on the patient, not at 1', async () => {
    const p = patient();
    await db.patients.put(p);
    usePatientStore.setState({ currentPatient: p });

    const { result } = renderHook(() => useDifficulty('object_hunt'));
    expect(result.current.level).toBe(4);
  });

  it('starts at level 1 for a game the patient has never played', async () => {
    const p = patient({ currentDifficulty: {} });
    await db.patients.put(p);
    usePatientStore.setState({ currentPatient: p });

    const { result } = renderHook(() => useDifficulty('memory_match'));
    expect(result.current.level).toBe(1);
  });

  it('persists a level change to Dexie so the next session starts there', async () => {
    const p = patient();
    await db.patients.put(p);
    usePatientStore.setState({ currentPatient: p });

    const { result } = renderHook(() => useDifficulty('object_hunt'));
    await act(async () => {
      await result.current.applySession(95);
    });

    expect(result.current.level).toBe(5);
    expect((await db.patients.get('p1'))?.currentDifficulty.object_hunt).toBe(5);
  });

  it('does not queue a profile sync for a level change, which would outrank caregiver edits', async () => {
    const p = patient();
    await db.patients.put(p);
    usePatientStore.setState({ currentPatient: p });

    const { result } = renderHook(() => useDifficulty('object_hunt'));
    await act(async () => {
      await result.current.applySession(95);
    });

    // Difficulty is local by design — the server has no column for it, and
    // a queued profile row would only bump `updated_at`.
    expect(await db.syncQueue.where('tableName').equals('patients').count()).toBe(0);
    expect((await db.patients.get('p1'))?.updatedAt).toBe(p.updatedAt);
  });

  it('gives back a reason for the change', async () => {
    const p = patient();
    await db.patients.put(p);
    usePatientStore.setState({ currentPatient: p });

    const { result } = renderHook(() => useDifficulty('object_hunt'));
    await act(async () => {
      await result.current.applySession(40);
    });

    expect(result.current.level).toBe(3);
    expect(result.current.lastDecision?.reason).toMatch(/level 3/);
  });

  it('holds a struggling patient at their level after one good session', async () => {
    const p = patient();
    await db.patients.put(p);
    usePatientStore.setState({ currentPatient: p });
    // Two weeks of weak days puts this patient in a low band, so the guard
    // in lib/engine/adaptive.ts applies.
    const today = new Date();
    for (let i = 0; i < 12; i += 1) {
      const date = new Date(today.getTime() - i * 86_400_000).toISOString().slice(0, 10);
      await db.dailySummaries.put({
        id: `d${i}`,
        patientId: 'p1',
        summaryDate: date,
        gameType: 'object_hunt',
        totalRounds: 10,
        correctRounds: 2,
        avgResponseTimeMs: 4000,
        maxDifficultyReached: 1,
        sessionCount: 1,
        eloRating: 1000,
        synced: true,
      });
    }

    const { result } = renderHook(() => useDifficulty('object_hunt'));
    // Wait for the profile load kicked off on mount.
    await waitFor(() => expect(result.current.level).toBe(4));
    await act(async () => {
      await result.current.applySession(88);
    });

    expect(result.current.level).toBe(4);
    expect(result.current.lastDecision?.source).toBe('guard');
  });
});
