// ─── Google Drive Sync Configuration ─────────────────────────────────────────

export const GOOGLE_CLIENT_ID =
  "895828296496-6ic97j33a9n7vo6ljjkhqhkvugf64c6k.apps.googleusercontent.com";

export const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.appdata";

/** File stored in the hidden appDataFolder on every user's Drive. */
export const DRIVE_FILE_NAME = "calendar_app_data.json";

/** Wait this many ms after the last change before uploading to Drive. */
export const SYNC_DEBOUNCE_MS = 1_000;

/** Poll Drive for remote changes every N ms while the tab is open. */
export const SYNC_INTERVAL_MS = 5_000;

/** Base URL for Drive REST API calls. */
export const DRIVE_API_BASE = "https://www.googleapis.com/drive/v3";
export const DRIVE_UPLOAD_BASE = "https://www.googleapis.com/upload/drive/v3";
