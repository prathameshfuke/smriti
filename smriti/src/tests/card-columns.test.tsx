import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import CardColumns from '@/components/ui/CardColumns';

describe('CardColumns', () => {
  it('keeps children in DOM order, so the phone stack reads the same as before', () => {
    render(
      <CardColumns>
        <section>One</section>
        <section>Two</section>
        <section>Three</section>
      </CardColumns>,
    );
    expect(screen.getAllByText(/One|Two|Three/).map((el) => el.textContent)).toEqual(['One', 'Two', 'Three']);
  });

  it('is a single-column grid on phones and balanced multi-column from lg', () => {
    const { container } = render(
      <CardColumns>
        <section>One</section>
      </CardColumns>,
    );
    const root = container.firstElementChild as HTMLElement;
    expect(root.className).toContain('grid-cols-1');
    expect(root.className).toContain('lg:columns-2');
    expect(root.className).toContain('lg:[&>*]:break-inside-avoid');
  });
});
