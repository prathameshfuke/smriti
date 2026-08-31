import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import BigButton from '@/components/ui/BigButton';
import TrafficLight from '@/components/ui/TrafficLight';
import ProgressRing from '@/components/ui/ProgressRing';
import SyncIndicator from '@/components/ui/SyncIndicator';
import GameTile from '@/components/ui/GameTile';
import Skeleton from '@/components/ui/Skeleton';
import LanguagePicker from '@/components/layout/LanguagePicker';
import { useSettingsStore } from '@/stores/settingsStore';

beforeEach(() => {
  window.localStorage.clear();
  useSettingsStore.setState(useSettingsStore.getInitialState(), true);
});

describe('BigButton', () => {
  it('renders its label', () => {
    render(<BigButton label="Start Playing" />);
    expect(screen.getByText('Start Playing')).toBeInTheDocument();
  });

  it('meets the 64px minimum touch target', () => {
    render(<BigButton label="Start" />);
    const btn = screen.getByRole('button');
    expect(Number.parseInt(btn.style.minHeight, 10)).toBeGreaterThanOrEqual(64);
  });

  it('calls onClick when pressed', () => {
    const onClick = vi.fn();
    render(<BigButton label="Start" onClick={onClick} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('shows an icon when one is provided', () => {
    render(<BigButton label="Play" icon={<svg data-testid="icon" />} />);
    expect(screen.getByTestId('icon')).toBeInTheDocument();
  });

  it('applies the primary background for the primary variant', () => {
    render(<BigButton label="Go" variant="primary" />);
    expect(screen.getByRole('button').className).toContain('bg-primary');
  });

  it('does not apply the primary background for the secondary variant', () => {
    render(<BigButton label="Go" variant="secondary" />);
    const cls = screen.getByRole('button').className;
    expect(cls).not.toContain('bg-primary');
  });

  it('is announced with its label for screen readers and audio prompts', () => {
    render(<BigButton label="Start Playing" />);
    expect(screen.getByRole('button')).toHaveAttribute('aria-label', 'Start Playing');
  });
});

describe('TrafficLight', () => {
  it('uses the danger colour for red status', () => {
    render(<TrafficLight status="red" />);
    expect(screen.getByRole('img').className).toContain('bg-danger');
  });

  it('uses the success colour for green status', () => {
    render(<TrafficLight status="green" />);
    expect(screen.getByRole('img').className).toContain('bg-success');
  });

  it('uses the warning colour for yellow status', () => {
    render(<TrafficLight status="yellow" />);
    expect(screen.getByRole('img').className).toContain('bg-warning');
  });

  it('carries a descriptive aria-label, not just a colour name', () => {
    render(<TrafficLight status="red" />);
    // Colour alone fails WCAG 1.4.1; the label must carry the meaning.
    expect(screen.getByRole('img')).toHaveAttribute(
      'aria-label',
      'Needs attention',
    );
  });
});

describe('ProgressRing', () => {
  it('renders an SVG', () => {
    const { container } = render(<ProgressRing value={50} />);
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('shows the percentage text', () => {
    render(<ProgressRing value={72} />);
    expect(screen.getByText('72%')).toBeInTheDocument();
  });

  it.each(['sm', 'md', 'lg'] as const)('renders at size %s', (size) => {
    const { container } = render(<ProgressRing value={10} size={size} />);
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('clamps out-of-range values', () => {
    render(<ProgressRing value={140} />);
    expect(screen.getByText('100%')).toBeInTheDocument();
  });
});

describe('SyncIndicator', () => {
  it('renders without crashing', () => {
    const { container } = render(<SyncIndicator status="synced" />);
    expect(container.firstChild).toBeTruthy();
  });

  it('shows status text', () => {
    render(<SyncIndicator status="offline" />);
    expect(screen.getByText(/offline/i)).toBeInTheDocument();
  });
});

describe('GameTile', () => {
  it('renders the game name', () => {
    render(<GameTile gameName="Kotha Khoj" href="/games/object-hunt" />);
    expect(screen.getByText('Kotha Khoj')).toBeInTheDocument();
  });

  it('carries an aria-label naming the game', () => {
    render(<GameTile gameName="Kotha Khoj" href="/games/object-hunt" />);
    expect(screen.getByRole('link')).toHaveAttribute('aria-label', 'Kotha Khoj');
  });

  it('meets the 64px minimum touch target', () => {
    render(<GameTile gameName="Beg Beg" href="/games/quick-tap" />);
    const tile = screen.getByRole('link');
    expect(Number.parseInt(tile.style.minHeight, 10)).toBeGreaterThanOrEqual(64);
  });
});

describe('Skeleton', () => {
  it('renders a pulsing placeholder', () => {
    const { container } = render(<Skeleton />);
    const el = container.firstChild as HTMLElement;
    expect(el.tagName).toBe('DIV');
    expect(el.className).toContain('animate-pulse');
  });
});

describe('LanguagePicker', () => {
  it('renders one button per supported language', () => {
    render(<LanguagePicker />);
    expect(screen.getAllByRole('button')).toHaveLength(3);
  });

  it('updates settingsStore when a language is chosen', () => {
    render(<LanguagePicker />);
    fireEvent.click(screen.getByRole('button', { name: /অসমীয়া/ }));
    expect(useSettingsStore.getState().language).toBe('as');
  });

  it('marks the active language with aria-pressed', () => {
    render(<LanguagePicker />);
    const en = screen.getByRole('button', { name: /English/ });
    expect(en).toHaveAttribute('aria-pressed', 'true');
  });
});
