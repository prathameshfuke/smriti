import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import BigButton from '@/components/ui/BigButton';
import TrafficLight from '@/components/ui/TrafficLight';
import ProgressRing from '@/components/ui/ProgressRing';
import SyncIndicator from '@/components/ui/SyncIndicator';
import GameTile from '@/components/ui/GameTile';
import Skeleton from '@/components/ui/Skeleton';
import AudioPrompt from '@/components/ui/AudioPrompt';
import ScoreGraph from '@/components/ui/ScoreGraph';
import LanguagePicker from '@/components/layout/LanguagePicker';
import PatientNav from '@/components/layout/PatientNav';
import CaregiverNav from '@/components/layout/CaregiverNav';
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

  it('meets the 72px minimum touch target', () => {
    render(<BigButton label="Start" />);
    const btn = screen.getByRole('button');
    expect(Number.parseInt(btn.style.minHeight, 10)).toBeGreaterThanOrEqual(72);
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

  it('applies the success background for the success variant', () => {
    render(<BigButton label="Correct" variant="success" />);
    const cls = screen.getByRole('button').className;
    expect(cls).toContain('bg-success');
    expect(cls).not.toContain('bg-primary');
  });

  it('does not apply the primary background for the secondary variant', () => {
    render(<BigButton label="Go" variant="secondary" />);
    expect(screen.getByRole('button').className).not.toContain('bg-primary');
  });

  it('presses down on tap and still shows a focus ring for keyboard users', () => {
    // The scale animation fires on pointer-down; focus-visible fires on
    // keyboard and switch navigation. Different users, both required.
    render(<BigButton label="Go" />);
    const cls = screen.getByRole('button').className;
    expect(cls).toContain('active:scale-');
    expect(cls).toContain('focus-visible:');
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

  it('carries a Status: aria-label', () => {
    render(<TrafficLight status="red" />);
    expect(screen.getByRole('img')).toHaveAttribute('aria-label', 'Status: red');
  });

  it('marks status with a glyph too, not colour alone', () => {
    // WCAG 1.4.1: colour-vision deficiency must not hide triage state.
    const { container } = render(<TrafficLight status="red" />);
    expect(container.textContent).not.toBe('');
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

  it.each([
    ['sm', 60],
    ['md', 80],
    ['lg', 120],
  ] as const)('renders size %s at %ipx', (size, px) => {
    const { container } = render(<ProgressRing value={10} size={size} />);
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
    expect(svg?.getAttribute('width')).toBe(String(px));
  });

  it('animates the arc on mount', () => {
    const { container } = render(<ProgressRing value={80} />);
    const arc = container.querySelectorAll('circle')[1];
    expect(arc.getAttribute('class')).toContain('animate-ring-fill');
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

  it('is pinned bottom-right as a pill', () => {
    const { container } = render(<SyncIndicator status="synced" />);
    const cls = (container.firstChild as HTMLElement).className;
    expect(cls).toContain('fixed');
    expect(cls).toContain('bottom-4');
    expect(cls).toContain('right-4');
    expect(cls).toContain('rounded-full');
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

  it('renders an illustration when one is given', () => {
    render(
      <GameTile gameName="Kotha Khoj" href="/g" illustrationSrc="/images/games/hunt.png" />,
    );
    expect(screen.getByRole('presentation')).toHaveAttribute(
      'src',
      '/images/games/hunt.png',
    );
  });

  it('shows one filled dot per difficulty level', () => {
    const { container } = render(
      <GameTile gameName="Beg Beg" href="/g" difficultyLevel={2} />,
    );
    expect(container.querySelectorAll('[data-difficulty-dot="on"]')).toHaveLength(2);
  });

  it('acts as a button when given onClick instead of href', () => {
    const onClick = vi.fn();
    render(<GameTile gameName="Beg Beg" onClick={onClick} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('meets the 72px minimum touch target', () => {
    render(<GameTile gameName="Beg Beg" href="/games/quick-tap" />);
    expect(
      Number.parseInt(screen.getByRole('link').style.minHeight, 10),
    ).toBeGreaterThanOrEqual(72);
  });
});

describe('AudioPrompt', () => {
  it('renders its children and adds no visible chrome of its own', () => {
    const { container } = render(
      <AudioPrompt src="/audio/en/greeting.mp3">
        <p>Tap the cow</p>
      </AudioPrompt>,
    );
    expect(screen.getByText('Tap the cow')).toBeInTheDocument();
    expect(container.querySelector('button')).toBeNull();
  });

  it('fires onComplete when playback ends', () => {
    const onComplete = vi.fn();
    render(
      <AudioPrompt src="/audio/en/greeting.mp3" onComplete={onComplete}>
        <p>Tap the cow</p>
      </AudioPrompt>,
    );
    const audio = document.querySelector('audio') as HTMLAudioElement;
    fireEvent.ended(audio);
    expect(onComplete).toHaveBeenCalledTimes(1);
  });
});

describe('ScoreGraph', () => {
  const data = [
    { date: '2026-08-01', accuracy: 80, gameType: 'object_hunt' as const },
    { date: '2026-08-02', accuracy: 60, gameType: 'object_hunt' as const },
  ];

  it('renders range tabs', () => {
    render(<ScoreGraph data={data} />);
    expect(screen.getByRole('button', { name: '7d' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '30d' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '90d' })).toBeInTheDocument();
  });

  it('flags a drop of more than 15 points', () => {
    render(<ScoreGraph data={data} />);
    expect(screen.getByText(/drop/i)).toBeInTheDocument();
  });

  it('says so when there is nothing to plot', () => {
    render(<ScoreGraph data={[]} />);
    expect(screen.getByText(/no sessions/i)).toBeInTheDocument();
  });
});

describe('Skeleton', () => {
  it('renders a pulsing placeholder', () => {
    const { container } = render(<Skeleton />);
    const el = container.firstChild as HTMLElement;
    expect(el.tagName).toBe('DIV');
    expect(el.className).toContain('animate-pulse');
  });

  it('accepts width and height', () => {
    const { container } = render(<Skeleton width="50%" height={40} />);
    const el = container.firstChild as HTMLElement;
    expect(el.style.width).toBe('50%');
    expect(el.style.height).toBe('40px');
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

  it('meets the 56px minimum touch target', () => {
    render(<LanguagePicker />);
    for (const btn of screen.getAllByRole('button')) {
      expect(Number.parseInt(btn.style.minHeight, 10)).toBeGreaterThanOrEqual(56);
    }
  });

  it('marks the active language with aria-pressed', () => {
    render(<LanguagePicker />);
    expect(screen.getByRole('button', { name: /English/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });
});

describe('PatientNav', () => {
  it('renders a 64px top bar with the screen title', () => {
    const { container } = render(<PatientNav title="Reminders" />);
    const bar = container.firstChild as HTMLElement;
    expect(Number.parseInt(bar.style.height, 10)).toBe(64);
    expect(screen.getByText('Reminders')).toBeInTheDocument();
  });

  it('shows a back button when onBack is given', () => {
    const onBack = vi.fn();
    render(<PatientNav title="Reminders" onBack={onBack} />);
    fireEvent.click(screen.getByRole('button', { name: /back/i }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('omits the back button on the home screen', () => {
    render(<PatientNav title="SMRITI" />);
    expect(screen.queryByRole('button', { name: /back/i })).toBeNull();
  });
});

describe('CaregiverNav', () => {
  it('renders the caregiver destinations', () => {
    render(<CaregiverNav />);
    expect(screen.getByRole('link', { name: /dashboard/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /patients/i })).toBeInTheDocument();
  });
});
