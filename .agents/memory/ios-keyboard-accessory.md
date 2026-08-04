---
name: iOS keyboard accessory
description: How Life Calendar fields should behave with the iPhone Chrome keyboard accessory.
---

On iPhone Chrome, opening a field with `autoFocus` or a programmatic `.focus()` can show the keyboard accessory bar with previous/next arrows and a checkmark. Keep all app fields manually focused by the user and use normal input types so the browser's standard password, card, address, and location suggestions remain available. Do not run delayed `onFocus` scrolling or state updates: they can make iOS recalculate the form after the keyboard appears.

**Why:** The requested standard keyboard appearance is controlled by iOS/Chrome, not by an in-app toolbar. `autocomplete="off"` is not the right fix and can remove useful browser suggestions.

**How to apply:** Do not add programmatic focus, `requestAnimationFrame` focus, `visualViewport` resize positioning, non-passive touch handlers, delayed `scrollIntoView`, or focus-time `setState` around app fields.
