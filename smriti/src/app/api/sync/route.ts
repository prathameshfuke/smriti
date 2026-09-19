import { v4 as uuid } from 'uuid';
import { authenticateRequest } from '@/lib/supabase/server-auth';
import { detectCognitiveDrop, detectLowAdherence, detectMissedSessions } from '@/lib/engine/alerts';
import { computeAdherence, dateRange } from '@/lib/engine/adherence';
import type { GameType } from '@/lib/supabase/types';
import {
  dedupeDailySummaries,
  hasValidIds,
  toWirePatientProfile,
  toWireDailySummary,
  toWireEvent,
  toWireReminderAck,
  toWireReminderSchedule,
  toWireSession,
} from '@/lib/db/wire';
import { scheduleAlertPush, type AlertKind, type AlertSeverity } from '@/lib/push/alertNotify';
import { fromWireConsent, parseConsentRecord, toWireConsent } from '@/lib/consent/wire';

/** Pull cursors are compared against client-written `updated_at` values, so
 * a phone whose clock runs behind could write a row that looks older than
 * another phone's cursor. Re-reading this overlap on every pull costs a few
 * duplicate rows (merged idempotently client-side) and closes that gap. */
const PULL_OVERLAP_MS = 60 * 60_000;

/** "Table not there yet" — MIGRATION 014 not applied. Not a sync failure. */
const MISSING_TABLE_CODES = new Set(['42P01', 'PGRST205']);

const MAX_LOG_TEXT = 2_000;

/** Long enough to stop a runaway loop, short enough that a caregiver tapping
 * Sync now right after an automatic sync only waits a moment (the client
 * retries once after `retryAfterMs`). */
const RATE_LIMIT_MS = 10_000;

/**
 * In-memory, per-process — resets on redeploy/cold-start and doesn't share
 * across serverless instances. Accepted MVP limitation (no Redis in this
 * $0-budget hackathon stack); a real deploy needs a shared store instead.
 */
const lastSyncByUser = new Map<string, number>();

interface PatientSyncPayload {
  patientId: string;
  sessions: Array<Record<string, unknown> & { id: string }>;
  events: Array<Record<string, unknown> & { id: string }>;
  dailySummaries: Array<Record<string, unknown> & { id: string; gameType: string }>;
  reminderAcks: Array<Record<string, unknown> & { id: string }>;
  /** Already snake_case (mapped client-side in lib/db/sync.ts) — safe to
   * upsert directly, unlike the categories above. */
  memoryBankEntries: Array<Record<string, unknown> & { id: string }>;
  /** Schedules created or edited on the phone since the last sync. Saved
   * before reminderAcks, which reference them by foreign key. */
  reminderSchedules?: Array<Record<string, unknown> & { id: string }>;
  /** Patient details edited on the phone (Settings: language, name, age). */
  profile?: Record<string, unknown> | null;
  /** snake_case `patient_consents` row, when consent changed on the phone. */
  consent?: Record<string, unknown> | null;
  /** snake_case Ask Smriti answers given offline on the phone. */
  aiConversationLogs?: Array<Record<string, unknown> & { id: string }>;
  /** Server time of this patient's last successful sync. */
  lastSyncTimestamp?: string | null;
}

/** Which of one patient's row categories Supabase actually rejected this sync. */
interface PatientSyncErrors {
  patient?: string;
  profile?: string;
  reminderSchedules?: string;
  sessions?: string;
  events?: string;
  dailySummaries?: string;
  reminderAcks?: string;
  memoryBankEntries?: string;
  consent?: string;
  aiConversationLogs?: string;
}

interface SyncRequestBody {
  deviceId: string;
  lastSyncTimestamp: string | null;
  patients: PatientSyncPayload[];
}

export async function POST(request: Request) {
  const auth = await authenticateRequest(request);
  if (!auth) return Response.json({ error: 'unauthorized' }, { status: 401 });

  const lastSync = lastSyncByUser.get(auth.userId) ?? 0;
  const waited = Date.now() - lastSync;
  if (waited < RATE_LIMIT_MS) {
    return Response.json({ error: 'rate_limited', retryAfterMs: RATE_LIMIT_MS - waited }, { status: 429 });
  }
  lastSyncByUser.set(auth.userId, Date.now());

  let body: SyncRequestBody;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'invalid_json' }, { status: 400 });
  }
  if (!Array.isArray(body?.patients)) {
    return Response.json({ error: 'missing_patients' }, { status: 400 });
  }

  const { supabase, userId } = auth;

  const { data: caregiver } = await supabase
    .from('caregivers')
    .select('id')
    .eq('auth_id', userId)
    .single();
  if (!caregiver) return Response.json({ error: 'caregiver_not_found' }, { status: 404 });

  // A patientId the client sends is untrusted input: without this check any
  // authenticated caller could read or write another caregiver's data by
  // simply naming their patient's id in the request body.
  const requestedIds = body.patients.map((p) => p.patientId);
  let ownedIds = new Set<string>();
  if (requestedIds.length) {
    const { data: owned } = await supabase
      .from('patients')
      .select('id')
      .eq('caregiver_id', caregiver.id)
      .in('id', requestedIds);
    ownedIds = new Set((owned ?? []).map((p) => p.id));
  }
  const ownedPatients = body.patients.filter((p) => ownedIds.has(p.patientId));

  let syncedEventCount = 0;
  // Keyed by patientId: which of this patient's row categories a Supabase
  // upsert actually rejected (e.g. a game_type CHECK-constraint violation).
  // None of these upserts were previously checked for `error` at all, so a
  // rejected batch still returned HTTP 200 with no way for the client to
  // know which rows never made it to the server — it just marked everything
  // "synced" off the response status alone.
  const syncErrors: Record<string, PatientSyncErrors> = {};
  // A patient this account does not have (still being saved, or removed) is
  // reported rather than skipped silently: the phone would otherwise mark
  // those rows synced and they would never reach the server.
  for (const p of body.patients) {
    if (!ownedIds.has(p.patientId)) syncErrors[p.patientId] = { patient: 'patient_not_on_account' };
  }

  for (const patient of ownedPatients) {
    const errors: PatientSyncErrors = {};
    // Every row is pinned to the patient whose ownership was just checked,
    // whatever patient id the row itself carries.
    const own = <T extends { patient_id: string }>(row: T): T => ({ ...row, patient_id: patient.patientId });

    if (patient.profile) {
      // Only a newer edit wins, so a stale phone cannot undo a change made elsewhere.
      const update = toWirePatientProfile(patient.profile);
      if (update) {
        const { error } = await supabase
          .from('patients')
          .update(update as never)
          .eq('id', patient.patientId)
          .lt('updated_at', update.updated_at);
        if (error) errors.profile = error.message;
      }
    }
    if (patient.reminderSchedules?.length) {
      const { error } = await supabase
        .from('reminder_schedules')
        .upsert(
          patient.reminderSchedules.map((r) => own(toWireReminderSchedule(r))).filter((r) => hasValidIds(r, ['id'])) as never[],
          { onConflict: 'id' },
        );
      if (error) errors.reminderSchedules = error.message;
    }
    if (patient.sessions?.length) {
      const { error } = await supabase
        .from('game_sessions')
        .upsert(
          patient.sessions.map((s) => own(toWireSession(s, body.deviceId ?? null))).filter((s) => hasValidIds(s, ['id'])) as never[],
          { onConflict: 'id' },
        );
      if (error) errors.sessions = error.message;
    }
    if (patient.events?.length) {
      const events = patient.events.map((e) => own(toWireEvent(e))).filter((e) => hasValidIds(e, ['id', 'session_id']));
      const { error } = await supabase
        .from('telemetry_events')
        .upsert(events as never[], { onConflict: 'id', ignoreDuplicates: true });
      if (error) errors.events = error.message;
      else syncedEventCount += events.length;
    }
    if (patient.dailySummaries?.length) {
      // A summary's own id is not referenced anywhere, so a malformed one is
      // replaced rather than dropping that day's numbers.
      const rows = dedupeDailySummaries(
        patient.dailySummaries.map((d) => {
          const row = own(toWireDailySummary(d));
          return hasValidIds(row, ['id']) ? row : { ...row, id: crypto.randomUUID() };
        }),
      );
      const { error } = await supabase
        .from('daily_summaries')
        .upsert(rows as never[], { onConflict: 'patient_id,summary_date,game_type' });
      if (error) errors.dailySummaries = error.message;
    }
    if (patient.reminderAcks?.length) {
      const { error } = await supabase
        .from('reminder_acks')
        .upsert(
          patient.reminderAcks.map((a) => own(toWireReminderAck(a))).filter((a) => hasValidIds(a, ['id', 'reminder_id'])) as never[],
          { onConflict: 'id', ignoreDuplicates: true },
        );
      if (error) errors.reminderAcks = error.message;
    }
    if (patient.memoryBankEntries?.length) {
      // Not ignoreDuplicates: unlike the append-only categories above, an
      // edit or soft-delete re-sends the same id and must actually overwrite
      // the existing row, not be silently skipped as a duplicate.
      const { error } = await supabase
        .from('memory_bank_entries')
        .upsert(patient.memoryBankEntries as never[], { onConflict: 'id' });
      if (error) errors.memoryBankEntries = error.message;
    }
    if (patient.consent) {
      const error = await saveConsent(supabase, patient.patientId, caregiver.id, patient.consent);
      if (error) errors.consent = error;
    }
    if (patient.aiConversationLogs?.length) {
      const rows = patient.aiConversationLogs.flatMap((log) => {
        const row = toWireAiLog(log, patient.patientId);
        return row ? [row] : [];
      });
      if (rows.length) {
        const { error } = await supabase
          .from('ai_conversation_log')
          .upsert(rows as never[], { onConflict: 'id', ignoreDuplicates: true });
        if (error) errors.aiConversationLogs = error.message;
      }
    }

    if (Object.keys(errors).length > 0) {
      syncErrors[patient.patientId] = errors;
      console.error('SMRITI: sync upsert rejected', patient.patientId, errors);
    }

    // Cognitive-drop alerts read from daily_summaries, which the loop above
    // just proved may not actually contain this patient's rows — skip a
    // check that would otherwise query the row it knows just failed to write.
    const gameTypes = new Set(
      patient.dailySummaries?.filter(() => !errors.dailySummaries).map((s) => toWireDailySummary(s).game_type) ?? [],
    );
    for (const gameType of gameTypes) {
      await checkCognitiveDropAlert(supabase, patient.patientId, gameType as GameType);
    }
    // Patient-level, not per-game-type: one check each per patient per sync.
    await checkMissedSessionsAlert(supabase, patient.patientId);
    await checkLowAdherenceAlert(supabase, patient.patientId);
  }

  const patientIds = ownedPatients.map((p) => p.patientId);
  const since = pullSince(ownedPatients.map((p) => p.lastSyncTimestamp ?? body.lastSyncTimestamp ?? null));

  const [
    { data: patients },
    { data: reminders },
    { data: alerts },
    { data: memoryBankEntries },
    { data: consents },
  ] = await Promise.all([
    patientIds.length
      ? supabase.from('patients').select('*').in('id', patientIds).gte('updated_at', since)
      : Promise.resolve({ data: [] }),
    patientIds.length
      ? supabase
          .from('reminder_schedules')
          .select('*')
          .in('patient_id', patientIds)
          .gte('updated_at', since)
      : Promise.resolve({ data: [] }),
    patientIds.length
      ? supabase.from('alerts').select('*').in('patient_id', patientIds).eq('is_resolved', false)
      : Promise.resolve({ data: [] }),
    patientIds.length
      ? supabase
          .from('memory_bank_entries')
          .select('id, patient_id, category, title, detail, photo_url, relationship, active, created_by, updated_at')
          .in('patient_id', patientIds)
          .gte('updated_at', since)
      : Promise.resolve({ data: [] }),
    patientIds.length
      ? supabase.from('patient_consents').select('*').in('patient_id', patientIds).gte('updated_at', since)
      : Promise.resolve({ data: [] }),
  ]);

  return Response.json({
    serverTimestamp: new Date().toISOString(),
    syncedEventCount,
    syncErrors,
    updates: {
      patients: patients ?? [],
      reminders: reminders ?? [],
      alerts: alerts ?? [],
      memoryBankEntries: memoryBankEntries ?? [],
      consents: consents ?? [],
    },
  });
}

type AuthedSupabase = NonNullable<Awaited<ReturnType<typeof authenticateRequest>>>['supabase'];

/** The earliest cursor among the patients in this request (minus the overlap); epoch when any has none. */
function pullSince(cursors: Array<string | null>): string {
  const times = cursors.map((c) => (c ? Date.parse(c) : Number.NaN));
  if (times.length === 0 || times.some((t) => Number.isNaN(t))) return new Date(0).toISOString();
  return new Date(Math.max(0, Math.min(...times) - PULL_OVERLAP_MS)).toISOString();
}

/**
 * Saves a consent sent by the phone. The patient and caregiver are pinned to
 * the ones this request was authorized for, whatever the body says, and an
 * older consent never replaces a newer one already on the server. Returns an
 * error message, or null when saved, skipped as stale, or the table is not
 * migrated yet.
 */
async function saveConsent(
  supabase: AuthedSupabase,
  patientId: string,
  caregiverId: string,
  raw: Record<string, unknown>,
): Promise<string | null> {
  const parsed = parseConsentRecord(fromWireConsentLoose(raw));
  if (!parsed) return 'invalid_consent';
  const record = { ...parsed, patientId, consentedBy: caregiverId };

  const { data: existing, error: readError } = await supabase
    .from('patient_consents')
    .select('updated_at')
    .eq('patient_id', patientId)
    .maybeSingle();
  if (readError) {
    if (MISSING_TABLE_CODES.has(readError.code ?? '')) {
      console.error('SMRITI: patient_consents table missing — apply MIGRATION 014.');
      return null;
    }
    return readError.message;
  }
  if (existing && Date.parse(existing.updated_at) >= Date.parse(record.updatedAt)) return null;

  const { error } = await supabase
    .from('patient_consents')
    .upsert(toWireConsent(record) as never, { onConflict: 'patient_id' });
  return error ? error.message : null;
}

/** Reads a snake_case consent row from an untrusted body into the camelCase shape parseConsentRecord validates. */
function fromWireConsentLoose(raw: Record<string, unknown>): unknown {
  try {
    return fromWireConsent(raw as never);
  } catch {
    return null;
  }
}

function toWireAiLog(raw: Record<string, unknown>, patientId: string) {
  const text = (v: unknown) => (typeof v === 'string' && v.trim().length > 0 ? v.slice(0, MAX_LOG_TEXT) : null);
  const question = text(raw.question);
  const answer = text(raw.answer);
  const createdAt = typeof raw.created_at === 'string' && !Number.isNaN(Date.parse(raw.created_at)) ? raw.created_at : null;
  const row = { id: raw.id };
  if (!question || !answer || !createdAt || !hasValidIds(row as Record<string, unknown>, ['id'])) return null;
  return {
    id: raw.id as string,
    patient_id: patientId,
    question,
    answer,
    grounded: raw.grounded === true,
    // Only the two kinds of answer a phone produces offline are accepted.
    model_used: raw.model_used === 'on-device-distress' ? 'on-device-distress' : 'on-device',
    flagged_for_followup: raw.model_used === 'on-device-distress',
    created_at: createdAt,
  };
}

/**
 * Fetches the last 8 days of accuracy for one patient+game, and inserts a
 * cognitive_drop alert if today is more than 2 stddev below the 7-day
 * baseline — unless an unresolved one for today already exists.
 */
async function checkCognitiveDropAlert(
  supabase: AuthedSupabase,
  patientId: string,
  gameType: GameType,
): Promise<void> {
  const { data: history } = await supabase
    .from('daily_summaries')
    .select('accuracy_pct, summary_date')
    .eq('patient_id', patientId)
    .eq('game_type', gameType)
    .order('summary_date', { ascending: false })
    .limit(8);

  if (!history || history.length < 8) return;
  if (!detectCognitiveDrop(history.map((h) => h.accuracy_pct))) return;

  // A true rolling 48h window, not a calendar-day boundary — two alerts
  // ~minutes apart but on opposite sides of midnight must still dedup.
  const windowStart = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

  const { data: existing } = await supabase
    .from('alerts')
    .select('id')
    .eq('patient_id', patientId)
    .eq('alert_type', 'cognitive_drop')
    .eq('is_resolved', false)
    .gte('created_at', windowStart)
    .limit(1);

  if (existing && existing.length > 0) return;

  const { data: patientRow } = await supabase
    .from('patients')
    .select('caregiver_id')
    .eq('id', patientId)
    .single();
  if (!patientRow) return;

  await raiseAlert(supabase, {
    patient_id: patientId,
    caregiver_id: patientRow.caregiver_id,
    alert_type: 'cognitive_drop',
    severity: 'red',
    title: 'Sudden drop in performance',
    description: `Today's ${gameType.replace('_', ' ')} accuracy is well below the recent average.`,
  });
}

/**
 * The one place an alert row is created. The caregiver is told (Web Push)
 * only when this call really inserted the row: every caller has already
 * returned early on its dedupe / resolve paths, and a failed insert stays
 * silent. The push is fire-and-forget and can never fail the sync.
 */
async function raiseAlert(
  supabase: AuthedSupabase,
  row: {
    patient_id: string;
    caregiver_id: string;
    alert_type: AlertKind;
    severity: AlertSeverity;
    title: string;
    description: string;
  },
): Promise<void> {
  const id = uuid();
  const { error } = await supabase
    .from('alerts')
    .insert({ id, ...row, is_read: false, is_resolved: false, resolved_at: null });
  if (error) return;
  scheduleAlertPush({
    alertId: id,
    caregiverId: row.caregiver_id,
    patientId: row.patient_id,
    type: row.alert_type,
    severity: row.severity,
  });
}

const DAY_MS = 24 * 60 * 60 * 1000;

async function resolveAlert(supabase: AuthedSupabase, alertId: string): Promise<void> {
  await supabase.from('alerts').update({ is_resolved: true, resolved_at: new Date().toISOString() }).eq('id', alertId);
}

/**
 * Keeps one `missed_sessions` (yellow) alert in step with reality: raised when
 * nothing was played on today or the 3 days before it, and resolved again as
 * soon as a game is played. It used to fire for a patient added that same
 * day, ignore a game played today, and stay open forever once raised, so a
 * patient who was playing every day still read "Needs attention".
 */
async function checkMissedSessionsAlert(supabase: AuthedSupabase, patientId: string): Promise<void> {
  const since = new Date(Date.now() - 3 * DAY_MS).toISOString().slice(0, 10);
  const [{ data: existing }, { data: summaries }, { data: patientRow }] = await Promise.all([
    supabase
      .from('alerts')
      .select('id')
      .eq('patient_id', patientId)
      .eq('alert_type', 'missed_sessions')
      .eq('is_resolved', false)
      .limit(1),
    supabase.from('daily_summaries').select('summary_date').eq('patient_id', patientId).gte('summary_date', since),
    supabase.from('patients').select('caregiver_id, created_at').eq('id', patientId).single(),
  ]);
  const openAlert = existing?.[0];
  const dates = (summaries ?? []).map((s) => s.summary_date);
  const playedToday = dates.includes(new Date().toISOString().slice(0, 10));
  const missed = !playedToday && detectMissedSessions(dates);

  if (!missed) {
    if (openAlert) await resolveAlert(supabase, openAlert.id);
    return;
  }
  if (openAlert || !patientRow) return;
  // A patient added in the last 3 days has not had the chance to miss 3 days.
  if (patientRow.created_at && Date.now() - new Date(patientRow.created_at).getTime() < 3 * DAY_MS) return;

  await raiseAlert(supabase, {
    patient_id: patientId,
    caregiver_id: patientRow.caregiver_id,
    alert_type: 'missed_sessions',
    severity: 'yellow',
    title: 'Patient missed 3+ consecutive days',
    description:
      'No game sessions recorded in the last 3 days. Regular engagement is important for cognitive maintenance.',
  });
}

/**
 * Keeps one `low_adherence` (yellow) alert in step with 7-day reminder
 * adherence (lib/engine/adherence.ts, the same calculation as the Reminders
 * tab): raised below 50%, resolved again at 50% or above. Nothing is raised
 * when no reminder was due yet, which used to read as 0% and raise it.
 */
async function checkLowAdherenceAlert(supabase: AuthedSupabase, patientId: string): Promise<void> {
  const days = dateRange(7);
  const earliest = days[0];
  const [{ data: existing }, { data: schedules }, { data: acks }] = await Promise.all([
    supabase
      .from('alerts')
      .select('id')
      .eq('patient_id', patientId)
      .eq('alert_type', 'low_adherence')
      .eq('is_resolved', false)
      .limit(1),
    supabase
      .from('reminder_schedules')
      // '*' rather than a column list: the appointment columns count toward
      // adherence when present, and a database without them still answers.
      .select('*')
      .eq('patient_id', patientId)
      .eq('is_active', true),
    supabase
      .from('reminder_acks')
      .select('reminder_id, scheduled_at, acknowledged_at')
      .eq('patient_id', patientId)
      .gte('scheduled_at', `${earliest}T00:00:00.000Z`),
  ]);
  const openAlert = existing?.[0];

  const { overallPct, byType } = computeAdherence(schedules ?? [], acks ?? [], days);
  const due = Object.values(byType).reduce((sum, t) => sum + t.total, 0);
  const low = due > 0 && detectLowAdherence(overallPct);

  if (!low) {
    if (openAlert) await resolveAlert(supabase, openAlert.id);
    return;
  }
  if (openAlert) return;

  const { data: patientRow } = await supabase
    .from('patients')
    .select('caregiver_id')
    .eq('id', patientId)
    .single();
  if (!patientRow) return;

  await raiseAlert(supabase, {
    patient_id: patientId,
    caregiver_id: patientRow.caregiver_id,
    alert_type: 'low_adherence',
    severity: 'yellow',
    title: 'Low reminder adherence',
    description: `Only ${overallPct}% of reminders were marked done in the last 7 days.`,
  });
}
