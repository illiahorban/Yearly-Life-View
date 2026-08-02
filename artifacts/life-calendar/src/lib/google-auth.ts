// ─── Google Identity Services (GIS) Token Client ─────────────────────────────
// Uses the OAuth 2.0 implicit / token model — no server-side code required.

import { GOOGLE_CLIENT_ID, DRIVE_SCOPE } from "../config";

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient(cfg: TokenClientConfig): TokenClient;
          revoke(token: string, done: () => void): void;
        };
      };
    };
  }
}

interface TokenClientConfig {
  client_id: string;
  scope: string;
  callback: (resp: TokenResponse) => void;
  error_callback?: (err: { type: string; message?: string }) => void;
}

interface TokenClient {
  requestAccessToken(opts?: { prompt?: string }): void;
}

interface TokenResponse {
  access_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
}

export interface StoredUserInfo {
  name: string;
  email: string;
  picture?: string;
}

// ── localStorage keys ─────────────────────────────────────────────────────────

const LS_TOKEN     = "gSync:accessToken";
const LS_EXPIRES   = "gSync:expiresAt";
const LS_USER_INFO = "gSync:userInfo";

// ── Module-level state (singleton) ────────────────────────────────────────────

let tokenClient: TokenClient | null = null;
let accessToken: string | null = null;
let tokenExpiresAt = 0;

let pendingResolve: ((token: string) => void) | null = null;
let pendingReject: ((err: Error) => void) | null = null;

// ── Script loading ────────────────────────────────────────────────────────────

let scriptLoaded = false;
let scriptLoading: Promise<void> | null = null;

function loadGisScript(): Promise<void> {
  if (scriptLoaded) return Promise.resolve();
  if (scriptLoading) return scriptLoading;

  scriptLoading = new Promise<void>((resolve, reject) => {
    if (typeof window === "undefined") return reject(new Error("No window"));
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = () => { scriptLoaded = true; resolve(); };
    script.onerror = () => reject(new Error("Failed to load GIS script"));
    document.head.appendChild(script);
  });

  return scriptLoading;
}

// ── Token persistence ─────────────────────────────────────────────────────────

function persistToken(token: string, expiresAt: number): void {
  try {
    localStorage.setItem(LS_TOKEN, token);
    localStorage.setItem(LS_EXPIRES, String(expiresAt));
  } catch { /* non-fatal: private browsing may block writes */ }
}

function clearPersistedToken(): void {
  try {
    localStorage.removeItem(LS_TOKEN);
    localStorage.removeItem(LS_EXPIRES);
  } catch { /* non-fatal */ }
}

/** Persist user info (name, email, picture) so it can be restored on page load. */
export function persistUserInfo(info: StoredUserInfo): void {
  try {
    localStorage.setItem(LS_USER_INFO, JSON.stringify(info));
  } catch { /* non-fatal */ }
}

/** Read stored user info. Returns null if nothing is saved or parsing fails. */
export function getStoredUserInfo(): StoredUserInfo | null {
  try {
    const raw = localStorage.getItem(LS_USER_INFO);
    return raw ? (JSON.parse(raw) as StoredUserInfo) : null;
  } catch {
    return null;
  }
}

// ── Token client init ─────────────────────────────────────────────────────────

async function ensureTokenClient(): Promise<void> {
  await loadGisScript();

  if (tokenClient) return;

  if (!window.google) throw new Error("Google Identity Services not available");

  tokenClient = window.google.accounts.oauth2.initTokenClient({
    client_id: GOOGLE_CLIENT_ID,
    scope: DRIVE_SCOPE,
    callback: (resp: TokenResponse) => {
      if (resp.error || !resp.access_token) {
        const err = new Error(resp.error_description ?? resp.error ?? "Auth failed");
        if (pendingReject) { pendingReject(err); pendingReject = null; pendingResolve = null; }
        return;
      }
      accessToken = resp.access_token;
      tokenExpiresAt = Date.now() + (Number(resp.expires_in ?? 3600) - 60) * 1000;
      // Persist so the session survives a page reload (valid for ~1 hour)
      persistToken(accessToken, tokenExpiresAt);
      if (pendingResolve) { pendingResolve(accessToken); pendingResolve = null; pendingReject = null; }
    },
    error_callback: (err) => {
      const error = new Error(err.message ?? err.type ?? "Auth error");
      if (pendingReject) { pendingReject(error); pendingReject = null; pendingResolve = null; }
    },
  });
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Attempt to restore a previous session from localStorage without showing any
 * Google UI. Returns true if a non-expired token was found and restored into
 * the module-level singleton, false otherwise.
 *
 * Call this once on app mount. If it returns true, call `startAutoSync` /
 * `doSync` to pull the latest data; the in-memory token will be used directly.
 */
export function tryRestoreSession(): boolean {
  try {
    const storedToken   = localStorage.getItem(LS_TOKEN);
    const storedExpires = Number(localStorage.getItem(LS_EXPIRES) ?? "0");
    // Require at least 30 s of remaining validity so we don't restore a token
    // that will expire before the first Drive request completes.
    if (storedToken && storedExpires > Date.now() + 30_000) {
      accessToken    = storedToken;
      tokenExpiresAt = storedExpires;
      return true;
    }
  } catch { /* non-fatal */ }
  return false;
}

/**
 * Request an access token interactively (shows the Google consent popup).
 * Returns the token string.
 */
export async function signInWithGoogle(): Promise<string> {
  await ensureTokenClient();
  if (!tokenClient) throw new Error("Token client not initialised");

  return new Promise<string>((resolve, reject) => {
    pendingResolve = resolve;
    pendingReject = reject;
    // prompt="" silently reuses existing grant; "consent" forces the dialog.
    tokenClient!.requestAccessToken({ prompt: accessToken ? "" : "consent" });
  });
}

/**
 * Attempt a silent token refresh (no popup). Useful after tryRestoreSession
 * detects the stored token has expired but the user's Google grant is still
 * active in the browser. Rejects if user interaction is required.
 */
export async function signInSilent(): Promise<string> {
  await ensureTokenClient();
  if (!tokenClient) throw new Error("Token client not initialised");

  return new Promise<string>((resolve, reject) => {
    pendingResolve = resolve;
    pendingReject = reject;
    tokenClient!.requestAccessToken({ prompt: "" }); // no popup
  });
}

/**
 * Silently refresh the token if we already have one and it's near expiry.
 * Returns the token if still valid or refreshed; throws if the user needs
 * to sign in again.
 */
export async function getValidToken(): Promise<string> {
  if (accessToken && Date.now() < tokenExpiresAt) return accessToken;
  if (!tokenClient) throw new Error("Not signed in");

  // Try silent refresh (prompt="")
  return new Promise<string>((resolve, reject) => {
    pendingResolve = resolve;
    pendingReject = reject;
    tokenClient!.requestAccessToken({ prompt: "" });
  });
}

/** Returns true if we currently have a non-expired access token. */
export function isSignedIn(): boolean {
  return !!accessToken && Date.now() < tokenExpiresAt;
}

/** Revoke the token and clear local state. */
export async function signOutFromGoogle(): Promise<void> {
  const token = accessToken;
  accessToken    = null;
  tokenExpiresAt = 0;
  clearPersistedToken();
  try { localStorage.removeItem(LS_USER_INFO); } catch { /* non-fatal */ }
  if (token) {
    await loadGisScript();
    window.google?.accounts.oauth2.revoke(token, () => {});
  }
}
