---
name: Google GIS token lifetime
description: The Life Calendar's browser-only Google Drive auth must account for short-lived access tokens.
---

Persisting a Google Identity Services access token in localStorage does not create a long-lived Google session. Access tokens expire after roughly an hour. Page-load restoration must never start GIS or show an account dialog; an expired token may be refreshed silently only from an explicit sync/sign-in action before Drive operations.

**Why:** A silent GIS refresh during page load can surface a Google account dialog in mobile WebKit, preventing the calendar from opening normally. Treating page load as signed out avoids that surprise while explicit sync can still refresh a valid grant.

**How to apply:** Keep user identity separate from token validity; restore only a token with remaining lifetime on mount; use `prompt: ""` only after an explicit sync operation has begun, and use interactive consent only from the user-triggered sign-in control.