/**
 * Temp file utilities for generated/edited images.
 * Images are saved to the OS temp directory with a "chiroDX_" prefix.
 * Files older than 1 hour are cleaned up on server start.
 */

import os from "node:os";
import path from "node:path";
import fs from "node:fs";
import fsp from "node:fs/promises";

const PREFIX = "chiroDX_";
const MAX_AGE_MS = 60 * 60 * 1000; // 1 hour

/** Give up on a slow image download rather than hanging the request. */
const DOWNLOAD_TIMEOUT_MS = 60_000;

/** Refuse absurdly large downloads (DALL-E images are a few MB at most). */
const MAX_IMAGE_BYTES = 25 * 1024 * 1024; // 25 MB

/** Image types we are willing to read from disk for colour extraction. */
export const ALLOWED_IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif"]);

const EXTENSION_MIME_TYPES = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

/**
 * Downloads an image from a URL and saves it to the OS temp folder.
 * Returns the full local Windows path
 * (e.g. C:\Users\...\AppData\Local\Temp\chiroDX_gen_123456.png)
 *
 * @param {string} url    https URL returned by the image provider
 * @param {string} suffix short tag included in the filename
 * @returns {Promise<string>} absolute path of the saved file
 */
export async function saveTempImage(url, suffix = "img") {
  // Only ever fetch the provider's own https URLs — never an arbitrary scheme.
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("Image provider returned an unusable URL.");
  }
  if (parsed.protocol !== "https:") {
    throw new Error("Image provider returned a non-HTTPS URL.");
  }

  const filename = `${PREFIX}${suffix}_${Date.now()}.png`;
  const filePath = path.join(os.tmpdir(), filename);

  let resp;
  try {
    resp = await fetch(parsed, { signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS) });
  } catch {
    throw new Error("Timed out downloading the generated image.");
  }
  if (!resp.ok) {
    throw new Error(`Could not download the generated image (${resp.status}).`);
  }

  const declaredLength = Number(resp.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_IMAGE_BYTES) {
    throw new Error("Generated image is too large to save.");
  }

  const buffer = Buffer.from(await resp.arrayBuffer());
  if (buffer.byteLength > MAX_IMAGE_BYTES) {
    throw new Error("Generated image is too large to save.");
  }

  await fsp.writeFile(filePath, buffer);
  console.log(`[Image] Saved to: ${filePath}`);
  return filePath;
}

/**
 * Read a local image as a base64 data-URL payload.
 * Used by the colour-extraction endpoint, which is given a path by the
 * CorelDraw macro (an exported bitmap) or typed in by the user.
 *
 * @param {string} imagePath absolute path to an image file
 * @returns {Promise<{ base64: string, mimeType: string }>}
 */
export async function readImageAsBase64(imagePath) {
  const ext = path.extname(imagePath).toLowerCase();
  if (!ALLOWED_IMAGE_EXTENSIONS.has(ext)) {
    const err = new Error(
      `Unsupported image type "${ext || "(none)"}". Supported: ${[...ALLOWED_IMAGE_EXTENSIONS].join(", ")}`
    );
    err.status = 400;
    throw err;
  }

  let stat;
  try {
    stat = await fsp.stat(imagePath);
  } catch {
    const err = new Error("Image file not found.");
    err.status = 400;
    throw err;
  }
  if (!stat.isFile()) {
    const err = new Error("Image path is not a file.");
    err.status = 400;
    throw err;
  }
  if (stat.size > MAX_IMAGE_BYTES) {
    const err = new Error("Image file is too large (max 25 MB).");
    err.status = 400;
    throw err;
  }

  const buffer = await fsp.readFile(imagePath);
  return {
    base64: buffer.toString("base64"),
    mimeType: EXTENSION_MIME_TYPES[ext] ?? "image/png",
  };
}

/**
 * Removes chiroDX_ temp files older than MAX_AGE_MS.
 * Called automatically on server start.
 */
export function cleanupOldTempFiles() {
  try {
    const tmpDir = os.tmpdir();
    const now = Date.now();
    let removed = 0;

    for (const name of fs.readdirSync(tmpDir)) {
      if (!name.startsWith(PREFIX)) continue;
      const fullPath = path.join(tmpDir, name);
      try {
        const { mtimeMs } = fs.statSync(fullPath);
        if (now - mtimeMs > MAX_AGE_MS) {
          fs.unlinkSync(fullPath);
          removed++;
        }
      } catch {
        // File vanished or is locked by another process — nothing to do.
      }
    }

    if (removed > 0) console.log(`[Cleanup] Removed ${removed} old temp file(s).`);
  } catch (err) {
    console.warn("[Cleanup] Warning:", err.message);
  }
}
