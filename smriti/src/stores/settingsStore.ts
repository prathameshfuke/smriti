import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { DEFAULT_LANGUAGE, type UILanguage } from '@/lib/i18n/languages';
import { useCaregiverStore } from '@/stores/caregiverStore';
import { DEFAULT_DISPLAY_SIZE, type DisplaySize } from '@/lib/a11y/sizing';

/**
 * The caregiver PIN gates access to patient health data, so only a derived
 * digest is stored — the raw PIN never reaches persistent storage.
 *
 * PBKDF2-HMAC-SHA256 at 100k iterations, not a single SHA-256 pass: the PIN
 * space is 10^4, and one unsalted-speed hash per guess means a stolen phone
 * is brute-forced in milliseconds. The stretch puts a full sweep in the
 * minutes, on a device that only ever computes this on an actual login.
 *
 * Stored format: `pbkdf2$<iterations>$<saltHex>$<digestHex>`. The older
 * `<saltHex>:<sha256Hex>` form still verifies so an installed device is not
 * locked out; those upgrade on the next setPin().
 */
const PBKDF2_ITERATIONS = 100_000;
const PBKDF2_KEY_BITS = 256;
const LEGACY_SEPARATOR = ':';

/**
 * Web Crypto is only exposed in secure contexts. That is not a limitation
 * worth working around: the service worker, and therefore the whole offline
 * PWA, has the same requirement — so plain http://<LAN-ip> cannot run SMRITI
 * either way. The error says so instead of surfacing a bare TypeError.
 */
export class PinCryptoUnavailableError extends Error {
  constructor() {
    super(
      'Web Crypto is unavailable. SMRITI needs a secure context: serve over ' +
        'HTTPS, or use http://localhost for local development.',
    );
    this.name = 'PinCryptoUnavailableError';
  }
}

export function isPinCryptoAvailable(): boolean {
  return typeof globalThis.crypto?.subtle?.importKey === 'function';
}

function subtle(): SubtleCrypto {
  if (!isPinCryptoAvailable()) throw new PinCryptoUnavailableError();
  return globalThis.crypto.subtle;
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Length-independent comparison, so a mismatch leaks no position. */
function equalHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function derive(pin: string, saltHex: string, iterations: number): Promise<string> {
  const key = await subtle().importKey(
    'raw',
    new TextEncoder().encode(pin),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const bits = await subtle().deriveBits(
    {
      name: 'PBKDF2',
      hash: 'SHA-256',
      salt: new TextEncoder().encode(saltHex),
      iterations,
    },
    key,
    PBKDF2_KEY_BITS,
  );
  return toHex(new Uint8Array(bits));
}

/** Pre-PBKDF2 format, kept only so existing installs can still log in. */
async function legacyDigest(pin: string, saltHex: string): Promise<string> {
  const buf = await subtle().digest('SHA-256', new TextEncoder().encode(`${saltHex}${pin}`));
  return toHex(new Uint8Array(buf));
}

export async function hashPin(pin: string, saltHex?: string): Promise<string> {
  const salt = saltHex ?? toHex(crypto.getRandomValues(new Uint8Array(16)));
  const digest = await derive(pin, salt, PBKDF2_ITERATIONS);
  return `pbkdf2$${PBKDF2_ITERATIONS}$${salt}$${digest}`;
}

export async function checkPin(pin: string, stored: string | null): Promise<boolean> {
  if (!stored) return false;

  if (stored.startsWith('pbkdf2$')) {
    const [, iterations, salt, expected] = stored.split('$');
    const rounds = Number.parseInt(iterations, 10);
    if (!Number.isFinite(rounds) || rounds <= 0 || !salt || !expected) return false;
    return equalHex(await derive(pin, salt, rounds), expected);
  }

  const [salt, expected] = stored.split(LEGACY_SEPARATOR);
  if (!salt || !expected) return false;
  return equalHex(await legacyDigest(pin, salt), expected);
}

/** The PIN is a fast unlock on top of a real login, not a second credential
 * — it must stop working once that underlying login is old enough that the
 * real session could plausibly have expired. */
const CAREGIVER_SESSION_MAX_AGE_MS = 24 * 60 * 60 * 1000;

/**
 * Wrong-PIN lockout — previously lived as component `useState` in the PIN
 * dialog (app/app/page.tsx), which meant a page reload silently reset both
 * the attempt count and any active cooldown: an attacker could guess twice,
 * reload, guess twice, reload, indefinitely, against a 10,000-combination
 * PIN with the 3-strikes limit never actually engaging. Persisted here
 * (same `persist` middleware as caregiverPinHash) so neither survives only
 * as long as the component happens to stay mounted. `pinCooldownUntil` is
 * an absolute timestamp, not a decrementing counter, so the remaining time
 * is just `pinCooldownUntil - Date.now()` recomputed on mount — nothing to
 * resume or lose across a reload.
 */
const MAX_PIN_ATTEMPTS = 3;
const PIN_COOLDOWN_MS = 30_000;

/** Single source of truth for language; I18nProvider reads through to this. */
interface SettingsState {
  language: UILanguage;
  isFirstLaunch: boolean;
  /** `pbkdf2$<iterations>$<salt>$<digest>` — never the raw PIN. */
  caregiverPinHash: string | null;
  /** Id of the caregiver `caregiverPinHash` was set for. The hash itself is
   * device-global (this store isn't keyed per caregiver), so without this a
   * second caregiver signing into the same device would silently unlock
   * under the first caregiver's PIN — see `clearPinIfDifferentCaregiver`. */
  caregiverPinOwnerId: string | null;
  /** Timestamp of the last confirmed-live caregiver login (magic-link
   * verify or onboarding) on this device. `null` until one has happened. */
  caregiverSessionVerifiedAt: number | null;
  /** Wrong attempts since the last correct PIN (or the last time a cooldown
   * expired and a fresh round started). */
  pinAttempts: number;
  /** Absolute ms timestamp the lockout ends, or null when not locked out. */
  pinCooldownUntil: number | null;
  /** On a phone shared by several patients: who is playing right now. */
  activePatientId: string | null;
  /** Last tap anywhere in the app, for the shared-phone idle re-ask. */
  lastActivityAt: number | null;
  /** Device-wide text size (see lib/a11y/sizing.ts). */
  textSize: DisplaySize;
  /** Device-wide icon size, independent of text size. */
  iconSize: DisplaySize;
  /** Device-wide zoom lock (see lib/a11y/zoomLock.ts). Off by default so
   * pinch-zoom stays available — WCAG 1.4.4, same reasoning as layout.tsx's
   * viewport export. A caregiver opts a specific device into it. */
  zoomLocked: boolean;
  setTextSize: (size: DisplaySize) => void;
  setIconSize: (size: DisplaySize) => void;
  setZoomLocked: (locked: boolean) => void;
  setActivePatient: (patientId: string | null) => void;
  touchActivity: () => void;
  setLanguage: (language: UILanguage) => void;
  setPin: (pin: string) => Promise<void>;
  verifyPin: (pin: string) => Promise<boolean>;
  /** Call once the current caregiver's identity is known (after a real
   * login pulls their profile). Wipes a leftover PIN set by a *different*
   * caregiver on this device; leaves it alone for the same one — so a
   * returning caregiver's PIN survives Log Out, but never carries over to
   * whoever signs in next. */
  clearPinIfDifferentCaregiver: (caregiverId: string) => void;
  markLaunched: () => void;
  /** Call right after a real login (magic-link verify, onboarding) succeeds. */
  markCaregiverSessionVerified: () => void;
  /** Whether the PIN can be trusted to unlock caregiver mode without
   * re-checking the underlying session — false once it's old enough that the
   * real login could have expired, or if no login has ever been recorded. */
  isCaregiverSessionFresh: () => boolean;
  /** Call after a failed verifyPin. Increments the persisted count and
   * starts the persisted cooldown once MAX_PIN_ATTEMPTS is reached. */
  recordWrongPinAttempt: () => void;
  /** Call after a successful verifyPin, so a correct entry actually clears
   * the slate instead of leaving a stale near-threshold count for next time. */
  clearPinAttempts: () => void;
  /** Whether entry is currently locked out — true while pinCooldownUntil is
   * still in the future. Reading this (rather than comparing the raw
   * timestamp inline everywhere) keeps the "in the past = not locked"
   * interpretation in one place. */
  isPinLocked: () => boolean;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      language: DEFAULT_LANGUAGE,
      isFirstLaunch: true,
      caregiverPinHash: null,
      caregiverPinOwnerId: null,
      caregiverSessionVerifiedAt: null,
      pinAttempts: 0,
      pinCooldownUntil: null,
      activePatientId: null,
      lastActivityAt: null,
      textSize: DEFAULT_DISPLAY_SIZE,
      iconSize: DEFAULT_DISPLAY_SIZE,
      zoomLocked: false,

      setTextSize: (textSize) => set({ textSize }),
      setIconSize: (iconSize) => set({ iconSize }),
      setZoomLocked: (zoomLocked) => set({ zoomLocked }),
      setActivePatient: (activePatientId) => set({ activePatientId, lastActivityAt: Date.now() }),
      touchActivity: () => set({ lastActivityAt: Date.now() }),
      setLanguage: (language) => set({ language }),
      setPin: async (pin) => {
        const ownerId = useCaregiverStore.getState().currentCaregiver?.id ?? null;
        set({ caregiverPinHash: await hashPin(pin), caregiverPinOwnerId: ownerId });
      },
      verifyPin: (pin) => checkPin(pin, get().caregiverPinHash),
      clearPinIfDifferentCaregiver: (caregiverId) => {
        const { caregiverPinHash, caregiverPinOwnerId } = get();
        // A null owner on an existing hash means this PIN predates
        // `caregiverPinOwnerId` (an install that updated from before this
        // field existed) — trusted once rather than forced through PIN setup
        // again; every `setPin()` from here on always stamps an owner, so
        // this only ever applies to that one pre-update hash.
        if (caregiverPinHash === null || caregiverPinOwnerId === null || caregiverPinOwnerId === caregiverId) return;
        set({
          caregiverPinHash: null,
          caregiverPinOwnerId: null,
          pinAttempts: 0,
          pinCooldownUntil: null,
        });
      },
      markLaunched: () => set({ isFirstLaunch: false }),
      markCaregiverSessionVerified: () => set({ caregiverSessionVerifiedAt: Date.now() }),
      isCaregiverSessionFresh: () => {
        const verifiedAt = get().caregiverSessionVerifiedAt;
        return verifiedAt !== null && Date.now() - verifiedAt < CAREGIVER_SESSION_MAX_AGE_MS;
      },
      recordWrongPinAttempt: () => {
        const next = get().pinAttempts + 1;
        set({
          pinAttempts: next,
          pinCooldownUntil: next >= MAX_PIN_ATTEMPTS ? Date.now() + PIN_COOLDOWN_MS : get().pinCooldownUntil,
        });
      },
      clearPinAttempts: () => set({ pinAttempts: 0, pinCooldownUntil: null }),
      isPinLocked: () => {
        const until = get().pinCooldownUntil;
        return until !== null && Date.now() < until;
      },
    }),
    { name: 'smriti.settings' },
  ),
);
