import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import RemindersPage from '@/app/reminders/page';

describe('scaffold smoke', () => {
  it('renders a placeholder page', () => {
    render(<RemindersPage />);
    expect(screen.getByText('Reminders')).toBeInTheDocument();
  });
});
