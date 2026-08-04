// ─── Sync Data Types ──────────────────────────────────────────────────────────
// These extend the app's existing data structures with sync metadata.
// The app normalises legacy records at the storage boundary, so every record
// written to Drive has both creation and modification timestamps.

export type SyncStatus =
  | "idle" // signed out, or synced with no pending changes
  | "synced" // last sync succeeded
  | "uploading" // uploading to Drive
  | "syncing" // downloading + merging
  | "error"; // last operation failed

export interface UserInfo {
  name: string;
  email: string;
  picture?: string;
}

// ── Per-item sync metadata ────────────────────────────────────────────────────

export interface SyncMeta {
  /** Unix ms timestamp when the record was first created. */
  createdAt: number;
  /** Unix ms timestamp of last local modification. */
  updatedAt: number;
  /** Soft-deleted: hidden in the UI, still kept in sync data for propagation. */
  isDeleted: boolean;
}

// ── Sync-aware versions of every syncable data type ──────────────────────────

export interface SyncMilestone {
  id: string;
  label: string;
  date: string;
  color: string;
  description?: string;
  recurring?: boolean;
  createdAt: number;
  updatedAt: number;
  isDeleted: boolean;
}

export interface SyncNoteEntry {
  id: string;
  text: string;
  createdAt: number;
  color?: string;
  updatedAt: number;
  isDeleted: boolean;
}

export interface SyncGoal {
  id: string;
  text: string;
  done: boolean;
  color?: string;
  createdAt: number;
  updatedAt: number;
  isDeleted: boolean;
}

export interface SyncBlockGoals {
  description: string;
  goals: SyncGoal[];
  createdAt: number;
  updatedAt: number;
  isDeleted: boolean;
}

export interface SyncDayGoals {
  count: number;
  done: boolean[];
  labels?: string[];
  colors?: (string | undefined)[];
  createdAt: number;
  updatedAt: number;
  isDeleted: boolean;
}

export interface SyncDayTemplate {
  id: string;
  name: string;
  items: string[];
  createdAt: number;
  updatedAt: number;
  isDeleted: boolean;
}

export interface SyncLifeSettings {
  birthDate: string;
  lifespan: number;
  createdAt: number;
  updatedAt: number;
}

export interface SyncQuarterMeta {
  data: unknown; // QuarterMeta[] — typed as unknown to avoid circular imports
  createdAt: number;
  updatedAt: number;
}

export interface SyncCalendarConfig {
  data: unknown; // CalendarConfig
  createdAt: number;
  updatedAt: number;
}

// ── Full snapshot stored in Drive ─────────────────────────────────────────────

export interface AppSnapshot {
  version: 1;
  exportedAt: number;
  /** Monotonic marker for a factory reset. A newer reset is authoritative. */
  resetAt?: number;
  /** Monotonic control marker that signs all currently open clients out. */
  logoutAt?: number;
  milestones: SyncMilestone[];
  lifeSettings: SyncLifeSettings;
  dayGoals: Record<string, SyncDayGoals>;
  dayTemplates: SyncDayTemplate[];
  /** notes[dateKey] = array of note entries for that day */
  notes: Record<string, SyncNoteEntry[]>;
  blockGoals: Record<string, SyncBlockGoals>;
  quarterGoals: Record<string, SyncBlockGoals>;
  yearGoals: Record<string, SyncBlockGoals>;
  quarterMeta: SyncQuarterMeta;
  /** calendarConfigs[year] = config for that year */
  calendarConfigs: Record<string, SyncCalendarConfig>;
}

export function emptySnapshot(): AppSnapshot {
  return {
    version: 1,
    exportedAt: 0,
    resetAt: 0,
    logoutAt: 0,
    milestones: [],
    lifeSettings: { birthDate: "", lifespan: 80, createdAt: 0, updatedAt: 0 },
    dayGoals: {},
    dayTemplates: [],
    notes: {},
    blockGoals: {},
    quarterGoals: {},
    yearGoals: {},
    quarterMeta: { data: null, createdAt: 0, updatedAt: 0 },
    calendarConfigs: {},
  };
}
