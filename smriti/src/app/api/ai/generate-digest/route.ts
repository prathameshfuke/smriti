import { authenticateRequest } from '@/lib/supabase/server-auth';
import { createServiceRoleClient } from '@/lib/supabase/client';
import { computeAdherence } from '@/lib/engine/adherence';
import { callLLM } from '@/lib/ai/llm-client';
import { buildFallbackDigest, containsForbiddenWord, shouldRegenerateDigest } from '@/lib/ai/digest-safety';

interface GenerateDigestBody {
  patientId?: string;
}

function dateRange(days: number): string[] {
  const dates: string[] = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    dates.push(d.toISOString().slice(0, 10));
  }
  return dates;
}

/** Monday of the current week, UTC — the digest's "week_of" anchor. */
function currentWeekOf(): string {
  const d = new Date();
  const day = d.getUTCDay();
  const diff = (day === 0 ? -6 : 1) - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10);
}

export async function POST(request: Request) {
  const auth = await authenticateRequest(request);
  if (!auth) return Response.json({ error: 'unauthorized' }, { status: 401 });

  let body: GenerateDigestBody;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'invalid_json' }, { status: 400 });
  }
  if (!body?.patientId) return Response.json({ error: 'missing_patient_id' }, { status: 400 });

  const { data: caregiver } = await auth.supabase.from('caregivers').select('id').eq('auth_id', auth.userId).single();
  if (!caregiver) return Response.json({ error: 'caregiver_not_found' }, { status: 404 });
  const { data: owned } = await auth.supabase
    .from('patients')
    .select('id')
    .eq('id', body.patientId)
    .eq('caregiver_id', caregiver.id)
    .single();
  if (!owned) return Response.json({ error: 'patient_not_found' }, { status: 404 });

  const service = createServiceRoleClient();
  const weekOf = currentWeekOf();

  const { data: existing } = await service
    .from('caregiver_digests')
    .select('summary_text, generated_at')
    .eq('patient_id', body.patientId)
    .eq('week_of', weekOf)
    .single();

  if (existing && !shouldRegenerateDigest(existing.generated_at)) {
    return Response.json({ summary: existing.summary_text, generatedAt: existing.generated_at, cached: true });
  }

  const days = dateRange(7);
  const earliest = `${days[0]}T00:00:00.000Z`;

  const [{ data: summaries }, { data: logRows }, { data: schedules }, { data: acks }] = await Promise.all([
    service.from('daily_summaries').select('game_type, accuracy_pct').eq('patient_id', body.patientId).gte('summary_date', days[0]),
    service.from('ai_conversation_log').select('grounded').eq('patient_id', body.patientId).gte('created_at', earliest),
    service.from('reminder_schedules').select('*').eq('patient_id', body.patientId).eq('is_active', true),
    service.from('reminder_acks').select('reminder_id, scheduled_at, acknowledged_at').eq('patient_id', body.patientId).gte('scheduled_at', earliest),
  ]);

  const gamesPlayed = (summaries ?? []).length;
  const avgAccuracyPct =
    gamesPlayed > 0 ? Math.round((summaries ?? []).reduce((sum, s) => sum + s.accuracy_pct, 0) / gamesPlayed) : 0;

  const grounded = (logRows ?? []).filter((r) => r.grounded).length;
  const askedTotal = (logRows ?? []).length;

  // Same counting as the caregiver adherence view, so a dated appointment
  // counts by its own prompts rather than every day of the week.
  const adherence = computeAdherence(schedules ?? [], acks ?? [], days);
  const totalExpected = Object.values(adherence.byType).reduce((sum, t) => sum + t.total, 0);
  const totalAcked = Object.values(adherence.byType).reduce((sum, t) => sum + t.acked, 0);
  const adherencePct = adherence.overallPct;

  const fallbackStats = { gamesPlayed, avgAccuracyPct, adherencePct };

  const systemPrompt =
    "Summarize this week's activity for a family caregiver in 3-4 plain sentences. Note any " +
    'notable change from the prior week if the data suggests one. Never diagnose, never use ' +
    'clinical or medical language, never say words like dementia, decline, cognition, or ' +
    'condition — describe only what the data shows (e.g. "completed fewer games this week" not ' +
    '"cognition is declining"). End with one concrete, optional suggestion only if relevant.';
  const userPrompt =
    `Games completed this week: ${gamesPlayed}, average accuracy: ${avgAccuracyPct}%. ` +
    `Companion questions answered from the Memory Bank: ${grounded} of ${askedTotal}. ` +
    `Reminders acknowledged: ${totalAcked} of ${totalExpected} (${adherencePct}%).`;

  let summary = '';
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const result = await callLLM({ systemPrompt, userPrompt });
    if (!containsForbiddenWord(result.text)) {
      summary = result.text;
      break;
    }
  }
  if (!summary) {
    summary = buildFallbackDigest(fallbackStats);
  }

  const generatedAt = new Date().toISOString();
  await service
    .from('caregiver_digests')
    .upsert(
      { id: crypto.randomUUID(), patient_id: body.patientId, week_of: weekOf, summary_text: summary, generated_at: generatedAt },
      { onConflict: 'patient_id,week_of' },
    );

  return Response.json({ summary, generatedAt, cached: false });
}
