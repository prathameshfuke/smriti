import { v4 as uuid } from 'uuid';
import { authenticateRequest } from '@/lib/supabase/server-auth';
import { createServiceRoleClient } from '@/lib/supabase/client';
import { callLLM } from '@/lib/ai/llm-client';
import { MIN_ENTRIES, validateQuizQuestions } from '@/lib/ai/reminiscence-quiz';

interface GenerateRequestBody {
  patientId?: string;
}

/**
 * Caregiver-triggered only ("Refresh Quiz" on the patient detail page) —
 * unlike /api/ai/complete, there is no patient-device path here, so a
 * single authenticateRequest + ownership check is enough.
 */
export async function POST(request: Request) {
  const auth = await authenticateRequest(request);
  if (!auth) return Response.json({ error: 'unauthorized' }, { status: 401 });

  let body: GenerateRequestBody;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'invalid_json' }, { status: 400 });
  }
  if (!body?.patientId) return Response.json({ error: 'missing_patient_id' }, { status: 400 });

  const { data: caregiver } = await auth.supabase
    .from('caregivers')
    .select('id')
    .eq('auth_id', auth.userId)
    .single();
  if (!caregiver) return Response.json({ error: 'caregiver_not_found' }, { status: 404 });

  const { data: owned } = await auth.supabase
    .from('patients')
    .select('id')
    .eq('id', body.patientId)
    .eq('caregiver_id', caregiver.id)
    .single();
  if (!owned) return Response.json({ error: 'patient_not_found' }, { status: 404 });

  const service = createServiceRoleClient();

  const { data: entries } = await service
    .from('memory_bank_entries')
    .select('title, detail, relationship, category')
    .eq('patient_id', body.patientId)
    .eq('active', true)
    .in('category', ['person', 'life_fact']);

  const facts = entries ?? [];
  if (facts.length < MIN_ENTRIES) {
    return Response.json(
      { error: 'not_enough_facts', needed: MIN_ENTRIES, have: facts.length },
      { status: 400 },
    );
  }

  const factLines = facts
    .map((f) => (f.relationship ? `${f.title} (${f.relationship}): ${f.detail}` : `${f.title}: ${f.detail}`))
    .join('\n');

  const systemPrompt =
    'Generate 5 multiple-choice questions testing recognition of these people and facts. ' +
    'Each question must be answerable ONLY from the facts given. Keep questions short, warm, ' +
    'never trick questions, and always give exactly 3 answer options with exactly one correct. ' +
    'For every question also include "entryTitle": the exact title, copied verbatim from the ' +
    'list below, of the fact the question is about. Output strict JSON only — no prose, no ' +
    'markdown code fences — in this exact shape: ' +
    '[{"question": "...", "options": ["...", "...", "..."], "correctIndex": 0, "entryTitle": "..."}]' +
    `\n\nFacts:\n${factLines}`;

  const result = await callLLM({ systemPrompt, userPrompt: 'Generate the quiz now.', maxTokens: 900 });
  const questions = validateQuizQuestions(
    result.text,
    facts.map((f) => f.title),
  );

  if (!questions) {
    console.error('reminiscence quiz generation produced invalid output:', result.text);
    return Response.json({ error: 'invalid_quiz_generated' }, { status: 502 });
  }

  const generatedAt = new Date().toISOString();
  await service
    .from('reminiscence_quizzes')
    .upsert({ id: uuid(), patient_id: body.patientId, questions, generated_at: generatedAt }, { onConflict: 'patient_id' });

  return Response.json({ questions, generatedAt });
}
