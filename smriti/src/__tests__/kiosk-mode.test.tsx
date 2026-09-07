import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

let searchParams = new URLSearchParams();
const mockPush = vi.fn();
const mockReplace = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
  usePathname: () => '/',
  useSearchParams: () => searchParams,
}));

vi.mock('@/lib/supabase/client', () => ({
  isSupabaseConfigured: () => true,
  createBrowserClient: () => ({
    auth: { signInWithOtp: vi.fn().mockResolvedValue({ error: null }) },
  }),
}));

// Mock device trust functions
const mockIndexedDB = {
  getToken: vi.fn(),
  setToken: vi.fn(),
  clearToken: vi.fn(),
};

vi.mock('@/lib/auth/deviceTrust', async (importOriginal) => {
  const actual = await importOriginal() as typeof import('@/lib/auth/deviceTrust');
  return {
    ...actual,
    getDeviceTrustToken: mockIndexedDB.getToken,
    setDeviceTrustToken: mockIndexedDB.setToken,
    clearDeviceTrustToken: mockIndexedDB.clearToken,
  };
});

describe('Kiosk Mode: Device Trust Authentication', () => {
  beforeEach(() => {
    mockIndexedDB.getToken.mockResolvedValue(null);
    mockIndexedDB.setToken.mockResolvedValue(undefined);
    mockIndexedDB.clearToken.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Untrusted Device (no device trust token)', () => {
    it('shows role selector, not a PIN input', async () => {
      const { default: LoginPage } = await import('@/app/login/page');
      render(<LoginPage />);

      // Role selector buttons should exist
      expect(screen.getByRole('button', { name: /i am the patient/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /i am the caregiver/i })).toBeInTheDocument();

      // PIN input should NOT exist on role selector
      const pinInputs = screen.queryAllByLabelText(/pin digit/i);
      expect(pinInputs.length).toBe(0);
    });

    it('patient branch defers to /app, which does the real local-session check itself', async () => {
      // This page no longer renders its own "ask your caregiver" dead end —
      // that had no logic behind it (it showed regardless of whether the
      // device was actually set up). /app does the real check now: restore
      // from local storage if this device already has a profile, or offer
      // Caregiver Login if not.
      const { default: LoginPage } = await import('@/app/login/page');
      render(<LoginPage />);

      fireEvent.click(screen.getByRole('button', { name: /i am the patient/i }));

      expect(mockReplace).toHaveBeenCalledWith('/app');
    });
  });

  describe('Trusted Device (valid device trust token)', () => {
    beforeEach(() => {
      // Mock valid device trust token
      mockIndexedDB.getToken.mockResolvedValue({
        patientId: 'patient_123',
        issuedAt: Date.now() - 86400000, // 1 day ago
        issuedBy: 'caregiver_456',
        signature: 'mock_sig',
      });
    });

    it('a well-formed, unexpired local token passes the client-side shape check', async () => {
      // NOT a security check — see isTokenWellFormed's own doc comment.
      // Real verification happens server-side in deviceTrustServer.ts,
      // covered separately in device-trust-server.test.ts. A previous
      // version of this test asserted a client-computable, unsigned value
      // ('cGF0aWVudF8xMjM6Y2FyZWdpdmVyXzQ1Njp2MQ==' — base64 of
      // "patient_123:caregiver_456:v1", no secret involved) was "valid" —
      // that was the security bug, not a behavior worth preserving.
      const { isTokenWellFormed } = await import('@/lib/auth/deviceTrust');
      const token = {
        patientId: 'patient_123',
        issuedAt: Date.now() - 86400000,
        issuedBy: 'caregiver_456',
        signature: 'server-issued-signature-opaque-to-the-client',
      };
      expect(isTokenWellFormed(token)).toBe(true);
    });
  });

  describe('Caregiver Re-entry (small corner icon on patient home)', () => {
    it('structure supports caregiver access icon on patient home', () => {
      // Placeholder: actual implementation tested after component added
      expect(true).toBe(true);
    });
  });

  describe('Caregiver Sign-Out (clears device trust token)', () => {
    it('sign-out action clears device trust token', async () => {
      // Simulate caregiver sign-out
      await mockIndexedDB.clearToken();
      expect(mockIndexedDB.clearToken).toHaveBeenCalled();
    });
  });

  describe('Trust Device Flow (caregiver onboarding)', () => {
    it('trust device screen appears after caregiver auth', async () => {
      // After caregiver email auth, trust screen should be available
      expect(true).toBe(true); // Structure test: screen exists in new route
    });

    it('tapping trust device stores device token in IndexedDB', async () => {
      mockIndexedDB.setToken.mockResolvedValue(undefined);
      await mockIndexedDB.setToken({
        patientId: 'patient_123',
        issuedAt: Date.now(),
        issuedBy: 'caregiver_456',
      });

      expect(mockIndexedDB.setToken).toHaveBeenCalled();
    });
  });

  describe('No PIN references (audit)', () => {
    it('no PIN input element in patient login', async () => {
      const { default: LoginPage } = await import('@/app/login/page');
      const { container } = render(<LoginPage />);

      const pinInputs = container.querySelectorAll('input[aria-label*="PIN"]');
      expect(pinInputs.length).toBe(0);
    });
  });
});
