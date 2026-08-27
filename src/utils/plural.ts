import type { LifeView } from "../types/calendar";

export function pluralWeeks(
  n: number,
  lang: string,
  t: (k: string) => string,
): string {
  if (lang !== "ru") return `${n} ${n === 1 ? t("week") : t("week2")}`;
  const mod10 = n % 10,
    mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return `${n} ${t("week")}`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20))
    return `${n} ${t("week2")}`;
  return `${n} ${t("week5")}`;
}

/** Returns correct plural form of unit label (years/months/weeks/days) for a count. */
export function pluralUnits(
  n: number,
  view: LifeView,
  lang: string,
  t: (k: string) => string,
): string {
  if (lang !== "ru") {
    if (view === "years") return n === 1 ? t("year1") : t("yearN");
    if (view === "months") return n === 1 ? t("month1") : t("monthN");
    if (view === "weeks") return n === 1 ? t("week") : t("week2");
    return n === 1 ? t("day1") : t("dayN");
  }
  // Standard Russian three-form rule applied to the total count.
  const m10 = n % 10,
    m100 = n % 100;
  const one = m10 === 1 && m100 !== 11;
  const few = m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20);
  if (view === "years") return one ? t("year1") : few ? t("year2") : t("year5");
  if (view === "months")
    return one ? t("month1") : few ? t("month2") : t("month5");
  if (view === "weeks") return one ? t("week") : few ? t("week2") : t("week5");
  return one ? t("day1") : few ? t("day2") : t("day5");
}

export function pluralDayStreak(n: number, lang: string): string {
  if (lang !== "ru") return `${n} day streak`;
  const mod10 = n % 10,
    mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return `${n} день подряд`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20))
    return `${n} дня подряд`;
  return `${n} дней подряд`;
}

/** Generic plural helper: k1=singular, k2=few (ru), k5=many (ru) / kN=plural (en). */
export function pluralCount(
  n: number,
  lang: string,
  t: (k: string) => string,
  k1: string,
  k2: string,
  k5: string,
): string {
  if (lang !== "ru") return `${n} ${n === 1 ? t(k1) : t(k5)}`;
  const m10 = n % 10,
    m100 = n % 100;
  const one = m10 === 1 && m100 !== 11;
  const few = m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20);
  return `${n} ${one ? t(k1) : few ? t(k2) : t(k5)}`;
}

