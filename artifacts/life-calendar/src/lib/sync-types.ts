// ─── Sync Data Types ──────────────────────────────────────────────────────────
// These extend the app's existing data structures with sync metadata.
// All field additions are optional so old localStorage data loads without errors.

export type SyncStatus =
  | "idle"       // signed out, or synced with no pending changes
  | "synced"     // last sync succeeded
  | "uploading"  // uploading to Drive
  | "syncing"    // downloading + merging
  | "error";     // last operation failed

export interface UserInfo {
  name: string;
  email: string;
  picture?: string;
}

// ── Per-item sync metadata ────────────────────────────────────────────────────

export interface SyncMeta {
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
}

export interface SyncBlockGoals {
  description: string;
  goals: SyncGoal[];
  updatedAt: number;
}

export interface SyncDayGoals {
  count: number;
  done: boolean[];
  labels?: string[];
  colors?: (string | undefined)[];
  updatedAt: number;
}

export interface SyncDayTemplate {
  id: string;
  name: string;
  items: string[];
  updatedAt: number;
  isDeleted: boolean;
}

export interface SyncLifeSettings {
  birthDate: string;
  lifespan: number;
  updatedAt: number;
}

export interface SyncQuarterMeta {
  data: unknown; // QuarterMeta[] — typed as unknown to avoid circular imports
  updatedAt: number;
}

export interface SyncCalendarConfig {
  data: unknown; // CalendarConfig
  updatedAt: number;
}

// ── Full snapshot stored in Drive ─────────────────────────────────────────────

export interface AppSnapshot {
  version: 1;
  exportedAt: number;
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
    milestones: [],
    lifeSettings: { birthDate: "", lifespan: 80, updatedAt: 0 },
    dayGoals: {},
    dayTemplates: [],
    notes: {},
    blockGoals: {},
    quarterGoals: {},
    yearGoals: {},
    quarterMeta: { data: null, updatedAt: 0 },
    calendarConfigs: {},
  };
}
