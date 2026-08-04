---
name: Mobile search animation
description: The Life Calendar search bar needs a separate low-reflow animation on phone layouts.
---

On mobile, avoid animating the search bar's `height` to `"auto"` inside the sticky calendar header. Animate only opacity and a small transform, while keeping the desktop height animation unchanged.

**Why:** Animating auto height on a mobile sticky header forces repeated layout recalculation across the large calendar and can look like low frame rate.

**How to apply:** Branch the search animation using the existing mobile viewport signal; keep the mobile duration short and use `will-change` only for the opacity/transform animation.