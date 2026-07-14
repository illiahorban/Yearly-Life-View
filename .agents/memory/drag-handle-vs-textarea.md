---
name: Drag handle vs full-card text input
description: Why "grab anywhere on the card" drag-to-reorder fails when the card is mostly a textarea/input, and the fix.
---

If a list item's visual "container" is almost entirely filled by an editable textarea/input (common for note-style cards with only a few px of padding), attaching drag-start handlers to the outer container does not work in practice: the textarea sits on top and swallows the pointer event (and shows a text-edit cursor), so there's no real area left to grab. Users report "hovering always shows the text cursor, I can't drag it."

**Why:** the outer wrapper and the textarea are basically the same size — there's no exposed margin of the "container" outside the input to click on.

**How to apply:** don't try to make the whole card draggable when it's dominated by a text input. Add a small dedicated grip strip (e.g. a fixed-width column with a grip icon, `cursor: grab`) as a sibling next to the textarea, and only wire the drag-start pointer handlers to that strip. Keep the textarea's own pointer handlers untouched so typing/click-to-position-cursor still works normally.
