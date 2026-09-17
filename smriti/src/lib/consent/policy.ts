/**
 * The consent SMRITI asks a caregiver for before any patient data is
 * collected, and the rules every guardrail (onboarding, the caregiver area,
 * Ask Smriti on the phone, and the AI API routes) checks it against.
 *
 * Pure module — no Dexie, no Supabase — so the client, the server and tests
 * all read the same definition.
 *
 * Bump CONSENT_VERSION whenever what is collected, who it is shared with, or
 * how it is protected changes materially. Every record below the new version
 * stops counting as valid, so each caregiver is taken back through the form
 * the next time they open the caregiver area.
 */

/** 2: Ask Smriti became a conversation — recent turns are now sent with
 * each message, Groq's larger model writes replies directly in the patient's
 * language, and a second check reviews each reply. */
export const CONSENT_VERSION = 2;

/** What a particular feature needs consent for. */
export type ConsentPurpose = 'care' | 'ai' | 'voice';

export interface ConsentRecord {
  patientId: string;
  version: number;
  /** Required: storing and using the care profile, game results and reminders. */
  careProfile: boolean;
  /** Required: the caregiver confirms they may agree on the patient's behalf. */
  guardianAttested: boolean;
  /** Optional: Ask Smriti — questions and relevant Memory Bank facts go to AI services. */
  aiCompanion: boolean;
  /** Optional: spoken questions are sent for speech recognition. Needs aiCompanion. */
  voiceProcessing: boolean;
  /** Local caregiver id who gave (or last changed) this consent. */
  consentedBy: string;
  consentedAt: string;
  updatedAt: string;
}

export interface ConsentChoices {
  careProfile: boolean;
  guardianAttested: boolean;
  aiCompanion: boolean;
  voiceProcessing: boolean;
}

export const EMPTY_CONSENT_CHOICES: ConsentChoices = {
  careProfile: false,
  guardianAttested: false,
  aiCompanion: false,
  voiceProcessing: false,
};

/** Both required boxes ticked — the minimum to continue setting up a patient. */
export function hasRequiredChoices(choices: ConsentChoices): boolean {
  return choices.careProfile && choices.guardianAttested;
}

/** Voice without the companion is meaningless; the form enforces this and so does this normaliser. */
export function normalizeChoices(choices: ConsentChoices): ConsentChoices {
  return { ...choices, voiceProcessing: choices.aiCompanion && choices.voiceProcessing };
}

export function isConsentValid(record: ConsentRecord | null | undefined, purpose: ConsentPurpose): boolean {
  if (!record) return false;
  if (record.version < CONSENT_VERSION) return false;
  if (!record.careProfile || !record.guardianAttested) return false;
  if (purpose === 'ai') return record.aiCompanion;
  if (purpose === 'voice') return record.aiCompanion && record.voiceProcessing;
  return true;
}

export function buildConsentRecord(
  patientId: string,
  caregiverId: string,
  choices: ConsentChoices,
  previous?: ConsentRecord | null,
  now: string = new Date().toISOString(),
): ConsentRecord {
  const normalized = normalizeChoices(choices);
  return {
    patientId,
    version: CONSENT_VERSION,
    ...normalized,
    consentedBy: caregiverId,
    // The original agreement date is kept when a caregiver only changes the optional AI choices.
    consentedAt: previous && previous.version >= CONSENT_VERSION ? previous.consentedAt : now,
    updatedAt: now,
  };
}

export interface NoticeSection {
  id: string;
  heading: string;
  points: string[];
}

/**
 * The plain-language notice shown with the consent form and again from
 * Settings. Every statement here must stay true of the code: if a provider,
 * a stored field or a protection changes, change this text and bump
 * CONSENT_VERSION in the same change.
 */
export const PRIVACY_NOTICE: NoticeSection[] = [
  {
    id: 'collect',
    heading: 'What SMRITI collects',
    points: [
      'About you: your name and caregiving role.',
      "About the patient: name, age, gender, years of education and preferred language.",
      'Activity: brain-game results, response times and how often they play.',
      'Reminders you set and whether each one was marked done.',
      'Memory Bank entries you add: people, places, routines and photos.',
      'Questions asked to Ask Smriti and the answers given, if you turn it on below.',
    ],
  },
  {
    id: 'use',
    heading: 'How it is used',
    points: [
      'To choose game difficulty, show reminders and let you follow progress.',
      'To alert you to a sudden drop in scores, missed days or missed reminders.',
      'SMRITI supports care. It does not diagnose or treat any condition, and data is never sold or used for advertising.',
    ],
  },
  {
    id: 'ai',
    heading: 'Ask Smriti (AI companion) — optional',
    points: [
      'Each message is sent with the last few turns of the conversation (up to 6) and up to 12 Memory Bank entries. Game history, age, reminders and contact details are not sent.',
      'Groq, or OpenRouter as a backup (AI model providers that may process data outside India), write the reply in the patient’s language from those Memory Bank entries only, and a second check reviews every reply for details that are not in the Memory Bank.',
      'Bhashini (Government of India, MeitY) reads replies aloud, and translates a reply only when one comes back in the wrong language.',
      'Every message and reply is saved so you can review the conversation. If a message sounds like distress, the patient is shown the Tele-MANAS helpline (14416) and it is flagged for you.',
      'With voice turned on, the spoken question is sent to Bhashini (or Groq if Bhashini cannot understand it) to turn it into text. SMRITI keeps the text, not the recording.',
    ],
  },
  {
    id: 'protect',
    heading: 'How it is protected',
    points: [
      'On this phone, names, Memory Bank entries, questions, answers, messages and reminder details are encrypted (AES-256-GCM) before they are stored.',
      'The caregiver area is locked with your PIN.',
      'Everything sent over the internet is encrypted in transit (HTTPS).',
      "On the server, database access rules let only your caregiver account read your patients' records.",
      "A patient's phone can act only for the one patient it was set up for, using a signed device token; without it the AI services refuse the request.",
      'Memory Bank photos are stored at long, unguessable web addresses. Anyone given the exact address could open a photo, so avoid photos of documents.',
    ],
  },
  {
    id: 'rights',
    heading: 'Your choices',
    points: [
      'Turn Ask Smriti or voice off at any time in Settings → Privacy & consent. It stops working on the patient’s phone straight away.',
      'Delete everything on this phone from Settings → Delete all data.',
      'Ask the SMRITI team to delete the account copy of your data at any time.',
    ],
  },
];
