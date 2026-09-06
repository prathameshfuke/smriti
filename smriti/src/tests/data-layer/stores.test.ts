import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { SmritiDB, db, type LocalPatient } from '@/lib/db/schema';
import { useSettingsStore } from '@/stores/settingsStore';
import { usePatientStore } from '@/stores/patientStore';
import { useGameStore } from '@/stores/gameStore';

const patient = (over: Partial<LocalPatient> = {}): LocalPatient => ({
  id: 'p1',
  caregiverId: 'c1',
  displayName: 'Aai',
  ageYears: 70,
  gender: 'female',
  educationYears: 2,
  primaryLanguage: 'as',
  sessionDurationMinutes: 15,
  isActive: true,
  currentDifficulty: {},
  updatedAt: '2026-08-31T10:00:00.000Z',
  syncedAt: null,
  ...over,
});

beforeEach(async () => {
  window.localStorage.clear();
  useSettingsStore.setState(useSettingsStore.getInitialState(), true);
  usePatientStore.setState(usePatientStore.getInitialState(), true);
  useGameStore.setState(useGameStore.getInitialState(), true);
  if (db.isOpen()) db.close();
  await SmritiDB.deleteDatabase();
  await db.open();
  await db.patients.clear();
});

describe('settingsStore', () => {
  it('initializes with language en', () => {
    expect(useSettingsStore.getState().language).toBe('en');
  });

  it('initializes as a first launch with no PIN set', () => {
    expect(useSettingsStore.getState().isFirstLaunch).toBe(true);
    expect(useSettingsStore.getState().caregiverPinHash).toBeNull();
  });

  it('setLanguage updates state', () => {
    useSettingsStore.getState().setLanguage('hi');
    expect(useSettingsStore.getState().language).toBe('hi');
  });

  it('markLaunched clears the first-launch flag', () => {
    useSettingsStore.getState().markLaunched();
    expect(useSettingsStore.getState().isFirstLaunch).toBe(false);
  });

  it('setPin stores a hash, never the raw PIN', async () => {
    await useSettingsStore.getState().setPin('1234');
    const { caregiverPinHash } = useSettingsStore.getState();
    expect(caregiverPinHash).toBeTruthy();
    expect(caregiverPinHash).not.toContain('1234');
    expect(caregiverPinHash).toMatch(/^pbkdf2\$\d+\$[0-9a-f]{32}\$[0-9a-f]{64}$/);
  });

  it('verifyPin accepts the correct PIN and rejects a wrong one', async () => {
    await useSettingsStore.getState().setPin('1234');
    expect(await useSettingsStore.getState().verifyPin('1234')).toBe(true);
    expect(await useSettingsStore.getState().verifyPin('9999')).toBe(false);
  });
});

describe('patientStore', () => {
  it('starts with no current patient', () => {
    expect(usePatientStore.getState().currentPatient).toBeNull();
    expect(usePatientStore.getState().allPatients).toEqual([]);
  });

  it('setCurrentPatient updates state', () => {
    const p = patient();
    usePatientStore.getState().setCurrentPatient(p);
    expect(usePatientStore.getState().currentPatient?.id).toBe('p1');
    expect(usePatientStore.getState().currentPatient?.displayName).toBe('Aai');
  });

  it('addPatient writes through to Dexie and updates state', async () => {
    await usePatientStore.getState().addPatient(patient());
    expect(await db.patients.get('p1')).toBeTruthy();
    expect(usePatientStore.getState().allPatients).toHaveLength(1);
  });

  it('loadPatients reads active patients from Dexie', async () => {
    await db.patients.bulkAdd([
      patient({ id: 'p1' }),
      patient({ id: 'p2', displayName: 'Deuta' }),
      patient({ id: 'p3', isActive: false }),
    ]);
    await usePatientStore.getState().loadPatients('c1');
    const ids = usePatientStore.getState().allPatients.map((p) => p.id);
    expect(ids.sort()).toEqual(['p1', 'p2']);
  });
});

describe('gameStore', () => {
  it('is not in an active session by default', () => {
    expect(useGameStore.getState().isSessionActive).toBe(false);
    expect(useGameStore.getState().activeSession).toBeNull();
    expect(useGameStore.getState().sessionEvents).toEqual([]);
  });

  it('startSession opens a session for the patient', () => {
    useGameStore.getState().startSession('p1');
    const s = useGameStore.getState();
    expect(s.isSessionActive).toBe(true);
    expect(s.activeSession?.patientId).toBe('p1');
    expect(s.activeSession?.endedAt).toBeNull();
  });

  it('logEvent appends to the session event log', () => {
    useGameStore.getState().startSession('p1');
    useGameStore.getState().setCurrentGame('quick_tap');
    useGameStore.getState().logEvent({
      gameType: 'quick_tap',
      difficultyLevel: 2,
      roundNumber: 1,
      isCorrect: true,
      responseTimeMs: 800,
      metadata: {},
    });
    expect(useGameStore.getState().sessionEvents).toHaveLength(1);
    expect(useGameStore.getState().sessionEvents[0].patientId).toBe('p1');
  });

  it('endSession closes the session and persists events to Dexie', async () => {
    useGameStore.getState().startSession('p1');
    useGameStore.getState().logEvent({
      gameType: 'object_hunt',
      difficultyLevel: 1,
      roundNumber: 1,
      isCorrect: false,
      responseTimeMs: null,
      metadata: {},
    });
    await useGameStore.getState().endSession();

    expect(useGameStore.getState().isSessionActive).toBe(false);
    expect(await db.gameSessions.count()).toBe(1);
    expect(await db.telemetryEvents.count()).toBe(1);
  });

  it('endSession builds a daily_summaries row even with no page-level buildDailySummary call (the dashboard read path)', async () => {
    // Regression for the caregiver dashboard showing "0/7 sessions" /
    // "0% accuracy today" despite played games: /api/patients reads
    // daily_summaries exclusively, but every game page only ever built that
    // row from its own "Finish Session" -> "Go Home" happy path. Exiting via
    // the nav bar's back button (which only ever called endSession) left a
    // fully-synced session with no summary row for the dashboard to show.
    useGameStore.getState().startSession('p1');
    useGameStore.getState().logEvent({
      gameType: 'object_hunt',
      difficultyLevel: 1,
      roundNumber: 1,
      isCorrect: true,
      responseTimeMs: 500,
      metadata: {},
    });
    await useGameStore.getState().endSession();

    const summaries = await db.dailySummaries.toArray();
    expect(summaries).toHaveLength(1);
    expect(summaries[0]).toMatchObject({
      patientId: 'p1',
      gameType: 'object_hunt',
      totalRounds: 1,
      correctRounds: 1,
    });
  });

  it('setWordStreamItems holds the recall list for the session', () => {
    useGameStore.getState().setWordStreamItems(['gamosa', 'bamboo', 'rhino']);
    expect(useGameStore.getState().wordStreamItems).toEqual(['gamosa', 'bamboo', 'rhino']);
  });
});
