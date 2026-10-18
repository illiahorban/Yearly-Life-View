// ─── Merge Engine ─────────────────────────────────────────────────────────────
// Last-write-wins merge by `updatedAt`, falling back to `createdAt`.
// Items that exist on only one side are always kept.
// `isDeleted` items are propagated (not filtered here — filtering is in the UI).

import type {
  AppSnapshot,
  SyncMilestone,
  SyncNoteEntry,
  SyncDayTemplate,
  SyncBlockGoals,
  SyncDayGoals,
  SyncLifeSettings,
  SyncQuarterMeta,
  SyncCalendarConfig,
} from "./sync-types";
import { emptySnapshot } from "./sync-types";

// ── Helpers ───────────────────────────────────────────────────────────────────

function timestampOf(value: {
  updatedAt?: unknown;
  createdAt?: unknown;
}): number {
  const updatedAt =
    typeof value.updatedAt === "number" && Number.isFinite(value.updatedAt)
      ? value.updatedAt
      : 0;
  const createdAt =
    typeof value.createdAt === "number" && Number.isFinite(value.createdAt)
      ? value.createdAt
      : 0;
  return Math.max(updatedAt, createdAt);
}

function newer<
  T extends { updatedAt?: number; createdAt?: number; isDeleted?: boolean },
>(a: T, b: T): T {
  const aTimestamp = timestampOf(a);
  const bTimestamp = timestampOf(b);
  if (aTimestamp !== bTimestamp) return aTimestamp > bTimestamp ? a : b;
  // On an exact timestamp tie, deletion wins. This protects a tombstone from
  // an older active copy that was created in the same millisecond.
  if (a.isDeleted !== b.isDeleted) return a.isDeleted ? a : b;
  return a;
}

/** Merge two arrays of items identified by `id`. Winner = higher updatedAt. */
function mergeById<
  T extends {
    id: string;
    updatedAt?: number;
    createdAt?: number;
    isDeleted: boolean;
  },
>(local: T[], remote: T[]): T[] {
  const map = new Map<string, T>();
  for (const item of local) map.set(item.id, item);
  for (const item of remote) {
    const existing = map.get(item.id);
    map.set(item.id, existing ? newer(existing, item) : item);
  }
  return Array.from(map.values());
}

/** Merge two Records where each value has an `updatedAt`. */
function mergeRecord<T extends { updatedAt?: number; createdAt?: number }>(
  local: Record<string, T>,
  remote: Record<string, T>,
): Record<string, T> {
  const merged: Record<string, T> = { ...local };
  for (const [key, remoteVal] of Object.entries(remote)) {
    const localVal = merged[key];
    merged[key] = localVal ? newer(localVal, remoteVal) : remoteVal;
  }
  return merged;
}

/** Merge goal collections independently so deleting one goal cannot be
 * resurrected by a newer edit to a different goal in the same block. */
function mergeBlockGoals(
  local: Record<string, SyncBlockGoals>,
  remote: Record<string, SyncBlockGoals>,
): Record<string, SyncBlockGoals> {
  const merged: Record<string, SyncBlockGoals> = {};
  const allKeys = new Set([...Object.keys(local), ...Object.keys(remote)]);
  for (const key of allKeys) {
    const localBlock = local[key];
    const remoteBlock = remote[key];
    if (!localBlock) {
      merged[key] = remoteBlock!;
      continue;
    }
    if (!remoteBlock) {
      merged[key] = localBlock;
      continue;
    }
    const winner = newer(localBlock, remoteBlock);
    merged[key] = {
      ...winner,
      goals: mergeById(localBlock.goals ?? [], remoteBlock.goals ?? []),
    };
  }
  return merged;
}

/** Merge notes: Record<dateKey, SyncNoteEntry[]> — merge per-day by note id. */
function mergeNotes(
  local: Record<string, SyncNoteEntry[]>,
  remote: Record<string, SyncNoteEntry[]>,
): Record<string, SyncNoteEntry[]> {
  const merged: Record<string, SyncNoteEntry[]> = {};
  const allKeys = new Set([...Object.keys(local), ...Object.keys(remote)]);
  for (const key of allKeys) {
    merged[key] = mergeById(local[key] ?? [], remote[key] ?? []);
  }
  return merged;
}

/** Merge life settings with intelligent fallback and per-field protection so lifespan or birthDate are not wiped out by defaults. */
function mergeLifeSettings(
  local?: SyncLifeSettings,
  remote?: SyncLifeSettings,
): SyncLifeSettings {
  const base: SyncLifeSettings = {
    birthDate: "",
    lifespan: 80,
    createdAt: 0,
    updatedAt: 0,
  };
  const loc = local ?? base;
  const rem = remote ?? base;

  const locTs = timestampOf(loc);
  const remTs = timestampOf(rem);

  // If one side has timestamp 0 (unmodified default), the other side with real changes wins
  if (locTs === 0 && remTs > 0) {
    return {
      birthDate: rem.birthDate || loc.birthDate || "",
      lifespan:
        typeof rem.lifespan === "number" &&
        !isNaN(rem.lifespan) &&
        rem.lifespan >= 20 &&
        rem.lifespan <= 120
          ? rem.lifespan
          : typeof loc.lifespan === "number" &&
              !isNaN(loc.lifespan) &&
              loc.lifespan >= 20 &&
              loc.lifespan <= 120
            ? loc.lifespan
            : 80,
      createdAt: rem.createdAt || loc.createdAt || 0,
      updatedAt: rem.updatedAt || remTs,
    };
  }

  if (remTs === 0 && locTs > 0) {
    return {
      birthDate: loc.birthDate || rem.birthDate || "",
      lifespan:
        typeof loc.lifespan === "number" &&
        !isNaN(loc.lifespan) &&
        loc.lifespan >= 20 &&
        loc.lifespan <= 120
          ? loc.lifespan
          : typeof rem.lifespan === "number" &&
              !isNaN(rem.lifespan) &&
              rem.lifespan >= 20 &&
              rem.lifespan <= 120
            ? rem.lifespan
            : 80,
      createdAt: loc.createdAt || rem.createdAt || 0,
      updatedAt: loc.updatedAt || locTs,
    };
  }

  const winner = locTs >= remTs ? loc : rem;
  const loser = locTs >= remTs ? rem : loc;

  // Preserves birthDate if winner has empty birthDate but loser has set one
  const birthDate = winner.birthDate || loser.birthDate || "";

  // Winner's lifespan, or loser's if winner has invalid lifespan
  const winnerLifespanValid =
    typeof winner.lifespan === "number" &&
    !isNaN(winner.lifespan) &&
    winner.lifespan >= 20 &&
    winner.lifespan <= 120;
  const loserLifespanValid =
    typeof loser.lifespan === "number" &&
    !isNaN(loser.lifespan) &&
    loser.lifespan >= 20 &&
    loser.lifespan <= 120;

  let lifespan = winnerLifespanValid
    ? winner.lifespan
    : loserLifespanValid
      ? loser.lifespan
      : 80;

  // Edge case protection: if winner has unconfigured/default lifespan 80,
  // but loser has customized valid lifespan (not 80), take the customized lifespan
  if (
    lifespan === 80 &&
    loserLifespanValid &&
    loser.lifespan !== 80
  ) {
    lifespan = loser.lifespan;
  }

  return {
    birthDate,
    lifespan,
    createdAt:
      Math.min(
        loc.createdAt || Number.MAX_SAFE_INTEGER,
        rem.createdAt || Number.MAX_SAFE_INTEGER,
      ) === Number.MAX_SAFE_INTEGER
        ? 0
        : Math.min(loc.createdAt || 0, rem.createdAt || 0),
    updatedAt: Math.max(locTs, remTs),
  };
}

// ── Public merge function ─────────────────────────────────────────────────────

/**
 * Merge local and remote snapshots.
 * Neither snapshot is mutated — a new merged snapshot is returned.
 */
export function mergeSnapshots(
  local: AppSnapshot,
  remote: AppSnapshot,
): AppSnapshot {
  const base = emptySnapshot();

  return {
    ...base,
    exportedAt: Math.max(local.exportedAt, remote.exportedAt),
    resetAt: Math.max(local.resetAt ?? 0, remote.resetAt ?? 0),
    logoutAt: Math.max(local.logoutAt ?? 0, remote.logoutAt ?? 0),

    milestones: mergeById(
      local.milestones ?? [],
      remote.milestones ?? [],
    ) as SyncMilestone[],

    lifeSettings: mergeLifeSettings(local.lifeSettings, remote.lifeSettings),

    dayGoals: mergeRecord(
      local.dayGoals ?? {},
      remote.dayGoals ?? {},
    ) as Record<string, SyncDayGoals>,

    dayTemplates: mergeById(
      local.dayTemplates ?? [],
      remote.dayTemplates ?? [],
    ) as SyncDayTemplate[],

    notes: mergeNotes(local.notes ?? {}, remote.notes ?? {}),

    blockGoals: mergeBlockGoals(
      local.blockGoals ?? {},
      remote.blockGoals ?? {},
    ) as Record<string, SyncBlockGoals>,

    quarterGoals: mergeBlockGoals(
      local.quarterGoals ?? {},
      remote.quarterGoals ?? {},
    ) as Record<string, SyncBlockGoals>,

    yearGoals: mergeBlockGoals(
      local.yearGoals ?? {},
      remote.yearGoals ?? {},
    ) as Record<string, SyncBlockGoals>,

    quarterMeta: newer(
      local.quarterMeta ?? { ...base.quarterMeta },
      remote.quarterMeta ?? { ...base.quarterMeta },
    ) as SyncQuarterMeta,

    calendarConfigs: mergeRecord(
      local.calendarConfigs ?? {},
      remote.calendarConfigs ?? {},
    ) as Record<string, SyncCalendarConfig>,
  };
}
