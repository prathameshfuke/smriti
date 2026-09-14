import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import 'fake-indexeddb/auto';
import { render, screen, fireEvent } from '@testing-library/react';

const push = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace: vi.fn() }),
  usePathname: () => '/caregiver/memory-bank',
}));

const getSession = vi.fn();
const getUser = vi.fn();
// The param's type is what keeps later .mockImplementation((table: string) => ...)
// calls in this file type-checking against the same shape.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const serviceFromMock = vi.fn((_table: string) => makeChain({ data: [], error: null }));
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const callerFromMock = vi.fn((_table: string) => makeChain({ data: [], error: null }));

function makeChain(result: { data: unknown; error: unknown }) {
  const chain: Record<string, unknown> = {};
  for (const method of ['select', 'eq', 'order', 'limit', 'insert', 'upsert']) {
    chain[method] = vi.fn(() => chain);
  }
  chain.single = vi.fn(() => Promise.resolve(result));
  chain.then = (resolve: (v: typeof result) => unknown) => resolve(result);
  return chain;
}

vi.mock('@/lib/supabase/client', () => ({
  isSupabaseConfigured: () => true,
  createBrowserClient: () => ({ auth: { getSession } }),
  createServerClient: () => ({ auth: { getUser }, from: callerFromMock }),
  createServiceRoleClient: () => ({ from: serviceFromMock }),
}));

vi.mock('@/lib/ai/llm-client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/ai/llm-client')>();
  return { ...actual, callLLM: vi.fn() };
});

beforeEach(async () => {
  getSession.mockReset();
  getUser.mockReset();
  serviceFromMock.mockReset();
  callerFromMock.mockReset();
  getSession.mockResolvedValue({ data: { session: { access_token: 'tok' } } });
  getUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null });
  serviceFromMock.mockImplementation(() => makeChain({ data: [], error: null }));
  callerFromMock.mockImplementation(() => makeChain({ data: [], error: null }));
  const { callLLM } = await import('@/lib/ai/llm-client');
  vi.mocked(callLLM).mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

const SAMPLE_TEXT =
  'My mother Kalpana has two sons, Arun who visits every Sunday and Bimal who lives in Delhi and calls on weekends.';

function validExtractionJson() {
  return JSON.stringify([
    { category: 'person', title: 'Arun', detail: 'Visits every Sunday', relationship: 'son' },
    { category: 'person', title: 'Bimal', detail: 'Lives in Delhi, calls on weekends', relationship: 'son' },
  ]);
}

// ---------------------------------------------------------------------------
// validateParsedEntries (pure)
// ---------------------------------------------------------------------------
describe('validateParsedEntries', () => {
  it('accepts a well-formed multi-entry response', async () => {
    const { validateParsedEntries } = await import('@/lib/ai/onboarding-parser');
    const result = validateParsedEntries(validExtractionJson());
    expect(result).toHaveLength(2);
    expect(result?.[0].title).toBe('Arun');
    expect(result?.[1].title).toBe('Bimal');
  });

  it('rejects a category outside person/life_fact/schedule', async () => {
    const { validateParsedEntries } = await import('@/lib/ai/onboarding-parser');
    const bad = JSON.parse(validExtractionJson());
    bad[0].category = 'medication';
    expect(validateParsedEntries(JSON.stringify(bad))).toBeNull();
  });

  it('rejects invalid JSON without throwing', async () => {
    const { validateParsedEntries } = await import('@/lib/ai/onboarding-parser');
    expect(validateParsedEntries('not json {{{')).toBeNull();
  });

  it('rejects an entry missing a title', async () => {
    const { validateParsedEntries } = await import('@/lib/ai/onboarding-parser');
    const bad = JSON.parse(validExtractionJson());
    delete bad[0].title;
    expect(validateParsedEntries(JSON.stringify(bad))).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// POST /api/ai/parse-onboarding-text
// ---------------------------------------------------------------------------
describe('POST /api/ai/parse-onboarding-text', () => {
  function makeRequest(body: Record<string, unknown>) {
    return new Request('http://localhost/api/ai/parse-onboarding-text', {
      method: 'POST',
      headers: { Authorization: 'Bearer tok', 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  it('extracts multiple people from one paragraph', async () => {
    const { callLLM } = await import('@/lib/ai/llm-client');
    vi.mocked(callLLM).mockResolvedValue({ text: validExtractionJson(), model: 'groq/llama-3.1-8b-instant', grounded: true });

    const { POST } = await import('@/app/api/ai/parse-onboarding-text/route');
    const res = await POST(makeRequest({ text: SAMPLE_TEXT }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.entries).toHaveLength(2);
  });

  it('returns an error, not a crash, on malformed LLM JSON, and never touches the database', async () => {
    const { callLLM } = await import('@/lib/ai/llm-client');
    vi.mocked(callLLM).mockResolvedValue({ text: 'not valid json', model: 'groq/llama-3.1-8b-instant', grounded: true });

    const { POST } = await import('@/app/api/ai/parse-onboarding-text/route');
    const res = await POST(makeRequest({ text: SAMPLE_TEXT }));
    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body.error).toBe('invalid_extraction');
    expect(serviceFromMock).not.toHaveBeenCalled();
  });

  it('returns 401 with no Authorization header', async () => {
    const { POST } = await import('@/app/api/ai/parse-onboarding-text/route');
    const res = await POST(
      new Request('http://localhost/api/ai/parse-onboarding-text', {
        method: 'POST',
        body: JSON.stringify({ text: SAMPLE_TEXT }),
      }),
    );
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// Memory Bank "Quick add" — review-before-write flow
// ---------------------------------------------------------------------------
describe('Memory Bank Quick add', () => {
  function mockFetchJson(body: unknown, ok = true) {
    return vi.fn().mockResolvedValue({ ok, status: ok ? 200 : 502, json: async () => body });
  }

  const testPatient = {
    id: 'p1',
    caregiverId: 'c1',
    displayName: 'Aai',
    ageYears: 72,
    gender: 'female' as const,
    educationYears: 4,
    primaryLanguage: 'en',
    sessionDurationMinutes: 10,
    isActive: true,
    currentDifficulty: {},
    updatedAt: new Date().toISOString(),
    syncedAt: null,
  };

  beforeEach(async () => {
    const { usePatientStore } = await import('@/stores/patientStore');
    const { useMemoryBankStore } = await import('@/stores/memoryBankStore');
    usePatientStore.setState({ currentPatient: testPatient });
    useMemoryBankStore.setState({ entries: [] });
  });

  afterEach(async () => {
    const { usePatientStore } = await import('@/stores/patientStore');
    usePatientStore.setState(usePatientStore.getInitialState(), true);
    vi.unstubAllGlobals();
  });

  it('opens a review row per extracted entry and never calls addEntry before confirmation', async () => {
    const { useMemoryBankStore } = await import('@/stores/memoryBankStore');
    const addEntry = vi.fn().mockResolvedValue(undefined);
    useMemoryBankStore.setState({ addEntry });
    vi.stubGlobal('fetch', mockFetchJson({ entries: JSON.parse(validExtractionJson()) }));

    const { default: MemoryBankPage } = await import('@/app/caregiver/memory-bank/page');
    render(<MemoryBankPage />);

    fireEvent.click(screen.getByRole('button', { name: /quick add/i }));
    fireEvent.change(screen.getByLabelText(/tell us about your family/i), { target: { value: SAMPLE_TEXT } });
    fireEvent.click(screen.getByRole('button', { name: /extract/i }));

    expect(await screen.findByDisplayValue('Arun')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Bimal')).toBeInTheDocument();
    expect(addEntry).not.toHaveBeenCalled();
  });

  it('never passes a removed row to addEntry, and calls addEntry once per remaining row on confirm', async () => {
    const { useMemoryBankStore } = await import('@/stores/memoryBankStore');
    const addEntry = vi.fn().mockResolvedValue(undefined);
    useMemoryBankStore.setState({ addEntry });
    vi.stubGlobal('fetch', mockFetchJson({ entries: JSON.parse(validExtractionJson()) }));

    const { default: MemoryBankPage } = await import('@/app/caregiver/memory-bank/page');
    render(<MemoryBankPage />);

    fireEvent.click(screen.getByRole('button', { name: /quick add/i }));
    fireEvent.change(screen.getByLabelText(/tell us about your family/i), { target: { value: SAMPLE_TEXT } });
    fireEvent.click(screen.getByRole('button', { name: /extract/i }));
    await screen.findByDisplayValue('Arun');

    fireEvent.click(screen.getByRole('button', { name: /remove bimal/i }));
    fireEvent.click(screen.getByRole('button', { name: /confirm/i }));

    expect(addEntry).toHaveBeenCalledTimes(1);
    expect(addEntry).toHaveBeenCalledWith(expect.objectContaining({ title: 'Arun' }));
  });

  it('shows an error state on a failed extraction and never calls addEntry', async () => {
    const { useMemoryBankStore } = await import('@/stores/memoryBankStore');
    const addEntry = vi.fn();
    useMemoryBankStore.setState({ addEntry });
    vi.stubGlobal('fetch', mockFetchJson({ error: 'invalid_extraction' }, false));

    const { default: MemoryBankPage } = await import('@/app/caregiver/memory-bank/page');
    render(<MemoryBankPage />);

    fireEvent.click(screen.getByRole('button', { name: /quick add/i }));
    fireEvent.change(screen.getByLabelText(/tell us about your family/i), { target: { value: SAMPLE_TEXT } });
    fireEvent.click(screen.getByRole('button', { name: /extract/i }));

    expect(await screen.findByText(/could not/i)).toBeInTheDocument();
    expect(addEntry).not.toHaveBeenCalled();
  });
});
