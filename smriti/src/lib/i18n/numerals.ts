import type { UILanguage } from './languages';

/**
 * Native digits per UI language. Assamese, Bengali and Manipuri (written in
 * Bengali script in this app) use Bengali-Assamese digits; Hindi, Nepali and
 * Bodo use Devanagari digits; English keeps 0-9.
 *
 * A fixed table rather than Intl.NumberFormat: CLDR's defaults disagree with
 * what a patient reads (hi defaults to Latin digits, mni/brx are not in ICU
 * at all), and older Android WebViews ship trimmed ICU data offline.
 */
const BENGALI_DIGITS = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
const DEVANAGARI_DIGITS = ['०', '१', '२', '३', '४', '५', '६', '७', '८', '९'];

const DIGITS: Record<UILanguage, readonly string[] | null> = {
  en: null,
  as: BENGALI_DIGITS,
  bn: BENGALI_DIGITS,
  mni: BENGALI_DIGITS,
  hi: DEVANAGARI_DIGITS,
  ne: DEVANAGARI_DIGITS,
  brx: DEVANAGARI_DIGITS,
};

/** Rewrites every ASCII digit in `value` into `language`'s own digits. */
export function localizeDigits(value: number | string, language: UILanguage): string {
  const text = String(value);
  const digits = DIGITS[language];
  return digits ? text.replace(/[0-9]/g, (d) => digits[Number(d)]) : text;
}
