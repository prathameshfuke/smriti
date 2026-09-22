import type { UILanguage } from '@/lib/i18n/languages';

/**
 * Pre-recorded consoling/grounding messages played when a patient logs "Not
 * so good" — short, calm, breathing-focused, deliberately not clinical and
 * never live-generated at the moment of use (see scripts/synthesize-consoling.ts,
 * which turns this text into the cached public/audio/consoling/<lang>/msg-N.m4a
 * files this module points at).
 *
 * `CONSOLING_TEXT_LANGUAGES` (reviewed, ready-to-synthesize text) is wider
 * than `CONSOLING_LANGUAGES` (text AND a verified cached clip on disk for
 * every message). brx and mni have neither: this plays to someone who just
 * said they are not feeling well, the highest-stakes moment in the app to
 * get wrong, and a guessed translation is worse than the existing neutral
 * fallback — same reasoning this app already applied when it rejected
 * machine-translated Khasi/Mizo as unsafe (see languages.ts). as and ne have
 * text but no clips yet: Sarvam's `as-IN`/`ne-IN` TTS returned "request beta
 * access" for the key used to run the synthesis script, and Bhashini
 * credentials were not available in the environment that ran it either — so
 * their audio is a re-run away (`npx tsx scripts/synthesize-consoling.ts
 * --lang as,ne` once either credential exists), not a rewrite.
 */
export const CONSOLING_TEXT_LANGUAGES = ['en', 'hi', 'as', 'bn', 'ne'] as const;
export const CONSOLING_LANGUAGES = ['en', 'hi', 'bn'] as const;
export type ConsolingTextLanguage = (typeof CONSOLING_TEXT_LANGUAGES)[number];
export type ConsolingLanguage = (typeof CONSOLING_LANGUAGES)[number];

export function hasConsolingAudio(language: UILanguage): language is ConsolingLanguage {
  return (CONSOLING_LANGUAGES as readonly string[]).includes(language);
}

export const CONSOLING_MESSAGES: Record<ConsolingTextLanguage, string[]> = {
  en: [
    "Take a slow breath in... and slowly breathe out. You're doing okay.",
    "Let's take a moment together. Breathe in slowly... and let it go.",
    "It's okay to feel this way sometimes. Take a deep breath with me.",
    'You are safe. Breathe in slowly... and breathe out slowly.',
    "Take a moment to rest. Breathe in... breathe out. You're not alone.",
  ],
  hi: [
    'धीरे से साँस अंदर लें... और धीरे से साँस छोड़ें। आप ठीक हैं।',
    'आइए एक पल साथ में रुकें। धीरे से साँस लें... और छोड़ दें।',
    'कभी-कभी ऐसा महसूस होना ठीक है। मेरे साथ एक गहरी साँस लें।',
    'आप सुरक्षित हैं। धीरे से साँस अंदर लें... और धीरे से साँस छोड़ें।',
    'थोड़ा आराम करें। साँस अंदर लें... साँस बाहर छोड़ें। आप अकेले नहीं हैं।',
  ],
  as: [
    'লাহেকৈ উশাহ লওক... আৰু লাহেকৈ উশাহ এৰক। আপুনি ঠিকেই আছে।',
    'আহক ক্ষণিক সময় একেলগে থাকোঁ। লাহেকৈ উশাহ লওক... আৰু এৰি দিয়ক।',
    'কেতিয়াবা এনে অনুভৱ কৰাটো ঠিকেই। মোৰ লগত এটা দীঘল উশাহ লওক।',
    'আপুনি সুৰক্ষিত আছে। লাহেকৈ উশাহ লওক... আৰু লাহেকৈ উশাহ এৰক।',
    'অলপ জিৰণি লওক। উশাহ লওক... উশাহ এৰক। আপুনি অকলশৰীয়া নহয়।',
  ],
  bn: [
    'ধীরে ধীরে শ্বাস নিন... আর ধীরে ধীরে ছেড়ে দিন। আপনি ঠিক আছেন।',
    'আসুন একটু সময় একসাথে থাকি। ধীরে শ্বাস নিন... আর ছেড়ে দিন।',
    'মাঝে মাঝে এমন লাগা ঠিক আছে। আমার সাথে একটা গভীর শ্বাস নিন।',
    'আপনি নিরাপদ আছেন। ধীরে শ্বাস নিন... আর ধীরে শ্বাস ছাড়ুন।',
    'একটু বিশ্রাম নিন। শ্বাস নিন... শ্বাস ছাড়ুন। আপনি একা নন।',
  ],
  ne: [
    'बिस्तारै सास लिनुहोस्... र बिस्तारै सास छोड्नुहोस्। तपाईं ठीक हुनुहुन्छ।',
    'एक क्षण सँगै बसौं। बिस्तारै सास लिनुहोस्... र छोड्नुहोस्।',
    'कहिलेकाहीं यस्तो महसुस हुनु ठीकै हो। मसँगै एक गहिरो सास लिनुहोस्।',
    'तपाईं सुरक्षित हुनुहुन्छ। बिस्तारै सास लिनुहोस्... र बिस्तारै सास छोड्नुहोस्।',
    'अलिकति आराम गर्नुहोस्। सास लिनुहोस्... सास छोड्नुहोस्। तपाईं एक्लै हुनुहुन्न।',
  ],
};

export const CONSOLING_CLIP_COUNT = CONSOLING_MESSAGES.en.length;

/**
 * `public/audio/consoling/<lang>/msg-<n>.m4a`, 1-indexed to match the
 * synthesis script's file names. `.m4a` (AAC), not literally `.mp3`: the
 * same format every other pre-synthesized clip in this app already ships
 * as (see scripts/synthesize-prompts.ts's own convertWav — macOS's
 * afconvert has no MP3 encoder, only AAC/ALAC), so this reuses the
 * existing audio pipeline instead of adding an mp3-specific one.
 */
export function consolingClipPath(language: ConsolingLanguage, index: number): string {
  return `/audio/consoling/${language}/msg-${index + 1}.m4a`;
}
