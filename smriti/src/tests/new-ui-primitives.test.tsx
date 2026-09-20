import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ScoreRing from '@/components/ui/ScoreRing';
import StreakFlame from '@/components/ui/StreakFlame';
import WeekActivity from '@/components/caregiver/WeekActivity';
import PinDots from '@/components/ui/PinDots';

describe('ScoreRing', () => {
  it('shows the rounded value inside the ring and an accessible label', () => {
    render(<ScoreRing value={71.6} label="Cognitive score 72 out of 100" />);
    expect(screen.getByText('72')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Cognitive score 72 out of 100' })).toBeInTheDocument();
  });

  it('draws no arc and shows a dash when there is no score yet', () => {
    const { container } = render(<ScoreRing value={null} label="No cognitive score yet" />);
    expect(screen.getByText('–')).toBeInTheDocument();
    // Only the empty background track circle, no filled arc.
    expect(container.querySelectorAll('circle')).toHaveLength(1);
  });

  it('lets a caller override the centre content, e.g. a percentage sign', () => {
    render(
      <ScoreRing value={84} label="84% of reminders acknowledged this week">
        {'84%'}
      </ScoreRing>,
    );
    expect(screen.getByText('84%')).toBeInTheDocument();
  });
});

describe('StreakFlame', () => {
  it('fills the flame when the streak is active', () => {
    const { container } = render(<StreakFlame active />);
    const outer = container.querySelector('path');
    expect(outer?.getAttribute('fill')).toBe('#D97706');
    expect(container.querySelectorAll('path')).toHaveLength(2);
  });

  it('draws only a grey outline with no streak', () => {
    const { container } = render(<StreakFlame active={false} />);
    const outer = container.querySelector('path');
    expect(outer?.getAttribute('fill')).toBe('none');
    expect(container.querySelectorAll('path')).toHaveLength(1);
  });

  it('is decorative — never the only way to know the streak count', () => {
    const { container } = render(<StreakFlame active />);
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });
});

describe('WeekActivity', () => {
  const days = [60, 72, null, 81, 55, 68, 52];

  it('summarises played days and average accuracy for screen readers', () => {
    render(<WeekActivity days={days} />);
    // (60+72+81+55+68+52)/6 = 64.67 -> rounds to 65. The wording names the
    // aggregation (a mean of the daily figures) so it cannot be read as the
    // cognitive score's rounds-weighted 14-day accuracy.
    expect(
      screen.getByRole('img', { name: /played on 6 of the last 7 days, 65% average of those days' accuracy/i }),
    ).toBeInTheDocument();
  });

  it('says plainly when nothing was played', () => {
    render(<WeekActivity days={[null, null, null, null, null, null, null]} />);
    expect(screen.getByRole('img', { name: /no games played in the last 7 days/i })).toBeInTheDocument();
  });

  it('full variant labels today and shows a weekday per day', () => {
    render(
      <WeekActivity
        variant="full"
        days={days}
        dates={['2026-09-08', '2026-09-09', '2026-09-10', '2026-09-11', '2026-09-12', '2026-09-13', '2026-09-14']}
      />,
    );
    expect(screen.getByText('Today')).toBeInTheDocument();
    expect(screen.getByText('Tue')).toBeInTheDocument();
  });
});

describe('PinDots', () => {
  it('fills exactly as many dots as digits entered, out of the given length', () => {
    const { container } = render(<PinDots filled={2} length={4} />);
    const dots = container.querySelectorAll('span > span, span');
    // The wrapper plus 4 dot spans; count the filled ones by class instead of position.
    expect(container.querySelectorAll('.bg-primary')).toHaveLength(2);
    expect(dots.length).toBeGreaterThanOrEqual(4);
  });

  it('is hidden from assistive tech — each PinPad key already announces itself', () => {
    const { container } = render(<PinDots filled={1} />);
    expect(container.firstChild).toHaveAttribute('aria-hidden', 'true');
  });
});
