---
name: Sync while editing
description: Protect local edits made while a Google Drive sync request is in flight.
---

When a Drive pull is in progress, read the latest queued or rendered local snapshot again immediately before merging the remote response.

**Why:** A fast mobile edit can happen after the request starts but before it returns. Merging against the old request-start snapshot briefly applies stale remote data and makes the new item appear, then disappear.

**How to apply:** Prefer the pending local snapshot, then the current snapshot getter, and only then the request-start snapshot when resolving a Drive response.