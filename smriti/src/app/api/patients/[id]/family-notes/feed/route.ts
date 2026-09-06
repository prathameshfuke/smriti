import { authenticateRequest } from '@/lib/supabase/server-auth';
import { verifyDeviceTrust } from '@/lib/auth/deviceTrustServer';

type RouteContext = { params: Promise<{ id: string }> };

const FEED_LIMIT = 20;

interface FamilyNoteFeedRow {
  id: string;
  text: string;
  sender_name: string | null;
  sender_relation: string | null;
  photo_url: string | null;
  created_at: string;
  seen_at: string | null;
}

/**
 * Patient-facing (offline-first) pull: the kiosk's family message board
 * calls this periodically and mirrors the result into Dexie's
 * `familyMessages` table (lib/family/familyMessagesClient.ts), so the board
 * still renders whatever was last fetched when the device is offline.
 *
 * Same two-auth-path shape as GET /api/patients/[id]/surface-note — a
 * kiosk device-trust token, or a caregiver Bearer token previewing the
 * board — but unlike surface-note this has no 1-per-day gate and no
 * mutation: it is a plain read of the patient's approved/surfaced message
 * history, newest first.
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

  const { createServiceRoleClient } = await import('@/lib/supabase/client');
  const service = createServiceRoleClient();

  const { data } = await service
    .from('family_notes')
    .select('id, text, sender_name, sender_relation, photo_url, created_at, seen_at')
    .eq('patient_id', authorizedPatientId)
    .in('status', ['approved', 'surfaced'])
    .order('created_at', { ascending: false })
    .limit(FEED_LIMIT);

  const notes = (data ?? []) as FamilyNoteFeedRow[];

  return Response.json({
    notes: notes.map((n) => ({
      id: n.id,
      text: n.text,
      senderName: n.sender_name,
      senderRelation: n.sender_relation,
      photoUrl: n.photo_url,
      createdAt: n.created_at,
      seenAt: n.seen_at,
    })),
  });
}
