import { v4 as uuid } from 'uuid';
import { authenticateRequest } from '@/lib/supabase/server-auth';
import { signFamilyShare, FAMILY_SHARE_DEFAULT_TTL_MS } from '@/lib/family/familyShareServer';

interface IssueRequestBody {
  patientId: string;
  label: string;
  reviewRequired?: boolean;
}

/**
 * Mints a family share. Requires the caller's real Supabase session and
 * proves patient ownership first — same shape as POST /api/device-trust.
 * The returned `id` IS the credential a family member uses (no separate
 * token) — the share row itself is checked live on every request, so
 * revocation takes effect immediately rather than waiting for a token to
 * expire.
 */
export async function POST(request: Request) {
  const auth = await authenticateRequest(request);
  if (!auth) return Response.json({ error: 'unauthorized' }, { status: 401 });

  let body: IssueRequestBody;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'invalid_json' }, { status: 400 });
  }
  if (!body?.patientId || !body?.label) {
    return Response.json({ error: 'missing_fields' }, { status: 400 });
  }

  const { supabase, userId } = auth;

  const { data: caregiver } = await supabase.from('caregivers').select('id').eq('auth_id', userId).single();
  if (!caregiver) return Response.json({ error: 'caregiver_not_found' }, { status: 404 });

  const { data: patient } = await supabase
    .from('patients')
    .select('id')
    .eq('id', body.patientId)
    .eq('caregiver_id', caregiver.id)
    .single();
  if (!patient) return Response.json({ error: 'patient_not_found' }, { status: 404 });

  const id = uuid();
  const expiresAt = new Date(Date.now() + FAMILY_SHARE_DEFAULT_TTL_MS);
  const signature = signFamilyShare(id, body.patientId, expiresAt);

  const { error } = await supabase.from('family_shares').insert({
    id,
    patient_id: body.patientId,
    caregiver_id: caregiver.id,
    label: body.label,
    signature,
    review_required: body.reviewRequired ?? true,
    expires_at: expiresAt.toISOString(),
    revoked_at: null,
  });
  if (error) return Response.json({ error: 'insert_failed' }, { status: 500 });

  return Response.json({ id, expiresAt: expiresAt.toISOString() });
}

/** Lists a patient's family shares for the caregiver-side management view. */
export async function GET(request: Request) {
  const auth = await authenticateRequest(request);
  if (!auth) return Response.json({ error: 'unauthorized' }, { status: 401 });

  const patientId = new URL(request.url).searchParams.get('patientId');
  if (!patientId) return Response.json({ error: 'missing_patient_id' }, { status: 400 });

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

  const { data: shares } = await supabase
    .from('family_shares')
    .select('id, label, review_required, expires_at, revoked_at, created_at')
    .eq('patient_id', patientId)
    .order('created_at', { ascending: false });

  return Response.json({ shares: shares ?? [] });
}
