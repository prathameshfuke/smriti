import { authenticateRequest } from '@/lib/supabase/server-auth';
import { verifyDeviceTrust } from '@/lib/auth/deviceTrustServer';

type RouteContext = { params: Promise<{ id: string; noteId: string }> };

/**
 * Patient-facing: records the "Seen" tap on one family message. Same dual
 * auth path as the feed/surface-note routes. Idempotent — only ever sets
 * `seen_at` when it is still NULL, so a retried offline-queued ack (or a
 * caregiver previewing the board) never clobbers the patient's original
 * ack timestamp with a later one.
 */
export async function POST(request: Request, { params }: RouteContext) {
  const { id: patientId, noteId } = await params;
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

  const { createServiceRoleClient } = await import('@/lib/supabase/client');
  const service = createServiceRoleClient();

  const { error } = await service
    .from('family_notes')
    .update({ seen_at: new Date().toISOString() })
    .eq('id', noteId)
    .eq('patient_id', authorizedPatientId)
    .is('seen_at', null);
  if (error) return Response.json({ error: 'update_failed' }, { status: 500 });

  return Response.json({ acknowledged: true });
}
