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

  // ── Core sync: pull from Drive, merge, push merged ───────────────────────

  const doSync = useCallback(async (snapshotToUpload?: AppSnapshot) => {
    if (!isSignedIn()) return;
    try {
      setSyncStatus("syncing");
      const token = await getValidToken();

      // Resolve file ID
      if (!fileIdRef.current) {
        fileIdRef.current = await findAppFile(token);
      }

      // Download remote
      let merged = snapshotToUpload ?? null;
      if (fileIdRef.current) {
        const remote = await downloadSnapshot(token, fileIdRef.current);
        if (remote && snapshotToUpload) {
          merged = mergeSnapshots(snapshotToUpload, remote);
        } else if (remote && !snapshotToUpload) {
          merged = remote;
        }
      }

      if (merged) {
        // Apply merged result to app state
        applyRef.current(merged);

        // Upload merged snapshot
        setSyncStatus("uploading");
        merged = { ...merged, exportedAt: Date.now() };
        fileIdRef.current = await uploadSnapshot(token, fileIdRef.current, merged);
      }

      setSyncStatus("synced");
    } catch (err) {
      console.error("[sync] error:", err);
      setSyncStatus("error");
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
  }, [stopAutoSync]);

  const triggerSync = useCallback(async () => {
    if (debounceTimerRef.current) { clearTimeout(debounceTimerRef.current); debounceTimerRef.current = null; }
    await doSync(pendingSnapshotRef.current ?? undefined);
  }, [doSync]);

  const markDirty = useCallback((snapshot: AppSnapshot) => {
    pendingSnapshotRef.current = snapshot;
    if (!isSignedIn()) return;

    // Debounce: reset the timer each time
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
