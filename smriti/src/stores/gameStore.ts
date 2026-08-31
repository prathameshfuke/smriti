import { create } from 'zustand';
import { v4 as uuid } from 'uuid';
import { db, type LocalGameSession, type LocalTelemetryEvent } from '@/lib/db/schema';
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
    }),

  logEvent: (round) => {
    const { activeSession, sessionEvents } = get();
    if (!activeSession) return;

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

    // Session and its events are written together: a session row without its
    // telemetry would corrupt the caregiver's adherence numbers.
    await db.transaction('rw', db.gameSessions, db.telemetryEvents, async () => {
      await db.gameSessions.put(closed);
      if (sessionEvents.length > 0) await db.telemetryEvents.bulkPut(sessionEvents);
    });

    set({ activeSession: null, isSessionActive: false, currentGame: null, sessionEvents: [] });
  },

  setCurrentGame: (currentGame) => set({ currentGame }),
  setWordStreamItems: (wordStreamItems) => set({ wordStreamItems }),
}));
