---
name: Mobile fixed header
description: The Life Calendar mobile header must stay visible while the calendar scrolls, including when search and the keyboard are open.
---

On mobile, keep the main calendar header `fixed` at the top of the viewport and reserve its measured height in normal document flow. Keep desktop on `sticky`.

**Why:** A mobile `sticky` header can stop sticking when the visual viewport changes while the search input and on-screen keyboard are active.

**How to apply:** Measure the mobile header with `ResizeObserver` and keep the spacer synchronized with header height, including search open/close changes. Do not replace this with a body scroll lock.