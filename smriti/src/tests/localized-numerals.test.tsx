import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { localizeDigits } from '@/lib/i18n/numerals';
import GameComponent from '@/components/games/larger-number/GameComponent';
import { LARGER_NUMBER_MESSAGES } from '@/components/games/larger-number/messages';

describe('localizeDigits', () => {
  it('writes Bengali-script digits for Assamese, Bengali and Manipuri', () => {
    expect(localizeDigits(1234567890, 'as')).toBe('১২৩৪৫৬৭৮৯০');
    expect(localizeDigits(42, 'bn')).toBe('৪২');
    expect(localizeDigits(42, 'mni')).toBe('৪২');
  });

  it('writes Devanagari digits for Hindi, Nepali and Bodo', () => {
    expect(localizeDigits(1234567890, 'hi')).toBe('१२३४५६७८९०');
    expect(localizeDigits(42, 'ne')).toBe('४२');
    expect(localizeDigits(42, 'brx')).toBe('४२');
  });

  it('leaves English and any non-digit characters alone', () => {
    expect(localizeDigits(42, 'en')).toBe('42');
    expect(localizeDigits('80%', 'as')).toBe('৮০%');
  });
});

describe('Larger Number numerals', () => {
  it('shows the level and challenge numbers in the app language', () => {
    render(
      <NextIntlClientProvider locale="as" messages={LARGER_NUMBER_MESSAGES.as}>
        <GameComponent />
      </NextIntlClientProvider>,
    );
    const text = document.body.textContent ?? '';
    expect(text).toMatch(/[০-৯]/);
    expect(text).not.toMatch(/[0-9]/);
    expect(screen.getByRole('button', { name: /./ })).toBeInTheDocument();
  });

  it('keeps 0-9 in English', () => {
    render(
      <NextIntlClientProvider locale="en" messages={LARGER_NUMBER_MESSAGES.en}>
        <GameComponent />
      </NextIntlClientProvider>,
    );
    expect(document.body.textContent).toMatch(/[0-9]/);
  });
});
