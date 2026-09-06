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
  it("renders the hero headline 'Cognitive Care for Your Loved Ones'", async () => {
    const { default: LandingPage } = await import('@/app/page');
    render(<LandingPage />);
    expect(screen.getByText(/cognitive care for your loved ones/i)).toBeInTheDocument();
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

  it('patient flow shows setup message instead of PIN', async () => {
    searchParams = new URLSearchParams();
    const { default: LoginPage } = await import('@/app/login/page');
    render(<LoginPage />);
    fireEvent.click(screen.getByRole('button', { name: /i am the patient/i }));
    expect(screen.getByText(/ask your caregiver/i)).toBeInTheDocument();
    const pinInputs = screen.queryAllByLabelText(/pin digit/i);
    expect(pinInputs.length).toBe(0);
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
