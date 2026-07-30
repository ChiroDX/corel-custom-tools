/**
 * ChiroDX  --  CorelDraw COM Bridge  v1.1
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

import { execFile } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PS1_PATH = path.join(__dirname, 'scripts', 'run-macro.ps1');

/**
 * VBA identifiers only. Arguments are passed to PowerShell as an argv array
 * (never a command string), so this is defence in depth rather than the only
 * guard — but it also stops a value starting with "-" being read as a flag.
 */
const MACRO_NAME_PATTERN = /^[A-Za-z][A-Za-z0-9_]{0,63}$/;
const GMS_NAME_PATTERN = /^[A-Za-z0-9 _.-]{1,64}$/;

// Optional: override which GMS project to target.
// Read from config or leave empty for auto-detect.
let gmsName = '';

/**
 * @param {string} name GMS project name, or '' to auto-detect
 * @throws {Error} if the name contains unexpected characters
 */
export function setGmsName(name) {
  const value = name ?? '';
  if (value !== '' && !GMS_NAME_PATTERN.test(value)) {
    throw new Error('Invalid GMS project name.');
  }
  gmsName = value;
}

/**
 * Run a named VBA macro in the active CorelDraw instance.
 * Returns a Promise that resolves with stdout, or rejects on failure.
 *
 * @param {string} macroName - Public Sub name in ApiClient.bas / ShapeSerializer.bas etc.
 * @param {number} timeoutMs - Max time to wait (default 15s)
 * @returns {Promise<string>}
 */
export function runCorelMacro(macroName, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    if (!MACRO_NAME_PATTERN.test(macroName ?? '')) {
      reject(new Error(`Invalid macro name: ${macroName}`));
      return;
    }

    const args = [
      '-ExecutionPolicy', 'Bypass',
      '-NonInteractive',
      '-NoProfile',
      '-File', PS1_PATH,
      '-MacroName', macroName,
    ];

    if (gmsName) {
      args.push('-GmsName', gmsName);
    }

    execFile(
      'powershell',
      args,
      {
        windowsHide: true,
        timeout: timeoutMs,
        encoding: 'utf8',
        // run-macro.ps1 only ever prints a few status lines.
        maxBuffer: 1024 * 1024,
      },
      (err, stdout, stderr) => {
        if (err) {
          if (err.killed) {
            reject(new Error(`CorelDraw did not respond within ${timeoutMs / 1000}s.`));
            return;
          }
          reject(new Error(stderr?.trim() || err.message));
          return;
        }
        resolve(stdout?.trim() || 'OK');
      }
    );
  });
}

/**
 * Check whether CorelDraw is reachable via COM.
 * Uses a lightweight macro call that does nothing but succeed.
 *
 * @returns {Promise<boolean>} true if CorelDraw is running and VBA macros are loaded
 */
export async function pingCorel() {
  try {
    await runCorelMacro('Ping', 5000);
    return true;
  } catch {
    return false;
  }
}
