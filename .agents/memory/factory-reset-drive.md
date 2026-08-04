---
name: Factory reset and Drive
description: The destructive local reset must also invalidate the calendar snapshot stored in Google Drive.
---

When a user performs a factory reset, overwrite Drive with an empty factory snapshot before clearing only the calendar data, preserve the Google session, apply the empty snapshot in memory, and explicitly finish the sync without reloading the page.

**Why:** Clearing only local storage leaves the previous cloud snapshot intact; reloading also makes reset behavior depend on token restoration timing and can briefly rehydrate stale data.

**How to apply:** Wait for active syncs and cancel pending uploads, upload the empty snapshot (creating the appData file if needed), then remove only calendar keys, apply factory defaults locally, and trigger sync with that snapshot. Keep authentication keys intact; if the cloud write fails, stop the reset rather than claiming completion.