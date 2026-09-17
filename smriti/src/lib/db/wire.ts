import type { LocalReminderSchedule } from './schema';

/**
 * Converts the rows a phone sends to /api/sync into the column names and
 * value ranges the Supabase tables accept.
 *
 * The client stores rows in Dexie with camelCase fields plus a local-only
 * `synced` flag and posts them as-is. Postgres columns are snake_case, so an
 * upsert of those raw rows was rejected for every category ("column patientId
 * does not exist"), nothing was ever marked synced, and the pending count
 * never went down. Rows already in snake_case (the integration test, any
 * future client) pass through the same converter unchanged.
 *
 * Done on the server rather than the client so phones still running an older
 * build start syncing as soon as this is deployed.
 */

type Row = Record<string, unknown>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Every id column here is UUID, and one malformed id makes Postgres reject
 * the whole batch, which would leave that category stuck unsynced forever.
 * Rows that could never be stored are dropped instead (the app itself always
 * generates UUIDs; hand-made test data does not).
 */
export function hasValidIds<T extends Record<string, unknown>>(row: T, keys: Array<keyof T>): boolean {
  return keys.every((k) => typeof row[k] === 'string' && UUID.test(row[k] as string));
}

function pick(row: Row, camel: string, snake: string): unknown {
  return row[snake] !== undefined ? row[snake] : row[camel];
}

function int(value: unknown, fallback: number | null): number | null {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? Math.round(n) : fallback;
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

export function toWireSession(row: Row, deviceId: string | null) {
  return {
    id: row.id as string,
    patient_id: pick(row, 'patientId', 'patient_id') as string,
    started_at: pick(row, 'startedAt', 'started_at') as string,
    ended_at: (pick(row, 'endedAt', 'ended_at') as string | null | undefined) ?? null,
    device_id: (pick(row, 'deviceId', 'device_id') as string | undefined) ?? deviceId,
  };
}

export function toWireEvent(row: Row) {
  return {
    id: row.id as string,
    session_id: pick(row, 'sessionId', 'session_id') as string,
    patient_id: pick(row, 'patientId', 'patient_id') as string,
    game_type: pick(row, 'gameType', 'game_type') as string,
    // CHECK (difficulty_level BETWEEN 1 AND 20).
    difficulty_level: clamp(int(pick(row, 'difficultyLevel', 'difficulty_level'), 1) ?? 1, 1, 20),
    round_number: int(pick(row, 'roundNumber', 'round_number'), 1) ?? 1,
    is_correct: Boolean(pick(row, 'isCorrect', 'is_correct')),
    // INTEGER column; a fractional millisecond value is rejected outright.
    response_time_ms: int(pick(row, 'responseTimeMs', 'response_time_ms'), null),
    event_timestamp: pick(row, 'eventTimestamp', 'event_timestamp') as string,
    metadata: (row.metadata as Row | undefined) ?? {},
  };
}

export function toWireDailySummary(row: Row) {
  const elo = int(pick(row, 'eloRating', 'elo_rating'), null);
  return {
    id: row.id as string,
    patient_id: pick(row, 'patientId', 'patient_id') as string,
    summary_date: pick(row, 'summaryDate', 'summary_date') as string,
    game_type: pick(row, 'gameType', 'game_type') as string,
    total_rounds: int(pick(row, 'totalRounds', 'total_rounds'), 0) ?? 0,
    correct_rounds: int(pick(row, 'correctRounds', 'correct_rounds'), 0) ?? 0,
    avg_response_time_ms: int(pick(row, 'avgResponseTimeMs', 'avg_response_time_ms'), null),
    max_difficulty_reached: Math.max(1, int(pick(row, 'maxDifficultyReached', 'max_difficulty_reached'), 1) ?? 1),
    session_count: Math.max(1, int(pick(row, 'sessionCount', 'session_count'), 1) ?? 1),
    // The phone uses 0 for "not rated yet"; the column means that with NULL.
    elo_rating: elo && elo > 0 ? elo : null,
  };
}

/**
 * One row per (patient, date, game). The upsert conflicts on that unique key,
 * and Postgres refuses a batch that touches the same key twice, so keep the
 * most complete row when a device sent duplicates.
 */
export function dedupeDailySummaries(rows: ReturnType<typeof toWireDailySummary>[]) {
  const byKey = new Map<string, ReturnType<typeof toWireDailySummary>>();
  for (const row of rows) {
    const key = `${row.patient_id}|${row.summary_date}|${row.game_type}`;
    const existing = byKey.get(key);
    if (!existing || row.total_rounds > existing.total_rounds) byKey.set(key, row);
  }
  return [...byKey.values()];
}

export function toWireReminderAck(row: Row) {
  return {
    id: row.id as string,
    reminder_id: pick(row, 'reminderId', 'reminder_id') as string,
    patient_id: pick(row, 'patientId', 'patient_id') as string,
    scheduled_at: pick(row, 'scheduledAt', 'scheduled_at') as string,
    acknowledged_at: (pick(row, 'acknowledgedAt', 'acknowledged_at') as string | null | undefined) ?? null,
    ack_method: (pick(row, 'ackMethod', 'ack_method') as string | null | undefined) ?? null,
  };
}

export function toWireReminderSchedule(row: Row) {
  const base = {
    id: row.id as string,
    patient_id: pick(row, 'patientId', 'patient_id') as string,
    reminder_type: pick(row, 'reminderType', 'reminder_type') as string,
    label: row.label as string,
    time_of_day: pick(row, 'timeOfDay', 'time_of_day') as string,
    days_of_week: pick(row, 'daysOfWeek', 'days_of_week') as number[],
    is_active: Boolean(pick(row, 'isActive', 'is_active')),
    updated_at: (pick(row, 'updatedAt', 'updated_at') as string | undefined) ?? new Date().toISOString(),
  };
  return { ...base, ...toWireAppointmentFields(row) };
}

const NO_APPOINTMENT_FIELDS = {
  appointment_date: null,
  facility_name: null,
  location_notes: null,
  bring_notes: null,
  remind_day_before_time: null,
  remind_day_of_time: null,
} as const;

/**
 * Appointment columns of a reminder row, camelCase or snake_case in, snake_case
 * out; absent → null. Always null for other reminder types, so a reminder that
 * used to be an appointment clears them on the server (MIGRATION 013's check
 * rejects a non-appointment row that still has them).
 */
export function toWireAppointmentFields(row: Row) {
  if (pick(row, 'reminderType', 'reminder_type') !== 'appointment') return { ...NO_APPOINTMENT_FIELDS };
  const value = (camel: string, snake: string) => (pick(row, camel, snake) as string | null | undefined) ?? null;
  return {
    appointment_date: value('appointmentDate', 'appointment_date'),
    facility_name: value('facilityName', 'facility_name'),
    location_notes: value('locationNotes', 'location_notes'),
    bring_notes: value('bringNotes', 'bring_notes'),
    remind_day_before_time: value('remindDayBeforeTime', 'remind_day_before_time'),
    remind_day_of_time: value('remindDayOfTime', 'remind_day_of_time'),
  };
}

/** Postgres TIME comes back as `HH:MM:SS`; the app keeps `HH:MM`. Null columns stay absent. */
export function toLocalAppointmentFields(row: {
  appointment_date?: string | null;
  facility_name?: string | null;
  location_notes?: string | null;
  bring_notes?: string | null;
  remind_day_before_time?: string | null;
  remind_day_of_time?: string | null;
}): Partial<LocalReminderSchedule> {
  const fields: Partial<LocalReminderSchedule> = {};
  if (row.appointment_date) fields.appointmentDate = row.appointment_date.slice(0, 10);
  if (row.facility_name) fields.facilityName = row.facility_name;
  if (row.location_notes) fields.locationNotes = row.location_notes;
  if (row.bring_notes) fields.bringNotes = row.bring_notes;
  if (row.remind_day_before_time) fields.remindDayBeforeTime = row.remind_day_before_time.slice(0, 5);
  if (row.remind_day_of_time) fields.remindDayOfTime = row.remind_day_of_time.slice(0, 5);
  return fields;
}

const PATIENT_LANGUAGES = new Set(['as', 'hi', 'en', 'mni', 'brx', 'kha', 'lus', 'bn', 'ne']);
const GENDERS = new Set(['male', 'female', 'other']);

/**
 * The editable columns of a patient row. Ownership and `is_active` are never
 * taken from the phone: removing a patient goes through its own checked
 * route. Values outside the table's CHECK constraints are left out rather
 * than failing the update.
 */
export function toWirePatientProfile(row: Row) {
  const updatedAt = pick(row, 'updatedAt', 'updated_at');
  if (typeof updatedAt !== 'string' || Number.isNaN(Date.parse(updatedAt))) return null;
  const update: Record<string, unknown> = { updated_at: updatedAt };
  const name = pick(row, 'displayName', 'display_name');
  if (typeof name === 'string' && name.trim()) update.display_name = name.trim().slice(0, 120);
  const language = pick(row, 'primaryLanguage', 'primary_language');
  if (typeof language === 'string' && PATIENT_LANGUAGES.has(language)) update.primary_language = language;
  const age = int(pick(row, 'ageYears', 'age_years'), null);
  if (age !== null && age > 0 && age < 130) update.age_years = age;
  const gender = pick(row, 'gender', 'gender');
  if (typeof gender === 'string' && GENDERS.has(gender)) update.gender = gender;
  const education = int(pick(row, 'educationYears', 'education_years'), null);
  if (education !== null && education >= 0) update.education_years = education;
  const minutes = int(pick(row, 'sessionDurationMinutes', 'session_duration_minutes'), null);
  if (minutes !== null && minutes > 0) update.session_duration_minutes = minutes;
  return update as { updated_at: string } & Record<string, unknown>;
}
