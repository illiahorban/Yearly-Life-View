// ─── useSyncEngine — React hook ───────────────────────────────────────────────
// Manages Google auth state, debounced uploads, and periodic pull-merge.

import { useCallback, useEffect, useRef, useState } from "react";
import { SYNC_DEBOUNCE_MS, SYNC_INTERVAL_MS } from "../config";
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
// Produces a stable, comparable string for any AppSnapshot, suitable for
// detecting whether the *user-visible data* has changed since the last sync.
//
// Normalisations applied so that the fingerprint of a freshly-pulled Drive
// snapshot matches the fingerprint of a buildSnapshot() call that was built
// from the React state set by applySnapshot():
//
//  1. `exportedAt` is excluded — it changes on every upload.
//  2. Soft-deleted items are excluded — applySnapshot() filters them from state
//     so buildSnapshot() never includes them.
//  3. `updatedAt ?? 0` instead of `updatedAt ?? Date.now()` — legacy items
//     without a timestamp produce the same fingerprint regardless of *when*
//     buildSnapshot() is called. (buildSnapshot uses `?? Date.now()` for the
//     actual upload payload, but we normalise it away here.)
//  4. Arrays are sorted by `id`, object keys are sorted alphabetically — so
//     insertion-order differences between the two snapshots don't cause false
//     mismatches.

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

  const fileIdRef            = useRef<string | null>(null);
  const pendingSnapshotRef   = useRef<AppSnapshot | null>(null);
  const debounceTimerRef     = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intervalRef          = useRef<ReturnType<typeof setInterval> | null>(null);
  const applyRef             = useRef(applySnapshot);
  applyRef.current = applySnapshot;

  /**
   * Content fingerprint of the last successfully synced snapshot (normalised —
   * no exportedAt, no deleted items, updatedAt ?? 0 for legacy entries).
   * markDirty compares the incoming buildSnapshot() fingerprint against this;
   * if they are equal the data has not changed since the last sync and there is
   * nothing to upload.
   */
  const lastSyncedContentRef = useRef<string>("");

  /**
   * Prevents two sync operations from running concurrently. Also blocks
   * markDirty for the duration of an upload-sync: React flushes the
   * applyRef() state updates at the `await uploadSnapshot` yield point; at
   * that moment this flag is still true, so the resulting useEffect → markDirty
   * call is rejected immediately.
   */
  const isSyncingRef = useRef(false);

  /**
   * Set to true before the first auto-restored pull so that the initial
   * download is strictly read-only (no upload-back regardless of local state).
   */
  const isInitialSyncRef = useRef(false);

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
        fileIdRef.current = await findAppFile(token);
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
        applyRef.current(merged);

        // Record the content fingerprint of what we just applied. markDirty
        // will compare against this to detect whether the user has actually
        // changed anything since we synced.
        lastSyncedContentRef.current = snapshotFingerprint(merged);

        const shouldUpload =
          !readOnly &&
          (!!snapshotToUpload || !fileIdRef.current || !remote);

        if (shouldUpload) {
          // Belt-and-suspenders: also skip the upload if the merged content
          // is identical to the remote (nothing new to push).
          const mergedFp = snapshotFingerprint(merged);
          const remoteFp = remote ? snapshotFingerprint(remote) : "";
          if (mergedFp !== remoteFp || !remote) {
            setSyncStatus("uploading");
            const toUpload = { ...merged, exportedAt: Date.now() };
            fileIdRef.current = await uploadSnapshot(
              token, fileIdRef.current, toUpload,
            );
            // Update fingerprint to the uploaded version
            lastSyncedContentRef.current = snapshotFingerprint(toUpload);
          }
        }
      }

      setSyncStatus("synced");
    } catch (err) {
      console.error("[sync] error:", err);
      setSyncStatus("error");
    } finally {
      isSyncingRef.current = false;
    }
  }, []);

  // ── Periodic auto-sync ────────────────────────────────────────────────────

  const startAutoSync = useCallback(() => {
    if (intervalRef.current) return;
    intervalRef.current = setInterval(() => { void doSync(); }, SYNC_INTERVAL_MS);
  }, [doSync]);

  const stopAutoSync = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    let focusTimer: ReturnType<typeof setTimeout> | null = null;
    const onFocus = () => {
      if (!isSignedIn()) return;
      if (focusTimer) clearTimeout(focusTimer);
      focusTimer = setTimeout(() => { focusTimer = null; void doSync(); }, 5_000);
    };
    const onVisible = () => {
      if (document.hidden || !isSignedIn()) return;
      if (focusTimer) clearTimeout(focusTimer);
      focusTimer = setTimeout(() => { focusTimer = null; void doSync(); }, 5_000);
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
      if (focusTimer) clearTimeout(focusTimer);
    };
  }, [doSync]);

  // ── Session restore on mount ──────────────────────────────────────────────

  useEffect(() => {
    if (tryRestoreSession()) {
      const stored = getStoredUserInfo();
      if (stored) setUserInfo(stored);
      isInitialSyncRef.current = true; // first pull must be read-only
      startAutoSync();
      void doSync();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // runs once on mount only

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

      startAutoSync();
      await doSync(pendingSnapshotRef.current ?? undefined);
    } catch (err) {
      console.error("[sync] sign-in error:", err);
      setSyncStatus("error");
    }
  }, [doSync, startAutoSync]);

  const signOut = useCallback(async () => {
    stopAutoSync();
    await signOutFromGoogle();
    setUserInfo(null);
    setSyncStatus("idle");
    fileIdRef.current          = null;
    lastSyncedContentRef.current = "";
    isInitialSyncRef.current   = false;
  }, [stopAutoSync]);

  const triggerSync = useCallback(async () => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    await doSync(pendingSnapshotRef.current ?? undefined);
  }, [doSync]);

  const markDirty = useCallback((snapshot: AppSnapshot) => {
    pendingSnapshotRef.current = snapshot;
    if (!isSignedIn()) return;

    // Guard 1 — overlapping sync in progress
    if (isSyncingRef.current) return;

    // Guard 2 — content hash: if the data hasn't changed since the last sync,
    // there is nothing to upload. This is the primary loop-prevention mechanism.
    // snapshotFingerprint() normalises away exportedAt, deleted items, and
    // `updatedAt ?? Date.now()` fallbacks so the comparison is stable.
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

  useEffect(() => () => { stopAutoSync(); }, [stopAutoSync]);

  return { syncStatus, userInfo, signIn, signOut, triggerSync, markDirty };
}
