// Fixed names rather than Intl: browsers disagree on short months ("Sep" vs
// "Sept"), and one phone should not read differently from the next.
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function utcDay(isoDate: string): Date {
  return new Date(`${isoDate.slice(0, 10)}T00:00:00Z`);
}

/** `2026-09-12` → `12 Sep`. Day strings are UTC calendar days throughout the dashboard. */
export function formatShortDate(isoDate: string): string {
  const d = utcDay(isoDate);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

/** `2026-09-14` → `Mon 14 Sep`. */
export function formatDayDate(isoDate: string): string {
  return `${WEEKDAYS[utcDay(isoDate).getUTCDay()]} ${formatShortDate(isoDate)}`;
}

/** `16:00` or `16:00:00` → `4 pm`; `08:30` → `8:30 am`. */
export function formatTimeOfDay(time: string): string {
  const [h, m] = time.split(':').map(Number);
  const suffix = h >= 12 ? 'pm' : 'am';
  const hour = h % 12 === 0 ? 12 : h % 12;
  return m ? `${hour}:${String(m).padStart(2, '0')} ${suffix}` : `${hour} ${suffix}`;
}
