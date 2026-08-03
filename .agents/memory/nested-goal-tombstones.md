---
name: Nested goal tombstones
description: Conflict-safe deletion rules for nested goal collections in Life Calendar sync.
---

Nested syncable goals must retain a tombstone per goal (`isDeleted: true` with a fresh `updatedAt`) when removed. The parent block should also be timestamped, but it cannot replace per-goal records.

**Why:** A later edit to another goal can make the parent block newer while an older cloud copy still contains the removed goal. Merging only at the parent level resurrects that goal.

**How to apply:** Merge goal collections by goal id, keep deleted goals in snapshots and local storage, filter tombstones only at UI boundaries, and preserve existing tombstones when saving an edited list.