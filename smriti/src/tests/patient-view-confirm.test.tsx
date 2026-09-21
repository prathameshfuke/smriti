import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

const push = vi.hoisted(() => vi.fn());
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace: vi.fn() }),
  usePathname: () => '/caregiver/dashboard',
}));

// The rail's sync footer reads IndexedDB, which this test doesn't exercise.
vi.mock('@/components/ui/SyncStatus', () => ({ default: () => null }));

import CaregiverNav from '@/components/layout/CaregiverNav';
import CaregiverRail from '@/components/layout/CaregiverRail';

beforeEach(() => push.mockClear());

describe.each([
  ['CaregiverNav', CaregiverNav],
  ['CaregiverRail', CaregiverRail],
])('%s Patient View', (_name, Component) => {
  it('asks before leaving the caregiver area, and stays put on "Stay here"', () => {
    render(<Component />);
    fireEvent.click(screen.getByRole('button', { name: 'Patient View' }));
    expect(push).not.toHaveBeenCalled();

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveTextContent('Switch to Patient View?');
    expect(screen.getByRole('button', { name: 'Stay here' })).toHaveFocus();

    fireEvent.click(screen.getByRole('button', { name: 'Stay here' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(push).not.toHaveBeenCalled();
  });

  it('goes to /app only after the caregiver confirms', () => {
    render(<Component />);
    fireEvent.click(screen.getByRole('button', { name: 'Patient View' }));
    fireEvent.click(screen.getByRole('button', { name: 'Switch to Patient View' }));
    expect(push).toHaveBeenCalledExactlyOnceWith('/app');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('Escape cancels', () => {
    render(<Component />);
    fireEvent.click(screen.getByRole('button', { name: 'Patient View' }));
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(push).not.toHaveBeenCalled();
  });
});
