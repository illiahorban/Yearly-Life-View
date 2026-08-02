---
name: Sync loop fix
description: Root causes and fix for the Google Drive infinite sync loop in Life Calendar.
---

# Drive Sync Infinite Loop — Root Causes & Fix

## The loop
`doSync` → `applySnapshot` → `setState` → React useEffect → `markDirty` → debounce setTimeout → `doSync` → ...

## Root cause 1 — too many doSync triggers
The hook had a `setInterval` (every 10 s), a `focus` listener, and a `visibilitychange` listener, all calling `doSync`. Combined with the markDirty path, this produced 9+ calls/second when the fingerprint guard failed.

**Fix:** Removed the interval, focus, and visibilitychange triggers entirely. `doSync` is now called from exactly two places: (1) the mount `useEffect` (once, read-only pull) and (2) `markDirty`'s debounce (user edit, 1 s debounce).

## Root cause 2 — calendarConfigs updatedAt lost in localStorage
`applySnapshot` wrote `cfg.data` (the raw `CalendarConfig`) to `localStorage("lifeCalendar:v1:{yr}")` without the `updatedAt` wrapper. `buildSnapshot` then read it back and fell back to `Date.now()`. `snapshotFingerprint` normalises with `?? 0`, so `Date.now() !== storedUpdatedAt` → fingerprint mismatch → loop.

**Fix:** `applySnapshot` now stores `{ ...cfg.data, updatedAt: cfg.updatedAt }`. `buildSnapshot` destructures `updatedAt` back out so `data` stays clean.

## Root cause 3 — quarterMeta updatedAt lost
`quarterMeta` state is `QuarterMeta[]`. `buildSnapshot` tried to read `.updatedAt` off the array (always `undefined`) and fell back to `Date.now()`. Same fingerprint mismatch.

**Fix:** `applySnapshot` stores `snapshot.quarterMeta.updatedAt` to `localStorage("lifeCalendar:quarterMeta:updatedAt")`. `buildSnapshot` reads it from there. `updateQuarterMeta` stamps `Date.now()` to the same key on user edits.

## Hard stop guard in doSync
Before calling `applyRef.current(merged)`, fingerprint the merged snapshot. If it matches `lastSyncedContentRef.current`, skip `applyRef` and the upload entirely (no setState, no network). This breaks any residual loop even if fingerprints drift.

**Why:** React 18 flushes batched state updates AFTER `isSyncingRef` is cleared in `finally`, so the markDirty guard based on `isSyncingRef` alone is not sufficient — the fingerprint guard is needed too.

## HMR hook-count mismatch after removing hooks
Removing `useCallback`/`useEffect` hooks from `useSyncEngine` changes the total hook count React tracks in `App.tsx` during HMR. This throws "invalid hook call" and requires a **workflow restart** (not just a save) to recover.
