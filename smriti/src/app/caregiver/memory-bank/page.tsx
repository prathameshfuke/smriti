'use client';

import { useCallback, useEffect, useState } from 'react';
import { v4 as uuid } from 'uuid';
import BigButton from '@/components/ui/BigButton';
import { useEscapeKey } from '@/hooks/useEscapeKey';
import PageHeader from '@/components/ui/PageHeader';
import MemoryBankBackup from '@/components/caregiver/MemoryBankBackup';
import { buttonClass, fieldClass, labelClass, textActionClass } from '@/components/ui/Panel';
import { authedFetch } from '@/lib/api/client';
import { usePatientStore } from '@/stores/patientStore';
import { useMemoryBankStore } from '@/stores/memoryBankStore';
import type { LocalMemoryBankEntry } from '@/lib/db/schema';
import type { MemoryBankCategory } from '@/lib/supabase/types';
import type { ParsedMemoryBankEntry } from '@/lib/ai/onboarding-parser';

/**
 * Per-category wording, used consistently in the section headings, the
 * add/edit dialog title and its field labels. The dialog always names the
 * category it is adding to ("Add Schedule", not just "Add entry"), so a
 * caregiver filling in several entries back-to-back always knows which
 * bucket they are in. Words only: an earlier version paired each category
 * with an icon and accent colour, which added four things to learn and
 * nothing the heading did not already say.
 */
const CATEGORY_META: Record<
  MemoryBankCategory,
  { heading: string; singular: string; titleLabel: string; hint: string }
> = {
  person: {
    heading: 'People',
    singular: 'Person',
    titleLabel: 'Name',
    hint: 'Family, friends and neighbours they may ask about.',
  },
  schedule: {
    heading: 'Schedule',
    singular: 'Schedule',
    titleLabel: 'Title',
    hint: 'Regular visits, outings and routines.',
  },
  life_fact: {
    heading: 'Life Facts',
    singular: 'Life Fact',
    titleLabel: 'Title',
    hint: 'Home, work, favourite things and stories.',
  },
  medication: {
    heading: 'Medication',
    singular: 'Medication',
    titleLabel: 'Title',
    hint: 'What they take and when.',
  },
};

const SECTIONS: MemoryBankCategory[] = ['person', 'schedule', 'life_fact', 'medication'];

/** Generous for a single phone snapshot, small enough that the base64 copy
 * stored as-is in IndexedDB (and pushed through /api/sync) never balloons. */
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

interface FormState {
  id: string | null;
  category: MemoryBankCategory;
  title: string;
  relationship: string;
  detail: string;
  photoUrl: string | null;
}

const emptyForm = (category: MemoryBankCategory): FormState => ({
  id: null,
  category,
  title: '',
  relationship: '',
  detail: '',
  photoUrl: null,
});

/**
 * Lightweight, non-blocking guidance — never disables Save. Two people can
 * legitimately share a relationship (a mother can have two sons), so this
 * only surfaces the collision so the caregiver can add a distinguishing
 * detail before the AI companion has two same-relationship facts to
 * confuse (e.g. two "sons" with nothing telling them apart).
 */
function findDuplicateWarning(form: FormState, entries: LocalMemoryBankEntry[]): string | null {
  const title = form.title.trim();
  if (!title) return null;

  if (form.category === 'person' && form.relationship.trim()) {
    const relationship = form.relationship.trim().toLowerCase();
    const collision = entries.find(
      (e) =>
        e.id !== form.id &&
        e.category === 'person' &&
        (e.relationship ?? '').trim().toLowerCase() === relationship &&
        e.title.trim().toLowerCase() !== title.toLowerCase(),
    );
    if (collision) {
      return `You already have "${collision.title}" listed as "${collision.relationship}". Add a distinguishing detail below (e.g. "elder son", "David's father") so the companion doesn't mix them up.`;
    }
  }

  const sameTitle = entries.find(
    (e) =>
      e.id !== form.id &&
      e.category === form.category &&
      e.title.trim().toLowerCase() === title.toLowerCase(),
  );
  if (sameTitle) {
    return `An entry named "${sameTitle.title}" already exists under ${CATEGORY_META[form.category].heading}. Check this isn't a duplicate.`;
  }

  return null;
}

export default function MemoryBankPage() {
  const currentPatient = usePatientStore((s) => s.currentPatient);
  const entries = useMemoryBankStore((s) => s.entries);
  const loadEntries = useMemoryBankStore((s) => s.loadEntries);
  const addEntry = useMemoryBankStore((s) => s.addEntry);
  const updateEntry = useMemoryBankStore((s) => s.updateEntry);
  const deleteEntry = useMemoryBankStore((s) => s.deleteEntry);

  const [form, setForm] = useState<FormState | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  /** Bumped on "Remove photo" so the file `<input>` remounts — otherwise
   * choosing the same file again after removing it never re-fires `onChange`. */
  const [photoInputKey, setPhotoInputKey] = useState(0);

  /** Visible, explicit confirmation that a save/delete actually reached
   * Dexie — replaces what used to be a silent dialog-close. A caregiver
   * unsure a save worked will either re-enter it (creating a duplicate) or
   * wrongly assume the patient's companion already knows it. No auto-dismiss
   * timer: it stays until the caregiver dismisses it or takes the next
   * action, so it can't flicker past unnoticed. */
  const [banner, setBanner] = useState<string | null>(null);

  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [quickText, setQuickText] = useState('');
  const [extracting, setExtracting] = useState(false);
  const [extractError, setExtractError] = useState(false);
  const [reviewEntries, setReviewEntries] = useState<ParsedMemoryBankEntry[] | null>(null);

  useEffect(() => {
    if (currentPatient) void loadEntries(currentPatient.id);
  }, [currentPatient, loadEntries]);

  const startAdd = (category: MemoryBankCategory) => {
    setPhotoError(null);
    setForm(emptyForm(category));
  };

  const startEdit = (entry: LocalMemoryBankEntry) => {
    setPhotoError(null);
    setForm({
      id: entry.id,
      category: entry.category,
      title: entry.title,
      relationship: entry.relationship ?? '',
      detail: entry.detail,
      photoUrl: entry.photoUrl,
    });
  };

  const onPhotoChange = (file: File | undefined) => {
    if (!file) return;
    if (file.size > MAX_PHOTO_BYTES) {
      setPhotoError('That photo is too large. Please choose one under 5MB.');
      return;
    }
    setPhotoError(null);
    const reader = new FileReader();
    // Functional update: `reader.onload` fires after this render, so it must
    // not close over a `form` value that may be stale by then.
    reader.onload = () =>
      setForm((prev) => (prev ? { ...prev, photoUrl: String(reader.result) } : prev));
    reader.readAsDataURL(file);
  };

  const removePhoto = () => {
    setForm((prev) => (prev ? { ...prev, photoUrl: null } : prev));
    setPhotoError(null);
    setPhotoInputKey((k) => k + 1);
  };

  const save = async () => {
    if (!form || !currentPatient) return;

    // Capture the fields we need and close the dialog *before* awaiting the
    // write. `addEntry`/`updateEntry` update the Zustand `entries` array as
    // soon as the Dexie write settles — that resolution lands on its own
    // microtask tick, separate from this function's continuation. Leaving
    // `form` (and therefore this dialog, including the duplicate-warning
    // paragraph) mounted across that gap meant the brand-new entry could
    // transiently appear in `entries` while `form` still held its
    // pre-save id-less snapshot, so `findDuplicateWarning` briefly flagged
    // the entry the caregiver had just saved as a duplicate of itself.
    // Closing the dialog first removes that window entirely; the banner
    // below still lands once — and only once — persistence is confirmed.
    const { id, category, title, relationship, detail, photoUrl } = form;
    setForm(null);

    if (id) {
      await updateEntry(id, {
        title,
        relationship: category === 'person' ? relationship || null : null,
        detail,
        photoUrl,
      });
      setBanner(`Saved: "${title}" updated.`);
    } else {
      await addEntry({
        id: uuid(),
        patientId: currentPatient.id,
        category,
        title,
        detail,
        photoUrl,
        relationship: category === 'person' ? relationship || null : null,
        active: true,
        createdBy: currentPatient.caregiverId,
        updatedAt: new Date().toISOString(),
      });
      setBanner(`Saved: "${title}" added to ${CATEGORY_META[category].heading}.`);
    }
  };

  const extractText = async () => {
    if (!quickText.trim()) return;
    setExtracting(true);
    setExtractError(false);
    try {
      const body = await authedFetch<{ entries: ParsedMemoryBankEntry[] }>('/api/ai/parse-onboarding-text', {
        method: 'POST',
        body: JSON.stringify({ text: quickText }),
      });
      setReviewEntries(body.entries);
      setQuickAddOpen(false);
      setQuickText('');
    } catch {
      setExtractError(true);
    } finally {
      setExtracting(false);
    }
  };

  const removeReviewEntry = (title: string) =>
    setReviewEntries((prev) => (prev ? prev.filter((e) => e.title !== title) : prev));

  const updateReviewEntry = (index: number, patch: Partial<ParsedMemoryBankEntry>) =>
    setReviewEntries((prev) => (prev ? prev.map((e, i) => (i === index ? { ...e, ...patch } : e)) : prev));

  const confirmReview = async () => {
    if (!reviewEntries || !currentPatient) return;
    for (const entry of reviewEntries) {
      await addEntry({
        id: uuid(),
        patientId: currentPatient.id,
        category: entry.category,
        title: entry.title,
        detail: entry.detail,
        photoUrl: null,
        relationship: entry.relationship,
        active: true,
        createdBy: currentPatient.caregiverId,
        updatedAt: new Date().toISOString(),
      });
    }
    const count = reviewEntries.length;
    setReviewEntries(null);
    if (count > 0) setBanner(`Saved: ${count} ${count === 1 ? 'entry' : 'entries'} added.`);
  };

  const confirmDelete = async () => {
    if (!confirmingId) return;
    const target = entries.find((e) => e.id === confirmingId);
    await deleteEntry(confirmingId);
    if (target) setBanner(`Removed: "${target.title}" deleted.`);
    setConfirmingId(null);
  };

  // Stable identities so useEscapeKey's listener isn't rebound every render.
  const closeForm = useCallback(() => setForm(null), []);
  const closeQuickAdd = useCallback(() => setQuickAddOpen(false), []);
  const closeReview = useCallback(() => setReviewEntries(null), []);
  const closeConfirm = useCallback(() => setConfirmingId(null), []);

  const hasAnyEntries = entries.length > 0;
  const duplicateWarning = form ? findDuplicateWarning(form, entries) : null;
  const formMeta = form ? CATEGORY_META[form.category] : null;

  return (
    <main className="mx-auto w-full max-w-dashboard px-5 py-8 md:px-10 md:py-12">
      <PageHeader
        title={currentPatient ? `Memory Bank for ${currentPatient.displayName}` : 'Memory Bank'}
        description="Facts your loved one can ask the companion about. It only answers from what you add here."
        action={
          <button
            type="button"
            aria-label="Quick add"
            onClick={() => setQuickAddOpen(true)}
            className={`${buttonClass.secondary} w-full md:w-auto`}
          >
            Quick add
          </button>
        }
      />

      <MemoryBankBackup />

      {extractError ? (
        <p role="alert" className="-mt-4 mb-6 text-caregiver-body font-bold text-danger">
          Could not extract entries. Try again.
        </p>
      ) : null}

      {banner ? (
        <div
          role="status"
          aria-live="polite"
          className="mb-6 flex items-center justify-between gap-4 rounded-card border border-success/50 bg-success/5 py-2 pl-5 pr-2 text-caregiver-body text-ink"
        >
          <span className="flex items-center gap-3">
            <span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 rounded-full bg-success" />
            {banner}
          </span>
          <button
            type="button"
            aria-label="Dismiss confirmation"
            onClick={() => setBanner(null)}
            className={`${textActionClass} shrink-0 px-3`}
          >
            Dismiss
          </button>
        </div>
      ) : null}

      {!hasAnyEntries ? (
        <section className="rounded-card border border-line200 bg-surface-card p-6 md:p-8">
          <h2 className="font-serif-display text-[1.5rem] font-medium leading-tight text-ink">Start the Memory Bank</h2>
          <p className="mt-2 max-w-[60ch] text-caregiver-body text-ink-muted">
            Add the people and facts your loved one might ask about.
          </p>
          {/* Four explicit choices instead of a single "Add Person" default: a
           * caregiver whose first memory is a medication or a weekly visit
           * shouldn't have to add an unrelated person first. */}
          <div role="group" aria-label="Choose what to add" className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {SECTIONS.map((category) => {
              const meta = CATEGORY_META[category];
              return (
                <button
                  key={category}
                  type="button"
                  onClick={() => startAdd(category)}
                  aria-label={`Add ${meta.singular}`}
                  aria-describedby={`mb-hint-${category}`}
                  className="flex min-h-touch flex-col justify-center rounded-tile border-2 border-ink-muted/60 bg-surface-card px-5 py-3 text-left transition-colors hover:border-ink-muted hover:bg-surface-muted/60"
                >
                  <span className="text-caregiver-body font-bold text-ink">Add {meta.singular}</span>
                  <span id={`mb-hint-${category}`} className="text-patient-sm text-ink-muted">
                    {meta.hint}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      ) : (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 lg:items-start">
          {SECTIONS.map((category) => {
            const meta = CATEGORY_META[category];
            const sectionEntries = entries.filter((e) => e.category === category);
            return (
              <section
                key={category}
                data-testid={`memory-bank-section-${category}`}
                className="rounded-card border border-line200 bg-surface-card"
              >
                <div className="flex items-start justify-between gap-4 px-5 pt-5 pb-3">
                  <div>
                    <h2 className="font-serif-display text-[1.375rem] font-medium leading-tight text-ink">
                      {meta.heading}
                    </h2>
                    <p className="mt-1 text-patient-sm text-ink-muted">{meta.hint}</p>
                  </div>
                  <button type="button" onClick={() => startAdd(category)} className={`${buttonClass.secondary} shrink-0 px-4`}>
                    Add
                  </button>
                </div>

                {sectionEntries.length === 0 ? (
                  <p className="px-5 pb-5 text-caregiver-body text-ink-muted">No entries yet.</p>
                ) : (
                  <ul className="divide-y divide-line200 border-t border-line200">
                    {sectionEntries.map((entry) => (
                      <li key={entry.id} className="flex gap-4 px-5 py-4">
                        {entry.category === 'person' && entry.photoUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={entry.photoUrl}
                            alt=""
                            className="h-14 w-14 shrink-0 rounded-full border border-line200 object-cover"
                          />
                        ) : null}
                        <div className="min-w-0 flex-1">
                          <p className="text-caregiver-body font-bold text-ink">{entry.title}</p>
                          {entry.relationship ? (
                            <p className="text-patient-sm text-ink-muted">{entry.relationship}</p>
                          ) : null}
                          <p className="mt-1 text-caregiver-body text-ink">{entry.detail}</p>
                          <div className="mt-1 flex gap-2">
                            <button
                              type="button"
                              aria-label={`Edit ${entry.title}`}
                              onClick={() => startEdit(entry)}
                              className={`${textActionClass} pr-3`}
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              aria-label={`Delete ${entry.title}`}
                              onClick={() => setConfirmingId(entry.id)}
                              className={`${textActionClass} px-3 text-ink-muted decoration-ink-muted/40 hover:text-danger`}
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
      )}

      {form ? (
        <Sheet labelledBy="mb-form-title" onClose={closeForm}>
          <h2 id="mb-form-title" className="font-serif-display text-[1.5rem] font-medium leading-tight text-ink">
            {form.id ? 'Edit' : 'Add'} {formMeta?.singular}
          </h2>

          <div>
            <label htmlFor="mb-title" className={labelClass}>
              {formMeta?.titleLabel}
            </label>
            <input
              id="mb-title"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className={fieldClass}
            />
          </div>

          {form.category === 'person' ? (
            <>
              <div>
                <label htmlFor="mb-relationship" className={labelClass}>
                  Relationship
                </label>
                <input
                  id="mb-relationship"
                  value={form.relationship}
                  onChange={(e) => setForm({ ...form, relationship: e.target.value })}
                  className={fieldClass}
                />
              </div>

              <div>
                <label htmlFor="mb-photo" className={labelClass}>
                  Photo
                </label>
                {form.photoUrl ? (
                  <div className="mb-3 flex items-center gap-4">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={form.photoUrl}
                      alt={form.title ? `Photo of ${form.title}` : 'Selected photo preview'}
                      className="h-20 w-20 rounded-full border border-line200 object-cover"
                    />
                    <button type="button" onClick={removePhoto} className={textActionClass}>
                      Remove photo
                    </button>
                  </div>
                ) : (
                  <p className="mb-3 text-patient-sm text-ink-muted">
                    Optional, but a photo helps your loved one recognise a face.
                  </p>
                )}
                <input
                  key={photoInputKey}
                  id="mb-photo"
                  type="file"
                  accept="image/*"
                  onChange={(e) => onPhotoChange(e.target.files?.[0])}
                  className="w-full text-caregiver-body text-ink file:mr-4 file:min-h-12 file:rounded-control file:border-2 file:border-ink-muted file:bg-surface-card file:px-4 file:font-bold file:text-ink"
                />
                {photoError ? (
                  <p role="alert" className="mt-2 text-patient-sm font-bold text-danger">
                    {photoError}
                  </p>
                ) : null}
              </div>
            </>
          ) : null}

          <div>
            <label htmlFor="mb-detail" className={labelClass}>
              Detail
            </label>
            <textarea
              id="mb-detail"
              value={form.detail}
              onChange={(e) => setForm({ ...form, detail: e.target.value })}
              rows={3}
              className={fieldClass}
            />
          </div>

          {duplicateWarning ? (
            <p
              role="status"
              aria-live="polite"
              className="flex items-start gap-3 rounded-tile border border-warning/50 bg-warning/5 px-4 py-3 text-patient-sm text-ink"
            >
              <span aria-hidden="true" className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-warning" />
              {duplicateWarning}
            </p>
          ) : null}

          <SheetActions>
            <BigButton label="Cancel" variant="secondary" onClick={() => setForm(null)} />
            <BigButton
              label="Save"
              variant="primary"
              disabled={!form.title.trim() || !form.detail.trim()}
              onClick={() => void save()}
            />
          </SheetActions>
        </Sheet>
      ) : null}

      {quickAddOpen ? (
        <Sheet labelledBy="quick-add-title" onClose={closeQuickAdd}>
          <h2 id="quick-add-title" className="font-serif-display text-[1.5rem] font-medium leading-tight text-ink">
            Quick add
          </h2>
          <div>
            <label htmlFor="quick-add-text" className={labelClass}>
              Tell us about your family. Write naturally
            </label>
            <p className="mb-3 text-patient-sm text-ink-muted">
              You will be able to check and edit each entry before anything is saved.
            </p>
            <textarea
              id="quick-add-text"
              value={quickText}
              onChange={(e) => setQuickText(e.target.value)}
              rows={5}
              className={fieldClass}
            />
          </div>
          <SheetActions>
            <BigButton label="Cancel" variant="secondary" onClick={() => setQuickAddOpen(false)} />
            <BigButton
              label={extracting ? 'Extracting…' : 'Extract'}
              variant="primary"
              disabled={extracting || !quickText.trim()}
              onClick={() => void extractText()}
            />
          </SheetActions>
        </Sheet>
      ) : null}

      {reviewEntries ? (
        <Sheet labelledBy="review-title" wide onClose={closeReview}>
          <h2 id="review-title" className="font-serif-display text-[1.5rem] font-medium leading-tight text-ink">
            Review extracted entries
          </h2>
          {reviewEntries.length === 0 ? (
            <p className="text-caregiver-body text-ink-muted">Nothing was extracted from that text.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {reviewEntries.map((entry, i) => (
                <li key={`${entry.title}-${i}`} className="flex flex-col gap-2 rounded-tile border border-line200 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-patient-sm font-bold text-ink-muted">
                      {CATEGORY_META[entry.category].singular}
                    </span>
                    <button
                      type="button"
                      aria-label={`Remove ${entry.title}`}
                      onClick={() => removeReviewEntry(entry.title)}
                      className={`${textActionClass} text-ink-muted decoration-ink-muted/40`}
                    >
                      Remove
                    </button>
                  </div>
                  <input
                    aria-label="Entry title"
                    value={entry.title}
                    onChange={(e) => updateReviewEntry(i, { title: e.target.value })}
                    className={`${fieldClass} font-bold`}
                  />
                  <textarea
                    aria-label="Entry text"
                    value={entry.detail}
                    onChange={(e) => updateReviewEntry(i, { detail: e.target.value })}
                    rows={2}
                    className={fieldClass}
                  />
                </li>
              ))}
            </ul>
          )}
          <SheetActions>
            <BigButton label="Cancel" variant="secondary" onClick={() => setReviewEntries(null)} />
            <BigButton label="Confirm and save" variant="primary" onClick={() => void confirmReview()} />
          </SheetActions>
        </Sheet>
      ) : null}

      {confirmingId ? (
        <Sheet labelledBy="delete-entry-title" role="alertdialog" onClose={closeConfirm}>
          <h2 id="delete-entry-title" className="font-serif-display text-[1.5rem] font-medium leading-tight text-ink">
            Remove this entry?
          </h2>
          <p className="text-caregiver-body text-ink-muted">
            The companion will stop using it in answers.
          </p>
          <SheetActions>
            <BigButton label="Cancel" variant="secondary" onClick={() => setConfirmingId(null)} />
            <BigButton label="Remove" variant="primary" onClick={() => void confirmDelete()} />
          </SheetActions>
        </Sheet>
      ) : null}
    </main>
  );
}

/** Modal surface: a bottom sheet on phones (thumb-reachable actions), a
 * centred dialog from `sm` up. */
function Sheet({
  labelledBy,
  children,
  onClose,
  wide = false,
  role = 'dialog',
}: {
  labelledBy: string;
  children: React.ReactNode;
  /** Escape and a tap on the dimmed backdrop both call this. */
  onClose: () => void;
  wide?: boolean;
  role?: 'dialog' | 'alertdialog';
}) {
  useEscapeKey(true, onClose);
  return (
    <div
      role={role}
      aria-modal="true"
      aria-labelledby={labelledBy}
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/50 sm:items-center sm:p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`scrollbar-none flex max-h-[92dvh] w-full flex-col gap-5 overflow-y-auto overscroll-contain rounded-t-card bg-surface-card p-6 shadow-xl sm:rounded-card ${
          wide ? 'sm:max-w-xl' : 'sm:max-w-md'
        }`}
      >
        {children}
      </div>
    </div>
  );
}

function SheetActions({ children }: { children: React.ReactNode }) {
  return <div className="mt-1 flex flex-col-reverse gap-3 sm:flex-row">{children}</div>;
}
