import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { DEFAULT_LANGUAGE, type UILanguage } from '@/lib/i18n/languages';

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

/** Single source of truth for language; I18nProvider reads through to this. */
interface SettingsState {
  language: UILanguage;
  isFirstLaunch: boolean;
  /** `pbkdf2$<iterations>$<salt>$<digest>` — never the raw PIN. */
  caregiverPinHash: string | null;
  setLanguage: (language: UILanguage) => void;
  setPin: (pin: string) => Promise<void>;
  verifyPin: (pin: string) => Promise<boolean>;
  markLaunched: () => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      language: DEFAULT_LANGUAGE,
      isFirstLaunch: true,
      caregiverPinHash: null,

      setLanguage: (language) => set({ language }),
      setPin: async (pin) => {
        set({ caregiverPinHash: await hashPin(pin) });
      },
      verifyPin: (pin) => checkPin(pin, get().caregiverPinHash),
      markLaunched: () => set({ isFirstLaunch: false }),
    }),
    { name: 'smriti.settings' },
  ),
);
