// ─── Google Drive appDataFolder operations ────────────────────────────────────
// Reads and writes a single JSON file in the hidden appDataFolder.

import { DRIVE_API_BASE, DRIVE_UPLOAD_BASE, DRIVE_FILE_NAME } from "../config";
import type { AppSnapshot } from "./sync-types";

async function driveRequest(
  method: string,
  url: string,
  token: string,
  body?: BodyInit | null,
  extraHeaders?: Record<string, string>,
): Promise<Response> {
  const resp = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...extraHeaders,
    },
    body,
  });

  if (resp.status === 401) throw new Error("UNAUTHORIZED");
  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(`Drive API error ${resp.status}: ${text.slice(0, 200)}`);
  }

  return resp;
}

/**
 * Find the app's data file in Drive appDataFolder.
 * Returns the file ID, or null if the file doesn't exist yet.
 */
export async function findAppFile(token: string): Promise<string | null> {
  const url =
    `${DRIVE_API_BASE}/files` +
    `?spaces=appDataFolder` +
    `&q=${encodeURIComponent(`name='${DRIVE_FILE_NAME}'`)}` +
    `&fields=files(id,modifiedTime)` +
    `&orderBy=modifiedTime+desc` +
    `&pageSize=1`;

  const resp = await driveRequest("GET", url, token);
  const data = (await resp.json()) as {
    files: { id: string; modifiedTime: string }[];
  };
  return data.files?.[0]?.id ?? null;
}

/**
 * Download and parse the snapshot JSON from Drive.
 * Returns null if the file is missing; propagates read/parse errors so callers
 * never mistake a temporary Drive failure for an empty calendar.
 */
export async function downloadSnapshot(
  token: string,
  fileId: string,
): Promise<AppSnapshot | null> {
  try {
    const url = `${DRIVE_API_BASE}/files/${fileId}?alt=media`;
    const resp = await driveRequest("GET", url, token);
    const json = (await resp.json()) as AppSnapshot;
    if (json?.version !== 1) {
      throw new Error("Unsupported calendar snapshot version");
    }
    return json;
  } catch (error) {
    // A deleted appDataFolder file is recoverable: the caller can create a
    // replacement. Other Drive/network failures must propagate so local
    // stale data is never uploaded over an unknown remote state.
    if (
      error instanceof Error &&
      error.message.startsWith("Drive API error 404")
    ) {
      return null;
    }
    throw error;
  }
}

/**
 * Upload a snapshot to Drive.
 * Creates the file if fileId is null, otherwise updates the existing file.
 * Returns the file ID (useful when creating for the first time).
 */
export async function uploadSnapshot(
  token: string,
  fileId: string | null,
  snapshot: AppSnapshot,
): Promise<string> {
  const payload = JSON.stringify(snapshot);

  if (fileId) {
    // Update existing file — simple media upload
    await driveRequest(
      "PATCH",
      `${DRIVE_UPLOAD_BASE}/files/${fileId}?uploadType=media`,
      token,
      payload,
      { "Content-Type": "application/json" },
    );
    return fileId;
  }

  // Create new file using multipart upload
  const metadata = JSON.stringify({
    name: DRIVE_FILE_NAME,
    parents: ["appDataFolder"],
    mimeType: "application/json",
  });

  const boundary = "-------calendar_app_boundary_x7z9";
  const body =
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${metadata}\r\n` +
    `--${boundary}\r\n` +
    `Content-Type: application/json\r\n\r\n` +
    `${payload}\r\n` +
    `--${boundary}--`;

  const resp = await driveRequest(
    "POST",
    `${DRIVE_UPLOAD_BASE}/files?uploadType=multipart&fields=id`,
    token,
    body,
    { "Content-Type": `multipart/related; boundary=${boundary}` },
  );

  const created = (await resp.json()) as { id: string };
  return created.id;
}
