import type {
  QuarterConfig,
  CalendarConfig,
  Block,
  Goal,
  BlockGoals,
  Milestone,
  NoteEntry,
  DayTemplate,
  DayGoals,
  LifeSettings,
  TimestampFields,
} from "../types/calendar";
import { gridWeeksForYear } from "./date-utils";
import { WEEKS_PER_QUARTER } from "../constants/i18n";

export function ls<T>(key: string, fb: T): T {
  if (typeof window === "undefined") return fb;
  try {
    const r = localStorage.getItem(key);
    return r ? (JSON.parse(r) as T) : fb;
  } catch {
    return fb;
  }
}
export function lsSet(key: string, v: unknown) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(v));
  } catch {}
}


export function makeId() {
  return Math.random().toString(36).slice(2, 10);
}

export function validTimestamp(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : fallback;
}

export function withTimestamps<T extends TimestampFields>(
  value: T,
  fallback = Date.now(),
): T & Required<TimestampFields> {
  const updatedAt = validTimestamp(
    value.updatedAt,
    validTimestamp(value.createdAt, fallback),
  );
  const createdAt = validTimestamp(value.createdAt, updatedAt);
  return { ...value, createdAt, updatedAt };
}

export function newTimestamps(): Required<TimestampFields> {
  const timestamp = Date.now();
  return { createdAt: timestamp, updatedAt: timestamp };
}

export function normalizeGoals(goals: Goal[], fallback: number): Goal[] {
  return goals.map((goal) => ({
    ...withTimestamps(goal, fallback),
    isDeleted: goal.isDeleted ?? false,
  }));
}

export function normalizeBlockGoals(value: BlockGoals, fallback: number): BlockGoals {
  const stamped = withTimestamps(value, fallback);
  return {
    ...stamped,
    isDeleted: value.isDeleted ?? false,
    goals: normalizeGoals(value.goals ?? [], fallback),
  };
}

export function normalizeMilestone(
  value: Milestone,
  fallback: number,
): Milestone & Required<TimestampFields> {
  return withTimestamps(value, fallback);
}

export function normalizeNote(
  value: NoteEntry,
  fallback: number,
): NoteEntry & Required<TimestampFields> {
  return withTimestamps(value, fallback);
}

export function normalizeDayTemplate(
  value: DayTemplate,
  fallback: number,
): DayTemplate & Required<TimestampFields> {
  return withTimestamps(value, fallback);
}

export function normalizeDayGoals(
  value: DayGoals,
  fallback: number,
): DayGoals & Required<TimestampFields> {
  return {
    ...withTimestamps(value, fallback),
    isDeleted: value.isDeleted ?? false,
  };
}

export function normalizeLifeSettings(
  value: LifeSettings,
  fallback: number,
): LifeSettings & Required<TimestampFields> {
  return withTimestamps(value, fallback);
}

export function updateBlockGoals(
  previous: BlockGoals | undefined,
  next: BlockGoals,
): BlockGoals {
  const changedAt = Date.now();
  const prior = previous ? normalizeBlockGoals(previous, changedAt) : undefined;
  const base = normalizeBlockGoals(next, changedAt);
  const previousById = new Map<string, Goal>(
    (prior?.goals ?? []).map((goal) => [goal.id, goal]),
  );
  const incomingIds = new Set(base.goals.map((goal) => goal.id));
  const removed = (prior?.goals ?? [])
    .filter((goal) => !incomingIds.has(goal.id) && !goal.isDeleted)
    .map((goal) => ({ ...goal, updatedAt: changedAt, isDeleted: true }));
  const existingTombstones = (prior?.goals ?? []).filter(
    (goal) => !incomingIds.has(goal.id) && goal.isDeleted,
  );
  return {
    ...base,
    isDeleted: false,
    createdAt: prior?.createdAt ?? base.createdAt,
    updatedAt: changedAt,
    goals: [
      ...base.goals.map((goal) => {
        const old = previousById.get(goal.id);
        const changed =
          !old ||
          old.text !== goal.text ||
          old.done !== goal.done ||
          old.color !== goal.color ||
          old.isDeleted !== goal.isDeleted;
        return {
          ...goal,
          createdAt: old?.createdAt ?? goal.createdAt,
          updatedAt: changed ? changedAt : (old?.updatedAt ?? changedAt),
          isDeleted: goal.isDeleted ?? false,
        };
      }),
      ...removed,
      ...existingTombstones,
    ],
  };
}

// Reorders the subset of `list` whose id is in `orderedIds` into that new
// relative order, while leaving every other item's position untouched.
// Matching by id (not by any grouping key) keeps this safe for lists like
// milestones where a rendered day's items can be synthetic recurring copies
// that share an id with a differently-dated original.
export function reorderByIds<T extends { id: string }>(
  list: T[],
  orderedIds: string[],
): T[] {
  const byId = new Map(list.map((item) => [item.id, item]));
  const targetSlots: number[] = [];
  list.forEach((item, i) => {
    if (byId.has(item.id) && orderedIds.includes(item.id)) targetSlots.push(i);
  });
  const reordered = orderedIds
    .map((id) => byId.get(id))
    .filter((x): x is T => x !== undefined);
  const next = [...list];
  targetSlots.forEach((pos, i) => {
    if (reordered[i]) next[pos] = reordered[i]!;
  });
  return next;
}

export function defaultBlock(): Block {
  return { id: makeId(), weeks: WEEKS_PER_QUARTER, label: "All weeks" };
}

/** Returns correct plural form of "week/неделя" for a given count and language. */

export function createSprintFromSelection(
  qConfig: QuarterConfig,
  selStart: number,
  selEnd: number,
  sprintLabel: string,
): QuarterConfig {
  const selEndExcl = selEnd + 1;
  const newBlocks: Block[] = [];
  let cursor = 0;
  let sprintAdded = false;
  for (const block of qConfig.blocks) {
    const bStart = cursor;
    const bEnd = cursor + block.weeks;
    cursor = bEnd;
    if (bEnd <= selStart || bStart >= selEndExcl) {
      newBlocks.push(block);
    } else {
      const beforeWeeks = selStart - bStart;
      if (beforeWeeks > 0)
        newBlocks.push({
          id: makeId(),
          weeks: beforeWeeks,
          label: block.label,
        });
      if (!sprintAdded) {
        newBlocks.push({
          id: makeId(),
          weeks: selEndExcl - selStart,
          label: sprintLabel,
        });
        sprintAdded = true;
      }
      const afterWeeks = bEnd - selEndExcl;
      if (afterWeeks > 0)
        newBlocks.push({ id: makeId(), weeks: afterWeeks, label: block.label });
    }
  }
  return { blocks: newBlocks };
}
export function defaultConfig(q4Cap = WEEKS_PER_QUARTER): CalendarConfig {
  return {
    ...newTimestamps(),
    quarters: [0, 1, 2, 3].map((qi) => ({
      blocks: [
        {
          id: makeId(),
          weeks: qi === 3 ? q4Cap : WEEKS_PER_QUARTER,
          label: "All weeks",
        },
      ],
    })),
  };
}
export function loadConfig(year: number): CalendarConfig {
  const q4Cap = gridWeeksForYear(year) - 3 * WEEKS_PER_QUARTER;
  if (typeof window === "undefined") return defaultConfig(q4Cap);
  try {
    const raw = localStorage.getItem(`lifeCalendar:v1:${year}`);
    if (!raw) return defaultConfig(q4Cap);
    const p = withTimestamps(JSON.parse(raw) as CalendarConfig);
    if (!p?.quarters || p.quarters.length !== 4) return defaultConfig(q4Cap);
    for (let qi = 0; qi < 4; qi++) {
      const cap = qi === 3 ? q4Cap : WEEKS_PER_QUARTER;
      if (
        p.quarters[qi]!.blocks.reduce((a, b) => a + (b.weeks || 0), 0) !== cap
      )
        return defaultConfig(q4Cap);
    }
    return p;
  } catch {
    return defaultConfig(q4Cap);
  }
}
export function saveConfig(year: number, cfg: CalendarConfig) {
  try {
    localStorage.setItem(
      `lifeCalendar:v1:${year}`,
      JSON.stringify(withTimestamps(cfg)),
    );
  } catch {}
}
export const normalizeNoteEntry = normalizeNote;

