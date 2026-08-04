---
name: Mobile search animation
description: The Life Calendar search bar needs a separate low-reflow animation on phone layouts.
---

The search bar in the sticky calendar header must use Framer Motion with transform-only `y` and `opacity` animation on every viewport; do not animate height, margin, or padding.

**Why:** Layout-property animation makes the large sticky calendar reflow and causes the search row to appear or disappear with a visible jump, especially on iOS.

**How to apply:** Wrap the conditional search row in `AnimatePresence`; use `initial/animate/exit` values for `y` and `opacity`, add `transform-gpu will-change-transform`, and keep focus user-driven on mobile so the keyboard does not jump during the entrance animation.