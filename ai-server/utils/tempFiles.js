/**
 * Temp file utilities for generated/edited images.
 * Images are saved to the OS temp directory with a "chiroDX_" prefix.
 * Files older than 1 hour are cleaned up on server start.
 */

import os from "os";
import path from "path";
import fs from "fs";

const PREFIX = "chiroDX_";
const MAX_AGE_MS = 60 * 60 * 1000; // 1 hour

/**
 * Downloads an image from a URL and saves it to the OS temp folder.
 * Returns the full local Windows path (e.g. C:\Users\...\AppData\Local\Temp\chiroDX_gen_123456.png)
 */
export async function saveTempImage(url, suffix = "img") {
  const filename = `${PREFIX}${suffix}_${Date.now()}.png`;
  const filePath = path.join(os.tmpdir(), filename);

  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Failed to download image: ${resp.statusText}`);

  const buffer = await resp.arrayBuffer();
  fs.writeFileSync(filePath, Buffer.from(buffer));

  console.log(`[Image] Saved to: ${filePath}`);
  return filePath;
}

/**
 * Removes chiroDX_ temp files older than MAX_AGE_MS.
 * Called automatically on server start.
 */
export function cleanupOldTempFiles() {
  try {
    const tmpDir = os.tmpdir();
    const now = Date.now();
    const removed = [];

    fs.readdirSync(tmpDir)
      .filter((f) => f.startsWith(PREFIX))
      .forEach((f) => {
        const fullPath = path.join(tmpDir, f);
        try {
          const { mtimeMs } = fs.statSync(fullPath);
          if (now - mtimeMs > MAX_AGE_MS) {
            fs.unlinkSync(fullPath);
            removed.push(f);
          }
        } catch (_) { /* file may have been deleted already */ }
      });

    if (removed.length > 0)
      console.log(`[Cleanup] Removed ${removed.length} old temp file(s).`);
  } catch (err) {
    console.warn("[Cleanup] Warning:", err.message);
  }
}
