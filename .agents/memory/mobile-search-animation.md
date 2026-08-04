---
name: Mobile search animation
description: The Life Calendar search bar needs a separate low-reflow animation on phone layouts.
---

The mobile search bar uses a low-reflow animation: a fixed-height parent slot reserves header space while the visible bar animates only `y` and opacity on the GPU. Desktop keeps its height animation.

**Why:** Animating the sticky header's height to `"auto"` on phones forces the large calendar to relayout on every frame and causes visible lag. The sprint panel stays smooth because it animates transform and opacity only.

**How to apply:** On mobile, keep a fixed parent height while open, position the bar absolutely inside it, and animate `y` plus opacity with GPU classes. Keep mobile-only input sizing (`height`, `lineHeight`, and 16px font) outside the container animation; leave desktop's shared height/opacity transition unchanged.