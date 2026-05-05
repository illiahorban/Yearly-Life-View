export const WEEKS_PER_QUARTER = 13;
export const TOTAL_WEEKS = 52;
export const MONTHS = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];
export const WEEKDAYS = ["M","T","W","T","F","S","S"];

export type Quarter = { label: string; tint: string; border: string; text: string; soft: string };

export const QUARTERS: Quarter[] = [
  { label: "Q1", tint: "rgba(0,122,255,0.045)",  border: "#0a84ff", text: "#0a84ff", soft: "rgba(10,132,255,0.18)" },
  { label: "Q2", tint: "rgba(52,199,89,0.05)",   border: "#34c759", text: "#28a745", soft: "rgba(52,199,89,0.20)" },
  { label: "Q3", tint: "rgba(255,204,0,0.07)",   border: "#ffcc00", text: "#b58900", soft: "rgba(255,204,0,0.28)" },
  { label: "Q4", tint: "rgba(255,149,0,0.06)",   border: "#ff9500", text: "#c2410c", soft: "rgba(255,149,0,0.22)" },
];

export type Goal        = { id: string; text: string; done: boolean };
export type Block       = { id: string; weeks: number; label: string; goals: Goal[] };
export type QuarterConfig = { blocks: Block[] };
export type CalendarConfig = { quarters: QuarterConfig[] };

export type DayNote = { text: string; emoji: string };
export type Notes   = Record<string, DayNote>;

export type Milestone = { id: string; date: string; label: string; emoji: string; color: string };

export type DayState = "past" | "today" | "future" | "out";
export type AppView  = "year" | "lifetime";

export function makeId() { return Math.random().toString(36).slice(2, 10); }
