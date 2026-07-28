---
name: Mobile day-modal scrolling
description: Keep the day modal usable above a mobile keyboard without moving the underlying calendar.
---

The day modal must use `window.visualViewport` to size its overlay to the actual visible screen while a mobile keyboard is open. It should remain normally centred within that visible area. Stop wheel and touch gestures only when its internal scroll body reaches an edge, so they cannot scroll the calendar behind it.

**Why:** Fixing the page body with `position: fixed` prevents scroll chaining but visibly makes the background jump to the top as modal state changes. Static viewport CSS alone also uses the layout viewport on mobile, which can leave the top of a tall modal behind the keyboard.

**How to apply:** Keep the background document untouched. For scrollable mobile dialogs, use a stable inner scroll-region marker and non-passive wheel/touch boundary handlers, plus `visualViewport` resize and scroll listeners for overlay height and offset. On focus, centre the field by scrolling that inner region only. Route every focus path through one debounced local scroll; do not combine focus effects with per-input scroll handlers.