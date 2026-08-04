---
name: Cross-device sync control markers
description: Google Drive sync uses authoritative reset and logout markers for already-open devices.
---

Factory reset is a global replacement, not a field-level merge: a newer reset marker must make every client apply the empty snapshot before normal sync resumes. Explicit sign-out is a separate control marker that tells other open clients to revoke their local session.

**Why:** A second device can hold stale local data and otherwise re-upload or merge it back after a reset; clearing only one browser's token cannot log out another browser.

**How to apply:** Keep reset and logout markers in the Drive snapshot, poll remote changes while signed in, apply a newer reset before merging records, and broadcast logout only for an explicit sign-out (not as part of reset propagation).
