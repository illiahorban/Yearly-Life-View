---
name: Reordering index-only array lists
description: How to add drag-reorder to state modeled as parallel arrays (done[]/labels[]/colors[]) with no per-item id.
---

Framer Motion's `Reorder.Group`/`Reorder.Item` requires each item to have a stable `value` (id) that stays attached to the item's content as it moves — not its current array index, since the index itself changes as items are dragged.

Some lists are modeled as parallel arrays keyed purely by position (e.g. a fixed-size goals list: `done: boolean[]`, `labels: string[]`, `colors?: string[]`, with a `count`) and have no per-item id field, often because the data is simple and doesn't need identity for anything else.

**Why:** adding a persisted id field to the stored data model is a bigger migration than the feature warrants; the id is only needed transiently to drive the drag library.

**How to apply:** keep a local, non-persisted shadow array of generated ids (`useState<string[]>`) with the same length as the real list, and update it in lockstep with every operation that changes the list's length or order (add, delete, reset, bulk-replace/apply-template). On `onReorder(newIds)`, compute the permutation from the old id order to the new one (`newIds.map(id => oldIds.indexOf(id))`) and apply that same permutation to every parallel array, then commit the new id order as the new shadow state.
