import type { CalendarConfig, Notes, Milestone } from "./types";
import { makeId, WEEKS_PER_QUARTER } from "./types";

// ── Date utils ────────────────────────────────────────────────────────────────
export function startOfDay(d: Date) { const x = new Date(d); x.setHours(0,0,0,0); return x; }
export function startOfYear(year: number) { return new Date(year, 0, 1); }
export function startOfNextYear(year: number) { return new Date(year + 1, 0, 1); }
export function startOfWeekMonday(d: Date) {
  const x = startOfDay(d);
  const diff = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - diff);
  return x;
}
export function addDays(d: Date, n: number) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
export function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
export function dateKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

// ── localStorage helpers ──────────────────────────────────────────────────────
function ls(k: string): string | null { try { return window.localStorage.getItem(k); } catch { return null; } }
function lsSet(k: string, v: string) { try { window.localStorage.setItem(k, v); } catch {} }

// ── Calendar config ───────────────────────────────────────────────────────────
function defaultQuarterConfig() {
  return { blocks: [{ id: makeId(), weeks: WEEKS_PER_QUARTER, label: "All weeks", goals: [] }] };
}
export function defaultConfig(): CalendarConfig {
  return { quarters: [0,1,2,3].map(() => defaultQuarterConfig()) };
}
export function loadConfig(year: number): CalendarConfig {
  try {
    const raw = ls(`lifeCalendar:v1:${year}`);
    if (!raw) return defaultConfig();
    const parsed = JSON.parse(raw) as CalendarConfig;
    if (!parsed?.quarters || parsed.quarters.length !== 4) return defaultConfig();
    for (const q of parsed.quarters) {
      const sum = q.blocks.reduce((a, b) => a + (b.weeks || 0), 0);
      if (sum !== WEEKS_PER_QUARTER) return defaultConfig();
    }
    for (const q of parsed.quarters) for (const b of q.blocks) if (!b.goals) b.goals = [];
    return parsed;
  } catch { return defaultConfig(); }
}
export function saveConfig(year: number, cfg: CalendarConfig) {
  lsSet(`lifeCalendar:v1:${year}`, JSON.stringify(cfg));
}

// ── Notes ─────────────────────────────────────────────────────────────────────
export function loadNotes(year: number): Notes {
  try { const r = ls(`lifeCalendar:notes:${year}`); return r ? JSON.parse(r) as Notes : {}; } catch { return {}; }
}
export function saveNotes(year: number, notes: Notes) {
  lsSet(`lifeCalendar:notes:${year}`, JSON.stringify(notes));
}

// ── Milestones ────────────────────────────────────────────────────────────────
export function loadMilestones(): Milestone[] {
  try { const r = ls(`lifeCalendar:milestones`); return r ? JSON.parse(r) as Milestone[] : []; } catch { return []; }
}
export function saveMilestones(ms: Milestone[]) {
  lsSet(`lifeCalendar:milestones`, JSON.stringify(ms));
}

// ── Preferences ───────────────────────────────────────────────────────────────
export function loadDarkMode(): boolean { return ls(`lifeCalendar:darkMode`) === "1"; }
export function saveDarkMode(v: boolean) { lsSet(`lifeCalendar:darkMode`, v ? "1" : "0"); }
