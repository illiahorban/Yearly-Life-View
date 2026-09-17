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
  hint?: string;
  login_hint?: string;
}

export interface OverridableTokenClientConfig {
  prompt?: string;
  hint?: string;
  login_hint?: string;
  enable_granular_consent?: boolean;
}

interface TokenClient {
  requestAccessToken(opts?: OverridableTokenClientConfig): void;
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

const LS_TOKEN = "gSync:accessToken";
const LS_EXPIRES = "gSync:expiresAt";
const LS_USER_INFO = "gSync:userInfo";
const LS_SESSION_STARTED = "gSync:sessionStartedAt";
const LS_SIGNED_IN = "gSync:signedIn";

// ── Module-level state (singleton) ────────────────────────────────────────────

let tokenClient: TokenClient | null = null;
let accessToken: string | null = null;
let tokenExpiresAt = 0;

let pendingResolve: ((token: string) => void) | null = null;
let pendingReject: ((err: Error) => void) | null = null;
let pendingTokenRequest: Promise<string> | null = null;

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
    script.onload = () => {
      scriptLoaded = true;
      resolve();
    };
    script.onerror = () => reject(new Error("Failed to load GIS script"));
    document.head.appendChild(script);
  });

  return scriptLoading;
}

// ── Token persistence ─────────────────────────────────────────────────────────

function persistToken(token: string, expiresAt: number): void {
  try {
    // Persist in localStorage so authentication survives browser reloads and restarts
    localStorage.setItem(LS_TOKEN, token);
    localStorage.setItem(LS_EXPIRES, String(expiresAt));
    localStorage.setItem(LS_SIGNED_IN, "true");
    sessionStorage.setItem(LS_TOKEN, token);
    sessionStorage.setItem(LS_EXPIRES, String(expiresAt));
  } catch {
    /* non-fatal: private browsing may block writes */
  }
}

function clearPersistedToken(): void {
  try {
    localStorage.removeItem(LS_TOKEN);
    localStorage.removeItem(LS_EXPIRES);
    sessionStorage.removeItem(LS_TOKEN);
    sessionStorage.removeItem(LS_EXPIRES);
  } catch {
    /* non-fatal */
  }
}

/** Check whether user is considered signed in to Google in this app. */
export function isUserSignedIn(): boolean {
  try {
    if (localStorage.getItem(LS_SIGNED_IN) === "true") return true;
    if (getStoredUserInfo() !== null) return true;
    return false;
  } catch {
    return false;
  }
}

export function setSignedInFlag(signedIn: boolean): void {
  try {
    if (signedIn) {
      localStorage.setItem(LS_SIGNED_IN, "true");
    } else {
      localStorage.removeItem(LS_SIGNED_IN);
    }
  } catch {
    /* non-fatal */
  }
}

/** Persist user info (name, email, picture) so it can be restored on page load. */
export function persistUserInfo(info: StoredUserInfo): void {
  try {
    localStorage.setItem(LS_USER_INFO, JSON.stringify(info));
    localStorage.setItem(LS_SIGNED_IN, "true");
  } catch {
    /* non-fatal */
  }
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

/** Record when this browser session was authenticated for remote logout checks. */
export function persistSessionStartedAt(value = Date.now()): void {
  try {
    localStorage.setItem(LS_SESSION_STARTED, String(value));
  } catch {
    /* non-fatal */
  }
}

export function getSessionStartedAt(): number {
  try {
    return Number(localStorage.getItem(LS_SESSION_STARTED) ?? 0) || 0;
  } catch {
    return 0;
  }
}

// ── Token client init ─────────────────────────────────────────────────────────

let proactiveRefreshTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleProactiveRefresh(expiresInSeconds: number) {
  if (proactiveRefreshTimer) {
    clearTimeout(proactiveRefreshTimer);
    proactiveRefreshTimer = null;
  }
  // Refresh ~10 minutes before expiry (or 30s minimum if short-lived)
  const refreshInMs = Math.max(30_000, (expiresInSeconds - 600) * 1000);
  proactiveRefreshTimer = setTimeout(async () => {
    proactiveRefreshTimer = null;
    if (document.visibilityState === "visible" && navigator.onLine && isUserSignedIn()) {
      try {
        await signInSilent();
        console.log("[auth] proactive background token refresh succeeded");
      } catch (err) {
        console.warn("[auth] proactive background token refresh deferred:", err);
      }
    }
  }, refreshInMs);
}

async function ensureTokenClient(): Promise<void> {
  await loadGisScript();

  if (tokenClient) return;

  if (!window.google) throw new Error("Google Identity Services not available");

  const storedUser = getStoredUserInfo();
  const userEmail = storedUser?.email || undefined;

  tokenClient = window.google.accounts.oauth2.initTokenClient({
    client_id: GOOGLE_CLIENT_ID,
    scope: DRIVE_SCOPE,
    hint: userEmail,
    login_hint: userEmail,
    callback: (resp: TokenResponse) => {
      if (resp.error || !resp.access_token) {
        const err = new Error(
          resp.error_description ?? resp.error ?? "Auth failed",
        );
        (err as any).googleError = resp.error ?? "auth_failed";
        if (pendingReject) {
          pendingReject(err);
          pendingReject = null;
          pendingResolve = null;
        }
        return;
      }
      accessToken = resp.access_token;
      const expiresIn = Number(resp.expires_in ?? 3600);
      tokenExpiresAt = Date.now() + (expiresIn - 60) * 1000;
      // Persist so the session survives a page reload (valid for ~1 hour)
      persistToken(accessToken, tokenExpiresAt);
      scheduleProactiveRefresh(expiresIn);
      if (pendingResolve) {
        pendingResolve(accessToken);
        pendingResolve = null;
        pendingReject = null;
      }
    },
    error_callback: (err) => {
      const error = new Error(err.message ?? err.type ?? "Auth error");
      (error as any).googleError = err.type ?? "auth_error";
      if (pendingReject) {
        pendingReject(error);
        pendingReject = null;
        pendingResolve = null;
      }
    },
  });
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Attempt to restore a previous session from storage without showing any
 * Google UI. Returns true if a non-expired token was found and restored into
 * the module-level singleton, false otherwise.
 */
export function tryRestoreSession(): boolean {
  try {
    const storedToken =
      localStorage.getItem(LS_TOKEN) || sessionStorage.getItem(LS_TOKEN);
    const storedExpires = Number(
      localStorage.getItem(LS_EXPIRES) ||
        sessionStorage.getItem(LS_EXPIRES) ||
        "0",
    );

    // Require at least 30 s of remaining validity so we don't restore a token
    // that will expire before the first Drive request completes.
    if (storedToken && storedExpires > Date.now() + 30_000) {
      accessToken = storedToken;
      tokenExpiresAt = storedExpires;
      scheduleProactiveRefresh(Math.round((storedExpires - Date.now()) / 1000));
      return true;
    }
  } catch {
    /* non-fatal */
  }
  return false;
}

/**
 * Restore a previous Google session without starting any Google UI.
 *
 * Checks if the user is authenticated in this app and restores or silently refreshes
 * the access token via Google Identity Services. Crucially, does NOT log out the user
 * if token refresh fails temporarily (e.g. offline on launch).
 */
export async function restoreSession(): Promise<boolean> {
  // 1. Check if we already have a valid unexpired token in storage
  if (tryRestoreSession()) {
    return true;
  }

  // 2. If the user is authenticated, attempt silent token restoration (no user popup)
  if (isUserSignedIn()) {
    try {
      const token = await signInSilent();
      if (token) {
        return true;
      }
    } catch (err) {
      // Non-fatal: the user remains authenticated in the app, but a token will
      // be requested upon the next network connection or explicit sync trigger.
      console.warn("[auth] silent token restore failed (will retry on next sync):", err);
      return false;
    }
  }

  return false;
}

/**
 * Request an access token interactively (shows the Google popup).
 * Always supplies hint and login_hint to bypass the "Choose an account" screen.
 */
export async function signInWithGoogle(): Promise<string> {
  await ensureTokenClient();
  if (!tokenClient) throw new Error("Token client not initialised");

  // Interactive: user clicked, so popup is allowed. Use hint to skip account picker.
  const token = await requestToken(accessToken ? "" : "consent", true);
  setSignedInFlag(true);
  return token;
}

/**
 * Attempt a strictly silent token refresh (prompt: "none").
 * NEVER opens a popup or window.
 * Rejects if user interaction is required.
 */
export async function signInSilent(): Promise<string> {
  await ensureTokenClient();
  if (!tokenClient) throw new Error("Token client not initialised");

  return requestToken("none", false);
}

function requestToken(prompt: string, interactive = false): Promise<string> {
  if (pendingTokenRequest) return pendingTokenRequest;

  const request = new Promise<string>((resolve, reject) => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    // For non-interactive requests, time out quickly (6s) so sync doesn't hang
    if (!interactive) {
      timer = setTimeout(() => {
        if (pendingReject) {
          pendingResolve = null;
          pendingReject = null;
          const err = new Error("Silent auth timeout");
          (err as any).googleError = "timeout";
          reject(err);
        }
      }, 6_000);
    }

    pendingResolve = (token: string) => {
      if (timer) clearTimeout(timer);
      resolve(token);
    };
    pendingReject = (err: Error) => {
      if (timer) clearTimeout(timer);
      reject(err);
    };
    try {
      const storedUser = getStoredUserInfo();
      const userEmail = storedUser?.email || undefined;
      const opts: OverridableTokenClientConfig = {
        prompt: interactive ? prompt : "none",
      };
      if (userEmail) {
        opts.hint = userEmail;
        opts.login_hint = userEmail;
      }
      tokenClient!.requestAccessToken(opts);
    } catch (e) {
      if (timer) clearTimeout(timer);
      reject(e instanceof Error ? e : new Error(String(e)));
    }
  });

  let trackedRequest: Promise<string>;
  trackedRequest = request.finally(() => {
    if (pendingTokenRequest === trackedRequest) {
      pendingTokenRequest = null;
    }
  });
  pendingTokenRequest = trackedRequest;
  return trackedRequest;
}

/**
 * Get a valid token for Drive operations.
 * If interactive is false (default for background sync, polling, wake/focus),
 * it ONLY attempts silent refresh (prompt: "none") and NEVER opens a popup.
 * If silent refresh requires interaction, it throws without opening any popup window.
 */
export async function getValidToken(interactive = false): Promise<string> {
  // Refresh one minute before the stored expiry. This avoids losing a sync
  // request when the token expires between its first and last Drive call.
  if (accessToken && Date.now() + 60_000 < tokenExpiresAt) return accessToken;

  // Try checking storage first (in case it was refreshed in another tab or instance)
  if (tryRestoreSession()) {
    if (accessToken && Date.now() + 60_000 < tokenExpiresAt) return accessToken;
  }

  await ensureTokenClient();
  if (!tokenClient) throw new Error("Token client not initialised");

  if (!interactive) {
    return requestToken("none", false);
  } else {
    return requestToken("", true);
  }
}

/** Returns true while the user is authenticated with Google in this app. */
export function isSignedIn(): boolean {
  return isUserSignedIn() || !!accessToken;
}

/** Revoke the token and clear local state when the user personally signs out. */
export async function signOutFromGoogle(): Promise<void> {
  if (proactiveRefreshTimer) {
    clearTimeout(proactiveRefreshTimer);
    proactiveRefreshTimer = null;
  }
  const token = accessToken;
  accessToken = null;
  tokenExpiresAt = 0;
  clearPersistedToken();
  try {
    localStorage.removeItem(LS_USER_INFO);
    localStorage.removeItem(LS_SESSION_STARTED);
    localStorage.removeItem(LS_SIGNED_IN);
  } catch {
    /* non-fatal */
  }
  if (token) {
    try {
      await loadGisScript();
      window.google?.accounts.oauth2.revoke(token, () => {});
    } catch {
      /* non-fatal */
    }
  }
}
