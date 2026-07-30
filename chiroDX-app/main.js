const { app, BrowserWindow, ipcMain, clipboard, shell } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');

// CorelDraw COM bridge (ES module — loaded dynamically to avoid require() issues)
let corelBridge = null;
async function getCorelBridge() {
  if (!corelBridge) {
    corelBridge = await import('./corel-bridge.js');
  }
  return corelBridge;
}

const isDev = process.env.NODE_ENV === 'development';
const SERVER_PORT = 3000;

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

  // Find node executable
  const nodePath = process.execPath.includes('electron')
    ? 'node'                   // dev: use system node
    : process.execPath;        // packaged: use bundled node (if available)

  serverProcess = spawn('node', ['server.js'], {
    cwd: serverDir,
    stdio: 'ignore',
    detached: false,
    windowsHide: true,
    shell: false,
  });

  serverProcess.on('error', (err) => {
    console.error('[ChiroDX] Server process error:', err.message);
  });

  serverProcess.on('exit', (code) => {
    if (code !== 0 && code !== null) {
      console.warn('[ChiroDX] Server exited with code', code);
    }
    serverProcess = null;
  });

  console.log('[ChiroDX] AI server started from', serverDir);
}

// ── Create the main floating window ──────────────────────────────
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 340,
    height: 720,
    minWidth: 280,
    minHeight: 420,
    maxWidth: 600,
    alwaysOnTop: true,
    title: 'ChiroDX Tools',
    backgroundColor: '#1e1e1e',
    // Keep window visible when CorelDraw is fullscreen / maximized
    alwaysOnTop: true,
    // No taskbar button — cleaner UX
    skipTaskbar: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  // Hide the default menu bar
  mainWindow.setMenuBarVisibility(false);

  // Load the React app
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    // Uncomment to open DevTools in development:
    // mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(path.join(__dirname, 'dist', 'index.html'));
  }

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
    // Start server first, give it 1.5 s to bind before showing UI
    startServer();
    setTimeout(createWindow, 1500);
  });
}

// ── Lifecycle ─────────────────────────────────────────────────────
app.on('window-all-closed', () => {
  // On Windows / Linux quit when all windows are closed
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  if (serverProcess) {
    serverProcess.kill();
    serverProcess = null;
  }
});

// ── IPC handlers exposed to the renderer via preload.js ───────────

// Read clipboard text (for "From Clipboard" button)
ipcMain.handle('clipboard:read', () => {
  return clipboard.readText();
});

// Write clipboard text (for "Copy fix" / "Apply" buttons)
ipcMain.handle('clipboard:write', (_event, text) => {
  clipboard.writeText(String(text));
});

// Open a file path in Windows Explorer (for generated images)
ipcMain.handle('shell:showItem', (_event, filePath) => {
  shell.showItemInFolder(filePath);
});

// Open a URL in the default browser
ipcMain.handle('shell:openUrl', (_event, url) => {
  shell.openExternal(url);
});

// ── CorelDraw COM bridge IPC ────────────────────────────────────

// Trigger VBA ApplyResult macro in CorelDraw — called when user clicks "Apply in CorelDraw"
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
    const ok = await bridge.pingCorel();
    return { ok };
  } catch {
    return { ok: false };
  }
});

// Set which GMS project to target (optional, from settings)
ipcMain.handle('corel:setGms', async (_event, gmsName) => {
  try {
    const bridge = await getCorelBridge();
    bridge.setGmsName(gmsName);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});
