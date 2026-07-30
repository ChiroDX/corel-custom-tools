const { contextBridge, ipcRenderer } = require('electron');

// Expose a safe, limited API to the renderer (React app)
// Nothing from Node/Electron leaks into the renderer directly
contextBridge.exposeInMainWorld('electronAPI', {
  // ── Clipboard ────────────────────────────────────────────────
  readClipboard:    ()          => ipcRenderer.invoke('clipboard:read'),
  writeClipboard:   (text)      => ipcRenderer.invoke('clipboard:write', text),

  // ── Shell helpers ────────────────────────────────────────────
  showItemInFolder: (filePath)  => ipcRenderer.invoke('shell:showItem', filePath),
  openUrl:          (url)       => ipcRenderer.invoke('shell:openUrl', url),

  // ── CorelDraw COM bridge ──────────────────────────────────────

  // Trigger the VBA ApplyResult macro in CorelDraw.
  // Returns { ok: true } or { ok: false, error: string }
  corelApply:   ()         => ipcRenderer.invoke('corel:apply'),

  // Ping CorelDraw to check if it's running and macros are loaded.
  // Returns { ok: true/false }
  corelPing:    ()         => ipcRenderer.invoke('corel:ping'),

  // Set which GMS project name to target (optional, auto-detects by default).
  corelSetGms:  (gmsName)  => ipcRenderer.invoke('corel:setGms', gmsName),
});
