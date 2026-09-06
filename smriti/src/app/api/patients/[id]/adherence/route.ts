import { authenticateRequest } from '@/lib/supabase/server-auth';
import type { ReminderType } from '@/lib/supabase/types';

const RANGE_DAYS = 7;

function dateRange(days: number): string[] {
  const dates: string[] = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    dates.push(d.toISOString().slice(0, 10));
  }
  return dates;
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateRequest(request);
  if (!auth) return Response.json({ error: 'unauthorized' }, { status: 401 });

  const { supabase, userId } = auth;
  const { id: patientId } = await params;

  const { data: caregiver } = await supabase
    .from('caregivers')
    .select('id')
    .eq('auth_id', userId)
    .single();
  if (!caregiver) return Response.json({ error: 'caregiver_not_found' }, { status: 404 });

  const { data: owned } = await supabase
    .from('patients')
    .select('id')
    .eq('id', patientId)
    .eq('caregiver_id', caregiver.id)
    .single();
  if (!owned) return Response.json({ error: 'not_found' }, { status: 404 });

  const days = dateRange(RANGE_DAYS);
  const earliest = days[0];
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const currentTimeStr = now.toISOString().slice(11, 16);

  const [{ data: schedules }, { data: acks }] = await Promise.all([
    supabase
      .from('reminder_schedules')
      .select('id, reminder_type, label, time_of_day, days_of_week')
      .eq('patient_id', patientId)
      .eq('is_active', true),
    supabase
      .from('reminder_acks')
      .select('reminder_id, scheduled_at, acknowledged_at')
      .eq('patient_id', patientId)
      .gte('scheduled_at', `${earliest}T00:00:00.000Z`),
  ]);

  const ackedByReminderAndDate = new Set(
    (acks ?? [])
      .filter((a) => a.acknowledged_at)
      .map((a) => `${a.reminder_id}:${a.scheduled_at.slice(0, 10)}`),
  );

  const byType: Record<string, { acked: number; total: number }> = {};
  const missed: Array<{ date: string; time: string; label: string }> = [];
  let totalAcked = 0;
  let totalExpected = 0;

  for (const schedule of schedules ?? []) {
    const type: ReminderType = schedule.reminder_type;
    byType[type] ??= { acked: 0, total: 0 };

    for (const dateStr of days) {
      const weekday = new Date(`${dateStr}T00:00:00Z`).getUTCDay();
      if (!schedule.days_of_week.includes(weekday)) continue;

      // A reminder scheduled later today hasn't had a chance to fire yet —
      // counting it as "missed" the moment the day starts made every
      // patient's adherence look worse than reality until each reminder's
      // own time actually passed.
      if (dateStr === todayStr && schedule.time_of_day.slice(0, 5) > currentTimeStr) continue;

      totalExpected += 1;
      byType[type].total += 1;

      const wasAcked = ackedByReminderAndDate.has(`${schedule.id}:${dateStr}`);
      if (wasAcked) {
        totalAcked += 1;
        byType[type].acked += 1;
      } else {
        missed.push({ date: dateStr, time: schedule.time_of_day, label: schedule.label });
      }
    }
  }

  const overallPct = totalExpected > 0 ? Math.round((totalAcked / totalExpected) * 100) : 0;

  return Response.json({ overallPct, byType, missed });
}
