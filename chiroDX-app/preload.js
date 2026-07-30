const { contextBridge, ipcRenderer } = require('electron');

/**
 * The only bridge between the renderer and Node/Electron.
 *
 * Each function below wraps one fixed IPC channel name — the renderer cannot
 * choose a channel, and nothing from Node or Electron is exposed directly.
 * Argument validation lives in main.js, next to the privileged call it guards.
 *
 * This preload runs sandboxed (see webPreferences in main.js), so it has no
 * filesystem or process access of its own.
 */
contextBridge.exposeInMainWorld('electronAPI', {
  // ── Clipboard ────────────────────────────────────────────────
  /** @returns {Promise<string>} current clipboard text */
  readClipboard: () => ipcRenderer.invoke('clipboard:read'),
  /** @returns {Promise<{ok: boolean, error?: string}>} */
  writeClipboard: (text) => ipcRenderer.invoke('clipboard:write', text),

  // ── Shell helpers ────────────────────────────────────────────
  /**
   * Reveal a generated image in Explorer. Only chiroDX_* files inside the OS
   * temp folder are accepted.
   * @returns {Promise<{ok: boolean, error?: string}>}
   */
  showItemInFolder: (filePath) => ipcRenderer.invoke('shell:showItem', filePath),
  /**
   * Open an http(s) URL in the default browser. Other schemes are rejected.
   * @returns {Promise<{ok: boolean, error?: string}>}
   */
  openUrl: (url) => ipcRenderer.invoke('shell:openUrl', url),

  // ── CorelDraw COM bridge ──────────────────────────────────────

  /**
   * Trigger the VBA ApplyResult macro in CorelDraw.
   * @returns {Promise<{ok: boolean, error?: string}>}
   */
  corelApply: () => ipcRenderer.invoke('corel:apply'),

  /**
   * Ping CorelDraw to check if it's running and macros are loaded.
   * @returns {Promise<{ok: boolean}>}
   */
  corelPing: () => ipcRenderer.invoke('corel:ping'),

  /**
   * Set which GMS project name to target (optional, auto-detects by default).
   * @returns {Promise<{ok: boolean, error?: string}>}
   */
  corelSetGms: (gmsName) => ipcRenderer.invoke('corel:setGms', gmsName),
});
