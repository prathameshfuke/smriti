import { authenticateRequest } from '@/lib/supabase/server-auth';
import { signDeviceTrust } from '@/lib/auth/deviceTrustServer';

interface DeviceTrustRequestBody {
  patientId: string;
}

/**
 * The only place a device-trust token is ever minted. Requires the caller's
 * real Supabase session (Bearer token) and proves they actually own the
 * requested patient before signing anything — the same ownership check
 * `/api/sync` uses, so a caregiver can't mint a trust token for a patient
 * that isn't theirs.
 */
export async function POST(request: Request) {
  const auth = await authenticateRequest(request);
  if (!auth) return Response.json({ error: 'unauthorized' }, { status: 401 });

  let body: DeviceTrustRequestBody;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'invalid_json' }, { status: 400 });
  }
  if (!body?.patientId) return Response.json({ error: 'missing_patient_id' }, { status: 400 });

  const { supabase, userId } = auth;

  const { data: caregiver } = await supabase
    .from('caregivers')
    .select('id')
    .eq('auth_id', userId)
    .single();
  if (!caregiver) return Response.json({ error: 'caregiver_not_found' }, { status: 404 });

  const { data: patient } = await supabase
    .from('patients')
    .select('id')
    .eq('id', body.patientId)
    .eq('caregiver_id', caregiver.id)
    .single();
  if (!patient) return Response.json({ error: 'patient_not_found' }, { status: 404 });

  const token = signDeviceTrust(body.patientId, userId);
  return Response.json({ token });
}
