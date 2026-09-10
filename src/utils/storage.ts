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
export function sanitizeQuarterBlocks(
  blocks: Block[] | undefined,
  cap: number,
): Block[] {
  if (!blocks || !Array.isArray(blocks) || blocks.length === 0) {
    return [{ id: makeId(), weeks: cap, label: "All weeks" }];
  }
  const valid = blocks
    .filter((b) => b && typeof b.weeks === "number" && b.weeks > 0)
    .map((b) => ({ ...b, id: b.id || makeId(), label: b.label || "All weeks" }));

  if (valid.length === 0) {
    return [{ id: makeId(), weeks: cap, label: "All weeks" }];
  }

  const total = valid.reduce((sum, b) => sum + b.weeks, 0);
  if (total === cap) {
    return valid;
  }

  const diff = cap - total;
  if (diff > 0) {
    // Need more weeks: add the difference to the last block
    const last = valid[valid.length - 1]!;
    valid[valid.length - 1] = { ...last, weeks: last.weeks + diff };
    return valid;
  } else {
    // Need fewer weeks: trim from the end
    let toRemove = -diff;
    const result: Block[] = [];
    for (let i = valid.length - 1; i >= 0; i--) {
      const b = valid[i]!;
      if (toRemove <= 0) {
        result.unshift(b);
      } else if (b.weeks > toRemove) {
        result.unshift({ ...b, weeks: b.weeks - toRemove });
        toRemove = 0;
      } else {
        toRemove -= b.weeks;
      }
    }
    return result.length > 0
      ? result
      : [{ id: makeId(), weeks: cap, label: "All weeks" }];
  }
}

export function loadConfig(year: number): CalendarConfig {
  const q4Cap = gridWeeksForYear(year) - 3 * WEEKS_PER_QUARTER;
  if (typeof window === "undefined") return defaultConfig(q4Cap);
  try {
    const raw = localStorage.getItem(`lifeCalendar:v1:${year}`);
    if (!raw) return defaultConfig(q4Cap);
    const p = withTimestamps(JSON.parse(raw) as CalendarConfig);
    if (!p?.quarters || !Array.isArray(p.quarters)) return defaultConfig(q4Cap);

    let hasChanges = false;
    const quarters: QuarterConfig[] = [0, 1, 2, 3].map((qi) => {
      const cap = qi === 3 ? q4Cap : WEEKS_PER_QUARTER;
      const existing = p.quarters[qi];
      const sanitizedBlocks = sanitizeQuarterBlocks(existing?.blocks, cap);
      if (
        !existing ||
        !existing.blocks ||
        existing.blocks.length !== sanitizedBlocks.length ||
        existing.blocks.some((b, idx) => b.weeks !== sanitizedBlocks[idx]?.weeks)
      ) {
        hasChanges = true;
      }
      return { blocks: sanitizedBlocks };
    });

    const result: CalendarConfig = {
      ...p,
      quarters,
    };
    if (hasChanges) {
      saveConfig(year, result);
    }
    return result;
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

