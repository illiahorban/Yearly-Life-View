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
   * True while a sync with an upload is in progress.
   * applyRef.current() schedules React state updates that are flushed by React
   * at the next `await` yield point (the `await uploadSnapshot` call). At that
   * yield the useEffect in App.tsx fires and calls markDirty — this flag blocks
   * it from scheduling a redundant re-upload.
   */
  const isSyncingRef = useRef(false);

  /**
   * Set to true immediately before applyRef.current() is called and reset via
   * setTimeout(0) afterwards. React 18 schedules passive effects (useEffect)
   * via MessageChannel, which runs before setTimeout(0) in all modern browsers.
   * This means markDirty sees preventAutoSaveRef === true when it fires from
   * the state change triggered by applySnapshot, preventing the upload loop
   * even for pull-only syncs (which have no `await uploadSnapshot` yield where
   * isSyncingRef would still be set).
   */
  const preventAutoSaveRef = useRef(false);

  /**
   * Set to true before the first pull triggered by an auto-restored session.
   * Ensures that the initial download from Drive is strictly read-only:
   * the data is applied to local state but never uploaded back.
   * Cleared to false as soon as the first sync (of any kind) begins.
   */
  const isInitialSyncRef = useRef(false);

  // ── Core sync: pull from Drive, merge (if needed), push merged ───────────

  const doSync = useCallback(async (snapshotToUpload?: AppSnapshot) => {
    if (!isSignedIn()) return;
    // Prevent overlapping / re-entrant syncs (e.g. interval fires while a
    // debounced upload is still in flight).
    if (isSyncingRef.current) return;

    // Consume the initial-sync flag. If it was set, this call is read-only.
    const readOnly = isInitialSyncRef.current;
    isInitialSyncRef.current = false;

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
          // Pull-only: take remote as-is (nothing local to merge with)
          merged = remote;
        }
      }

      if (merged) {
        // Block markDirty from scheduling an upload while we apply the
        // downloaded/merged data. preventAutoSaveRef is reset via setTimeout(0)
        // which runs after React's MessageChannel-scheduled passive effects.
        preventAutoSaveRef.current = true;
        applyRef.current(merged);
        setTimeout(() => { preventAutoSaveRef.current = false; }, 0);

        // Decide whether to upload:
        //  • readOnly = true  → first auto-restore pull, never upload
        //  • no snapshotToUpload → periodic/focus pull, no local changes to push
        //  • snapshotToUpload provided → user made changes; upload the merge result
        //  • no remote file yet → first-ever upload (create the file)
        const shouldUpload = !readOnly && (!!snapshotToUpload || !fileIdRef.current || !remote);

        if (shouldUpload) {
          setSyncStatus("uploading");
          const toUpload = { ...merged, exportedAt: Date.now() };
          // This await is the yield point where React flushes the state
          // updates from applyRef above and runs passive effects. At that
          // point isSyncingRef is still true, so any markDirty call is
          // blocked via the isSyncingRef guard as well.
          fileIdRef.current = await uploadSnapshot(token, fileIdRef.current, toUpload);
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
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
  }, []);

  // Sync on tab focus / visibility change
  useEffect(() => {
    const onFocus   = () => { if (isSignedIn()) void doSync(); };
    const onVisible = () => { if (!document.hidden && isSignedIn()) void doSync(); };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [doSync]);

  // ── Session restore on mount ──────────────────────────────────────────────
  // Check localStorage for a still-valid token from a previous session. If
  // found, skip the sign-in popup and silently pull the latest Drive data.

  useEffect(() => {
    if (tryRestoreSession()) {
      const stored = getStoredUserInfo();
      if (stored) setUserInfo(stored);

      // Mark the upcoming sync as read-only (download-only, no upload-back).
      isInitialSyncRef.current = true;
      startAutoSync();
      void doSync(); // pull-only: applies Drive data without uploading
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally empty — runs once on mount

  // ── Public API ────────────────────────────────────────────────────────────

  const signIn = useCallback(async () => {
    try {
      setSyncStatus("syncing");
      const token = await signInWithGoogle();

      // Fetch user info from the tokeninfo endpoint and persist it
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
          const userInfoObj: UserInfo = {
            name:    info.name ?? info.email ?? "Google User",
            email:   info.email ?? "",
            picture: info.picture,
          };
          setUserInfo(userInfoObj);
          persistUserInfo(userInfoObj); // survive page reload
        }
      } catch { /* non-fatal */ }

      startAutoSync();
      // Interactive sign-in: merge local pending data with remote and upload.
      // This is intentionally NOT read-only — we want to push local changes.
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
    isInitialSyncRef.current = false;
  }, [stopAutoSync]);

  const triggerSync = useCallback(async () => {
    if (debounceTimerRef.current) { clearTimeout(debounceTimerRef.current); debounceTimerRef.current = null; }
    await doSync(pendingSnapshotRef.current ?? undefined);
  }, [doSync]);

  const markDirty = useCallback((snapshot: AppSnapshot) => {
    // Always keep the latest snapshot so the next upload has fresh data.
    pendingSnapshotRef.current = snapshot;
    if (!isSignedIn()) return;

    // Guard 1 — isSyncingRef:
    // An upload sync is in flight. The state change that triggered markDirty
    // came from applyRef.current() inside doSync (React flushed the updates
    // at the `await uploadSnapshot` yield). Skip scheduling.
    if (isSyncingRef.current) return;

    // Guard 2 — preventAutoSaveRef:
    // Set synchronously before every applyRef.current() call; reset via
    // setTimeout(0) which fires after React's MessageChannel-scheduled effects.
    // This blocks the loop for pull-only syncs (no upload await, so
    // isSyncingRef is already false when effects fire).
    if (preventAutoSaveRef.current) return;

    // Debounce: reset the timer on every user change
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      debounceTimerRef.current = null;
      void doSync(pendingSnapshotRef.current ?? undefined);
    }, SYNC_DEBOUNCE_MS);
  }, [doSync]);

  // Cleanup on unmount
  useEffect(() => () => { stopAutoSync(); }, [stopAutoSync]);

  return { syncStatus, userInfo, signIn, signOut, triggerSync, markDirty };
}
