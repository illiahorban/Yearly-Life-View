---
name: Mobile window first tap
description: On Life Calendar phones, switching between work areas uses a dismiss-then-open interaction.
---

On mobile, when a window, panel, menu, or week-selection mode is open, a tap on another work area must close the current state first; the next tap opens the new area. Week-selection mode must close on a completed click outside its controls, not on pointerdown, so scrolling does not dismiss it.

**Why:** A single touch was both dismissing the current overlay and activating the control underneath, while pointerdown fires at the start of a scroll gesture on phones.

**How to apply:** Keep this behavior mobile-only. Use click capture for outside week-selection dismissal and guard every top-level action that can open a different window; preserve normal interactions inside the active panel.