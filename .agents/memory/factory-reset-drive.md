---
name: Factory reset and Drive
description: The destructive local reset must also invalidate the calendar snapshot stored in Google Drive.
---

When a user performs a factory reset while Google sync is active, overwrite the existing Drive snapshot with an empty factory snapshot before clearing only the calendar data. Preserve the Google session.

**Why:** Clearing only local storage leaves the previous cloud snapshot intact; the next sign-in merges that older data back into the new local state.

**How to apply:** Wait for active syncs and cancel pending uploads, upload the empty snapshot to the existing Drive file, then remove only the app's calendar keys and reload. Keep authentication keys intact; if the cloud write fails, stop the reset rather than claiming completion.