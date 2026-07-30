const { app, BrowserWindow, ipcMain, clipboard, shell } = require('electron');
const path = require('node:path');
const os = require('node:os');
const { spawn } = require('node:child_process');
const fs = require('node:fs');

// CorelDraw COM bridge (ES module — loaded dynamically to avoid require() issues)
let corelBridgePromise = null;
function getCorelBridge() {
  // Cache the promise, not the module: two concurrent IPC calls during startup
  // would otherwise each kick off their own import().
  corelBridgePromise ??= import('./corel-bridge.js');
  return corelBridgePromise;
}

const isDev = process.env.NODE_ENV === 'development';

let mainWindow = null;
let serverProcess = null;

// ── Find the ai-server directory ──────────────────────────────────
function findServerDir() {
  const candidates = [
    // Dev: ai-server/ sits next to chiroDX-app/
    path.join(__dirname, '..', 'ai-server'),
    // Packaged: electron-builder copies it to resources/ai-server
    path.join(process.resourcesPath || '', 'ai-server'),
    // Fallback: user's Documents folder
    path.join(process.env.USERPROFILE || '', 'Documents', 'ChiroDX',
              'corel-custom-tools', 'ai-server'),
  ];
  for (const dir of candidates) {
    if (fs.existsSync(path.join(dir, 'server.js'))) return dir;
  }
  return null;
}

// ── Start the Express AI server as a child process ────────────────
function startServer() {
  const serverDir = findServerDir();
  if (!serverDir) {
    console.warn('[ChiroDX] ai-server not found — tools will show "Server offline"');
    return;
  }

  serverProcess = spawn('node', ['server.js'], {
    cwd: serverDir,
    stdio: 'ignore',
    detached: false,
    windowsHide: true,
    shell: false,
  });

  serverProcess.on('error', (err) => {
    // ENOENT here means Node.js is not on PATH. The panel will show
    // "Server offline"; setup.bat is what installs the prerequisite.
    console.error('[ChiroDX] Server process error:', err.message);
    serverProcess = null;
  });

  serverProcess.on('exit', (code) => {
    if (code !== 0 && code !== null) {
      console.warn('[ChiroDX] Server exited with code', code);
    }
    serverProcess = null;
  });

  console.log('[ChiroDX] AI server started from', serverDir);
}

function stopServer() {
  if (serverProcess) {
    serverProcess.kill();
    serverProcess = null;
  }
}

// ── Create the main floating window ──────────────────────────────
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 340,
    height: 720,
    minWidth: 280,
    minHeight: 420,
    maxWidth: 600,
    // Keep the panel visible when CorelDraw is fullscreen / maximized
    alwaysOnTop: true,
    title: 'ChiroDX Tools',
    backgroundColor: '#1e1e1e',
    skipTaskbar: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      // The preload only needs contextBridge + ipcRenderer, both of which are
      // available inside the sandbox, so there is no reason to disable it.
      sandbox: true,
    },
  });

  // Hide the default menu bar
  mainWindow.setMenuBarVisibility(false);

  // Load the React app
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, 'dist', 'index.html'));
  }

  // The renderer must never navigate away from the app or spawn windows.
  // Any link that wants a browser goes through the vetted shell:openUrl IPC.
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  mainWindow.webContents.on('will-navigate', (event, url) => {
    const allowed = isDev ? 'http://localhost:5173' : 'file://';
    if (!url.startsWith(allowed)) event.preventDefault();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// ── Single-instance: second launch just focuses existing window ───
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  // Another instance is already running — quit this one
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    // Start server first, give it a moment to bind before showing the UI.
    // The panel polls /health anyway, so this is only to avoid a visible
    // "Server offline" flash on a cold start.
    startServer();
    setTimeout(createWindow, 1500);
  });
}

// ── Lifecycle ─────────────────────────────────────────────────────
app.on('window-all-closed', () => {
  // On Windows / Linux quit when all windows are closed
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', stopServer);
process.on('exit', stopServer);

// ── IPC input guards ──────────────────────────────────────────────
// Everything below crosses the renderer → main boundary, so each argument is
// validated here rather than trusted. A rejected call resolves with
// { ok: false, error } so the panel can show a message.

const MAX_CLIPBOARD_CHARS = 1_000_000;

/** GMS project names are VBA identifiers; keep them to a safe character set. */
const GMS_NAME_PATTERN = /^[A-Za-z0-9 _.-]{1,64}$/;

function isSafeExternalUrl(value) {
  if (typeof value !== 'string' || value.length > 2048) return false;
  try {
    const { protocol } = new URL(value);
    // Anything else (file:, javascript:, ms-msdt:, custom handlers…) can be
    // used to launch local programs through the Windows shell.
    return protocol === 'https:' || protocol === 'http:';
  } catch {
    return false;
  }
}

/**
 * Generated images always land in the OS temp folder with a chiroDX_ prefix
 * (see ai-server/utils/tempFiles.js), so "reveal in Explorer" never needs to
 * accept an arbitrary path from the renderer.
 */
function isRevealableFile(value) {
  if (typeof value !== 'string' || value.length > 4096) return false;
  const resolved = path.resolve(value);
  const tmp = path.resolve(os.tmpdir());
  const inTmp = resolved === tmp || resolved.startsWith(tmp + path.sep);
  return inTmp && path.basename(resolved).startsWith('chiroDX_');
}

// ── IPC handlers exposed to the renderer via preload.js ───────────

// Read clipboard text (for "From Clipboard" button)
ipcMain.handle('clipboard:read', () => clipboard.readText());

// Write clipboard text (for "Copy fix" / "Apply" buttons)
ipcMain.handle('clipboard:write', (_event, text) => {
  if (typeof text !== 'string' || text.length > MAX_CLIPBOARD_CHARS) {
    return { ok: false, error: 'Text is not copyable.' };
  }
  clipboard.writeText(text);
  return { ok: true };
});

// Reveal a generated image in Windows Explorer
ipcMain.handle('shell:showItem', (_event, filePath) => {
  if (!isRevealableFile(filePath)) {
    console.warn('[ChiroDX] Refused to reveal path outside the temp folder');
    return { ok: false, error: 'That file cannot be shown from here.' };
  }
  shell.showItemInFolder(path.resolve(filePath));
  return { ok: true };
});

// Open a URL in the default browser
ipcMain.handle('shell:openUrl', async (_event, url) => {
  if (!isSafeExternalUrl(url)) {
    console.warn('[ChiroDX] Refused to open non-http(s) URL');
    return { ok: false, error: 'Only http and https links can be opened.' };
  }
  await shell.openExternal(url);
  return { ok: true };
});

// ── CorelDraw COM bridge IPC ────────────────────────────────────

// Trigger the VBA ApplyResult macro — "Apply in CorelDraw" button.
// The macro name is fixed here; the renderer cannot choose what runs.
ipcMain.handle('corel:apply', async () => {
  try {
    const bridge = await getCorelBridge();
    await bridge.runCorelMacro('ApplyResult');
    return { ok: true };
  } catch (err) {
    console.error('[CorelBridge] apply failed:', err.message);
    return { ok: false, error: err.message };
  }
});

// Check whether CorelDraw is reachable — used by the status bar
ipcMain.handle('corel:ping', async () => {
  try {
    const bridge = await getCorelBridge();
    return { ok: await bridge.pingCorel() };
  } catch {
    return { ok: false };
  }
});

// Set which GMS project to target (optional, from settings)
ipcMain.handle('corel:setGms', async (_event, gmsName) => {
  if (gmsName !== '' && (typeof gmsName !== 'string' || !GMS_NAME_PATTERN.test(gmsName))) {
    return { ok: false, error: 'Invalid GMS project name.' };
  }
  try {
    const bridge = await getCorelBridge();
    bridge.setGmsName(gmsName);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});
