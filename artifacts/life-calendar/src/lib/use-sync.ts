// ─── useSyncEngine — React hook ───────────────────────────────────────────────
// Manages Google auth state, debounced uploads, and periodic pull-merge.

import { useCallback, useEffect, useRef, useState } from "react";
import { SYNC_DEBOUNCE_MS, SYNC_INTERVAL_MS } from "../config";
import { signInWithGoogle, signOutFromGoogle, isSignedIn, getValidToken } from "./google-auth";
import { findAppFile, downloadSnapshot, uploadSnapshot } from "./google-drive";
import { mergeSnapshots } from "./merge-engine";
import type { AppSnapshot, SyncStatus, UserInfo } from "./sync-types";

export interface SyncEngine {
  syncStatus: SyncStatus;
  userInfo: UserInfo | null;
  /** Show the Google sign-in popup. */
  signIn: () => Promise<void>;
  /** Revoke auth and clear local user info. */
  signOut: () => Promise<void>;
  /** Immediately push + pull without waiting for debounce. */
  triggerSync: () => Promise<void>;
  /**
   * Call whenever app data changes. The engine debounces and uploads.
   * Pass the latest snapshot so it can be uploaded.
   */
  markDirty: (snapshot: AppSnapshot) => void;
}

interface Options {
  /** Called after a successful merge with the merged snapshot. */
  applySnapshot: (snapshot: AppSnapshot) => void;
}

function parseJwt(token: string): Record<string, string> | null {
  try {
    const base64 = token.split(".")[1]!.replace(/-/g, "+").replace(/_/g, "/");
    const json = atob(base64);
    return JSON.parse(json) as Record<string, string>;
  } catch {
    return null;
  }
}

/**
 * Returns the maximum `updatedAt` timestamp across all items in the snapshot.
 * Used to detect whether the snapshot contains user-authored changes newer
 * than the last completed sync.
 */
function getMaxUpdatedAt(snapshot: AppSnapshot): number {
  let max = 0;
  for (const m of snapshot.milestones) max = Math.max(max, m.updatedAt);
  max = Math.max(max, snapshot.lifeSettings.updatedAt);
  for (const v of Object.values(snapshot.dayGoals)) max = Math.max(max, v.updatedAt);
  for (const t of snapshot.dayTemplates) max = Math.max(max, t.updatedAt);
  for (const entries of Object.values(snapshot.notes)) {
    for (const e of entries) max = Math.max(max, e.updatedAt);
  }
  for (const v of Object.values(snapshot.blockGoals)) max = Math.max(max, v.updatedAt);
  for (const v of Object.values(snapshot.quarterGoals)) max = Math.max(max, v.updatedAt);
  for (const v of Object.values(snapshot.yearGoals)) max = Math.max(max, v.updatedAt);
  max = Math.max(max, snapshot.quarterMeta.updatedAt);
  for (const v of Object.values(snapshot.calendarConfigs)) max = Math.max(max, v.updatedAt);
  return max;
}

export function useSyncEngine({ applySnapshot }: Options): SyncEngine {
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("idle");
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);

  // Stable refs to avoid stale closures
  const fileIdRef = useRef<string | null>(null);
  const pendingSnapshotRef = useRef<AppSnapshot | null>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const applyRef = useRef(applySnapshot);
  applyRef.current = applySnapshot;

  /**
   * True while a sync is in progress (between the first await and the finally
   * block). This flag is still set during `await uploadSnapshot`, which is when
   * React flushes the batched state updates from `applyRef.current()` and runs
   * `useEffect`. Checking it in `markDirty` prevents the apply-triggered state
   * change from scheduling a redundant upload.
   */
  const isSyncingRef = useRef(false);

  /**
   * Wall-clock time (Date.now()) of the last *completed* sync. `markDirty`
   * compares the snapshot's max `updatedAt` against this value: if all item
   * timestamps pre-date the last sync the data has not changed since we synced
   * it, so uploading again would be a no-op.
   */
  const lastSyncedAtRef = useRef<number>(0);

  // ── Core sync: pull from Drive, merge, push merged ───────────────────────

  const doSync = useCallback(async (snapshotToUpload?: AppSnapshot) => {
    if (!isSignedIn()) return;

    // Prevent overlapping / re-entrant syncs. A markDirty call that fires
    // during the async upload (while React flushes the applyRef state updates)
    // would normally queue another sync; the isSyncingRef guard stops that.
    if (isSyncingRef.current) return;

    isSyncingRef.current = true;
    try {
      setSyncStatus("syncing");
      const token = await getValidToken();

      // Resolve file ID
      if (!fileIdRef.current) {
        fileIdRef.current = await findAppFile(token);
      }

      // Download remote snapshot
      let merged: AppSnapshot | null = snapshotToUpload ?? null;
      let remote: AppSnapshot | null = null;
      if (fileIdRef.current) {
        remote = await downloadSnapshot(token, fileIdRef.current);
        if (remote && snapshotToUpload) {
          merged = mergeSnapshots(snapshotToUpload, remote);
        } else if (remote && !snapshotToUpload) {
          // Pull-only: use remote as-is (nothing local to merge)
          merged = remote;
        }
      }

      if (merged) {
        // Apply merged result to app state.
        // NOTE: this schedules React state updates. React will batch them and
        // run useEffect hooks asynchronously (after paint). If we are about to
        // await uploadSnapshot below, that await is the yield point where React
        // flushes those updates — at which point isSyncingRef is still true,
        // so any markDirty call triggered by the state change is blocked.
        applyRef.current(merged);

        // Only upload when there were local changes to contribute. A pull-only
        // sync (snapshotToUpload === undefined) merely downloads and applies —
        // re-uploading the same data would trigger another markDirty → doSync
        // cycle (the infinite loop we are fixing).
        const hasLocalChanges = !!snapshotToUpload;
        const isFirstUpload = !fileIdRef.current || !remote;

        if (hasLocalChanges || isFirstUpload) {
          setSyncStatus("uploading");
          const toUpload = { ...merged, exportedAt: Date.now() };
          // await here is the yield point where React may flush the state
          // updates from applyRef above; isSyncingRef is still true at this
          // point, blocking any concurrent markDirty call.
          fileIdRef.current = await uploadSnapshot(token, fileIdRef.current, toUpload);
        }
      }

      // Record the wall-clock time of this successful sync. markDirty will
      // compare incoming snapshot timestamps against this value and skip
      // scheduling an upload if no item has been modified since we synced.
      lastSyncedAtRef.current = Date.now();

      setSyncStatus("synced");
    } catch (err) {
      console.error("[sync] error:", err);
      setSyncStatus("error");
    } finally {
      // Reset after all awaits complete. By the time React's passive effects
      // (useEffect) run — which is after paint, after the current JS execution
      // context — isSyncingRef is already false. The lastSyncedAtRef timestamp
      // guard then acts as the second line of defence for pull-only syncs.
      isSyncingRef.current = false;
    }
  }, []);

  // ── Periodic auto-sync ────────────────────────────────────────────────────

  const startAutoSync = useCallback(() => {
    if (intervalRef.current) return;
    intervalRef.current = setInterval(() => { void doSync(); }, SYNC_INTERVAL_MS);
  }, [doSync]);

  const stopAutoSync = useCallback(() => {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
  }, []);

  // Sync on tab focus / visibility change
  useEffect(() => {
    const onFocus = () => { if (isSignedIn()) void doSync(); };
    const onVisible = () => { if (!document.hidden && isSignedIn()) void doSync(); };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [doSync]);

  // ── Public API ────────────────────────────────────────────────────────────

  const signIn = useCallback(async () => {
    try {
      setSyncStatus("syncing");
      const token = await signInWithGoogle();

      // Decode user info from token (GIS doesn't return ID token in token flow,
      // so we fetch it from the tokeninfo endpoint)
      try {
        const infoResp = await fetch(
          `https://www.googleapis.com/oauth2/v3/tokeninfo?access_token=${token}`,
        );
        if (infoResp.ok) {
          const info = (await infoResp.json()) as {
            email?: string;
            name?: string;
            picture?: string;
            sub?: string;
          };
          setUserInfo({
            name: info.name ?? info.email ?? "Google User",
            email: info.email ?? "",
            picture: info.picture,
          });
        }
      } catch { /* non-fatal */ }

      startAutoSync();

      // Immediately pull and push current state
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
    fileIdRef.current = null;
    lastSyncedAtRef.current = 0;
  }, [stopAutoSync]);

  const triggerSync = useCallback(async () => {
    if (debounceTimerRef.current) { clearTimeout(debounceTimerRef.current); debounceTimerRef.current = null; }
    await doSync(pendingSnapshotRef.current ?? undefined);
  }, [doSync]);

  const markDirty = useCallback((snapshot: AppSnapshot) => {
    // Always keep the latest snapshot available for the next upload, even if
    // we decide not to schedule one right now.
    pendingSnapshotRef.current = snapshot;
    if (!isSignedIn()) return;

    // Guard 1 — isSyncingRef:
    // A sync is currently in flight (we are inside an await). The state change
    // that triggered this markDirty came from applyRef.current() inside doSync,
    // not from a user edit. Skip scheduling to avoid the upload loop.
    if (isSyncingRef.current) return;

    // Guard 2 — timestamp comparison:
    // Compare the newest item timestamp in the snapshot against the wall-clock
    // time when we last completed a sync. If every item pre-dates the last sync
    // the data has not been modified by the user since we synced it — uploading
    // would just re-send the same bytes we already have on Drive.
    // This guard catches the pull-only case: after doSync() without a
    // snapshotToUpload, isSyncingRef is already reset (no upload yield point),
    // but the data timestamps are all older than lastSyncedAtRef.
    if (lastSyncedAtRef.current > 0 && getMaxUpdatedAt(snapshot) <= lastSyncedAtRef.current) return;

    // Debounce: reset the timer each time the user makes a change
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      debounceTimerRef.current = null;
      void doSync(pendingSnapshotRef.current ?? undefined);
    }, SYNC_DEBOUNCE_MS);
  }, [doSync]);

  // Cleanup
  useEffect(() => () => { stopAutoSync(); }, [stopAutoSync]);

  return { syncStatus, userInfo, signIn, signOut, triggerSync, markDirty };
}
