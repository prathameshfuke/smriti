import { v4 as uuid } from 'uuid';
import { createServiceRoleClient } from '@/lib/supabase/client';
import { verifyFamilyShareSignature, isFamilyShareExpired } from '@/lib/family/familyShareServer';

type RouteContext = { params: Promise<{ id: string }> };

interface NotesRequestBody {
  text: string;
  senderName?: string;
  senderRelation?: string;
  photoUrl?: string;
}

const MAX_NOTE_LENGTH = 280;
const MAX_SENDER_FIELD_LENGTH = 60;
const MAX_PHOTO_URL_LENGTH = 2048;

/**
 * A family member leaves a one-directional note. No auth header — the share
 * id is the credential, same validation as the GET view route. Lands as
 * `pending` when the share's `review_required` is true (the default),
 * `approved` only when a caregiver has explicitly turned review off for
 * this family member — never auto-approved by omission.
 */
export async function POST(request: Request, { params }: RouteContext) {
  const { id } = await params;

  let body: NotesRequestBody;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'invalid_json' }, { status: 400 });
  }
  const text = body?.text?.trim();
  if (!text || text.length > MAX_NOTE_LENGTH) {
    return Response.json({ error: 'invalid_text' }, { status: 400 });
  }
  const senderName = body?.senderName?.trim().slice(0, MAX_SENDER_FIELD_LENGTH) || null;
  const senderRelation = body?.senderRelation?.trim().slice(0, MAX_SENDER_FIELD_LENGTH) || null;
  const photoUrlRaw = body?.photoUrl?.trim();
  if (photoUrlRaw && photoUrlRaw.length > MAX_PHOTO_URL_LENGTH) {
    return Response.json({ error: 'invalid_photo_url' }, { status: 400 });
  }
  const photoUrl = photoUrlRaw || null;

  const service = createServiceRoleClient();
  const { data } = await service.from('family_shares').select('*').eq('id', id).single();
  const share = data as
    | { id: string; patient_id: string; signature: string; expires_at: string; revoked_at: string | null; review_required: boolean }
    | null;

  if (
    !share ||
    share.revoked_at ||
    isFamilyShareExpired(share.expires_at) ||
    !verifyFamilyShareSignature(share.id, share.patient_id, share.expires_at, share.signature)
  ) {
    return Response.json({ error: 'invalid_or_expired_share' }, { status: 401 });
  }

  const status = share.review_required ? 'pending' : 'approved';

  const { error } = await service.from('family_notes').insert({
    id: uuid(),
    family_share_id: share.id,
    posted_by_caregiver_id: null,
    patient_id: share.patient_id,
    text,
    status,
    sender_name: senderName,
    sender_relation: senderRelation,
    photo_url: photoUrl,
    surfaced_at: null,
    seen_at: null,
  });
  if (error) return Response.json({ error: 'insert_failed' }, { status: 500 });

  return Response.json({ status });
}
