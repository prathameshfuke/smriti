'use client';

import { useEffect, useState } from 'react';
import { v4 as uuid } from 'uuid';
import { Pencil, Trash2, Plus } from 'lucide-react';
import BigButton from '@/components/ui/BigButton';
import { authedFetch } from '@/lib/api/client';
import { usePatientStore } from '@/stores/patientStore';
import { useMemoryBankStore } from '@/stores/memoryBankStore';
import type { LocalMemoryBankEntry } from '@/lib/db/schema';
import type { MemoryBankCategory } from '@/lib/supabase/types';
import type { ParsedMemoryBankEntry } from '@/lib/ai/onboarding-parser';

const SECTIONS: { category: MemoryBankCategory; heading: string; titleLabel: string }[] = [
  { category: 'person', heading: 'People', titleLabel: 'Name' },
  { category: 'schedule', heading: 'Schedule', titleLabel: 'Title' },
  { category: 'life_fact', heading: 'Life Facts', titleLabel: 'Title' },
  { category: 'medication', heading: 'Medication', titleLabel: 'Title' },
];

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

export default function MemoryBankPage() {
  const currentPatient = usePatientStore((s) => s.currentPatient);
  const entries = useMemoryBankStore((s) => s.entries);
  const loadEntries = useMemoryBankStore((s) => s.loadEntries);
  const addEntry = useMemoryBankStore((s) => s.addEntry);
  const updateEntry = useMemoryBankStore((s) => s.updateEntry);
  const deleteEntry = useMemoryBankStore((s) => s.deleteEntry);

  const [form, setForm] = useState<FormState | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [quickText, setQuickText] = useState('');
  const [extracting, setExtracting] = useState(false);
  const [extractError, setExtractError] = useState(false);
  const [reviewEntries, setReviewEntries] = useState<ParsedMemoryBankEntry[] | null>(null);

  useEffect(() => {
    if (currentPatient) void loadEntries(currentPatient.id);
  }, [currentPatient, loadEntries]);

  const startAdd = (category: MemoryBankCategory) => setForm(emptyForm(category));

  const startEdit = (entry: LocalMemoryBankEntry) =>
    setForm({
      id: entry.id,
      category: entry.category,
      title: entry.title,
      relationship: entry.relationship ?? '',
      detail: entry.detail,
      photoUrl: entry.photoUrl,
    });

  const onPhotoChange = (file: File | undefined) => {
    if (!file || !form) return;
    const reader = new FileReader();
    reader.onload = () => setForm({ ...form, photoUrl: String(reader.result) });
    reader.readAsDataURL(file);
  };

  const save = async () => {
    if (!form || !currentPatient) return;

    if (form.id) {
      await updateEntry(form.id, {
        title: form.title,
        relationship: form.category === 'person' ? form.relationship || null : null,
        detail: form.detail,
        photoUrl: form.photoUrl,
      });
    } else {
      await addEntry({
        id: uuid(),
        patientId: currentPatient.id,
        category: form.category,
        title: form.title,
        detail: form.detail,
        photoUrl: form.photoUrl,
        relationship: form.category === 'person' ? form.relationship || null : null,
        active: true,
        createdBy: currentPatient.caregiverId,
        updatedAt: new Date().toISOString(),
      });
    }
    setForm(null);
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
    setReviewEntries(null);
  };

  const confirmDelete = async () => {
    if (!confirmingId) return;
    await deleteEntry(confirmingId);
    setConfirmingId(null);
  };

  const hasAnyEntries = entries.length > 0;

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

      {!hasAnyEntries ? (
        <div className="flex flex-col items-center gap-4 rounded-card border border-gray-300 bg-white py-12 text-center shadow-sm">
          <p className="text-caregiver-body text-ink-muted">
            Add the people and facts your loved one might ask about.
          </p>
          <BigButton
            label="Add Person"
            variant="primary"
            icon={<Plus size={20} aria-hidden="true" />}
            onClick={() => startAdd('person')}
          />
        </div>
      ) : (
        <div className="flex flex-col gap-10">
          {SECTIONS.map(({ category, heading }) => {
            const sectionEntries = entries.filter((e) => e.category === category);
            return (
              <section key={category} data-testid={`memory-bank-section-${category}`}>
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="font-serif-display text-lg font-semibold text-navy">{heading}</h2>
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
                          <div>
                            <p className="font-bold text-navy">{entry.title}</p>
                            {entry.relationship ? (
                              <p className="text-patient-sm text-gray-600">{entry.relationship}</p>
                            ) : null}
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
            <h3 className="font-serif-display text-lg font-semibold text-navy">
              {form.id ? 'Edit entry' : 'Add entry'}
            </h3>

            <label htmlFor="mb-title" className="text-sm font-semibold text-navy">
              {SECTIONS.find((s) => s.category === form.category)?.titleLabel ?? 'Title'}
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
                <input
                  id="mb-photo"
                  type="file"
                  accept="image/*"
                  onChange={(e) => onPhotoChange(e.target.files?.[0])}
                  className="text-caregiver-body text-ink"
                />
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
