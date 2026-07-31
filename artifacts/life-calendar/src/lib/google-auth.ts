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
  if (!accessToken) return;
  await loadGisScript();
  window.google?.accounts.oauth2.revoke(accessToken, () => {});
  accessToken = null;
  tokenExpiresAt = 0;
}
