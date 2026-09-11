'use client';

import { useEffect, useState } from 'react';
import { v4 as uuid } from 'uuid';
import {
  Pencil,
  Trash2,
  Plus,
  User,
  CalendarClock,
  BookOpen,
  Pill,
  AlertTriangle,
  Check,
  X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import BigButton from '@/components/ui/BigButton';
import { authedFetch } from '@/lib/api/client';
import { usePatientStore } from '@/stores/patientStore';
import { useMemoryBankStore } from '@/stores/memoryBankStore';
import type { LocalMemoryBankEntry } from '@/lib/db/schema';
import type { MemoryBankCategory } from '@/lib/supabase/types';
import type { ParsedMemoryBankEntry } from '@/lib/ai/onboarding-parser';

/**
 * One visual identity per category — an icon plus an accent colour, used
 * consistently in the section headings, the add/edit dialog, and the
 * per-entry cards. Previously the add/edit dialog just said "Add entry" no
 * matter which of the four "+ Add" links opened it, so a caregiver filling
 * in several entries back-to-back had no in-dialog confirmation of which
 * bucket they were in. Colour is never the only signal — every badge is
 * always paired with the category name in text — matching the caregiver
 * dashboard rule in docs/07_AGENT_PROMPTS.md: "don't rely on colour alone
 * for status."
 */
const CATEGORY_META: Record<
  MemoryBankCategory,
  { heading: string; singular: string; titleLabel: string; Icon: LucideIcon; badgeClass: string }
> = {
  person: {
    heading: 'People',
    singular: 'Person',
    titleLabel: 'Name',
    Icon: User,
    badgeClass: 'bg-primary/10 text-primary',
  },
  schedule: {
    heading: 'Schedule',
    singular: 'Schedule',
    titleLabel: 'Title',
    Icon: CalendarClock,
    badgeClass: 'bg-muga/15 text-muga-dark',
  },
  life_fact: {
    heading: 'Life Facts',
    singular: 'Life Fact',
    titleLabel: 'Title',
    Icon: BookOpen,
    badgeClass: 'bg-navy/10 text-navy',
  },
  medication: {
    heading: 'Medication',
    singular: 'Medication',
    titleLabel: 'Title',
    Icon: Pill,
    badgeClass: 'bg-warning/15 text-warning',
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
      setBanner(`Saved — "${title}" updated.`);
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
      setBanner(`Saved — "${title}" added to ${CATEGORY_META[category].heading}.`);
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
    if (count > 0) setBanner(`Saved — ${count} ${count === 1 ? 'entry' : 'entries'} added.`);
  };

  const confirmDelete = async () => {
    if (!confirmingId) return;
    const target = entries.find((e) => e.id === confirmingId);
    await deleteEntry(confirmingId);
    if (target) setBanner(`Removed — "${target.title}" deleted.`);
    setConfirmingId(null);
  };

  const hasAnyEntries = entries.length > 0;
  const duplicateWarning = form ? findDuplicateWarning(form, entries) : null;
  const formMeta = form ? CATEGORY_META[form.category] : null;

  return (
    <main className="mx-auto max-w-dashboard px-4 py-6 md:px-8 md:py-10">
      <header className="mb-8 border-b-2 border-muga/30 pb-5">
        <p className="text-sm font-semibold uppercase tracking-wide text-muga-dark">Caregiver</p>
        <h1 className="font-serif-display text-caregiver-heading font-semibold text-navy">
          Memory Bank
        </h1>
        <p className="mt-2 text-caregiver-body text-gray-600">
          Facts your loved one can ask the AI companion about — it only answers from what you add here.
        </p>
        <button
          type="button"
          aria-label="Quick add"
          onClick={() => setQuickAddOpen(true)}
          className="mt-3 text-sm font-semibold text-teal hover:text-primary-dark"
        >
          Quick add
        </button>
        {extractError ? (
          <p className="mt-2 text-patient-sm text-danger">Could not extract entries. Try again.</p>
        ) : null}
      </header>

      {banner ? (
        <div
          role="status"
          aria-live="polite"
          className="mb-6 flex items-center justify-between gap-3 rounded-card border border-success/40 bg-success/10 px-4 py-3 text-caregiver-body text-ink"
        >
          <span className="flex items-center gap-2">
            <Check size={20} className="shrink-0 text-success" aria-hidden="true" />
            {banner}
          </span>
          <button
            type="button"
            aria-label="Dismiss confirmation"
            onClick={() => setBanner(null)}
            style={{ minHeight: 44, minWidth: 44 }}
            className="flex shrink-0 items-center justify-center rounded-full text-gray-600 hover:bg-gray-100"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>
      ) : null}

      {!hasAnyEntries ? (
        <div className="flex flex-col items-center gap-6 rounded-card border border-gray-300 bg-white py-12 text-center shadow-sm">
          <p className="text-caregiver-body text-ink-muted">
            Add the people and facts your loved one might ask about.
          </p>
          {/* Four explicit, icon-coded choices instead of a single "Add Person" default —
           * a caregiver whose first memory is a medication or a weekly visit schedule
           * shouldn't have to add an unrelated person first just to unlock that option. */}
          <div role="group" aria-label="Choose what to add" className="grid w-full max-w-md grid-cols-1 gap-3 px-6 sm:grid-cols-2">
            {SECTIONS.map((category) => {
              const meta = CATEGORY_META[category];
              return (
                <button
                  key={category}
                  type="button"
                  onClick={() => startAdd(category)}
                  style={{ minHeight: 44 }}
                  className="flex items-center gap-3 rounded-card border border-gray-300 bg-white p-4 text-left shadow-sm hover:border-primary hover:bg-primary/5"
                >
                  <span
                    aria-hidden="true"
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${meta.badgeClass}`}
                  >
                    <meta.Icon size={20} />
                  </span>
                  <span className="font-semibold text-navy">Add {meta.singular}</span>
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-10">
          {SECTIONS.map((category) => {
            const meta = CATEGORY_META[category];
            const sectionEntries = entries.filter((e) => e.category === category);
            return (
              <section key={category} data-testid={`memory-bank-section-${category}`}>
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="flex items-center gap-2 font-serif-display text-lg font-semibold text-navy">
                    <span
                      aria-hidden="true"
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${meta.badgeClass}`}
                    >
                      <meta.Icon size={16} />
                    </span>
                    {meta.heading}
                  </h2>
                  <button
                    type="button"
                    onClick={() => startAdd(category)}
                    className="flex items-center gap-1 text-sm font-semibold text-teal hover:text-primary-dark"
                  >
                    <Plus size={16} aria-hidden="true" />
                    Add
                  </button>
                </div>

                {sectionEntries.length === 0 ? (
                  <p className="text-patient-sm text-gray-600">No entries yet.</p>
                ) : (
                  <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {sectionEntries.map((entry) => (
                      <li
                        key={entry.id}
                        className="flex flex-col gap-2 rounded-card border border-gray-300 bg-white p-4 shadow-sm"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-start gap-3">
                            {entry.category === 'person' ? (
                              entry.photoUrl ? (
                                <img
                                  src={entry.photoUrl}
                                  alt=""
                                  className="h-12 w-12 shrink-0 rounded-full border border-gray-300 object-cover"
                                />
                              ) : (
                                <span
                                  aria-hidden="true"
                                  className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${meta.badgeClass}`}
                                >
                                  <User size={20} />
                                </span>
                              )
                            ) : null}
                            <div>
                              <p className="font-bold text-navy">{entry.title}</p>
                              {entry.relationship ? (
                                <p className="text-patient-sm text-gray-600">{entry.relationship}</p>
                              ) : null}
                            </div>
                          </div>
                          <div className="flex shrink-0 gap-1">
                            <button
                              type="button"
                              aria-label={`Edit ${entry.title}`}
                              onClick={() => startEdit(entry)}
                              style={{ minHeight: 44, minWidth: 44 }}
                              className="flex items-center justify-center rounded-full text-gray-600 hover:bg-gray-100 hover:text-teal"
                            >
                              <Pencil size={18} aria-hidden="true" />
                            </button>
                            <button
                              type="button"
                              aria-label={`Delete ${entry.title}`}
                              onClick={() => setConfirmingId(entry.id)}
                              style={{ minHeight: 44, minWidth: 44 }}
                              className="flex items-center justify-center rounded-full text-gray-600 hover:bg-gray-100 hover:text-danger"
                            >
                              <Trash2 size={18} aria-hidden="true" />
                            </button>
                          </div>
                        </div>
                        <p className="text-caregiver-body text-gray-700">{entry.detail}</p>
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
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
        >
          <div className="flex w-full max-w-md flex-col gap-4 rounded-card bg-white p-6 shadow-lg">
            <h3 className="flex items-center gap-2 font-serif-display text-lg font-semibold text-navy">
              {formMeta ? (
                <span
                  aria-hidden="true"
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${formMeta.badgeClass}`}
                >
                  <formMeta.Icon size={18} />
                </span>
              ) : null}
              {form.id ? 'Edit' : 'Add'} {formMeta?.singular}
            </h3>

            <label htmlFor="mb-title" className="text-sm font-semibold text-navy">
              {formMeta?.titleLabel}
            </label>
            <input
              id="mb-title"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="h-14 rounded-card border border-gray-300 px-4 text-caregiver-body text-ink"
            />

            {form.category === 'person' ? (
              <>
                <label htmlFor="mb-relationship" className="text-sm font-semibold text-navy">
                  Relationship
                </label>
                <input
                  id="mb-relationship"
                  value={form.relationship}
                  onChange={(e) => setForm({ ...form, relationship: e.target.value })}
                  className="h-14 rounded-card border border-gray-300 px-4 text-caregiver-body text-ink"
                />

                <label htmlFor="mb-photo" className="text-sm font-semibold text-navy">
                  Photo
                </label>
                {form.photoUrl ? (
                  <div className="flex items-center gap-3">
                    <img
                      src={form.photoUrl}
                      alt={form.title ? `Photo of ${form.title}` : 'Selected photo preview'}
                      className="h-20 w-20 rounded-full border border-gray-300 object-cover"
                    />
                    <button
                      type="button"
                      onClick={removePhoto}
                      className="text-sm font-semibold text-danger hover:underline"
                    >
                      Remove photo
                    </button>
                  </div>
                ) : (
                  <p className="text-patient-sm text-gray-600">No photo selected yet — optional, but it helps your loved one recognise a face.</p>
                )}
                <input
                  key={photoInputKey}
                  id="mb-photo"
                  type="file"
                  accept="image/*"
                  onChange={(e) => onPhotoChange(e.target.files?.[0])}
                  className="text-caregiver-body text-ink"
                />
                {photoError ? (
                  <p role="alert" className="text-patient-sm text-danger">
                    {photoError}
                  </p>
                ) : null}
              </>
            ) : null}

            <label htmlFor="mb-detail" className="text-sm font-semibold text-navy">
              Detail
            </label>
            <textarea
              id="mb-detail"
              value={form.detail}
              onChange={(e) => setForm({ ...form, detail: e.target.value })}
              rows={3}
              className="rounded-card border border-gray-300 px-4 py-3 text-caregiver-body text-ink"
            />

            {duplicateWarning ? (
              <p
                role="status"
                aria-live="polite"
                className="flex items-start gap-2 rounded-card border border-warning/40 bg-warning/10 px-3 py-2 text-patient-sm text-ink"
              >
                <AlertTriangle size={18} className="mt-0.5 shrink-0 text-warning" aria-hidden="true" />
                {duplicateWarning}
              </p>
            ) : null}

            <div className="mt-2 flex gap-3">
              <BigButton label="Cancel" variant="secondary" onClick={() => setForm(null)} />
              <BigButton
                label="Save"
                variant="primary"
                disabled={!form.title.trim() || !form.detail.trim()}
                onClick={() => void save()}
              />
            </div>
          </div>
        </div>
      ) : null}

      {quickAddOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
        >
          <div className="flex w-full max-w-md flex-col gap-4 rounded-card bg-white p-6 shadow-lg">
            <h3 className="font-serif-display text-lg font-semibold text-navy">Quick add</h3>
            <label htmlFor="quick-add-text" className="text-sm font-semibold text-navy">
              Tell us about your family — just write naturally
            </label>
            <textarea
              id="quick-add-text"
              value={quickText}
              onChange={(e) => setQuickText(e.target.value)}
              rows={5}
              className="rounded-card border border-gray-300 px-4 py-3 text-caregiver-body text-ink"
            />
            <div className="flex gap-3">
              <BigButton label="Cancel" variant="secondary" onClick={() => setQuickAddOpen(false)} />
              <BigButton
                label={extracting ? 'Extracting…' : 'Extract'}
                variant="primary"
                disabled={extracting || !quickText.trim()}
                onClick={() => void extractText()}
              />
            </div>
          </div>
        </div>
      ) : null}

      {reviewEntries ? (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
        >
          <div className="flex max-h-[90vh] w-full max-w-lg flex-col gap-4 overflow-y-auto rounded-card bg-white p-6 shadow-lg">
            <h3 className="font-serif-display text-lg font-semibold text-navy">Review extracted entries</h3>
            {reviewEntries.length === 0 ? (
              <p className="text-caregiver-body text-ink-muted">Nothing was extracted from that text.</p>
            ) : (
              reviewEntries.map((entry, i) => (
                <div key={`${entry.title}-${i}`} className="flex flex-col gap-2 rounded-card border border-gray-300 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <input
                      value={entry.title}
                      onChange={(e) => updateReviewEntry(i, { title: e.target.value })}
                      className="h-10 flex-1 rounded-card border border-gray-300 px-3 font-bold text-navy"
                    />
                    <button
                      type="button"
                      aria-label={`Remove ${entry.title}`}
                      onClick={() => removeReviewEntry(entry.title)}
                      style={{ minHeight: 44, minWidth: 44 }}
                      className="flex items-center justify-center rounded-full text-gray-600 hover:bg-gray-100 hover:text-danger"
                    >
                      <Trash2 size={18} aria-hidden="true" />
                    </button>
                  </div>
                  <textarea
                    value={entry.detail}
                    onChange={(e) => updateReviewEntry(i, { detail: e.target.value })}
                    rows={2}
                    className="rounded-card border border-gray-300 px-3 py-2 text-caregiver-body text-ink"
                  />
                </div>
              ))
            )}
            <div className="flex gap-3">
              <BigButton label="Cancel" variant="secondary" onClick={() => setReviewEntries(null)} />
              <BigButton label="Confirm & Save" variant="primary" onClick={() => void confirmReview()} />
            </div>
          </div>
        </div>
      ) : null}

      {confirmingId ? (
        <div
          role="alertdialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
        >
          <div className="mx-4 flex flex-col gap-4 rounded-card bg-white p-6 shadow-lg">
            <p className="text-caregiver-body text-ink">Remove this entry?</p>
            <div className="flex gap-3">
              <BigButton label="Cancel" variant="secondary" onClick={() => setConfirmingId(null)} />
              <BigButton label="Remove" variant="primary" onClick={() => void confirmDelete()} />
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
