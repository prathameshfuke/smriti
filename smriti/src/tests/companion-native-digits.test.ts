import { describe, it, expect } from 'vitest';
import { foldNativeDigits, significantWords } from '@/lib/ai/companion-retrieval';

describe('native digit folding for retrieval', () => {
  it('maps Devanagari and Assamese digits to ASCII', () => {
    expect(foldNativeDigits('मेरी दवा ५००')).toBe('मेरी दवा 500');
    expect(foldNativeDigits('মোৰ ঘৰ ১৯৫০')).toBe('মোৰ ঘৰ 1950');
  });

  it('makes a spoken native-digit year match the stored ASCII one', () => {
    expect(significantWords('जन्म १९५०')).toContain('1950');
    expect(significantWords('জন্ম ১৯৫০')).toContain('1950');
  });
});
