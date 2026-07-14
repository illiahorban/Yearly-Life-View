---
name: Reorder drag selects sibling text
description: Why dragging a reorderable card over sibling text inputs highlights their text, and the fix.
---

When a drag-to-reorder handle is dragged (mouse button held down) across the page, the pointer passes over sibling cards that contain textareas/inputs. The browser's default behavior for a mouse-down-and-move gesture is to start a text selection, so those siblings' text visibly highlights during the drag even though the user never intended to select anything.

**Why:** Framer Motion's `Reorder.Item` drag doesn't suppress the browser's native selection behavior on its own; it only handles the layout reordering.

**How to apply:** in the drag-handle's `onDragStart`/`onDragEnd` (or pointer-down/up) handlers, toggle `document.body.style.userSelect = "none"` (and `webkitUserSelect`) for the duration of the drag, then reset it to `""` when the drag ends. Suspending selection app-wide (not just on one element) is necessary because the drag can pass over any sibling.
