# SMRITI — Database Schema

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
  preferred_language TEXT NOT NULL DEFAULT 'en' CHECK (preferred_language IN ('as', 'hi', 'en', 'mni', 'brx')),
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
  primary_language TEXT NOT NULL DEFAULT 'as' CHECK (primary_language IN ('as', 'hi', 'en', 'mni', 'brx', 'kha', 'lus')),
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
