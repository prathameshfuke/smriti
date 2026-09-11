import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

let searchParams = new URLSearchParams();
const replace = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace }),
  usePathname: () => '/login',
  useSearchParams: () => searchParams,
}));

vi.mock('@/lib/supabase/client', () => ({
  isSupabaseConfigured: () => true,
  createBrowserClient: () => ({
    auth: { signInWithOtp: vi.fn().mockResolvedValue({ error: null }) },
  }),
}));

describe('Landing page', () => {
  it("renders the hero headline 'Care that stays with you, even offline'", async () => {
    // Amigo-inspired restyle (docs/Design System_ Amigo-Inspired Clinical AI
    // Platform.md §5.3: "headline should be short, declarative, and
    // operational") replaced the old generic headline with this copy.
    const { default: LandingPage } = await import('@/app/page');
    render(<LandingPage />);
    expect(screen.getByText(/care that stays with you/i)).toBeInTheDocument();
    expect(screen.getByText(/even offline/i)).toBeInTheDocument();
  });

  it("renders a 'Get Started' CTA linking to /login", async () => {
    const { default: LandingPage } = await import('@/app/page');
    render(<LandingPage />);
    const ctas = screen.getAllByRole('link', { name: /get started/i });
    expect(ctas.length).toBeGreaterThan(0);
    for (const cta of ctas) expect(cta).toHaveAttribute('href', '/login');
  });

  it('features section renders 3 cards (Offline First, Local Languages, Clinically Grounded)', async () => {
    const { default: LandingPage } = await import('@/app/page');
    render(<LandingPage />);
    expect(screen.getByText('Offline First')).toBeInTheDocument();
    expect(screen.getByText('Local Languages')).toBeInTheDocument();
    expect(screen.getByText('Clinically Grounded')).toBeInTheDocument();
  });

  it('game showcase renders 5 cognitive games that actually ship in the app', async () => {
    const { default: LandingPage } = await import('@/app/page');
    render(<LandingPage />);
    expect(screen.getByText('Memory Match')).toBeInTheDocument();
    expect(screen.getByText('Object Hunt')).toBeInTheDocument();
    expect(screen.getByText('Word Stream')).toBeInTheDocument();
    expect(screen.getByText('Quick Tap')).toBeInTheDocument();
    expect(screen.getByText('Path Match')).toBeInTheDocument();
  });

  it('renders a footer with 3 columns (SMRITI, Resources, Legal)', async () => {
    const { default: LandingPage } = await import('@/app/page');
    render(<LandingPage />);
    expect(screen.getByRole('heading', { name: 'Resources' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Legal' })).toBeInTheDocument();
  });

  it('has no gradient background anywhere', async () => {
    const { default: LandingPage } = await import('@/app/page');
    const { container } = render(<LandingPage />);
    const all = container.querySelectorAll('*');
    for (const el of all) {
      expect(el.className.toString()).not.toMatch(/gradient/i);
    }
  });

  it('contains no emoji characters', async () => {
    const { default: LandingPage } = await import('@/app/page');
    const { container } = render(<LandingPage />);
    const emojiRange = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;
    expect(emojiRange.test(container.textContent ?? '')).toBe(false);
  });
});

describe('Login page', () => {
  it('role selector renders 2 buttons (Patient, Caregiver)', async () => {
    searchParams = new URLSearchParams();
    const { default: LoginPage } = await import('@/app/login/page');
    render(<LoginPage />);
    expect(screen.getByRole('button', { name: /i am the patient/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /i am the caregiver/i })).toBeInTheDocument();
  });

  it('patient role sends the caregiver straight to the real /app screen, not a dead-end message', async () => {
    // The old inline "ask your caregiver" screen had no logic behind it at
    // all — this now defers entirely to /app, which actually checks local
    // storage and restores a returning patient or offers Caregiver Login.
    searchParams = new URLSearchParams();
    replace.mockClear();
    const { default: LoginPage } = await import('@/app/login/page');
    render(<LoginPage />);
    fireEvent.click(screen.getByRole('button', { name: /i am the patient/i }));
    expect(replace).toHaveBeenCalledWith('/app');
  });

  it('caregiver role sends the caregiver to the real, fixed login page, not the old link-only flow', async () => {
    // The inline flow here used to be a second, divergent copy of
    // /caregiver/login stuck on the old link-only OTP email with no code
    // entry — fixed once, in one place, by routing here instead.
    searchParams = new URLSearchParams();
    replace.mockClear();
    const { default: LoginPage } = await import('@/app/login/page');
    render(<LoginPage />);
    fireEvent.click(screen.getByRole('button', { name: /i am the caregiver/i }));
    expect(replace).toHaveBeenCalledWith('/caregiver/login');
  });
});
