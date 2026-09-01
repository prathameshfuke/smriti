import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

let searchParams = new URLSearchParams();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
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
  it("renders the hero headline 'Memory and engagement, simply designed'", async () => {
    const { default: LandingPage } = await import('@/app/landing/page');
    render(<LandingPage />);
    expect(screen.getByText(/memory and engagement, simply designed/i)).toBeInTheDocument();
  });

  it("renders a 'Get Started' CTA linking to /login", async () => {
    const { default: LandingPage } = await import('@/app/landing/page');
    render(<LandingPage />);
    const cta = screen.getByRole('link', { name: /get started/i });
    expect(cta).toHaveAttribute('href', '/login');
  });

  it('features section renders 3 cards (Offline First, Local Languages, Clinically Grounded)', async () => {
    const { default: LandingPage } = await import('@/app/landing/page');
    render(<LandingPage />);
    expect(screen.getByText('Offline First')).toBeInTheDocument();
    expect(screen.getByText('Local Languages')).toBeInTheDocument();
    expect(screen.getByText('Clinically Grounded')).toBeInTheDocument();
  });

  it('game showcase renders the 4 real games the app ships', async () => {
    const { default: LandingPage } = await import('@/app/landing/page');
    render(<LandingPage />);
    expect(screen.getByText('Object Hunt')).toBeInTheDocument();
    expect(screen.getByText('Word Stream')).toBeInTheDocument();
    expect(screen.getByText('Quick Tap')).toBeInTheDocument();
    expect(screen.getByText('Path Match')).toBeInTheDocument();
  });

  it('renders a footer with 3 columns (SMRITI, Resources, Legal)', async () => {
    const { default: LandingPage } = await import('@/app/landing/page');
    render(<LandingPage />);
    expect(screen.getByRole('heading', { name: 'Resources' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Legal' })).toBeInTheDocument();
  });

  it('has no gradient background anywhere', async () => {
    const { default: LandingPage } = await import('@/app/landing/page');
    const { container } = render(<LandingPage />);
    const all = container.querySelectorAll('*');
    for (const el of all) {
      expect(el.className.toString()).not.toMatch(/gradient/i);
    }
  });

  it('contains no emoji characters', async () => {
    const { default: LandingPage } = await import('@/app/landing/page');
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

  it('patient flow shows a 4-digit PIN input', async () => {
    searchParams = new URLSearchParams();
    const { default: LoginPage } = await import('@/app/login/page');
    render(<LoginPage />);
    fireEvent.click(screen.getByRole('button', { name: /i am the patient/i }));
    expect(screen.getAllByRole('textbox').length + screen.getAllByLabelText(/digit/i).length).toBeGreaterThanOrEqual(4);
  });

  it('caregiver flow shows an email input and submit button', async () => {
    searchParams = new URLSearchParams();
    const { default: LoginPage } = await import('@/app/login/page');
    render(<LoginPage />);
    fireEvent.click(screen.getByRole('button', { name: /i am the caregiver/i }));
    expect(screen.getByPlaceholderText(/your@email.com/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /send login link/i })).toBeInTheDocument();
  });
});
