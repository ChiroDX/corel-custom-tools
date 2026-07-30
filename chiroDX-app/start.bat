@echo off
:: ChiroDX Tools -- Electron launcher
:: Called by CorelDraw's VBA AutoExec / ShowToolsPanel macro.
:: If the app is already running, Electron's single-instance lock
:: brings the existing window to the front automatically.

cd /d "%~dp0"

:: Install dependencies if missing (first run only)
if not exist "node_modules\electron" (
    echo [ChiroDX] Installing dependencies -- this takes ~1 minute on first run...
    call npm install --prefer-offline --no-audit --loglevel error
    if errorlevel 1 (
        echo [ChiroDX] npm install failed. Make sure Node.js is installed.
        pause
        exit /b 1
    )
)

:: Launch Electron (hidden cmd window so no terminal flashes)
start "" /b node_modules\.bin\electron.cmd .
