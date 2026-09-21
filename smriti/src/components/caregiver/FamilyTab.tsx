'use client';

import { useEffect, useState } from 'react';
import Skeleton from '@/components/ui/Skeleton';
import Panel, { buttonClass, fieldClass, labelClass } from '@/components/ui/Panel';
import Notice from '@/components/ui/Notice';
import CardColumns from '@/components/ui/CardColumns';
import AccountAccessCard from '@/components/caregiver/AccountAccessCard';
import { authedFetch } from '@/lib/api/client';

interface FamilyShareRow {
  id: string;
  label: string;
  review_required: boolean;
  expires_at: string;
  revoked_at: string | null;
  created_at: string;
}

interface FamilyNoteRow {
  id: string;
  text: string;
  status: string;
  created_at: string;
}

export interface FamilyTabProps {
  patientId: string;
  onError: () => void;
}

/** Family share links and the message board: create/revoke a link, post a
 * message to the patient's home screen, and moderate pending family notes. */
export default function FamilyTab({ patientId, onError }: FamilyTabProps) {
  const [familyShares, setFamilyShares] = useState<FamilyShareRow[] | null>(null);
  const [familyNotes, setFamilyNotes] = useState<FamilyNoteRow[] | null>(null);
  const [newShareLabel, setNewShareLabel] = useState('');
  const [creatingShare, setCreatingShare] = useState(false);
  const [newMessageSender, setNewMessageSender] = useState('');
  const [newMessageRelation, setNewMessageRelation] = useState('');
  const [newMessageText, setNewMessageText] = useState('');
  const [newMessagePhotoUrl, setNewMessagePhotoUrl] = useState('');
  const [postingMessage, setPostingMessage] = useState(false);
  const [messagePosted, setMessagePosted] = useState(false);
  // Read once on mount, not on every render: `Date.now()` is impure and
  // React flags calling it during render. ISO 8601 UTC strings compare
  // lexicographically the same as chronologically, so this is a plain
  // string comparison below, not a re-parsed Date on each share row.
  const [nowIso] = useState(() => new Date().toISOString());

  const loadFamilyTabData = () => {
    authedFetch<{ shares: FamilyShareRow[] }>(`/api/family-share?patientId=${patientId}`)
      .then((body) => setFamilyShares(body.shares))
      .catch(() => setFamilyShares((prev) => prev ?? []));
    authedFetch<{ notes: FamilyNoteRow[] }>(`/api/patients/${patientId}/family-notes`)
      .then((body) => setFamilyNotes(body.notes))
      .catch(() => setFamilyNotes((prev) => prev ?? []));
  };

  useEffect(() => {
    loadFamilyTabData();
    // Fires once per patient; loadFamilyTabData closes over patientId, the
    // only real dependency, and is intentionally not itself a dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId]);

  const createFamilyShare = () => {
    if (!newShareLabel.trim()) return;
    setCreatingShare(true);
    authedFetch<{ id: string; expiresAt: string }>('/api/family-share', {
      method: 'POST',
      body: JSON.stringify({ patientId, label: newShareLabel.trim() }),
    })
      .then(() => {
        setNewShareLabel('');
        setFamilyShares(null);
        loadFamilyTabData();
      })
      .catch(onError)
      .finally(() => setCreatingShare(false));
  };

  const updateShareReviewRequired = (shareId: string, reviewRequired: boolean) => {
    setFamilyShares((prev) => (prev ?? []).map((s) => (s.id === shareId ? { ...s, review_required: reviewRequired } : s)));
    authedFetch(`/api/family-share/${shareId}`, {
      method: 'PATCH',
      body: JSON.stringify({ reviewRequired }),
    }).catch(() => {
      // Revert on failure — the optimistic flip above assumed success.
      setFamilyShares((prev) => (prev ?? []).map((s) => (s.id === shareId ? { ...s, review_required: !reviewRequired } : s)));
    });
  };

  const revokeFamilyShare = (shareId: string) => {
    authedFetch(`/api/family-share/${shareId}`, { method: 'DELETE' })
      .then(() => {
        setFamilyShares(null);
        loadFamilyTabData();
      })
      .catch(onError);
  };

  const postFamilyMessage = () => {
    if (!newMessageText.trim()) return;
    setPostingMessage(true);
    setMessagePosted(false);
    authedFetch<{ id: string; status: string }>(`/api/patients/${patientId}/family-notes`, {
      method: 'POST',
      body: JSON.stringify({
        text: newMessageText.trim(),
        senderName: newMessageSender.trim() || undefined,
        senderRelation: newMessageRelation.trim() || undefined,
        photoUrl: newMessagePhotoUrl.trim() || undefined,
      }),
    })
      .then(() => {
        setNewMessageSender('');
        setNewMessageRelation('');
        setNewMessageText('');
        setNewMessagePhotoUrl('');
        setMessagePosted(true);
      })
      .catch(onError)
      .finally(() => setPostingMessage(false));
  };

  const moderateFamilyNote = (noteId: string, action: 'approve' | 'reject') => {
    authedFetch(`/api/patients/${patientId}/family-notes`, {
      method: 'PATCH',
      body: JSON.stringify({ noteId, action }),
    })
      .then(() => setFamilyNotes((prev) => (prev ? prev.filter((n) => n.id !== noteId) : prev)))
      .catch(onError);
  };

  return (
    <CardColumns>
      <Panel
        title="Share with family"
        description="A read-only weekly summary and this week's activity. Games data, the Memory Bank and companion conversations are never shared. Links expire after 30 days and can be revoked any time."
      >
        <label htmlFor="family-share-label" className={labelClass}>
          Who is this link for?
        </label>
        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            id="family-share-label"
            value={newShareLabel}
            onChange={(e) => setNewShareLabel(e.target.value)}
            placeholder="e.g. Son in Delhi"
            className={`${fieldClass} sm:flex-1`}
          />
          <button
            type="button"
            onClick={createFamilyShare}
            disabled={creatingShare || !newShareLabel.trim()}
            className={`${buttonClass.primary} min-h-14`}
          >
            {creatingShare ? 'Creating…' : 'Create link'}
          </button>
        </div>
      </Panel>

      <Panel title="Post a message" description="Appears on the patient's home screen as a short card they can mark as seen.">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-4 sm:flex-row">
            <div className="sm:flex-1">
              <label htmlFor="message-sender-name" className={labelClass}>
                Your name
              </label>
              <input
                id="message-sender-name"
                value={newMessageSender}
                onChange={(e) => setNewMessageSender(e.target.value)}
                placeholder="Optional"
                className={fieldClass}
              />
            </div>
            <div className="sm:flex-1">
              <label htmlFor="message-sender-relation" className={labelClass}>
                Relation to patient
              </label>
              <input
                id="message-sender-relation"
                value={newMessageRelation}
                onChange={(e) => setNewMessageRelation(e.target.value)}
                placeholder="e.g. Daughter"
                className={fieldClass}
              />
            </div>
          </div>
          <div>
            <label htmlFor="message-text" className={labelClass}>
              Message
            </label>
            <textarea
              id="message-text"
              value={newMessageText}
              onChange={(e) => setNewMessageText(e.target.value)}
              placeholder="Write a short message…"
              maxLength={280}
              rows={3}
              className={fieldClass}
            />
          </div>
          <div>
            <label htmlFor="message-photo-url" className={labelClass}>
              Photo URL
            </label>
            <input
              id="message-photo-url"
              value={newMessagePhotoUrl}
              onChange={(e) => setNewMessagePhotoUrl(e.target.value)}
              placeholder="Optional"
              className={fieldClass}
            />
          </div>
          <button
            type="button"
            onClick={postFamilyMessage}
            disabled={postingMessage || !newMessageText.trim()}
            className={`${buttonClass.primary} self-start`}
          >
            {postingMessage ? 'Posting…' : 'Post message'}
          </button>
          <div role="status" className="empty:hidden">
            {messagePosted ? <Notice tone="success">Message posted. It will appear on the patient&apos;s home screen.</Notice> : null}
          </div>
        </div>
      </Panel>
      <Panel title="Active shares" flush>
        {familyShares === null ? (
          <div className="px-5 pb-5">
            <Skeleton height={80} />
          </div>
        ) : null}
        {familyShares && familyShares.length === 0 ? (
          <p className="px-5 pb-5 text-caregiver-body text-ink-muted">No family shares yet.</p>
        ) : null}
        {familyShares && familyShares.length > 0 ? (
          <div className="divide-y divide-line200 border-t border-line200">
            {familyShares.map((share) => {
              const revoked = Boolean(share.revoked_at);
              const expired = !revoked && share.expires_at < nowIso;
              return (
                <AccountAccessCard
                  key={share.id}
                  label={share.label}
                  active={!revoked && !expired}
                  statusTone={revoked ? 'danger' : expired ? 'warning' : 'success'}
                  statusLabel={revoked ? 'Revoked' : expired ? 'Expired' : `Expires ${new Date(share.expires_at).toLocaleDateString()}`}
                  reviewRequired={share.review_required}
                  onReviewRequiredChange={(next) => updateShareReviewRequired(share.id, next)}
                  onRevoke={() => revokeFamilyShare(share.id)}
                  shareUrl={typeof window !== 'undefined' ? `${window.location.origin}/family/${share.id}` : undefined}
                />
              );
            })}
          </div>
        ) : null}
      </Panel>

      <Panel title="Notes awaiting review" flush>
        {familyNotes === null ? (
          <div className="px-5 pb-5">
            <Skeleton height={80} />
          </div>
        ) : null}
        {familyNotes && familyNotes.length === 0 ? (
          <p className="px-5 pb-5 text-caregiver-body text-ink-muted">Nothing waiting for review.</p>
        ) : null}
        {familyNotes && familyNotes.length > 0 ? (
          <ul className="divide-y divide-line200 border-t border-line200">
            {familyNotes.map((note) => (
              <li key={note.id} className="flex flex-col gap-3 px-5 py-4">
                <p className="text-caregiver-body text-ink">&ldquo;{note.text}&rdquo;</p>
                <div className="flex gap-3">
                  <button type="button" onClick={() => moderateFamilyNote(note.id, 'approve')} className={buttonClass.primary}>
                    Approve
                  </button>
                  <button type="button" onClick={() => moderateFamilyNote(note.id, 'reject')} className={buttonClass.secondary}>
                    Reject
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ) : null}
      </Panel>
    </CardColumns>
  );
}
