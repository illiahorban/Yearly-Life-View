---
name: Mobile day-modal scrolling
description: Keep the day modal usable above a mobile keyboard without moving the underlying calendar.
---

Do not use `window.visualViewport` sizing or custom wheel/touch edge interception for the day modal. Keep the overlay on the browser's normal fixed layout and let the inner body scroll naturally.

**Why:** On iPhone Chrome, viewport resize listeners and non-passive touch handlers interfere with the browser's native keyboard/form-assistant behavior, causing the arrows/checkmark accessory to appear. The earlier body-lock workaround also made the background jump.

**How to apply:** Keep the modal background styling and the existing mobile no-autofocus guards, but avoid adding viewport listeners, `preventDefault()` touch interception, or custom scroll-region markers. Preserve normal manual field focus and browser-managed keyboard behavior.