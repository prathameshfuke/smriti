import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { DEFAULT_LANGUAGE, type UILanguage } from '@/lib/i18n/languages';

/**
 * The caregiver PIN gates access to patient health data, so only a salted
 * SHA-256 digest is stored. The raw PIN never reaches persistent storage.
 * This is not password-grade KDF work; it stops casual reads of localStorage,
 * which is the realistic threat on a shared family device.
 */
const HASH_SEPARATOR = ':';

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

async function digest(pin: string, saltHex: string): Promise<string> {
  const data = new TextEncoder().encode(`${saltHex}${pin}`);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return toHex(new Uint8Array(buf));
}

export async function hashPin(pin: string, saltHex?: string): Promise<string> {
  const salt = saltHex ?? toHex(crypto.getRandomValues(new Uint8Array(32)));
  return `${salt}${HASH_SEPARATOR}${await digest(pin, salt)}`;
}

export async function checkPin(pin: string, stored: string | null): Promise<boolean> {
  if (!stored) return false;
  const [salt, expected] = stored.split(HASH_SEPARATOR);
  if (!salt || !expected) return false;
  return (await digest(pin, salt)) === expected;
}

/** Single source of truth for language; I18nProvider reads through to this. */
interface SettingsState {
  language: UILanguage;
  isFirstLaunch: boolean;
  /** `<salt>:<sha256>` — never the raw PIN. */
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
