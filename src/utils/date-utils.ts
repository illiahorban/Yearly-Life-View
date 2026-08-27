// ─── Date helpers ─────────────────────────────────────────────────────────────
export function dateKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export const _JUMP_EN_FULL = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
];
export const _JUMP_EN_SHORT = [
  "jan",
  "feb",
  "mar",
  "apr",
  "may",
  "jun",
  "jul",
  "aug",
  "sep",
  "oct",
  "nov",
  "dec",
];
export const _JUMP_RU_FULL = [
  "январь",
  "февраль",
  "март",
  "апрель",
  "май",
  "июнь",
  "июль",
  "август",
  "сентябрь",
  "октябрь",
  "ноябрь",
  "декабрь",
];
export const _JUMP_RU_GEN = [
  "января",
  "февраля",
  "марта",
  "апреля",
  "мая",
  "июня",
  "июля",
  "августа",
  "сентября",
  "октября",
  "ноября",
  "декабря",
];
export const _JUMP_RU_SHORT = [
  "янв",
  "фев",
  "мар",
  "апр",
  "май",
  "июн",
  "июл",
  "авг",
  "сен",
  "окт",
  "ноя",
  "дек",
];
export function _jumpFindMonth(name: string): number {
  const n = name.toLowerCase();
  for (let i = 0; i < 12; i++) {
    if (
      _JUMP_EN_FULL[i] === n ||
      _JUMP_EN_SHORT[i] === n ||
      _JUMP_RU_FULL[i] === n ||
      _JUMP_RU_GEN[i] === n ||
      _JUMP_RU_SHORT[i] === n
    )
      return i;
  }
  return -1;
}
export function parseDateQuery(s: string): Date | null {
  const q = s.trim();
  if (q.length < 3) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(q)) {
    const d = new Date(q + "T00:00:00");
    return isNaN(d.getTime()) ? null : d;
  }
  const numMatch = q.match(/^(\d{1,2})[./](\d{1,2})(?:[./](\d{2,4}))?$/);
  if (numMatch) {
    const day = parseInt(numMatch[1]),
      month = parseInt(numMatch[2]) - 1;
    let year = new Date().getFullYear();
    if (numMatch[3])
      year =
        numMatch[3].length === 2
          ? 2000 + parseInt(numMatch[3])
          : parseInt(numMatch[3]);
    if (month < 0 || month > 11 || day < 1 || day > 31) return null;
    const d = new Date(year, month, day);
    return d.getDate() === day && d.getMonth() === month ? d : null;
  }
  const lower = q.toLowerCase();
  const dmY = lower.match(/^(\d{1,2})\s+([a-zа-яё]+)(?:[,\s]+(\d{4}))?$/);
  if (dmY) {
    const day = parseInt(dmY[1]),
      mi = _jumpFindMonth(dmY[2]),
      year = dmY[3] ? parseInt(dmY[3]) : new Date().getFullYear();
    if (mi === -1 || day < 1 || day > 31) return null;
    const d = new Date(year, mi, day);
    return d.getDate() === day && d.getMonth() === mi ? d : null;
  }
  const mdY = lower.match(/^([a-zа-яё]+)\s+(\d{1,2})(?:[,\s]+(\d{4}))?$/);
  if (mdY) {
    const mi = _jumpFindMonth(mdY[1]),
      day = parseInt(mdY[2]),
      year = mdY[3] ? parseInt(mdY[3]) : new Date().getFullYear();
    if (mi === -1 || day < 1 || day > 31) return null;
    const d = new Date(year, mi, day);
    return d.getDate() === day && d.getMonth() === mi ? d : null;
  }
  return null;
}
export function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
export function startOfYear(y: number) {
  return new Date(y, 0, 1);
}
export function startOfNextYear(y: number) {
  return new Date(y + 1, 0, 1);
}
export function startOfWeekMonday(d: Date) {
  const x = startOfDay(d);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
}
export function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
export function sameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}
export function daysBetween(a: Date, b: Date) {
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}
export function monthsBetween(a: Date, b: Date) {
  let months =
    (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
  if (b.getDate() < a.getDate()) months -= 1;
  return Math.max(0, months);
}
export function addYears(d: Date, years: number) {
  const x = new Date(d);
  const month = x.getMonth();
  x.setFullYear(x.getFullYear() + years);
  // Keep leap-day birthdays on the last valid day of February.
  if (x.getMonth() !== month) x.setDate(0);
  return x;
}
/** Number of grid weeks needed to cover the full calendar year.
 *  The grid starts on the Monday of the week containing Jan 1 and must
 *  reach at least the Sunday of the week containing Dec 31 — mirroring
 *  how Q1's first week already shows a few days from the previous year.
 *  Result is 52 for most years, 53 for years whose Dec 31 falls after
 *  week 52 ends (e.g. 2015, 2020, 2026, 2032). */
export function dayOfYear(d: Date): number {
  return Math.round(
    (d.getTime() - new Date(d.getFullYear(), 0, 0).getTime()) / 86_400_000,
  );
}

export function gridWeeksForYear(year: number): number {
  const gridStart = startOfWeekMonday(startOfYear(year));
  const dec31 = new Date(year, 11, 31);
  return Math.ceil((daysBetween(gridStart, dec31) + 1) / 7);
}

