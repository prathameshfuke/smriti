# SMRITI — Database Schema

> **Live schema drift**: `bn`/`ne` were added to the `preferred_language`/
> `primary_language` CHECK constraints below on 2026-09-12 (multilingual
> expansion, Part 2) as a doc update only — this needs a real
> `ALTER TABLE ... DROP CONSTRAINT ... ADD CONSTRAINT ...` run against the
> live Supabase project before caregiver/patient records can actually use
> those values server-side. Until then, `pushCaregiverProfile` (which
> writes these columns) fails that write silently and keeps the local
> Dexie record as source of truth — the app stays fully usable offline,
> only the caregiver-dashboard sync of a bn/ne profile is affected.

---

## 1. Supabase (PostgreSQL) — Server-Side Schema

```sql
-- =============================================
-- MIGRATION 001: Core Tables
-- =============================================

-- Caregivers (authenticated users)
CREATE TABLE caregivers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_id UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  role TEXT NOT NULL DEFAULT 'family' CHECK (role IN ('family', 'asha_worker', 'nurse', 'clinician')),
  preferred_language TEXT NOT NULL DEFAULT 'en' CHECK (preferred_language IN ('as', 'hi', 'en', 'mni', 'brx', 'bn', 'ne')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Patients (managed by caregivers, no direct auth)
CREATE TABLE patients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  caregiver_id UUID NOT NULL REFERENCES caregivers(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  age_years INTEGER CHECK (age_years >= 40 AND age_years <= 120),
  gender TEXT CHECK (gender IN ('male', 'female', 'other')),
  education_years INTEGER DEFAULT 0 CHECK (education_years >= 0),
  primary_language TEXT NOT NULL DEFAULT 'as' CHECK (primary_language IN ('as', 'hi', 'en', 'mni', 'brx', 'kha', 'lus', 'bn', 'ne')),
  session_duration_minutes INTEGER NOT NULL DEFAULT 15 CHECK (session_duration_minutes BETWEEN 5 AND 30),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Game Sessions
CREATE TABLE game_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ,
  device_id TEXT,                     -- Identifies which device was used
  sync_received_at TIMESTAMPTZ DEFAULT now()
);

-- Telemetry Events (append-only, immutable)
CREATE TABLE telemetry_events (
  id UUID PRIMARY KEY,                -- Generated client-side
  session_id UUID NOT NULL REFERENCES game_sessions(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  game_type TEXT NOT NULL CHECK (game_type IN ('object_hunt', 'word_stream', 'quick_tap', 'path_match')),
  difficulty_level INTEGER NOT NULL CHECK (difficulty_level BETWEEN 1 AND 20),
  round_number INTEGER NOT NULL,
  is_correct BOOLEAN NOT NULL,
  response_time_ms INTEGER,           -- NULL if timed out
  event_timestamp TIMESTAMPTZ NOT NULL,
  metadata JSONB DEFAULT '{}',        -- Game-specific data (e.g., which objects shown)
  sync_received_at TIMESTAMPTZ DEFAULT now()
);

-- Daily Summaries (aggregated from telemetry, one per patient per game per day)
CREATE TABLE daily_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  summary_date DATE NOT NULL,
  game_type TEXT NOT NULL CHECK (game_type IN ('object_hunt', 'word_stream', 'quick_tap', 'path_match')),
  total_rounds INTEGER NOT NULL DEFAULT 0,
  correct_rounds INTEGER NOT NULL DEFAULT 0,
  accuracy_pct NUMERIC(5,2) GENERATED ALWAYS AS (
    CASE WHEN total_rounds > 0 THEN (correct_rounds::numeric / total_rounds * 100) ELSE 0 END
  ) STORED,
  avg_response_time_ms INTEGER,
  max_difficulty_reached INTEGER NOT NULL DEFAULT 1,
  session_count INTEGER NOT NULL DEFAULT 1,
  elo_rating NUMERIC(8,2) DEFAULT 1200.00,  -- Per-domain Elo (Phase 2)
  sync_received_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(patient_id, summary_date, game_type)
);

-- Reminder Schedules (caregiver-configurable)
CREATE TABLE reminder_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  reminder_type TEXT NOT NULL CHECK (reminder_type IN ('medication', 'hydration', 'activity', 'appointment')),
  label TEXT NOT NULL,                -- e.g., "Red pill", "Morning walk"
  time_of_day TIME NOT NULL,          -- When to fire
  days_of_week INTEGER[] DEFAULT '{0,1,2,3,4,5,6}', -- 0=Sun, 6=Sat
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Reminder Acknowledgments (from patient interaction)
CREATE TABLE reminder_acks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reminder_id UUID NOT NULL REFERENCES reminder_schedules(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  scheduled_at TIMESTAMPTZ NOT NULL,
  acknowledged_at TIMESTAMPTZ,        -- NULL = not acknowledged
  ack_method TEXT CHECK (ack_method IN ('touch', 'voice', 'caregiver')),
  sync_received_at TIMESTAMPTZ DEFAULT now()
);

-- Alerts (generated server-side during sync)
CREATE TABLE alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  caregiver_id UUID NOT NULL REFERENCES caregivers(id) ON DELETE CASCADE,
  alert_type TEXT NOT NULL CHECK (alert_type IN ('cognitive_drop', 'missed_sessions', 'low_adherence')),
  severity TEXT NOT NULL CHECK (severity IN ('red', 'yellow', 'green')),
  title TEXT NOT NULL,
  description TEXT,
  is_read BOOLEAN NOT NULL DEFAULT false,
  is_resolved BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ
);

-- Indexes for common queries
CREATE INDEX idx_telemetry_patient_date ON telemetry_events(patient_id, event_timestamp);
CREATE INDEX idx_summaries_patient_date ON daily_summaries(patient_id, summary_date);
CREATE INDEX idx_alerts_caregiver_unread ON alerts(caregiver_id, is_read) WHERE is_read = false;
CREATE INDEX idx_reminder_acks_patient ON reminder_acks(patient_id, scheduled_at);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_caregivers_updated_at BEFORE UPDATE ON caregivers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_patients_updated_at BEFORE UPDATE ON patients
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_reminders_updated_at BEFORE UPDATE ON reminder_schedules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

```sql
-- =============================================
-- MIGRATION 002: Row Level Security
-- =============================================

ALTER TABLE caregivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE telemetry_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE reminder_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE reminder_acks ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;

-- Caregivers can only see/edit their own record
CREATE POLICY caregiver_self ON caregivers
  FOR ALL USING (auth_id = auth.uid());

-- Caregivers can only see/edit their own patients
CREATE POLICY caregiver_patients ON patients
  FOR ALL USING (caregiver_id IN (
    SELECT id FROM caregivers WHERE auth_id = auth.uid()
  ));

-- Cascade: all patient-linked tables inherit patient access
CREATE POLICY caregiver_sessions ON game_sessions
  FOR ALL USING (patient_id IN (
    SELECT id FROM patients WHERE caregiver_id IN (
      SELECT id FROM caregivers WHERE auth_id = auth.uid()
    )
  ));

-- Same pattern for all other patient-linked tables
CREATE POLICY caregiver_telemetry ON telemetry_events
  FOR ALL USING (patient_id IN (
    SELECT id FROM patients WHERE caregiver_id IN (
      SELECT id FROM caregivers WHERE auth_id = auth.uid()
    )
  ));

CREATE POLICY caregiver_summaries ON daily_summaries
  FOR ALL USING (patient_id IN (
    SELECT id FROM patients WHERE caregiver_id IN (
      SELECT id FROM caregivers WHERE auth_id = auth.uid()
    )
  ));

CREATE POLICY caregiver_reminders ON reminder_schedules
  FOR ALL USING (patient_id IN (
    SELECT id FROM patients WHERE caregiver_id IN (
      SELECT id FROM caregivers WHERE auth_id = auth.uid()
    )
  ));

CREATE POLICY caregiver_acks ON reminder_acks
  FOR ALL USING (patient_id IN (
    SELECT id FROM patients WHERE caregiver_id IN (
      SELECT id FROM caregivers WHERE auth_id = auth.uid()
    )
  ));

CREATE POLICY caregiver_alerts ON alerts
  FOR ALL USING (caregiver_id IN (
    SELECT id FROM caregivers WHERE auth_id = auth.uid()
  ));
```

---

## 2. Client-Side Schema (Dexie.js / IndexedDB)

```typescript
// src/lib/db/schema.ts
import Dexie, { type Table } from 'dexie';

export interface LocalPatient {
  id: string;
  caregiverId: string;
  displayName: string;
  ageYears: number;
  gender: 'male' | 'female' | 'other';
  educationYears: number;
  primaryLanguage: string;
  sessionDurationMinutes: number;
  isActive: boolean;
  currentDifficulty: Record<string, number>; // per game type
  updatedAt: string;
  syncedAt: string | null;
}

export interface LocalGameSession {
  id: string;
  patientId: string;
  startedAt: string;
  endedAt: string | null;
  synced: boolean;
}

export interface LocalTelemetryEvent {
  id: string;
  sessionId: string;
  patientId: string;
  gameType: 'object_hunt' | 'word_stream' | 'quick_tap' | 'path_match';
  difficultyLevel: number;
  roundNumber: number;
  isCorrect: boolean;
  responseTimeMs: number | null;
  eventTimestamp: string;
  metadata: Record<string, unknown>;
  synced: boolean;
}

export interface LocalDailySummary {
  id: string;
  patientId: string;
  summaryDate: string;
  gameType: string;
  totalRounds: number;
  correctRounds: number;
  avgResponseTimeMs: number;
  maxDifficultyReached: number;
  sessionCount: number;
  eloRating: number;
  synced: boolean;
}

export interface LocalReminderSchedule {
  id: string;
  patientId: string;
  reminderType: 'medication' | 'hydration' | 'activity' | 'appointment';
  label: string;
  timeOfDay: string;
  daysOfWeek: number[];
  isActive: boolean;
  updatedAt: string;
}

export interface LocalReminderAck {
  id: string;
  reminderId: string;
  patientId: string;
  scheduledAt: string;
  acknowledgedAt: string | null;
  ackMethod: 'touch' | 'voice' | 'caregiver' | null;
  synced: boolean;
}

export interface SyncQueueItem {
  id: string;
  tableName: string;
  recordId: string;
  operation: 'insert' | 'update';
  payload: Record<string, unknown>;
  createdAt: string;
  attempts: number;
}

class SmritiDB extends Dexie {
  patients!: Table<LocalPatient>;
  gameSessions!: Table<LocalGameSession>;
  telemetryEvents!: Table<LocalTelemetryEvent>;
  dailySummaries!: Table<LocalDailySummary>;
  reminderSchedules!: Table<LocalReminderSchedule>;
  reminderAcks!: Table<LocalReminderAck>;
  syncQueue!: Table<SyncQueueItem>;

  constructor() {
    super('smriti');
    this.version(1).stores({
      patients: 'id, caregiverId, isActive',
      gameSessions: 'id, patientId, startedAt, synced',
      telemetryEvents: 'id, sessionId, patientId, gameType, eventTimestamp, synced',
      dailySummaries: 'id, [patientId+summaryDate+gameType], synced',
      reminderSchedules: 'id, patientId, reminderType, isActive',
      reminderAcks: 'id, reminderId, patientId, scheduledAt, synced',
      syncQueue: 'id, tableName, createdAt'
    });
  }
}

export const db = new SmritiDB();
```

---

## 3. Alert Generation Logic (Server-Side)

```sql
-- Function to check for cognitive drops during sync
CREATE OR REPLACE FUNCTION check_cognitive_alerts(p_patient_id UUID)
RETURNS void AS $$
DECLARE
  v_caregiver_id UUID;
  v_game_type TEXT;
  v_rolling_avg NUMERIC;
  v_rolling_stddev NUMERIC;
  v_latest_accuracy NUMERIC;
  v_missed_sessions INTEGER;
  v_adherence_pct NUMERIC;
BEGIN
  SELECT caregiver_id INTO v_caregiver_id FROM patients WHERE id = p_patient_id;

  -- Check each game type for sudden cognitive drops
  FOR v_game_type IN SELECT DISTINCT game_type FROM daily_summaries WHERE patient_id = p_patient_id LOOP
    -- 7-day rolling average and stddev (excluding today)
    SELECT AVG(accuracy_pct), STDDEV(accuracy_pct)
    INTO v_rolling_avg, v_rolling_stddev
    FROM daily_summaries
    WHERE patient_id = p_patient_id
      AND game_type = v_game_type
      AND summary_date BETWEEN CURRENT_DATE - 8 AND CURRENT_DATE - 1;

    -- Today's accuracy
    SELECT accuracy_pct INTO v_latest_accuracy
    FROM daily_summaries
    WHERE patient_id = p_patient_id
      AND game_type = v_game_type
      AND summary_date = CURRENT_DATE;

    -- RED alert: >2 SD drop from rolling average
    IF v_rolling_stddev IS NOT NULL AND v_rolling_stddev > 0
       AND v_latest_accuracy < (v_rolling_avg - 2 * v_rolling_stddev) THEN
      INSERT INTO alerts (patient_id, caregiver_id, alert_type, severity, title, description)
      VALUES (
        p_patient_id, v_caregiver_id, 'cognitive_drop', 'red',
        'Sudden cognitive score drop detected',
        format('Accuracy in %s dropped to %.0f%% (7-day avg: %.0f%%). This may indicate a treatable condition (UTI, dehydration, medication change). Please check on the patient.', v_game_type, v_latest_accuracy, v_rolling_avg)
      )
      ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;

  -- Check missed sessions (3+ consecutive days)
  SELECT COUNT(*) INTO v_missed_sessions
  FROM generate_series(CURRENT_DATE - 3, CURRENT_DATE - 1, '1 day') d
  WHERE NOT EXISTS (
    SELECT 1 FROM daily_summaries
    WHERE patient_id = p_patient_id AND summary_date = d
  );

  IF v_missed_sessions >= 3 THEN
    INSERT INTO alerts (patient_id, caregiver_id, alert_type, severity, title, description)
    VALUES (
      p_patient_id, v_caregiver_id, 'missed_sessions', 'yellow',
      'Patient missed 3+ consecutive days',
      'No game sessions recorded in the last 3 days. Regular engagement is important for cognitive maintenance.'
    )
    ON CONFLICT DO NOTHING;
  END IF;
END;
$$ LANGUAGE plpgsql;
```

---

## 4. Memory Bank + AI Conversation Log

```sql
-- =============================================
-- MIGRATION 004: Memory Bank + AI Conversation Log
-- =============================================

-- Caregiver-supplied facts the AI companion may answer from. Nothing else.
CREATE TABLE memory_bank_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN ('person', 'schedule', 'life_fact', 'medication')),
  title TEXT NOT NULL,
  detail TEXT NOT NULL,
  photo_url TEXT,             -- public URL in the memory-bank-photos Storage bucket (see MIGRATION 012); local Dexie keeps its own data-URL copy for offline/same-device rendering
  relationship TEXT,          -- only meaningful for category='person'
  active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID NOT NULL REFERENCES caregivers(id) ON DELETE CASCADE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Retained for the caregiver digest and safety audit — never surfaced to the
-- patient as a chat history.
CREATE TABLE ai_conversation_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  grounded BOOLEAN NOT NULL,        -- true if the answer came from Memory Bank facts
  model_used TEXT NOT NULL,         -- e.g. 'groq/llama-3.1-8b-instant', for debugging
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_memory_bank_patient_active ON memory_bank_entries(patient_id, active);
CREATE INDEX idx_ai_log_patient_date ON ai_conversation_log(patient_id, created_at);

CREATE TRIGGER trg_memory_bank_updated_at BEFORE UPDATE ON memory_bank_entries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE memory_bank_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_conversation_log ENABLE ROW LEVEL SECURITY;

-- Caregivers manage their own patients' Memory Bank entries.
CREATE POLICY caregiver_memory_bank ON memory_bank_entries
  FOR ALL USING (patient_id IN (
    SELECT id FROM patients WHERE caregiver_id IN (
      SELECT id FROM caregivers WHERE auth_id = auth.uid()
    )
  ));

-- Caregivers can read the conversation log (for the digest/safety-audit
-- feature). No patient-facing policy: the kiosk device has no Supabase
-- session to key RLS off (see src/lib/auth/deviceTrust.ts) — writes for that
-- path go through POST /api/ai/complete using the service-role key instead,
-- after the route validates the device-trust token itself.
CREATE POLICY caregiver_read_ai_log ON ai_conversation_log
  FOR SELECT USING (patient_id IN (
    SELECT id FROM patients WHERE caregiver_id IN (
      SELECT id FROM caregivers WHERE auth_id = auth.uid()
    )
  ));
```

```sql
-- =============================================
-- MIGRATION 005: Companion distress flag
-- =============================================

-- Set true when a question short-circuited on a distress keyword (the
-- Tele-MANAS safety response) instead of reaching the LLM — a stronger
-- signal than an ordinary ungrounded question, surfaced separately to the
-- caregiver rather than folded into `grounded = false`.
ALTER TABLE ai_conversation_log ADD COLUMN flagged_for_followup BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX idx_ai_log_followup ON ai_conversation_log(patient_id, flagged_for_followup)
  WHERE flagged_for_followup;
```

```sql
-- =============================================
-- MIGRATION 006: Reminiscence Quiz
-- =============================================

-- One cached quiz per patient, regenerated in place by a caregiver's
-- "Refresh Quiz" action — never generated on the fly per play, so the game
-- loads instantly and works offline. `questions` is validated server-side
-- before this row is ever written (see POST /api/ai/generate-reminiscence-quiz);
-- a failed regeneration leaves the previous row untouched.
CREATE TABLE reminiscence_quizzes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL UNIQUE REFERENCES patients(id) ON DELETE CASCADE,
  questions JSONB NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE reminiscence_quizzes ENABLE ROW LEVEL SECURITY;

CREATE POLICY caregiver_reminiscence_quizzes ON reminiscence_quizzes
  FOR ALL USING (patient_id IN (
    SELECT id FROM patients WHERE caregiver_id IN (
      SELECT id FROM caregivers WHERE auth_id = auth.uid()
    )
  ));
```

```sql
-- =============================================
-- MIGRATION 007: Caregiver Weekly Digest
-- =============================================

-- One row per patient per week; regenerating the same week replaces it
-- rather than accumulating duplicates.
CREATE TABLE caregiver_digests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  week_of DATE NOT NULL,
  summary_text TEXT NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (patient_id, week_of)
);

CREATE INDEX idx_caregiver_digests_patient ON caregiver_digests(patient_id, week_of DESC);

ALTER TABLE caregiver_digests ENABLE ROW LEVEL SECURITY;

CREATE POLICY caregiver_own_digests ON caregiver_digests
  FOR ALL USING (patient_id IN (
    SELECT id FROM patients WHERE caregiver_id IN (
      SELECT id FROM caregivers WHERE auth_id = auth.uid()
    )
  ));
```

```sql
-- =============================================
-- MIGRATION 008: Widen game_type CHECK to cover all shipped games
-- =============================================

-- Migration 001's game_type CHECK only ever listed the first 4 games
-- (object_hunt, word_stream, quick_tap, path_match). 10 games shipped since
-- then — memory_match, memory_blocks, frog_leap, counting_boxes, n_back,
-- larger_number, memory_span, fish_trace, double_decision, reminiscence_quiz
-- — and every one of them has been silently failing to sync its
-- telemetry_events/daily_summaries rows to Supabase (INSERT rejected by the
-- CHECK constraint) since launch. This does not affect local/offline play —
-- Dexie has no such constraint — only the caregiver-dashboard server-side
-- view of these games' history.
ALTER TABLE telemetry_events DROP CONSTRAINT telemetry_events_game_type_check;
ALTER TABLE telemetry_events ADD CONSTRAINT telemetry_events_game_type_check
  CHECK (game_type IN (
    'object_hunt', 'word_stream', 'quick_tap', 'path_match',
    'memory_match', 'memory_blocks', 'frog_leap', 'counting_boxes',
    'n_back', 'larger_number', 'memory_span', 'fish_trace',
    'double_decision', 'reminiscence_quiz'
  ));

ALTER TABLE daily_summaries DROP CONSTRAINT daily_summaries_game_type_check;
ALTER TABLE daily_summaries ADD CONSTRAINT daily_summaries_game_type_check
  CHECK (game_type IN (
    'object_hunt', 'word_stream', 'quick_tap', 'path_match',
    'memory_match', 'memory_blocks', 'frog_leap', 'counting_boxes',
    'n_back', 'larger_number', 'memory_span', 'fish_trace',
    'double_decision', 'reminiscence_quiz'
  ));
```

```sql
-- =============================================
-- MIGRATION 009: Add routine_recall game type
-- =============================================

-- Routine Recall (see feature plan) reuses reminder_acks — no new table —
-- but its telemetry/summary rows need the 15th game_type value accepted.
-- Kept as its own migration, separate from 008, because it is new-feature
-- scope rather than a fix to already-shipped games.
ALTER TABLE telemetry_events DROP CONSTRAINT telemetry_events_game_type_check;
ALTER TABLE telemetry_events ADD CONSTRAINT telemetry_events_game_type_check
  CHECK (game_type IN (
    'object_hunt', 'word_stream', 'quick_tap', 'path_match',
    'memory_match', 'memory_blocks', 'frog_leap', 'counting_boxes',
    'n_back', 'larger_number', 'memory_span', 'fish_trace',
    'double_decision', 'reminiscence_quiz', 'routine_recall'
  ));

ALTER TABLE daily_summaries DROP CONSTRAINT daily_summaries_game_type_check;
ALTER TABLE daily_summaries ADD CONSTRAINT daily_summaries_game_type_check
  CHECK (game_type IN (
    'object_hunt', 'word_stream', 'quick_tap', 'path_match',
    'memory_match', 'memory_blocks', 'frog_leap', 'counting_boxes',
    'n_back', 'larger_number', 'memory_span', 'fish_trace',
    'double_decision', 'reminiscence_quiz', 'routine_recall'
  ));
```

```sql
-- =============================================
-- MIGRATION 010: Family sharing (read-only digest access + one-way notes)
-- =============================================

-- One row per family member a caregiver has invited. `signature` is an
-- HMAC over (id, patient_id, expires_at) computed server-side with
-- FAMILY_SHARE_SECRET (see lib/family/familyShareServer.ts) — never
-- computable by the client, same scheme as device_trust tokens. The token
-- handed to the family member is `id` (opaque, unguessable UUID); the row
-- itself, not a JWT, is the source of truth for expiry/revocation so a
-- revoke is an immediate DB write, not dependent on token TTL alone.
CREATE TABLE family_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  caregiver_id UUID NOT NULL REFERENCES caregivers(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  signature TEXT NOT NULL,
  review_required BOOLEAN NOT NULL DEFAULT true,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One-directional (family -> patient) encouragement notes. `surfaced_at`
-- being NULL is what the patient-home rate-limit query keys off; the
-- 1-per-day cap is enforced in application code (POST
-- /api/patients/[id]/surface-note), not here, since "has a note already
-- surfaced today" needs a same-day comparison a CHECK constraint can't
-- express cleanly.
CREATE TABLE family_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_share_id UUID NOT NULL REFERENCES family_shares(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'surfaced')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  surfaced_at TIMESTAMPTZ
);

CREATE INDEX idx_family_shares_patient ON family_shares(patient_id);
CREATE INDEX idx_family_notes_patient_status ON family_notes(patient_id, status);

ALTER TABLE family_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE family_notes ENABLE ROW LEVEL SECURITY;

-- Caregiver-side management (list/revoke shares, approve/reject notes) goes
-- through the caregiver's own Supabase session, same ownership pattern as
-- every other table here.
CREATE POLICY caregiver_family_shares ON family_shares
  FOR ALL USING (caregiver_id IN (
    SELECT id FROM caregivers WHERE auth_id = auth.uid()
  ));

CREATE POLICY caregiver_family_notes ON family_notes
  FOR ALL USING (family_share_id IN (
    SELECT id FROM family_shares WHERE caregiver_id IN (
      SELECT id FROM caregivers WHERE auth_id = auth.uid()
    )
  ));

-- The unauthenticated family-facing routes (GET the digest view, POST a
-- note) use the service-role client after verifying the HMAC token
-- themselves in application code — RLS above only ever needs to authorize
-- the caregiver's own session, never an anonymous family-member request.
```

```sql
-- =============================================
-- MIGRATION 011: Family message board (sender identity, photo, seen ack,
-- caregiver-direct posting)
-- =============================================

-- Widens `family_notes` (MIGRATION 010) into the patient-home "family
-- message board" instead of introducing a parallel table: same
-- one-directional family -> patient shape, same moderation/surfacing
-- lifecycle, just richer content and a second way to get a row in here.
--
-- `family_share_id` becomes nullable because a caregiver can now post a
-- message directly (patient detail page) without minting a family-share
-- link first — those rows carry `posted_by_caregiver_id` instead. The CHECK
-- ensures a row always has exactly one origin, never both and never
-- neither, so the ownership story for RLS/moderation stays unambiguous.
ALTER TABLE family_notes ALTER COLUMN family_share_id DROP NOT NULL;
ALTER TABLE family_notes ADD COLUMN posted_by_caregiver_id UUID REFERENCES caregivers(id) ON DELETE CASCADE;
ALTER TABLE family_notes ADD COLUMN sender_name TEXT;
ALTER TABLE family_notes ADD COLUMN sender_relation TEXT;
-- Plain URL string, not a Storage bucket reference — same MVP scope cut as
-- memory_bank_entries.photo_url (see lib/db/schema.ts).
ALTER TABLE family_notes ADD COLUMN photo_url TEXT;
-- When the patient taps "Seen" on the kiosk. Distinct from `surfaced_at`
-- (server decided to show it) — this is the patient's own acknowledgement,
-- and is what the caregiver-side board can point to as "read".
ALTER TABLE family_notes ADD COLUMN seen_at TIMESTAMPTZ;

ALTER TABLE family_notes ADD CONSTRAINT family_notes_origin_check
  CHECK (
    (family_share_id IS NOT NULL AND posted_by_caregiver_id IS NULL) OR
    (family_share_id IS NULL AND posted_by_caregiver_id IS NOT NULL)
  );

CREATE INDEX idx_family_notes_patient_created ON family_notes(patient_id, created_at DESC);

-- Caregiver-authored rows are managed the same way family-share-authored
-- rows already are (MIGRATION 010's `caregiver_family_notes` policy only
-- reaches rows through `family_share_id`, so a direct-post row needs its
-- own arm of coverage).
CREATE POLICY caregiver_family_notes_direct ON family_notes
  FOR ALL USING (posted_by_caregiver_id IN (
    SELECT id FROM caregivers WHERE auth_id = auth.uid()
  ));
```

```sql
-- =============================================
-- MIGRATION 012: Memory Bank photo Storage bucket
-- =============================================

-- `memory_bank_entries.photo_url` (MIGRATION 004) was a data-URL string
-- with no Storage bucket ("MVP scope cut" — see its column comment). That
-- meant every photo shipped as a multi-MB base64 blob through `/api/sync`
-- on every edit, and there was nowhere for a photo to live once a caregiver
-- pulls their profile onto a second device.
--
-- Public bucket (deliberate choice, not an oversight): a memory-bank photo
-- is a family photo, not medical/biometric data, and this app's own
-- reminiscence-quiz kiosk device has no Supabase session to fetch a signed
-- URL with — a plain public URL lets it (and any future cross-device
-- caregiver view) render with a bare `<img src>`, no auth round trip.
-- WRITE access is still RLS-scoped below, same as every other table here.
--
-- Object path convention: `{patient_id}/{entry_id}` — see
-- `lib/db/sync.ts`'s `uploadMemoryBankPhotos`, which uploads with
-- `upsert: true` so re-syncing an edited entry overwrites the same object
-- instead of accumulating duplicates.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'memory-bank-photos',
  'memory-bank-photos',
  true,
  5242880, -- 5MB — a family photo, not a video
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do nothing;

-- Public bucket only bypasses RLS for reads (served via the public URL
-- endpoint); writes are still gated by RLS like every other table — a
-- caregiver may only write under a path whose first segment is one of
-- their own patients' ids.
create policy caregiver_memory_bank_photos on storage.objects
  for all using (
    bucket_id = 'memory-bank-photos'
    and (storage.foldername(name))[1]::uuid in (
      select id from patients where caregiver_id in (
        select id from caregivers where auth_id = auth.uid()
      )
    )
  )
  with check (
    bucket_id = 'memory-bank-photos'
    and (storage.foldername(name))[1]::uuid in (
      select id from patients where caregiver_id in (
        select id from caregivers where auth_id = auth.uid()
      )
    )
  );
```

```sql
-- =============================================
-- MIGRATION 013: Appointment details on reminder_schedules
-- =============================================

-- An appointment reminder is one dated event entered by the caregiver from
-- what they were told (a PHC/CHC slip, a verbal instruction, an eSanjeevani
-- slot) — never synced from any booking system. It prompts up to twice: the
-- day before (travel planning) and on the day. See
-- src/lib/engine/appointments.ts.
--
-- For these rows time_of_day is the appointment time and days_of_week is '{}'.
-- Every column is nullable and NULL for the other reminder types. The app
-- only sends these columns on appointment rows, so other reminder types keep
-- syncing before this migration is applied.
ALTER TABLE reminder_schedules
  ADD COLUMN appointment_date DATE,
  ADD COLUMN facility_name TEXT CHECK (char_length(facility_name) <= 120),
  ADD COLUMN location_notes TEXT CHECK (char_length(location_notes) <= 500),
  ADD COLUMN bring_notes TEXT CHECK (char_length(bring_notes) <= 500),
  ADD COLUMN remind_day_before_time TIME,
  ADD COLUMN remind_day_of_time TIME;

ALTER TABLE reminder_schedules ADD CONSTRAINT reminder_schedules_appointment_fields_check
  CHECK (
    reminder_type = 'appointment'
    OR (appointment_date IS NULL AND facility_name IS NULL AND location_notes IS NULL
        AND bring_notes IS NULL AND remind_day_before_time IS NULL AND remind_day_of_time IS NULL)
  );

ALTER TABLE reminder_schedules ADD CONSTRAINT reminder_schedules_day_of_before_appointment_check
  CHECK (remind_day_of_time IS NULL OR remind_day_of_time <= time_of_day);
```
