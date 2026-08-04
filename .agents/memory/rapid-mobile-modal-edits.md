---
name: Rapid mobile modal edits
description: Preserve sequential edits made faster than React can render the modal.
---

For editable modal drafts on mobile, calculate each next value from a synchronously updated ref and then update React state and the parent from that same value.

**Why:** React can batch rapid taps and event changes, so closures may still contain the previous render's draft; the last action can otherwise overwrite an earlier add or edit before the modal closes.

**How to apply:** Keep the ref aligned whenever the draft changes, centralize draft commits, and use that commit path for add, remove, reorder, toggle, text, color, template, and reset actions.