import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/caregiver/dashboard',
}));

import BigButton from '@/components/ui/BigButton';
import TrafficLight from '@/components/ui/TrafficLight';
import ProgressRing from '@/components/ui/ProgressRing';
import SyncIndicator from '@/components/ui/SyncIndicator';
import GameTile from '@/components/ui/GameTile';
import Skeleton from '@/components/ui/Skeleton';
import AudioPrompt from '@/components/ui/AudioPrompt';
import ScoreGraph from '@/components/ui/ScoreGraph';
import LanguagePicker from '@/components/layout/LanguagePicker';
import { LANGUAGES } from '@/lib/i18n/languages';
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
    expect(screen.getAllByRole('button')).toHaveLength(LANGUAGES.length);
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
  it('renders an at-least-64px top bar with the screen title', () => {
    const { container } = render(<PatientNav title="Reminders" />);
    const bar = container.firstChild as HTMLElement;
    // A minimum, not a fixed height: at Large text the title wraps and the
    // bar grows instead of the title overlapping the Back button.
    expect(Number.parseInt(bar.style.minHeight, 10)).toBe(64);
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
    const names = screen.getAllByRole('link').map((link) => link.textContent);
    // Full labels, matching CaregiverRail's desktop wording — no shortened
    // "Memory", no "Dashboard" (the page itself is titled "Overview").
    expect(names).toEqual(['Overview', 'Patients', 'Memory Bank', 'Settings', 'Patient View']);
  });

  it('never clips a label: labels wrap between words instead of truncating', () => {
    render(<CaregiverNav />);
    for (const link of screen.getAllByRole('link')) {
      const label = link.querySelector('span');
      expect(label?.className).not.toMatch(/\b(truncate|whitespace-nowrap|overflow-hidden)\b/);
    }
  });

  it('tabs run edge to edge so each one gets a full fifth of the width', () => {
    render(<CaregiverNav />);
    const nav = screen.getByRole('navigation', { name: 'Caregiver' });
    expect(nav.className).not.toMatch(/(^|\s)(gap|px)-/);
    for (const link of screen.getAllByRole('link')) {
      expect(link.className).toMatch(/\bflex-1\b/);
      expect(link.className).toMatch(/\bbasis-0\b/);
    }
  });

  it('sizes height and bottom padding from the shared safe-area variables', () => {
    render(<CaregiverNav />);
    // Classes, not inline style: jsdom drops env() in inline styles, and a
    // fixed height with the inset padded *inside* it used to leave ~29px of
    // tap height on notched iPhones.
    const nav = screen.getByRole('navigation', { name: 'Caregiver' });
    expect(nav.className).toMatch(/(^|\s)h-\(--caregiver-nav-h\)(\s|$)/);
    expect(nav.className).toMatch(/(^|\s)pb-\(--caregiver-nav-pad\)(\s|$)/);
  });

  it('overlaps the home-indicator zone instead of stacking the full inset under the labels', () => {
    const css = readFileSync(resolve(__dirname, '../app/globals.css'), 'utf8');
    // Full inset (34px on iPhone) under a 64px bar read as a tall blank strip.
    expect(css).toMatch(/--caregiver-nav-pad:\s*max\(calc\(env\(safe-area-inset-bottom\) - 14px\), 4px\)/);
    // 56px at default sizes (9.6 + 20 + 26.4), scaled by the text/icon size settings.
    expect(css).toMatch(
      /--caregiver-nav-h:\s*calc\(9\.6px \+ 20px \* var\(--icon-scale\) \+ 1\.65rem \+ var\(--caregiver-nav-pad\)\)/,
    );
  });
});

describe('Icon', () => {
  it('defaults to a 2.5 stroke and stays decorative', async () => {
    const { default: Icon } = await import('@/components/Icon');
    const { Heart } = await import('lucide-react');
    const { container } = render(<Icon icon={Heart} size={24} />);
    const svg = container.querySelector('svg')!;
    expect(svg.getAttribute('stroke-width')).toBe('2.5');
    expect(svg.getAttribute('aria-hidden')).toBe('true');
    expect(svg.getAttribute('width')).toBe('24');
  });

  it('lets a caller override the stroke and label a standalone icon', async () => {
    const { default: Icon } = await import('@/components/Icon');
    const { Settings } = await import('lucide-react');
    render(<Icon icon={Settings} strokeWidth={2} aria-label="Settings" />);
    const svg = screen.getByRole('img', { name: 'Settings' });
    expect(svg.getAttribute('stroke-width')).toBe('2');
    expect(svg.getAttribute('aria-hidden')).toBeNull();
  });
});
