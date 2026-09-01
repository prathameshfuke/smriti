import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import 'fake-indexeddb/auto';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/reminders',
}));

import RemindersPage from '@/app/reminders/page';

describe('scaffold smoke', () => {
  it('renders the reminders page', () => {
    render(<RemindersPage />);
    expect(screen.getByText('Reminders')).toBeInTheDocument();
  });
});
