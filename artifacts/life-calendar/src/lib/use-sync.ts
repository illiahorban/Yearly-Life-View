// ─── useSyncEngine — React hook ───────────────────────────────────────────────
// Manages Google auth state, debounced uploads, and cross-device pulls.
//
// doSync is triggered by local edits, mount, and lightweight background pulls:
//   1. App mount — one pull to hydrate state from Drive.
//   2. markDirty — debounced upload when the user edits the calendar.
//   3. Background polling / visibility — pull remote edits made on another device.
//
// doSync itself never schedules another pull. The fingerprint guard prevents
// a remote apply from turning into a sync loop.

import { useCallback, useEffect, useRef, useState } from "react";
import { SYNC_DEBOUNCE_MS, SYNC_INTERVAL_MS } from "../config";
import {
  signInWithGoogle,
  signOutFromGoogle,
  isSignedIn,
  getValidToken,
  restoreSession,
  persistUserInfo,
  getStoredUserInfo,
  persistSessionStartedAt,
  getSessionStartedAt,
} from "./google-auth";
import { findAppFile, downloadSnapshot, uploadSnapshot } from "./google-drive";
import { mergeSnapshots } from "./merge-engine";
import { emptySnapshot } from "./sync-types";
import type { AppSnapshot, SyncStatus, UserInfo } from "./sync-types";

export interface SyncEngine {
  syncStatus: SyncStatus;
  userInfo: UserInfo | null;
  signIn: () => Promise<void>;
  signOut: (snapshot?: AppSnapshot, broadcast?: boolean) => Promise<void>;
  resetCloudData: () => Promise<void>;
  triggerSync: () => Promise<void>;
  markDirty: (snapshot: AppSnapshot) => void;
}

interface Options {
  applySnapshot: (snapshot: AppSnapshot) => void;
  getLocalSnapshot?: () => AppSnapshot;
}

// ── Content fingerprint ───────────────────────────────────────────────────────
//
// Produces a stable, comparable string for any AppSnapshot so markDirty can
// detect whether the user-visible data actually changed since the last sync.
//
// Normalisations:
//  1. `exportedAt` excluded — changes on every upload.
//  2. Soft-deleted items stay in the fingerprint — a deletion is a real
//     change and must be uploaded even though the UI hides the item.
//  3. Missing timestamps fingerprint as 0; storage normalization supplies
//     stable values for legacy records before they are uploaded.
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
    resetAt: s.resetAt ?? 0,
    logoutAt: s.logoutAt ?? 0,
    lifeSettings: {
      birthDate: s.lifeSettings.birthDate,
      lifespan: s.lifeSettings.lifespan,
      createdAt: s.lifeSettings.createdAt ?? 0,
      updatedAt: s.lifeSettings.updatedAt ?? 0,
    },

    milestones: sortById(s.milestones).map((m) => ({
      id: m.id,
      label: m.label,
      date: m.date,
      color: m.color,
      description: m.description ?? null,
      recurring: m.recurring ?? false,
      createdAt: m.createdAt ?? 0,
      updatedAt: m.updatedAt ?? 0,
      isDeleted: m.isDeleted ?? false,
    })),

    notes: sortedKeys(
      Object.fromEntries(
        Object.entries(s.notes)
          .map(([k, entries]) => [
            k,
            sortById(entries).map((e) => ({
              id: e.id,
              text: e.text,
              color: e.color ?? null,
              createdAt: e.createdAt ?? 0,
              updatedAt: e.updatedAt ?? 0,
              isDeleted: e.isDeleted ?? false,
            })),
          ])
          .filter(([, v]) => (v as unknown[]).length > 0),
      ),
    ),

    dayGoals: sortedKeys(
      Object.fromEntries(
        Object.entries(s.dayGoals).map(([k, v]) => [
          k,
          {
            count: v.count,
            done: v.done,
            labels: v.labels ?? null,
            colors: v.colors ?? null,
            createdAt: v.createdAt ?? 0,
            updatedAt: v.updatedAt ?? 0,
            isDeleted: v.isDeleted ?? false,
          },
        ]),
      ),
    ),

    dayTemplates: sortById(s.dayTemplates).map((t) => ({
      id: t.id,
      name: t.name,
      items: t.items,
      createdAt: t.createdAt ?? 0,
      updatedAt: t.updatedAt ?? 0,
      isDeleted: t.isDeleted ?? false,
    })),

    blockGoals: sortedKeys(
      Object.fromEntries(
        Object.entries(s.blockGoals).map(([k, v]) => [
          k,
          {
            description: v.description,
            goals: v.goals,
            createdAt: v.createdAt ?? 0,
            updatedAt: v.updatedAt ?? 0,
            isDeleted: v.isDeleted ?? false,
          },
        ]),
      ),
    ),

    quarterGoals: sortedKeys(
      Object.fromEntries(
        Object.entries(s.quarterGoals).map(([k, v]) => [
          k,
          {
            description: v.description,
            goals: v.goals,
            createdAt: v.createdAt ?? 0,
            updatedAt: v.updatedAt ?? 0,
            isDeleted: v.isDeleted ?? false,
          },
        ]),
      ),
    ),

    yearGoals: sortedKeys(
      Object.fromEntries(
        Object.entries(s.yearGoals).map(([k, v]) => [
          k,
          {
            description: v.description,
            goals: v.goals,
            createdAt: v.createdAt ?? 0,
            updatedAt: v.updatedAt ?? 0,
            isDeleted: v.isDeleted ?? false,
          },
        ]),
      ),
    ),

    quarterMeta: {
      data: s.quarterMeta.data,
      createdAt: s.quarterMeta.createdAt ?? 0,
      updatedAt: s.quarterMeta.updatedAt ?? 0,
    },

    calendarConfigs: sortedKeys(
      Object.fromEntries(
        Object.entries(s.calendarConfigs).map(([k, v]) => [
          k,
          {
            data: v.data,
            createdAt: v.createdAt ?? 0,
            updatedAt: v.updatedAt ?? 0,
          },
        ]),
      ),
    ),
  });
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useSyncEngine({
  applySnapshot,
  getLocalSnapshot,
}: Options): SyncEngine {
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("idle");
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);

  const fileIdRef = useRef<string | null>(null);
  const pendingSnapshotRef = useRef<AppSnapshot | null>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const applyRef = useRef(applySnapshot);
  applyRef.current = applySnapshot;
  const getLocalSnapshotRef = useRef(getLocalSnapshot);
  getLocalSnapshotRef.current = getLocalSnapshot;

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
  const isControlOperationRef = useRef(false);

  /**
   * Guards against our own localStorage writes re-triggering doSync via a
   * storage event in the unlikely case another listener exists in the page.
   * Set to true before any localStorage write inside doSync, cleared after.
   */
  const isWritingStorageRef = useRef(false);

  // ── Core sync ─────────────────────────────────────────────────────────────

  const doSync = useCallback(async (snapshotToUpload?: AppSnapshot) => {
    if (!isSignedIn()) return;
    if (isSyncingRef.current) return;
    if (isControlOperationRef.current) return;

    // Consume the snapshot that started this request. If another edit arrives
    // while the request is in flight, markDirty will replace this ref and it
    // will be uploaded from finally below.
    const snapshotAtStart = snapshotToUpload ?? pendingSnapshotRef.current;
    if (pendingSnapshotRef.current === snapshotAtStart) {
      pendingSnapshotRef.current = null;
    }

    isSyncingRef.current = true;
    try {
      setSyncStatus("syncing");
      const token = await getValidToken();

      if (!fileIdRef.current) {
        isWritingStorageRef.current = true; // findAppFile may write auth state
        fileIdRef.current = await findAppFile(token);
        isWritingStorageRef.current = false;
      }

      // Pulls also include the current local snapshot. This prevents a
      // recently-created local tombstone from being replaced by an older
      // remote item during page startup.
      //
      // A user can edit the calendar while the initial Drive request is still
      // in flight. In that case snapshotAtStart is already stale; prefer the
      // newest queued snapshot so the response cannot briefly roll the UI back
      // to the state from before the user's tap.
      let localSnapshot =
        pendingSnapshotRef.current ??
        snapshotAtStart ??
        getLocalSnapshotRef.current?.();
      let merged: AppSnapshot | null = localSnapshot ?? null;
      let remote: AppSnapshot | null = null;
      let remoteRequestsLogout = false;

      if (fileIdRef.current) {
        remote = await downloadSnapshot(token, fileIdRef.current);

        // The React state/effect for a fast tap may have completed while the
        // Drive request was in flight. Read the newest queued/rendered local
        // snapshot immediately before merging so the response cannot roll the
        // calendar back to the state from before that tap.
        localSnapshot =
          pendingSnapshotRef.current ??
          getLocalSnapshotRef.current?.() ??
          localSnapshot;

        remoteRequestsLogout = Boolean(
          remote?.logoutAt && remote.logoutAt > getSessionStartedAt(),
        );

        if (remoteRequestsLogout) {
          await signOutFromGoogle();
          setUserInfo(null);
          setSyncStatus("idle");
          fileIdRef.current = null;
          pendingSnapshotRef.current = null;
          lastSyncedContentRef.current = "";
          return;
        }

        const localResetAt = localSnapshot?.resetAt ?? 0;
        const remoteResetAt = remote?.resetAt ?? 0;
        if (
          remote &&
          localSnapshot &&
          localResetAt !== remoteResetAt &&
          Math.max(localResetAt, remoteResetAt) > 0
        ) {
          // A factory reset is a global replacement, not a field-level merge.
          // This prevents old data on another device from resurrecting.
          merged = localResetAt > remoteResetAt ? localSnapshot : remote;
        } else if (remote && localSnapshot) {
          merged = mergeSnapshots(localSnapshot, remote);
        } else if (remote && !localSnapshot) {
          merged = remote;
        }
      }

      if (merged) {
        const mergedFp = snapshotFingerprint(merged);

        // ── Hard stop ──────────────────────────────────────────────────────
        // If merged content is identical to the last sync, skip applyRef
        // (no setState) and skip any upload (no network).  This is the
        // primary guard against the useEffect → markDirty → doSync cycle.
        if (
          lastSyncedContentRef.current !== "" &&
          mergedFp === lastSyncedContentRef.current
        ) {
          setSyncStatus("synced");
          return; // finally still runs → isSyncingRef reset
        }

        isWritingStorageRef.current = true;
        applyRef.current(merged);
        isWritingStorageRef.current = false;

        lastSyncedContentRef.current = mergedFp;

        const shouldUpload = !!localSnapshot || !fileIdRef.current || !remote;

        if (shouldUpload) {
          const remoteFp = remote ? snapshotFingerprint(remote) : "";
          if (mergedFp !== remoteFp || !remote) {
            setSyncStatus("uploading");
            const toUpload = { ...merged, exportedAt: Date.now() };
            isWritingStorageRef.current = true;
            fileIdRef.current = await uploadSnapshot(
              token,
              fileIdRef.current,
              toUpload,
            );
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

      const queuedSnapshot = pendingSnapshotRef.current;
      if (queuedSnapshot) {
        pendingSnapshotRef.current = null;
        void doSync(queuedSnapshot);
      }
    }
  }, []);

  // ── Storage-event guard ───────────────────────────────────────────────────
  // Suppress any storage-triggered doSync that originates from our own writes.

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (isWritingStorageRef.current) return; // our own write — ignore
      if (!e.key?.startsWith("lifeCalendar:") && !e.key?.startsWith("gSync:"))
        return;
      // Another tab changed the data — pull the latest.
      if (isSignedIn()) void doSync();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [doSync]);

  // ── Session restore on mount (trigger #1) ─────────────────────────────────

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      if (!(await restoreSession()) || cancelled) return;

      const stored = getStoredUserInfo();
      if (stored) setUserInfo(stored);
      if (!getSessionStartedAt()) persistSessionStartedAt();
      void doSync(getLocalSnapshotRef.current?.());
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // runs exactly once on mount

  // Pull remote changes made on another device. The fingerprint guard inside
  // doSync prevents this from causing an upload/apply loop.
  useEffect(() => {
    const pullRemote = () => {
      if (isSignedIn()) void doSync();
    };
    const interval = window.setInterval(pullRemote, SYNC_INTERVAL_MS);
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") pullRemote();
    };
    window.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("focus", pullRemote);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("focus", pullRemote);
    };
  }, [doSync]);

  // ── Public API ────────────────────────────────────────────────────────────

  const signIn = useCallback(async () => {
    try {
      setSyncStatus("syncing");
      const token = await signInWithGoogle();
      persistSessionStartedAt();

      try {
        const infoResp = await fetch(
          `https://www.googleapis.com/oauth2/v3/tokeninfo?access_token=${token}`,
        );
        if (infoResp.ok) {
          const info = (await infoResp.json()) as {
            email?: string;
            name?: string;
            picture?: string;
          };
          const userInfoObj: UserInfo = {
            name: info.name ?? info.email ?? "Google User",
            email: info.email ?? "",
            picture: info.picture,
          };
          setUserInfo(userInfoObj);
          persistUserInfo(userInfoObj);
        }
      } catch {
        /* non-fatal */
      }

      await doSync(pendingSnapshotRef.current ?? undefined);
    } catch (err) {
      console.error("[sync] sign-in error:", err);
      setSyncStatus("error");
    }
  }, [doSync]);

  const signOut = useCallback(
    async (snapshot?: AppSnapshot, broadcast = true) => {
      if (!isSignedIn()) return;

      if (broadcast) {
        while (isControlOperationRef.current) {
          await new Promise<void>((resolve) => setTimeout(resolve, 25));
        }
        isControlOperationRef.current = true;
        try {
          while (isSyncingRef.current) {
            await new Promise<void>((resolve) => setTimeout(resolve, 25));
          }
          if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
            debounceTimerRef.current = null;
          }

          const token = await getValidToken();
          if (!fileIdRef.current) fileIdRef.current = await findAppFile(token);
          if (fileIdRef.current) {
            const local =
              pendingSnapshotRef.current ??
              snapshot ??
              getLocalSnapshotRef.current?.();
            pendingSnapshotRef.current = null;
            const remote = await downloadSnapshot(token, fileIdRef.current);
            const localResetAt = local?.resetAt ?? 0;
            const remoteResetAt = remote?.resetAt ?? 0;
            const content =
              remote && local
                ? localResetAt !== remoteResetAt &&
                  Math.max(localResetAt, remoteResetAt) > 0
                  ? localResetAt > remoteResetAt
                    ? local
                    : remote
                  : mergeSnapshots(local, remote)
                : (local ?? remote ?? emptySnapshot());
            const now = Date.now();
            await uploadSnapshot(token, fileIdRef.current, {
              ...content,
              exportedAt: now,
              logoutAt: now,
            });
          }
        } catch (error) {
          // A local sign-out must still complete even if Drive is temporarily
          // unavailable. The next authenticated session can retry the marker.
          console.error("[sync] sign-out broadcast error:", error);
          setSyncStatus("error");
        } finally {
          isControlOperationRef.current = false;
        }
      }

      await signOutFromGoogle();
      setUserInfo(null);
      setSyncStatus("idle");
      fileIdRef.current = null;
      lastSyncedContentRef.current = "";
    },
    [],
  );

  const resetCloudData = useCallback(async () => {
    if (!isSignedIn()) return;

    // Let an already-running upload finish before replacing Drive data with
    // the factory-reset snapshot. Otherwise the old snapshot could win the
    // race and be downloaded again after the next sign-in.
    while (isSyncingRef.current) {
      await new Promise<void>((resolve) => setTimeout(resolve, 25));
    }
    while (isControlOperationRef.current) {
      await new Promise<void>((resolve) => setTimeout(resolve, 25));
    }
    isControlOperationRef.current = true;

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    pendingSnapshotRef.current = null;

    setSyncStatus("uploading");
    try {
      const token = await getValidToken();
      if (!fileIdRef.current) {
        isWritingStorageRef.current = true;
        fileIdRef.current = await findAppFile(token);
        isWritingStorageRef.current = false;
      }

      // Keep the existing Drive file, but replace its contents with an empty
      // snapshot. This prevents a later sign-in from merging old cloud data
      // back into the freshly-reset local calendar.
      if (fileIdRef.current) {
        const resetNow = Date.now();
        const resetSnapshot: AppSnapshot = {
          ...emptySnapshot(),
          exportedAt: resetNow,
          resetAt: resetNow,
        };
        isWritingStorageRef.current = true;
        await uploadSnapshot(token, fileIdRef.current, resetSnapshot);
        isWritingStorageRef.current = false;
        lastSyncedContentRef.current = snapshotFingerprint(resetSnapshot);
      }
      setSyncStatus("synced");
    } catch (error) {
      setSyncStatus("error");
      throw error;
    } finally {
      isWritingStorageRef.current = false;
      isControlOperationRef.current = false;
      pendingSnapshotRef.current = null;
    }
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

  const markDirty = useCallback(
    (snapshot: AppSnapshot) => {
      pendingSnapshotRef.current = snapshot;
      if (!isSignedIn()) return;
      if (isControlOperationRef.current) return;

      // Guard 1 — a sync is already running; it will see the latest state via
      // pendingSnapshotRef when it completes, so no extra scheduling needed.
      if (isSyncingRef.current) return;

      // Guard 2 — content fingerprint: if data hasn't changed since the last
      // sync there is nothing to upload.
      if (
        lastSyncedContentRef.current !== "" &&
        snapshotFingerprint(snapshot) === lastSyncedContentRef.current
      )
        return;

      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = setTimeout(() => {
        debounceTimerRef.current = null;
        void doSync(pendingSnapshotRef.current ?? undefined);
      }, SYNC_DEBOUNCE_MS);
    },
    [doSync],
  );

  return {
    syncStatus,
    userInfo,
    signIn,
    signOut,
    resetCloudData,
    triggerSync,
    markDirty,
  };
}
