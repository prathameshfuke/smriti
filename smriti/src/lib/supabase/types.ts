/**
 * TypeScript row types for the Supabase (PostgreSQL) schema.
 *
 * Field names are snake_case because that is the wire format PostgREST
 * returns. The Dexie mirror in `src/lib/db/schema.ts` uses camelCase; the
 * sync layer is responsible for mapping between the two. Keeping these
 * honest to the wire prevents silent `undefined` reads on query results.
 *
 * Mirrors 03_DATABASE.md, migration 001.
 */

export type Language = 'as' | 'hi' | 'en' | 'mni' | 'brx';
export type PatientLanguage = Language | 'kha' | 'lus';
export type CaregiverRole = 'family' | 'asha_worker' | 'nurse' | 'clinician';
export type Gender = 'male' | 'female' | 'other';
export type GameType = 'object_hunt' | 'word_stream' | 'quick_tap' | 'path_match';
export type ReminderType = 'medication' | 'hydration' | 'activity' | 'appointment';
export type AckMethod = 'touch' | 'voice' | 'caregiver';
export type AlertType = 'cognitive_drop' | 'missed_sessions' | 'low_adherence';
export type AlertSeverity = 'red' | 'yellow' | 'green';

/** ISO-8601 timestamp string (TIMESTAMPTZ). */
export type Timestamptz = string;
/** ISO-8601 calendar date, `YYYY-MM-DD` (DATE). */
export type DateOnly = string;
/** 24-hour wall-clock time, `HH:MM[:SS]` (TIME). */
export type TimeOfDay = string;

export interface Caregiver {
  id: string;
  auth_id: string;
  display_name: string;
  phone: string | null;
  email: string | null;
  role: CaregiverRole;
  preferred_language: Language;
  created_at: Timestamptz;
  updated_at: Timestamptz;
}

export interface Patient {
  id: string;
  caregiver_id: string;
  display_name: string;
  age_years: number | null;
  gender: Gender | null;
  education_years: number;
  primary_language: PatientLanguage;
  session_duration_minutes: number;
  is_active: boolean;
  created_at: Timestamptz;
  updated_at: Timestamptz;
}

export interface GameSession {
  id: string;
  patient_id: string;
  started_at: Timestamptz;
  ended_at: Timestamptz | null;
  device_id: string | null;
  sync_received_at: Timestamptz | null;
}

/** Append-only and immutable once written. */
export interface TelemetryEvent {
  id: string;
  session_id: string;
  patient_id: string;
  game_type: GameType;
  difficulty_level: number;
  round_number: number;
  is_correct: boolean;
  /** NULL when the round timed out. */
  response_time_ms: number | null;
  event_timestamp: Timestamptz;
  metadata: Record<string, unknown>;
  sync_received_at: Timestamptz | null;
}

export interface DailySummary {
  id: string;
  patient_id: string;
  summary_date: DateOnly;
  game_type: GameType;
  total_rounds: number;
  correct_rounds: number;
  /** Generated column — computed by Postgres, never written by the client. */
  readonly accuracy_pct: number;
  avg_response_time_ms: number | null;
  max_difficulty_reached: number;
  session_count: number;
  elo_rating: number | null;
  sync_received_at: Timestamptz | null;
}

export interface ReminderSchedule {
  id: string;
  patient_id: string;
  reminder_type: ReminderType;
  label: string;
  time_of_day: TimeOfDay;
  /** 0 = Sunday through 6 = Saturday. */
  days_of_week: number[];
  is_active: boolean;
  created_at: Timestamptz;
  updated_at: Timestamptz;
}

export interface ReminderAck {
  id: string;
  reminder_id: string;
  patient_id: string;
  scheduled_at: Timestamptz;
  /** NULL means the reminder was never acknowledged. */
  acknowledged_at: Timestamptz | null;
  ack_method: AckMethod | null;
  sync_received_at: Timestamptz | null;
}

/** Generated server-side during sync; see check_cognitive_alerts(). */
export interface Alert {
  id: string;
  patient_id: string;
  caregiver_id: string;
  alert_type: AlertType;
  severity: AlertSeverity;
  title: string;
  description: string | null;
  is_read: boolean;
  is_resolved: boolean;
  created_at: Timestamptz;
  resolved_at: Timestamptz | null;
}

export interface Database {
  caregivers: Caregiver;
  patients: Patient;
  game_sessions: GameSession;
  telemetry_events: TelemetryEvent;
  daily_summaries: DailySummary;
  reminder_schedules: ReminderSchedule;
  reminder_acks: ReminderAck;
  alerts: Alert;
}
