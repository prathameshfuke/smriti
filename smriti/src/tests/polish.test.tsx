import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import ErrorBoundary from '@/components/ErrorBoundary';

const push = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace: vi.fn() }),
  usePathname: () => '/games/object-hunt',
}));

function Boom(): React.ReactElement {
  throw new Error('boom: sensitive stack detail');
}

describe('ErrorBoundary', () => {
  it('renders fallback UI when a child component throws', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    );
    expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
    spy.mockRestore();
  });

  it('does not show error.message or stack trace in the fallback output', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { container } = render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    );
    expect(container.textContent).not.toMatch(/boom: sensitive stack detail/);
    expect(container.textContent).not.toMatch(/at Boom/);
    spy.mockRestore();
  });

  it("renders a 'Go Home' button in the fallback UI", () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    );
    expect(screen.getByRole('button', { name: /go home/i })).toBeInTheDocument();
    spy.mockRestore();
  });
});

describe('Disclaimer', () => {
  it('is present in the main layout output', async () => {
    const { default: RootLayout } = await import('@/app/layout');
    render(
      <RootLayout>
        <div>page content</div>
      </RootLayout>,
    );
    expect(
      screen.getByText(/does not diagnose or treat any condition/i),
    ).toBeInTheDocument();
  });

  it('is visible on the home page, not hidden behind other elements', async () => {
    const { default: RootLayout } = await import('@/app/layout');
    const { default: HomePage } = await import('@/app/page');
    render(
      <RootLayout>
        <HomePage />
      </RootLayout>,
    );
    const disclaimer = screen.getByText(/does not diagnose or treat any condition/i);
    expect(disclaimer).toBeVisible();
  });
});
