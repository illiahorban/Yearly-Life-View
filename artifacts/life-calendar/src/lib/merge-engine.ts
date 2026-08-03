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

function timestampOf(value: { updatedAt?: unknown; createdAt?: unknown }): number {
  const updatedAt = typeof value.updatedAt === "number" && Number.isFinite(value.updatedAt) ? value.updatedAt : 0;
  const createdAt = typeof value.createdAt === "number" && Number.isFinite(value.createdAt) ? value.createdAt : 0;
  return Math.max(updatedAt, createdAt);
}

function newer<T extends { updatedAt?: number; createdAt?: number; isDeleted?: boolean }>(a: T, b: T): T {
  const aTimestamp = timestampOf(a);
  const bTimestamp = timestampOf(b);
  if (aTimestamp !== bTimestamp) return aTimestamp > bTimestamp ? a : b;
  // On an exact timestamp tie, deletion wins. This protects a tombstone from
  // an older active copy that was created in the same millisecond.
  if (a.isDeleted !== b.isDeleted) return a.isDeleted ? a : b;
  return a;
}

/** Merge two arrays of items identified by `id`. Winner = higher updatedAt. */
function mergeById<T extends { id: string; updatedAt?: number; createdAt?: number; isDeleted: boolean }>(
  local: T[],
  remote: T[],
): T[] {
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

// ── Public merge function ─────────────────────────────────────────────────────

/**
 * Merge local and remote snapshots.
 * Neither snapshot is mutated — a new merged snapshot is returned.
 */
export function mergeSnapshots(local: AppSnapshot, remote: AppSnapshot): AppSnapshot {
  const base = emptySnapshot();

  return {
    ...base,
    exportedAt: Math.max(local.exportedAt, remote.exportedAt),

    milestones: mergeById(
      local.milestones ?? [],
      remote.milestones ?? [],
    ) as SyncMilestone[],

    lifeSettings: newer(
      local.lifeSettings ?? { ...base.lifeSettings },
      remote.lifeSettings ?? { ...base.lifeSettings },
    ) as SyncLifeSettings,

    dayGoals: mergeRecord(
      local.dayGoals ?? {},
      remote.dayGoals ?? {},
    ) as Record<string, SyncDayGoals>,

    dayTemplates: mergeById(
      local.dayTemplates ?? [],
      remote.dayTemplates ?? [],
    ) as SyncDayTemplate[],

    notes: mergeNotes(local.notes ?? {}, remote.notes ?? {}),

    blockGoals: mergeRecord(
      local.blockGoals ?? {},
      remote.blockGoals ?? {},
    ) as Record<string, SyncBlockGoals>,

    quarterGoals: mergeRecord(
      local.quarterGoals ?? {},
      remote.quarterGoals ?? {},
    ) as Record<string, SyncBlockGoals>,

    yearGoals: mergeRecord(
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
