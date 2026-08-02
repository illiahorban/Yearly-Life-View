// ─── Merge Engine ─────────────────────────────────────────────────────────────
// Last-write-wins merge by `updatedAt` timestamp.
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

function newer<T extends { updatedAt?: number }>(a: T, b: T): T {
  // Legacy snapshots may not have sync metadata. Treat those records as
  // timestamp 0 so a current local edit or tombstone cannot be resurrected
  // by an older metadata-free remote record.
  return (a.updatedAt ?? 0) >= (b.updatedAt ?? 0) ? a : b;
}

/** Merge two arrays of items identified by `id`. Winner = higher updatedAt. */
function mergeById<T extends { id: string; updatedAt?: number; isDeleted: boolean }>(
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
function mergeRecord<T extends { updatedAt?: number }>(
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
