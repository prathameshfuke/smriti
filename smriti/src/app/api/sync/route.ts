import { v4 as uuid } from 'uuid';
import { authenticateRequest } from '@/lib/supabase/server-auth';
import { detectCognitiveDrop } from '@/lib/engine/alerts';
import type { GameType } from '@/lib/supabase/types';

const RATE_LIMIT_MS = 30_000;

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
}

/** Which of one patient's row categories Supabase actually rejected this sync. */
interface PatientSyncErrors {
  sessions?: string;
  events?: string;
  dailySummaries?: string;
  reminderAcks?: string;
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
  if (Date.now() - lastSync < RATE_LIMIT_MS) {
    return Response.json({ error: 'rate_limited' }, { status: 429 });
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

  for (const patient of ownedPatients) {
    const errors: PatientSyncErrors = {};

    if (patient.sessions?.length) {
      const { error } = await supabase
        .from('game_sessions')
        .upsert(patient.sessions as never[], { onConflict: 'id', ignoreDuplicates: true });
      if (error) errors.sessions = error.message;
    }
    if (patient.events?.length) {
      const { error } = await supabase
        .from('telemetry_events')
        .upsert(patient.events as never[], { onConflict: 'id', ignoreDuplicates: true });
      if (error) errors.events = error.message;
      else syncedEventCount += patient.events.length;
    }
    if (patient.dailySummaries?.length) {
      const { error } = await supabase
        .from('daily_summaries')
        .upsert(patient.dailySummaries as never[], { onConflict: 'id' });
      if (error) errors.dailySummaries = error.message;
    }
    if (patient.reminderAcks?.length) {
      const { error } = await supabase
        .from('reminder_acks')
        .upsert(patient.reminderAcks as never[], { onConflict: 'id', ignoreDuplicates: true });
      if (error) errors.reminderAcks = error.message;
    }

    if (Object.keys(errors).length > 0) {
      syncErrors[patient.patientId] = errors;
      console.error('SMRITI: sync upsert rejected', patient.patientId, errors);
    }

    // Cognitive-drop alerts read from daily_summaries, which the loop above
    // just proved may not actually contain this patient's rows — skip a
    // check that would otherwise query the row it knows just failed to write.
    const gameTypes = new Set(
      patient.dailySummaries?.filter(() => !errors.dailySummaries).map((s) => s.gameType) ?? [],
    );
    for (const gameType of gameTypes) {
      await checkCognitiveDropAlert(supabase, patient.patientId, gameType as GameType);
    }
  }

  const since = body.lastSyncTimestamp ?? new Date(0).toISOString();
  const patientIds = ownedPatients.map((p) => p.patientId);

  const [{ data: patients }, { data: reminders }, { data: alerts }] = await Promise.all([
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
  ]);

  return Response.json({
    serverTimestamp: new Date().toISOString(),
    syncedEventCount,
    syncErrors,
    updates: { patients: patients ?? [], reminders: reminders ?? [], alerts: alerts ?? [] },
  });
}

type AuthedSupabase = NonNullable<Awaited<ReturnType<typeof authenticateRequest>>>['supabase'];

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

  await supabase.from('alerts').insert({
    id: uuid(),
    patient_id: patientId,
    caregiver_id: patientRow.caregiver_id,
    alert_type: 'cognitive_drop',
    severity: 'red',
    title: 'Sudden drop in performance',
    description: `Today's ${gameType.replace('_', ' ')} accuracy is well below the recent average.`,
    is_read: false,
    is_resolved: false,
    resolved_at: null,
  });
}
