---
name: Mobile animation audit
description: Large Life Calendar surfaces need low-reflow mobile animations to keep opening and list updates smooth.
---

On mobile, large modal cards and calendar sections should use opacity plus a small translate, with Framer Motion `layout` disabled and heavy `backdrop-filter` avoided. Keep desktop spring, scale, layout, and blur behavior unchanged.

**Why:** The calendar renders a large grid, so mobile scale/layout transitions and broad blur surfaces trigger expensive recalculation and can make opening or list updates visibly jerky.

**How to apply:** Use the existing `useIsMobile()` branch for modal opening states, section/list `layout` props, and surface/backdrop blur styles. Preserve the desktop branch exactly where possible.