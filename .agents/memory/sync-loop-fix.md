---
name: Sync loop fix — content fingerprint approach
description: How the Google Drive auto-sync infinite loop was fixed and why simpler approaches failed.
---

## The loop

`doSync()` (pull-only) → `applySnapshot(merged)` sets React state → `useEffect` → `markDirty(buildSnapshot())` → debounce → `doSync(snapshot)` → apply again → loop.

## Why timestamp comparison fails

`buildSnapshot()` in App.tsx uses `const now2 = Date.now()` with `updatedAt ?? now2` for every field that lacks a timestamp (legacy data, `QuarterMeta[]` type has no `updatedAt`, etc.). Every call to `buildSnapshot()` produces a snapshot where some items have `updatedAt = Date.now()`, so `maxUpdatedAt(snapshot) > lastSyncedAtRef` is always true — the guard never fires.

## Why `setTimeout(0)` is unreliable

React 18 schedules passive effects (`useEffect`) via MessageChannel. MessageChannel and `setTimeout(0)` are both macro-tasks; their relative order varies by browser and load, so `preventAutoSaveRef` reset via `setTimeout(0)` cannot reliably fire after the React effect.

## The fix: `snapshotFingerprint()` + `lastSyncedContentRef`

`snapshotFingerprint(s: AppSnapshot): string` normalises the snapshot before stringifying:
1. Excludes `exportedAt` (changes every upload).
2. Filters soft-deleted items (applySnapshot filters them; buildSnapshot won't have them).
3. Uses `updatedAt ?? 0` — legacy items without a timestamp get 0, not `Date.now()`.
4. Sorts arrays by `id` and object keys alphabetically for stable stringify.

After every successful pull or upload, `lastSyncedContentRef.current = snapshotFingerprint(merged)` is stored. `markDirty` returns early if `snapshotFingerprint(incoming) === lastSyncedContentRef.current`.

**Why this works:** after `applySnapshot(merged)`, `buildSnapshot()` reconstructs state with the same `updatedAt` values as `merged` (because `stamp(m) = m.updatedAt ?? now2` returns the stored value when it exists). Legacy items get `0` in the fingerprint on both sides, making them equal. The only structural difference — deleted items — is handled by the filter.

## Additional guards kept

- `isSyncingRef`: prevents overlapping/re-entrant sync calls. Also blocks `markDirty` during `await uploadSnapshot` (React flushes effects at that yield with the flag still true).
- `isInitialSyncRef`: first pull after auto-session-restore is strictly read-only.

## Auth persistence

Token + expiresAt stored in `localStorage` (`gSync:accessToken`, `gSync:expiresAt`). `tryRestoreSession()` restores to module state if > 30 s remaining. User info stored under `gSync:userInfo`. All cleared on sign-out. `use-sync.ts` calls `tryRestoreSession()` in a mount-only `useEffect` with `[]` deps — `syncStatus` is intentionally absent from the dirty-effect deps array.
