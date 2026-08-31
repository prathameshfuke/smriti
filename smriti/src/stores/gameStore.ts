import { create } from 'zustand';
import { v4 as uuid } from 'uuid';
import { db, type LocalGameSession, type LocalTelemetryEvent } from '@/lib/db/schema';
import { buildQueueItem } from '@/lib/db/syncQueue';
import type { GameType } from '@/lib/supabase/types';

/** The caller supplies the round facts; the store owns identity and timing. */
export type RoundResult = Pick<
  LocalTelemetryEvent,
  'gameType' | 'difficultyLevel' | 'roundNumber' | 'isCorrect' | 'responseTimeMs' | 'metadata'
>;

interface GameState {
  activeSession: LocalGameSession | null;
  currentGame: GameType | null;
  sessionEvents: LocalTelemetryEvent[];
  isSessionActive: boolean;
  /**
   * Rounds logged with no session open. Telemetry is the clinical record, so
   * losing it silently would let a caller drop a patient's whole session
   * without anything on screen or in the data saying so.
   */
  droppedEvents: number;
  /** Items shown at session start for delayed recall (MoCA-style). */
  wordStreamItems: string[];
  startSession: (patientId: string) => void;
  endSession: () => Promise<void>;
  logEvent: (round: RoundResult) => void;
  setCurrentGame: (game: GameType | null) => void;
  setWordStreamItems: (items: string[]) => void;
}

export const useGameStore = create<GameState>()((set, get) => ({
  activeSession: null,
  currentGame: null,
  sessionEvents: [],
  isSessionActive: false,
  droppedEvents: 0,
  wordStreamItems: [],

  startSession: (patientId) =>
    set({
      activeSession: {
        id: uuid(),
        patientId,
        startedAt: new Date().toISOString(),
        endedAt: null,
        synced: false,
      },
      sessionEvents: [],
      isSessionActive: true,
      droppedEvents: 0,
    }),

  logEvent: (round) => {
    const { activeSession, sessionEvents, droppedEvents } = get();
    if (!activeSession) {
      console.error('SMRITI: telemetry round logged with no active session', round);
      set({ droppedEvents: droppedEvents + 1 });
      return;
    }

    set({
      sessionEvents: [
        ...sessionEvents,
        {
          id: uuid(),
          sessionId: activeSession.id,
          patientId: activeSession.patientId,
          eventTimestamp: new Date().toISOString(),
          synced: false,
          ...round,
        },
      ],
    });
  },

  endSession: async () => {
    const { activeSession, sessionEvents } = get();
    if (!activeSession) return;

    const closed: LocalGameSession = { ...activeSession, endedAt: new Date().toISOString() };

    // Session, its events and their sync-queue entries are written together:
    // a session row without its telemetry would corrupt the caregiver's
    // adherence numbers, and a row without a queue entry would never reach the
    // server if the device goes offline before the next sync.
    await db.transaction(
      'rw',
      db.gameSessions,
      db.telemetryEvents,
      db.syncQueue,
      async () => {
        await db.gameSessions.put(closed);
        if (sessionEvents.length > 0) await db.telemetryEvents.bulkPut(sessionEvents);

        await db.syncQueue.bulkPut([
          buildQueueItem('game_sessions', closed.id, 'insert', { ...closed }),
          ...sessionEvents.map((e) =>
            buildQueueItem('telemetry_events', e.id, 'insert', { ...e }),
          ),
        ]);
      },
    );

    set({ activeSession: null, isSessionActive: false, currentGame: null, sessionEvents: [] });
  },

  setCurrentGame: (currentGame) => set({ currentGame }),
  setWordStreamItems: (wordStreamItems) => set({ wordStreamItems }),
}));
