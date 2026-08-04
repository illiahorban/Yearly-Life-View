---
name: Google GIS token lifetime
description: The Life Calendar's browser-only Google Drive auth must account for short-lived access tokens.
---

Persisting a Google Identity Services access token in localStorage does not create a long-lived Google session. Access tokens expire after roughly an hour, so a saved token must be restored with a silent GIS request when expired and refreshed before Drive operations.

**Why:** Treating an expired saved token as a signed-out state caused the UI to lose the Google account after a long-open tab or a later page reload, even when the user's Google authorization was still valid.

**How to apply:** Keep user identity separate from token validity, use `prompt: ""` for restore/refresh, and let the next Drive operation retry token acquisition rather than clearing the account immediately.