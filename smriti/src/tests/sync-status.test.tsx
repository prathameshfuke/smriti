import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { I18nProvider } from '@/lib/i18n/provider';
import { useGameStore } from '@/stores/gameStore';

const syncNow = vi.fn();
vi.mock('@/hooks/useSync', () => ({
  useSync: () => ({ syncStatus: 'pending', lastSynced: null, pendingCount: 3, syncNow }),
}));

describe('SyncStatus', () => {
  beforeEach(() => {
    syncNow.mockReset();
    useGameStore.setState({ isSessionActive: false });
  });

  it('tells the caregiver to finish the game instead of blaming the connection, and never calls syncNow', async () => {
    useGameStore.setState({ isSessionActive: true });
    const { default: SyncStatus } = await import('@/components/ui/SyncStatus');
    render(
      <I18nProvider>
        <SyncStatus />
      </I18nProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: /sync now/i }));

    expect(await screen.findByText(/a game is in progress\. finish it, then sync\./i)).toBeInTheDocument();
    expect(syncNow).not.toHaveBeenCalled();
  });

  it('syncs normally once no game is active', async () => {
    syncNow.mockResolvedValue(true);
    const { default: SyncStatus } = await import('@/components/ui/SyncStatus');
    render(
      <I18nProvider>
        <SyncStatus />
      </I18nProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: /sync now/i }));

    await waitFor(() => expect(syncNow).toHaveBeenCalledTimes(1));
    expect(screen.queryByText(/a game is in progress/i)).not.toBeInTheDocument();
  });

  it('shows a real failure message when sync itself fails, not the game-active message', async () => {
    syncNow.mockResolvedValue(false);
    const { default: SyncStatus } = await import('@/components/ui/SyncStatus');
    render(
      <I18nProvider>
        <SyncStatus />
      </I18nProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: /sync now/i }));

    expect(await screen.findByText(/could not reach your account/i)).toBeInTheDocument();
    expect(screen.queryByText(/a game is in progress/i)).not.toBeInTheDocument();
  });
});
