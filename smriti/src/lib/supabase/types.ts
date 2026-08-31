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

export type Caregiver = {
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

export type Patient = {
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

export type GameSession = {
  id: string;
  patient_id: string;
  started_at: Timestamptz;
  ended_at: Timestamptz | null;
  device_id: string | null;
  sync_received_at: Timestamptz | null;
}

/** Append-only and immutable once written. */
export type TelemetryEvent = {
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

export type DailySummary = {
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

export type ReminderSchedule = {
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

export type ReminderAck = {
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
export type Alert = {
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

/**
 * Columns Postgres fills in itself. They are never part of an insert payload:
 * `accuracy_pct` is a generated column, the timestamps have defaults.
 */
type ServerManaged = 'created_at' | 'updated_at' | 'sync_received_at' | 'accuracy_pct';

/** Insert payload: server-managed columns dropped, `id` optional where defaulted. */
type Insertable<T> = Omit<T, ServerManaged & keyof T>;
type Updatable<T> = Partial<Insertable<T>>;

interface TableShape<Row> {
  Row: Row;
  Insert: Insertable<Row>;
  Update: Updatable<Row>;
  /**
   * Required by supabase-js's GenericTable constraint. Without it the schema
   * fails the constraint silently and every query result degrades to `never`.
   * Empty because these types are hand-written; `supabase gen types` would
   * populate the foreign-key relationships here.
   */
  Relationships: [];
}

/**
 * Shaped for the supabase-js client generic, which resolves rows through
 * `Database['public']['Tables'][name]['Row']`. Passing this to
 * createBrowserClient/createServerClient is what makes query results typed —
 * without it every `.from(...).select()` returns `any`.
 */
export interface Database {
  public: {
    Tables: {
      caregivers: TableShape<Caregiver>;
      patients: TableShape<Patient>;
      game_sessions: TableShape<GameSession>;
      telemetry_events: TableShape<TelemetryEvent>;
      daily_summaries: TableShape<DailySummary>;
      reminder_schedules: TableShape<ReminderSchedule>;
      reminder_acks: TableShape<ReminderAck>;
      alerts: TableShape<Alert>;
    };
    // Mapped-over-never, matching `supabase gen types` output. A plain
    // Record<never, never> lacks an index signature and fails GenericSchema.
    Views: { [_ in never]: never };
    Functions: { [_ in never]: never };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
}
