import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import 'fake-indexeddb/auto';
import { db } from '@/lib/db/schema';
import { clearInferenceAuthCache } from '@/lib/ai/bhashini-auth';
import type { CompanionFact } from '@/lib/ai/companion-retrieval';

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.unstubAllGlobals();
});

function fact(id: string, overrides: Partial<CompanionFact> = {}): CompanionFact {
  return { id, kind: 'life_fact', title: id, detail: '', relationship: null, ...overrides };
}

// ---------------------------------------------------------------------------
// companion-cache.ts — non-English questions
// ---------------------------------------------------------------------------
describe('companion-cache with Indian-language questions', () => {
  beforeEach(async () => {
    await db.aiConversationLog.clear();
  });

  it('keeps letters and vowel signs of every script instead of stripping to ASCII', async () => {
    const { normalizeQuestion } = await import('@/lib/ai/companion-cache');
    expect(normalizeQuestion('मेरा बेटा कौन है?')).toBe('मेरा बेटा कौन है');
    expect(normalizeQuestion('মোৰ পুতেক কোন?')).toBe('মোৰ পুতেক কোন');
  });

  it('never answers one Hindi question with the cached answer of a different one', async () => {
    const { cacheAnswer, findCachedAnswer } = await import('@/lib/ai/companion-cache');
    await cacheAnswer({
      id: 'c1',
      patientId: 'p1',
      question: 'मेरा बेटा कौन है?',
      answer: 'आपका बेटा राजू है।',
      grounded: true,
      modelUsed: 'groq',
      createdAt: new Date().toISOString(),
      language: 'hi',
    });
    expect(await findCachedAnswer('p1', 'मेरी दवाई कब है?', 'hi')).toBeNull();
    expect((await findCachedAnswer('p1', 'मेरा बेटा कौन है', 'hi'))?.answer).toBe('आपका बेटा राजू है।');
  });

  it('only reuses an answer cached in the language being asked in', async () => {
    const { cacheAnswer, findCachedAnswer } = await import('@/lib/ai/companion-cache');
    await cacheAnswer({
      id: 'c2',
      patientId: 'p1',
      question: 'who is raju',
      answer: 'Raju is your son.',
      grounded: true,
      modelUsed: 'groq',
      createdAt: new Date().toISOString(),
      language: 'en',
    });
    expect(await findCachedAnswer('p1', 'who is raju', 'hi')).toBeNull();
    expect(await findCachedAnswer('p1', 'who is raju', 'en')).not.toBeNull();
  });

  it('never evicts, or serves as a cache hit, an offline answer still waiting to upload', async () => {
    const { cacheAnswer, findCachedAnswer } = await import('@/lib/ai/companion-cache');
    await cacheAnswer({
      id: 'pending',
      patientId: 'p1',
      question: 'question pending',
      answer: 'x',
      grounded: true,
      modelUsed: 'on-device',
      createdAt: new Date(2020, 0, 1).toISOString(),
      pendingSync: true,
    });
    for (let i = 0; i < 6; i++) {
      await cacheAnswer({
        id: `e${i}`,
        patientId: 'p1',
        question: `question ${i}`,
        answer: 'y',
        grounded: true,
        modelUsed: 'groq',
        createdAt: new Date(2026, 0, 1, 0, i).toISOString(),
      });
    }
    expect(await db.aiConversationLog.get('pending')).toBeDefined();
    expect(await findCachedAnswer('p1', 'question pending')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// companion-retrieval.ts
// ---------------------------------------------------------------------------
describe('companion retrieval', () => {
  const facts: CompanionFact[] = [
    fact('m:1', { kind: 'person', title: 'Raju', relationship: 'son', detail: 'Lives in Guwahati, visits on Sundays' }),
    fact('m:2', { kind: 'medication', title: 'Blood pressure pill', detail: 'One red pill after breakfast' }),
    fact('m:3', { kind: 'life_fact', title: 'Home', detail: 'You live in Jorhat with Meena' }),
    fact('r:1', { kind: 'reminder', title: 'Walk', detail: 'activity reminder at 17:00, every day' }),
  ];

  it('ranks the entry the question names first', async () => {
    const { rankFacts } = await import('@/lib/ai/companion-retrieval');
    expect(rankFacts(['who is Raju'], facts)[0].fact.id).toBe('m:1');
    expect(rankFacts(['when do I take my blood pressure pill'], facts)[0].fact.id).toBe('m:2');
  });

  it('matches a translated question and a question in Devanagari against the same entries', async () => {
    const { rankFacts } = await import('@/lib/ai/companion-retrieval');
    const hindiFacts = [...facts, fact('m:4', { kind: 'person', title: 'मीना', relationship: 'पत्नी', detail: 'आपकी पत्नी' })];
    expect(rankFacts(['मीना कौन है', 'who is Meena'], hindiFacts)[0].fact.id).toBe('m:4');
  });

  it('caps what is sent to the model and prefers the kind of fact asked about when no word matches', async () => {
    const { selectFactsForPrompt, MAX_FACTS_PER_QUESTION } = await import('@/lib/ai/companion-retrieval');
    const many = Array.from({ length: 30 }, (_, i) => fact(`m:${i}`, { title: `Entry ${i}`, detail: 'something' }));
    many.push(fact('m:med', { kind: 'medication', title: 'Thyroxine', detail: 'Before tea' }));
    const selected = selectFactsForPrompt(['what medicine do I take'], many);
    expect(selected).toHaveLength(MAX_FACTS_PER_QUESTION);
    expect(selected[0].id).toBe('m:med');
  });

  it('reads back an entry offline only for a clear, unambiguous match', async () => {
    const { bestLocalFact } = await import('@/lib/ai/companion-retrieval');
    expect(bestLocalFact('who is Raju', facts)?.id).toBe('m:1');
    expect(bestLocalFact('what is the weather', facts)).toBeNull();
    const twins = [fact('a', { title: 'Raju', detail: 'x' }), fact('b', { title: 'Raju', detail: 'y' })];
    expect(bestLocalFact('who is Raju', twins)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// companion-answer.ts
// ---------------------------------------------------------------------------
describe('parseCitedAnswer', () => {
  const facts = [fact('m:1'), fact('m:2')];

  it('strips the FACTS line and returns the facts cited', async () => {
    const { parseCitedAnswer } = await import('@/lib/ai/companion-answer');
    const parsed = parseCitedAnswer('Raju is your son. He visits on Sundays.\nFACTS: F1', facts);
    expect(parsed.answer).toBe('Raju is your son. He visits on Sundays.');
    expect(parsed.cited?.map((f) => f.id)).toEqual(['m:1']);
  });

  it('ignores citations of facts that were never given, and "none"', async () => {
    const { parseCitedAnswer } = await import('@/lib/ai/companion-answer');
    expect(parseCitedAnswer('Something.\nFACTS: F7', facts).cited).toEqual([]);
    expect(parseCitedAnswer('Something.\nFACTS: none', facts).cited).toEqual([]);
  });

  it('reports no citation block at all when the model ignored the format', async () => {
    const { parseCitedAnswer } = await import('@/lib/ai/companion-answer');
    expect(parseCitedAnswer('Raju is your son.', facts)).toEqual({ answer: 'Raju is your son.', cited: null });
  });
});

// ---------------------------------------------------------------------------
// companion-offline.ts
// ---------------------------------------------------------------------------
describe('answerOffline', () => {
  beforeEach(async () => {
    await db.aiConversationLog.clear();
    await db.memoryBankEntries.clear();
    await db.reminderSchedules.clear();
    await db.memoryBankEntries.put({
      id: 'e1',
      patientId: 'p1',
      category: 'person',
      title: 'Raju',
      detail: 'Your son, visits on Sundays',
      photoUrl: null,
      relationship: 'son',
      active: true,
      createdBy: 'c1',
      updatedAt: new Date().toISOString(),
      synced: true,
    });
  });

  it('reads back the matching Memory Bank entry and queues it for the caregiver log', async () => {
    const { answerOffline } = await import('@/lib/ai/companion-offline');
    const result = await answerOffline('p1', 'who is Raju');
    expect(result).toEqual({ kind: 'memoryBook', text: 'Raju (son): Your son, visits on Sundays' });
    const logs = await db.aiConversationLog.where('patientId').equals('p1').toArray();
    expect(logs).toEqual([expect.objectContaining({ pendingSync: true, modelUsed: 'on-device' })]);
  });

  it('shows the helpline for a distress phrase and queues it flagged, even offline', async () => {
    const { answerOffline } = await import('@/lib/ai/companion-offline');
    expect(await answerOffline('p1', 'मैं मरना चाहता हूँ')).toEqual({ kind: 'distress' });
    const logs = await db.aiConversationLog.where('patientId').equals('p1').toArray();
    expect(logs).toEqual([expect.objectContaining({ pendingSync: true, modelUsed: 'on-device-distress' })]);
  });

  it('says nothing rather than guess when no entry clearly matches', async () => {
    const { answerOffline } = await import('@/lib/ai/companion-offline');
    expect(await answerOffline('p1', 'what is the weather today')).toEqual({ kind: 'none' });
  });
});

// ---------------------------------------------------------------------------
// consent policy + wire
// ---------------------------------------------------------------------------
describe('consent policy', () => {
  const base = {
    patientId: 'p1',
    version: 1,
    careProfile: true,
    guardianAttested: true,
    aiCompanion: true,
    voiceProcessing: true,
    consentedBy: 'c1',
    consentedAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
  };

  it('needs both required agreements for anything, and the purpose switched on for AI and voice', async () => {
    const { isConsentValid } = await import('@/lib/consent/policy');
    expect(isConsentValid(null, 'care')).toBe(false);
    expect(isConsentValid(base, 'voice')).toBe(true);
    expect(isConsentValid({ ...base, guardianAttested: false }, 'care')).toBe(false);
    expect(isConsentValid({ ...base, aiCompanion: false }, 'ai')).toBe(false);
    expect(isConsentValid({ ...base, aiCompanion: false }, 'care')).toBe(true);
    expect(isConsentValid({ ...base, aiCompanion: false, voiceProcessing: true }, 'voice')).toBe(false);
    expect(isConsentValid({ ...base, version: 0 }, 'care')).toBe(false);
  });

  it('never records voice on without Ask Smriti, and keeps the first agreement date on later changes', async () => {
    const { buildConsentRecord } = await import('@/lib/consent/policy');
    const first = buildConsentRecord('p1', 'c1', { ...base, aiCompanion: false, voiceProcessing: true }, null, '2026-09-01T00:00:00.000Z');
    expect(first.voiceProcessing).toBe(false);
    const later = buildConsentRecord('p1', 'c1', { ...base }, first, '2026-09-05T00:00:00.000Z');
    expect(later.consentedAt).toBe('2026-09-01T00:00:00.000Z');
    expect(later.updatedAt).toBe('2026-09-05T00:00:00.000Z');
  });

  it('rejects incomplete consent from an untrusted body', async () => {
    const { parseConsentRecord } = await import('@/lib/consent/wire');
    expect(parseConsentRecord(base)).toEqual(base);
    expect(parseConsentRecord({ ...base, careProfile: 'yes' })).toBeNull();
    expect(parseConsentRecord({ ...base, consentedAt: 'not a date' })).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Bhashini: translation client + inference key cache
// ---------------------------------------------------------------------------
describe('Bhashini translation', () => {
  function configBody() {
    return {
      pipelineResponseConfig: [{ config: [{ serviceId: 'ai4bharat/indictrans-v2' }] }],
      pipelineInferenceAPIEndPoint: { inferenceApiKey: { name: 'Authorization', value: 'dyn-key' } },
    };
  }
  function translationBody(target: string) {
    return { pipelineResponse: [{ taskType: 'translation', output: [{ source: 'x', target }] }] };
  }

  beforeEach(() => {
    clearInferenceAuthCache();
    process.env.BHASHINI_USER_ID = 'u';
    process.env.BHASHINI_ULCA_API_KEY = 'k';
  });

  it('returns same-language text without any network call', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const { translateText } = await import('@/lib/ai/bhashini-nmt-client');
    expect((await translateText('hello', 'en', 'en')).text).toBe('hello');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sends source and target languages, and reuses the inference key for the next call', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => configBody() })
      .mockResolvedValueOnce({ ok: true, json: async () => translationBody('who is my son') })
      .mockResolvedValueOnce({ ok: true, json: async () => translationBody('where is my home') });
    vi.stubGlobal('fetch', fetchMock);
    const { translateText } = await import('@/lib/ai/bhashini-nmt-client');

    expect((await translateText('मेरा बेटा कौन है', 'hi', 'en')).text).toBe('who is my son');
    expect((await translateText('मेरा घर कहाँ है', 'hi', 'en')).text).toBe('where is my home');

    // One config call for both translations.
    expect(fetchMock).toHaveBeenCalledTimes(3);
    const configRequest = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(configRequest.pipelineTasks[0]).toEqual({
      taskType: 'translation',
      config: { language: { sourceLanguage: 'hi', targetLanguage: 'en' } },
    });
    const compute = JSON.parse(fetchMock.mock.calls[1][1].body);
    expect(compute.pipelineTasks[0].config.serviceId).toBe('ai4bharat/indictrans-v2');
    expect(compute.inputData.input[0].source).toBe('मेरा बेटा कौन है');
  });

  it('drops a cached key after a failed compute call so the next call fetches a fresh one', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => configBody() })
      .mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({}) })
      .mockResolvedValueOnce({ ok: true, json: async () => configBody() })
      .mockResolvedValueOnce({ ok: true, json: async () => translationBody('ok') });
    vi.stubGlobal('fetch', fetchMock);
    const { translateText } = await import('@/lib/ai/bhashini-nmt-client');

    await expect(translateText('नमस्ते', 'hi', 'en')).rejects.toThrow();
    expect((await translateText('नमस्ते', 'hi', 'en')).text).toBe('ok');
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });
});
