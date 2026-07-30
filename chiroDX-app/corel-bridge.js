/**
 * ChiroDX  --  CorelDraw COM Bridge  v1.0
 * ─────────────────────────────────────────
 * Node.js wrapper around run-macro.ps1.
 * Lets the Electron main process trigger VBA macros in CorelDraw
 * without the user needing to switch windows.
 *
 * Usage (in main.js IPC handlers):
 *   import { runCorelMacro, pingCorel } from './corel-bridge.js'
 *
 *   await runCorelMacro('ApplyResult')   // triggers VBA ApplyResult sub
 *   const ok = await pingCorel()         // returns true if CorelDraw is reachable
 */

import { execFile } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PS1_PATH = path.join(__dirname, 'scripts', 'run-macro.ps1');

// Optional: override which GMS project to target
// Read from config or leave empty for auto-detect
let gmsName = '';

export function setGmsName(name) {
  gmsName = name ?? '';
}

/**
 * Run a named VBA macro in the active CorelDraw instance.
 * Returns a Promise that resolves with stdout, or rejects on failure.
 *
 * @param {string} macroName - Public Sub name in ApiClient.bas / ShapeSerializer.bas etc.
 * @param {number} timeoutMs - Max time to wait (default 15s)
 */
export function runCorelMacro(macroName, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const args = [
      '-ExecutionPolicy', 'Bypass',
      '-NonInteractive',
      '-File', PS1_PATH,
      '-MacroName', macroName,
    ];

    if (gmsName) {
      args.push('-GmsName', gmsName);
    }

    const proc = execFile(
      'powershell',
      args,
      {
        windowsHide: true,
        timeout:     timeoutMs,
        encoding:    'utf8',
      },
      (err, stdout, stderr) => {
        if (err) {
          const msg = stderr?.trim() || err.message;
          reject(new Error(msg));
        } else {
          resolve(stdout?.trim() ?? 'OK');
        }
      }
    );

    // Prevent zombie processes
    proc.on('error', (err) => reject(err));
  });
}

/**
 * Check whether CorelDraw is reachable via COM.
 * Uses a lightweight macro call that does nothing but succeed.
 *
 * Returns true if CorelDraw is running and VBA macros are loaded.
 */
export async function pingCorel() {
  try {
    await runCorelMacro('Ping', 5000);
    return true;
  } catch {
    return false;
  }
}
