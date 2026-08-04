---
name: iOS keyboard accessory
description: How Life Calendar fields should behave with the iPhone Chrome keyboard accessory.
---

On iPhone Chrome, the keyboard accessory can briefly show previous/next arrows and a checkmark before WebKit replaces it with its standard suggestions. Keep fields manually focused by the user and use native input/textarea elements. Do not keep inactive edit/add forms mounted behind `opacity`, `visibility`, `pointer-events`, or only `inert`; conditionally render them or use `display: none` so WebKit cannot include their fields in form navigation. Preserve the normal viewport and text-size behavior instead of forcing mobile input sizes.

**Why:** The requested standard keyboard appearance is controlled by iOS/Chrome, not by an in-app toolbar, but the page can still change which fields WebKit discovers. Transparent or visibility-hidden editable controls were enough to reintroduce the arrows in this app. Forced `font-size`, `user-select`, animation overrides, and modal geometry hacks also changed WebKit's timing. `autocomplete="off"` is not the right fix and can remove useful browser suggestions.

**How to apply:** Do not add programmatic focus, `requestAnimationFrame` focus, `visualViewport` resize positioning, non-passive touch handlers, delayed `scrollIntoView`, or focus-time `setState` around app fields. Prefer fixed-height native textareas for event creation/editing; keep `TextareaAutosize` away from keyboard-entry paths. Treat an open modal as a true interaction boundary and unmount inactive conditional forms. Avoid new iOS-specific CSS overrides unless a physical-device regression proves they are needed.
