---
name: Mobile search animation
description: The Life Calendar search bar needs a separate low-reflow animation on phone layouts.
---

On mobile, animate the search bar from `y: -15` with opacity using a `380/30` spring; when closing, fade it out without moving it. Desktop keeps the deeper `-100%` entrance. Let the surrounding sticky-header space follow with `layout`.

**Why:** Animating height and margin directly in a sticky header forces repeated layout recalculation across the large calendar and makes the open/close feel abrupt. A transform keeps the visible search motion on the GPU, while a simple fade avoids a distracting reverse slide and layout handles the surrounding flow.

**How to apply:** Wrap the search region in a `motion` layout container, keep `AnimatePresence` around the conditional search content, use `y` plus opacity for entrance, and use opacity-only exit on mobile. Add `transform-gpu` and `will-change-transform`; keep search controls tap-highlight-free and animate the toggle with `whileTap`.