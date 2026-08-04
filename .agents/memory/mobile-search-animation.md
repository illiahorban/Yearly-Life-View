---
name: Mobile search animation
description: The Life Calendar search bar needs a separate low-reflow animation on phone layouts.
---

On mobile, avoid animating the search bar's `height` to `"auto"` inside the sticky calendar header. Use matching fixed-height open/close animations with opacity and a small transform; make the outer slot slightly taller than the input so its border cannot be clipped. Keep the desktop height animation unchanged.

**Why:** Animating auto height on a mobile sticky header forces repeated layout recalculation across the large calendar and can look like low frame rate. Sticky `backdrop-filter` and spring animations can also make iOS rendering stutter. An opacity-only close leaves the header's layout collapsing abruptly.

**How to apply:** Branch the search animation using the existing mobile viewport signal; animate the same fixed height and margin in both directions, keep the duration short, give the input an explicit box-sized height, and use `will-change` only for the animated properties. Prefer opacity/transform over mobile height transitions, disable sticky blur on phones, and use short tweens instead of springs for compact menus.