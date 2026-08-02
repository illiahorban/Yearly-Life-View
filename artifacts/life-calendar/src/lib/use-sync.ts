// ─── useSyncEngine — React hook ───────────────────────────────────────────────
// Manages Google auth state, debounced uploads, and on-mount pull.
//
// doSync is triggered by exactly TWO events:
//   1. App mount — one pull to hydrate state from Drive.
//   2. markDirty — debounced upload when the user edits the calendar.
//
// There is NO polling interval, NO focus/visibilitychange listener, and
// NO self-rescheduling inside doSync.  This eliminates the class of infinite
// loops caused by applySnapshot() → setState → useEffect → markDirty → doSync.

import { useCallback, useEffect, useRef, useState } from "react";
import { SYNC_DEBOUNCE_MS } from "../config";
import {
  signInWithGoogle,
  signOutFromGoogle,
  isSignedIn,
  getValidToken,
  tryRestoreSession,
  persistUserInfo,
  getStoredUserInfo,
} from "./google-auth";
import { findAppFile, downloadSnapshot, uploadSnapshot } from "./google-drive";
import { mergeSnapshots } from "./merge-engine";
import type { AppSnapshot, SyncStatus, UserInfo } from "./sync-types";

export interface SyncEngine {
  syncStatus: SyncStatus;
  userInfo: UserInfo | null;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  triggerSync: () => Promise<void>;
  markDirty: (snapshot: AppSnapshot) => void;
}

interface Options {
  applySnapshot: (snapshot: AppSnapshot) => void;
}

// ── Content fingerprint ───────────────────────────────────────────────────────
//
// Produces a stable, comparable string for any AppSnapshot so markDirty can
// detect whether the user-visible data actually changed since the last sync.
//
// Normalisations:
//  1. `exportedAt` excluded — changes on every upload.
//  2. Soft-deleted items excluded — applySnapshot() filters them from state.
//  3. `updatedAt ?? 0` — items without a timestamp (legacy data) fingerprint
//     as 0, preventing a mismatch against buildSnapshot()'s `?? Date.now()`.
//  4. Arrays sorted by `id`, object keys sorted alphabetically.

function snapshotFingerprint(s: AppSnapshot): string {
  const sortById = <T extends { id: string }>(arr: T[]): T[] =>
    [...arr].sort((a, b) => a.id.localeCompare(b.id));

  const sortedKeys = <T>(obj: Record<string, T>): Record<string, T> => {
    const out: Record<string, T> = {};
    for (const k of Object.keys(obj).sort()) out[k] = obj[k]!;
    return out;
  };

  return JSON.stringify({
    lifeSettings: {
      birthDate:  s.lifeSettings.birthDate,
      lifespan:   s.lifeSettings.lifespan,
      updatedAt:  s.lifeSettings.updatedAt ?? 0,
    },

    milestones: sortById(s.milestones.filter(m => !m.isDeleted)).map(m => ({
      id: m.id, label: m.label, date: m.date, color: m.color,
      description: m.description ?? null, recurring: m.recurring ?? false,
      updatedAt: m.updatedAt ?? 0,
    })),

    notes: sortedKeys(
      Object.fromEntries(
        Object.entries(s.notes)
          .map(([k, entries]) => [
            k,
            sortById(entries.filter(e => !e.isDeleted)).map(e => ({
              id: e.id, text: e.text, color: e.color ?? null,
              updatedAt: e.updatedAt ?? 0,
            })),
          ])
          .filter(([, v]) => (v as unknown[]).length > 0),
      ),
    ),

    dayGoals: sortedKeys(
      Object.fromEntries(
        Object.entries(s.dayGoals).map(([k, v]) => [
          k,
          { count: v.count, done: v.done, labels: v.labels ?? null,
            colors: v.colors ?? null, updatedAt: v.updatedAt ?? 0 },
        ]),
      ),
    ),

    dayTemplates: sortById(s.dayTemplates.filter(t => !t.isDeleted)).map(t => ({
      id: t.id, name: t.name, items: t.items, updatedAt: t.updatedAt ?? 0,
    })),

    blockGoals: sortedKeys(
      Object.fromEntries(
        Object.entries(s.blockGoals).map(([k, v]) => [
          k, { description: v.description, goals: v.goals, updatedAt: v.updatedAt ?? 0 },
        ]),
      ),
    ),

    quarterGoals: sortedKeys(
      Object.fromEntries(
        Object.entries(s.quarterGoals).map(([k, v]) => [
          k, { description: v.description, goals: v.goals, updatedAt: v.updatedAt ?? 0 },
        ]),
      ),
    ),

    yearGoals: sortedKeys(
      Object.fromEntries(
        Object.entries(s.yearGoals).map(([k, v]) => [
          k, { description: v.description, goals: v.goals, updatedAt: v.updatedAt ?? 0 },
        ]),
      ),
    ),

    quarterMeta: { data: s.quarterMeta.data, updatedAt: s.quarterMeta.updatedAt ?? 0 },

    calendarConfigs: sortedKeys(
      Object.fromEntries(
        Object.entries(s.calendarConfigs).map(([k, v]) => [
          k, { data: v.data, updatedAt: v.updatedAt ?? 0 },
        ]),
      ),
    ),
  });
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useSyncEngine({ applySnapshot }: Options): SyncEngine {
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("idle");
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);

  const fileIdRef          = useRef<string | null>(null);
  const pendingSnapshotRef = useRef<AppSnapshot | null>(null);
  const debounceTimerRef   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const applyRef           = useRef(applySnapshot);
  applyRef.current = applySnapshot;

  /**
   * Content fingerprint of the last successfully synced snapshot.
   * markDirty compares against this; doSync skips applyRef + network
   * if the fingerprint hasn't changed.
   */
  const lastSyncedContentRef = useRef<string>("");

  /**
   * Mutual-exclusion flag. Set to true at the start of doSync, cleared in
   * finally.  Blocks concurrent calls and prevents markDirty from scheduling
   * a new debounce while a sync is already in flight.
   */
  const isSyncingRef = useRef(false);

  /**
   * True during the first on-mount pull so it stays strictly read-only
   * (no upload regardless of local state).
   */
  const isInitialSyncRef = useRef(false);

  /**
   * Guards against our own localStorage writes re-triggering doSync via a
   * storage event in the unlikely case another listener exists in the page.
   * Set to true before any localStorage write inside doSync, cleared after.
   */
  const isWritingStorageRef = useRef(false);

  // ── Core sync ─────────────────────────────────────────────────────────────

  const doSync = useCallback(async (snapshotToUpload?: AppSnapshot) => {
    console.trace("[SYNC TRIGGERED BY]:");
    if (!isSignedIn()) return;
    if (isSyncingRef.current) return;

    const readOnly = isInitialSyncRef.current;
    isInitialSyncRef.current = false;

    isSyncingRef.current = true;
    try {
      setSyncStatus("syncing");
      const token = await getValidToken();

      if (!fileIdRef.current) {
        isWritingStorageRef.current = true; // findAppFile may write auth state
        fileIdRef.current = await findAppFile(token);
        isWritingStorageRef.current = false;
      }

      let merged: AppSnapshot | null = snapshotToUpload ?? null;
      let remote: AppSnapshot | null = null;

      if (fileIdRef.current) {
        remote = await downloadSnapshot(token, fileIdRef.current);
        if (remote && snapshotToUpload) {
          merged = mergeSnapshots(snapshotToUpload, remote);
        } else if (remote && !snapshotToUpload) {
          merged = remote;
        }
      }

      if (merged) {
        const mergedFp = snapshotFingerprint(merged);

        // ── Hard stop ──────────────────────────────────────────────────────
        // If merged content is identical to the last sync, skip applyRef
        // (no setState) and skip any upload (no network).  This is the
        // primary guard against the useEffect → markDirty → doSync cycle.
        if (lastSyncedContentRef.current !== "" && mergedFp === lastSyncedContentRef.current) {
          setSyncStatus("synced");
          return; // finally still runs → isSyncingRef reset
        }

        isWritingStorageRef.current = true;
        applyRef.current(merged);
        isWritingStorageRef.current = false;

        lastSyncedContentRef.current = mergedFp;

        const shouldUpload =
          !readOnly &&
          (!!snapshotToUpload || !fileIdRef.current || !remote);

        if (shouldUpload) {
          const remoteFp = remote ? snapshotFingerprint(remote) : "";
          if (mergedFp !== remoteFp || !remote) {
            setSyncStatus("uploading");
            const toUpload = { ...merged, exportedAt: Date.now() };
            isWritingStorageRef.current = true;
            fileIdRef.current = await uploadSnapshot(token, fileIdRef.current, toUpload);
            isWritingStorageRef.current = false;
            lastSyncedContentRef.current = snapshotFingerprint(toUpload);
          }
        }
      }

      setSyncStatus("synced");
    } catch (err) {
      console.error("[sync] error:", err);
      setSyncStatus("error");
    } finally {
      isWritingStorageRef.current = false;
      isSyncingRef.current = false;
    }
  }, []);

  // ── Storage-event guard ───────────────────────────────────────────────────
  // Suppress any storage-triggered doSync that originates from our own writes.

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (isWritingStorageRef.current) return; // our own write — ignore
      if (!e.key?.startsWith("lifeCalendar:") && !e.key?.startsWith("gSync:")) return;
      // Another tab changed the data — pull the latest.
      if (isSignedIn()) void doSync();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [doSync]);

  // ── Session restore on mount (trigger #1) ─────────────────────────────────

  useEffect(() => {
    if (tryRestoreSession()) {
      const stored = getStoredUserInfo();
      if (stored) setUserInfo(stored);
      isInitialSyncRef.current = true; // first pull is read-only
      void doSync();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // runs exactly once on mount

  // ── Public API ────────────────────────────────────────────────────────────

  const signIn = useCallback(async () => {
    try {
      setSyncStatus("syncing");
      const token = await signInWithGoogle();

      try {
        const infoResp = await fetch(
          `https://www.googleapis.com/oauth2/v3/tokeninfo?access_token=${token}`,
        );
        if (infoResp.ok) {
          const info = (await infoResp.json()) as {
            email?: string; name?: string; picture?: string;
          };
          const userInfoObj: UserInfo = {
            name:    info.name ?? info.email ?? "Google User",
            email:   info.email ?? "",
            picture: info.picture,
          };
          setUserInfo(userInfoObj);
          persistUserInfo(userInfoObj);
        }
      } catch { /* non-fatal */ }

      await doSync(pendingSnapshotRef.current ?? undefined);
    } catch (err) {
      console.error("[sync] sign-in error:", err);
      setSyncStatus("error");
    }
  }, [doSync]);

  const signOut = useCallback(async () => {
    await signOutFromGoogle();
    setUserInfo(null);
    setSyncStatus("idle");
    fileIdRef.current            = null;
    lastSyncedContentRef.current = "";
    isInitialSyncRef.current     = false;
  }, []);

  const triggerSync = useCallback(async () => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    await doSync(pendingSnapshotRef.current ?? undefined);
  }, [doSync]);

  // ── markDirty (trigger #2) ────────────────────────────────────────────────
  // Called by App.tsx whenever user-visible state changes.  Debounced so
  // rapid edits collapse into a single upload.

  const markDirty = useCallback((snapshot: AppSnapshot) => {
    pendingSnapshotRef.current = snapshot;
    if (!isSignedIn()) return;

    // Guard 1 — a sync is already running; it will see the latest state via
    // pendingSnapshotRef when it completes, so no extra scheduling needed.
    if (isSyncingRef.current) return;

    // Guard 2 — content fingerprint: if data hasn't changed since the last
    // sync there is nothing to upload.
    if (
      lastSyncedContentRef.current !== "" &&
      snapshotFingerprint(snapshot) === lastSyncedContentRef.current
    ) return;

    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      debounceTimerRef.current = null;
      void doSync(pendingSnapshotRef.current ?? undefined);
    }, SYNC_DEBOUNCE_MS);
  }, [doSync]);

  return { syncStatus, userInfo, signIn, signOut, triggerSync, markDirty };
}
