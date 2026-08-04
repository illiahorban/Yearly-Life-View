---
name: iOS keyboard accessory
description: How Life Calendar fields should behave with the iPhone Chrome keyboard accessory.
---

On iPhone Chrome, opening a field with `autoFocus` or a programmatic `.focus()` can show the keyboard accessory bar with previous/next arrows and a checkmark. Avoid automatic focus on mobile for searches, add/edit forms, and newly created fields. Keep manual focus and normal input types so the browser's standard password, card, address, and location suggestions remain available.

**Why:** The requested standard keyboard appearance is controlled by iOS/Chrome, not by an in-app toolbar. `autocomplete="off"` is not the right fix and can remove useful browser suggestions.

**How to apply:** Use the existing mobile breakpoint to guard autofocus effects and conditional `autoFocus`; preserve desktop autofocus and manual focus behavior. Do not add `visualViewport` resize positioning or non-passive touch handlers around the modal, because those can also trigger the non-standard accessory state.