import { authenticateRequest } from '@/lib/supabase/server-auth';
import { verifyDeviceTrust } from '@/lib/auth/deviceTrustServer';

type RouteContext = { params: Promise<{ id: string }> };

function startOfTodayIso(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

/**
 * Patient-facing: "is there an encouragement note to show right now."
 * Two auth paths, same shape as /api/ai/converse — a kiosk device-trust
 * token (patient device, no Supabase session) or a caregiver Bearer token
 * (previewing what the patient will see). The 1-per-day rate limit is
 * enforced HERE, server-side, not just in the UI — a device token proves
 * which patient is asking, but nothing stops a client from polling this
 * endpoint repeatedly, so the cap has to hold regardless of call frequency.
 */
export async function GET(request: Request, { params }: RouteContext) {
  const { id: patientId } = await params;
  const url = new URL(request.url);

  let authorizedPatientId: string | null = null;

  const tokenRaw = url.searchParams.get('deviceTrustToken');
  if (tokenRaw) {
    let token;
    try {
      token = JSON.parse(tokenRaw);
    } catch {
      token = null;
    }
    if (token && verifyDeviceTrust(token) && token.patientId === patientId) {
      authorizedPatientId = patientId;
    }
  }

  if (!authorizedPatientId) {
    const auth = await authenticateRequest(request);
    if (!auth) return Response.json({ error: 'unauthorized' }, { status: 401 });
    const { supabase, userId } = auth;
    const { data: caregiver } = await supabase.from('caregivers').select('id').eq('auth_id', userId).single();
    if (!caregiver) return Response.json({ error: 'caregiver_not_found' }, { status: 404 });
    const { data: patient } = await supabase
      .from('patients')
      .select('id')
      .eq('id', patientId)
      .eq('caregiver_id', caregiver.id)
      .single();
    if (!patient) return Response.json({ error: 'patient_not_found' }, { status: 404 });
    authorizedPatientId = patientId;
  }

  // Import lazily so the service-role client (needed either way, since a
  // device-trust caller has no Supabase session to read/write with) isn't
  // constructed before auth has actually succeeded.
  const { createServiceRoleClient } = await import('@/lib/supabase/client');
  const service = createServiceRoleClient();

  const { data: surfacedToday } = await service
    .from('family_notes')
    .select('id')
    .eq('patient_id', authorizedPatientId)
    .eq('status', 'surfaced')
    .gte('surfaced_at', startOfTodayIso());
  if (surfacedToday && surfacedToday.length > 0) {
    return Response.json({ note: null });
  }

  const { data: candidates } = await service
    .from('family_notes')
    .select('id, text')
    .eq('patient_id', authorizedPatientId)
    .eq('status', 'approved')
    .order('created_at', { ascending: true })
    .limit(1);

  const next = (candidates ?? [])[0] as { id: string; text: string } | undefined;
  if (!next) return Response.json({ note: null });

  await service
    .from('family_notes')
    .update({ status: 'surfaced', surfaced_at: new Date().toISOString() })
    .eq('id', next.id);

  return Response.json({ note: { id: next.id, text: next.text } });
}
