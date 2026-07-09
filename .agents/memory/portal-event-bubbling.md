---
name: Portal click bubbles via React tree, not DOM
description: React portal content bubbles synthetic events to its JSX ancestor, not its DOM parent — matters for nested modals/dialogs.
---

A component rendered with `ReactDOM.createPortal(..., document.body)` is detached from its parent in the DOM tree, but React's synthetic event system still propagates according to the **JSX/component tree**, not the DOM tree. If that portaled component is a JSX descendant of another component (e.g. a confirm dialog rendered from inside a parent modal), clicks inside the portal still bubble up through the parent's React event handlers.

**Why:** A shared `ConfirmDialog` component's overlay had `onClick={onClose}` without `stopPropagation()`. It was called as a JSX sibling of a modal's "card" div (which itself only stops propagation for its own subtree), both nested under the modal's outer backdrop (`onClick={onClose-of-modal}`). Any click on the confirm dialog's overlay or buttons bubbled past the dialog's own onClose and closed the entire parent modal — even though the dialog rendered to `document.body` and visually/DOM-wise looked unrelated. This was intermittent and hard to reproduce because it depended on which confirm dialog appeared and where in the JSX tree it sat relative to the stopPropagation boundary.

**How to apply:** Any dialog/overlay component that portals to `document.body` and closes itself via a backdrop `onClick` must call `e.stopPropagation()` in that handler (not just call `onClose()`), regardless of DOM nesting — otherwise assume the event will bubble to whatever ancestor JSX component rendered it, potentially closing unrelated ancestor modals.
