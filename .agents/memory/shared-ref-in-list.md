---
name: Shared ref inside .map() list
description: A single useRef assigned via ref={sharedRef} inside a .map() only ends up pointing at the last-rendered item, breaking per-item logic like outside-click detection.
---

When rendering a list with `.map()`, assigning the same `ref` object (e.g. `ref={sharedRef}`) to a DOM node inside each iteration means the ref's `.current` ends up pointing at whichever item rendered last — not the specific item currently being interacted with (e.g. "the one being edited").

**Why:** A milestone list had an inline-edit form per item, gated by `isEditing = editId === item.id`, and an outside-click handler used a single `useRef` to detect clicks outside the editing form. It worked when editing the last item in the list, but for any other item, `ref.current` still pointed at the last item's (invisible, collapsed) DOM node. Clicking inside the actual edit form (e.g. a textarea) then registered as "outside" and closed the form immediately — a hard-to-reproduce bug that only appeared with multiple items and non-last-item edits.

**How to apply:** For per-item refs inside a list, use a `Map<id, HTMLElement>` (`useRef(new Map())`) with a callback ref (`ref={el => el ? map.set(id, el) : map.delete(id)}`), and look up the correct entry by the active item's id when doing outside-click/contains checks. Never rely on a single shared ref for logic that must target one specific item among several rendered in a loop.
