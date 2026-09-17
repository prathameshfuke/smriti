import { authenticateRequest } from '@/lib/supabase/server-auth';
import { computeAdherence, dateRange } from '@/lib/engine/adherence';

const RANGE_DAYS = 7;

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

  const [{ data: schedules }, { data: acks }] = await Promise.all([
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

  return Response.json(computeAdherence(schedules ?? [], acks ?? [], days));
}
