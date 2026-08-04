---
name: Mobile search animation
description: The Life Calendar search bar needs a separate low-reflow animation on phone layouts.
---

On mobile and desktop, animate the search bar's content with Framer Motion `y` and opacity using a spring; let the surrounding sticky-header space follow with `layout` rather than animating the search bar's height.

**Why:** Animating height and margin directly in a sticky header forces repeated layout recalculation across the large calendar and makes the open/close feel abrupt. A transform keeps the visible search motion on the GPU while layout handles the surrounding flow.

**How to apply:** Wrap the search region in a `motion` layout container, keep `AnimatePresence` around the conditional search content, and use `initial/animate/exit` with `y` plus opacity and the shared Apple-style spring. Add `transform-gpu` and `will-change-transform` to the animated containers.