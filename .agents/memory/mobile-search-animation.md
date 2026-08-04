---
name: Mobile search animation
description: The Life Calendar search bar needs a separate low-reflow animation on phone layouts.
---

The mobile search bar intentionally mirrors the desktop animation: Framer Motion animates `height` to `"auto"` with matching opacity and margin transitions so both layouts feel identical. Keep the mobile input's explicit height and iOS-safe typography separately.

**Why:** The user explicitly prefers the desktop search motion on mobile; the fixed-height variant felt different and less polished. The input still needs an explicit mobile height to avoid iOS clipping.

**How to apply:** Use one shared `initial/animate/exit` definition for desktop and mobile (`height: 0` ↔ `height: "auto"`, opacity, and margin), with the shared short ease-in-out transition. Keep mobile-only input sizing (`height`, `lineHeight`, and 16px font) outside the container animation.