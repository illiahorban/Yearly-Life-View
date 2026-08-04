---
name: iOS keyboard accessory
description: How Life Calendar fields should behave with the iPhone Chrome keyboard accessory.
---

On iPhone Chrome, the keyboard accessory can briefly show previous/next arrows and a checkmark before WebKit replaces it with its standard suggestions. Keep fields manually focused by the user and use native input/textarea elements. On mobile, keep editable controls at 16px or larger, avoid animated container height changes or auto-resizing event fields, and do not disable native viewport zoom while the keyboard opens. When a modal is open, mark the page behind it `inert`; hidden edit/add forms must also be `inert`, because opacity/visibility/pointer-events alone still leave their fields in WebKit's form-navigation set.

**Why:** The requested standard keyboard appearance is controlled by iOS/Chrome, not by an in-app toolbar. `autocomplete="off"` is not the right fix and can remove useful browser suggestions. A `maximum-scale`/`user-scalable=no` viewport or `dvh` modal height can also make WebKit recalculate the layout during keyboard animation. WebKit can still discover transparent/hidden editable controls, so a modal with an active background page can produce the form-navigation arrows even without a `<form>`.

**How to apply:** Do not add programmatic focus, `requestAnimationFrame` focus, `visualViewport` resize positioning, non-passive touch handlers, delayed `scrollIntoView`, or focus-time `setState` around app fields. Prefer fixed-height native textareas for event creation/editing; keep `TextareaAutosize` away from keyboard-entry paths. Treat an open modal as a true interaction boundary: the background and every inactive conditional form must be inert.
