---
name: Mobile search animation
description: The Life Calendar search bar needs a separate low-reflow animation on phone layouts.
---

On mobile, animate the search bar from `y: -15` with opacity using a `380/30` spring; desktop keeps the deeper `-100%` entrance. Let the surrounding sticky-header space follow with `layout`.

**Why:** Animating height and margin directly in a sticky header forces repeated layout recalculation across the large calendar and makes the open/close feel abrupt. A transform keeps the visible search motion on the GPU while layout handles the surrounding flow.

**How to apply:** Wrap the search region in a `motion` layout container, keep `AnimatePresence` around the conditional search content, and use `initial/animate/exit` with `y` plus opacity. Add `transform-gpu` and `will-change-transform`; keep search controls tap-highlight-free and animate the toggle with `whileTap`.