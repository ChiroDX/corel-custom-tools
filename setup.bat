@echo off
:: ============================================================
:: ChiroDX Tools — One-Time Setup
:: ============================================================
:: Run this once on each employee's PC. It will:
::   1. Detect where the ai-server folder is
::   2. Save that path to a config file
::   3. Install npm dependencies (if needed)
::   4. Register a Windows Task Scheduler job to auto-start the server on login
::   5. Start the server right now so it's ready immediately
::
:: Requirements: Node.js must be installed (https://nodejs.org)
:: No admin rights needed.
:: ============================================================

title ChiroDX Tools Setup

echo.
echo  ============================================
echo   ChiroDX Tools - Setup
echo  ============================================
echo.

:: ── Step 1: Detect server directory ──────────────────────
:: The bat file lives in the repo root, ai-server is a subfolder
set "SCRIPT_DIR=%~dp0"
set "SERVER_DIR=%SCRIPT_DIR%ai-server"

if not exist "%SERVER_DIR%\server.js" (
    echo  [ERROR] Cannot find ai-server\server.js
    echo  Expected at: %SERVER_DIR%\server.js
    echo  Make sure this .bat file is in the corel-custom-tools folder.
    echo.
    pause
    exit /b 1
)

echo  [OK] Found server at: %SERVER_DIR%

:: ── Step 2: Check Node.js is installed ───────────────────
where node >nul 2>nul
if errorlevel 1 (
    echo.
    echo  [ERROR] Node.js is not installed or not in PATH.
    echo  Download it from: https://nodejs.org
    echo  After installing, close this window and run setup.bat again.
    echo.
    pause
    exit /b 1
)

for /f "tokens=*" %%v in ('node --version') do set "NODE_VER=%%v"
echo  [OK] Node.js %NODE_VER% found

:: ── Step 3: Install npm dependencies ─────────────────────
echo.
echo  Installing dependencies...
cd /d "%SERVER_DIR%"
call npm install --silent
if errorlevel 1 (
    echo  [WARNING] npm install had issues, but continuing...
) else (
    echo  [OK] Dependencies installed
)

:: ── Step 4: Create config directory + file ───────────────
set "CONFIG_DIR=%APPDATA%\ChiroDX"
set "CONFIG_FILE=%CONFIG_DIR%\config.ini"

if not exist "%CONFIG_DIR%" mkdir "%CONFIG_DIR%"

:: Write config file
(
    echo [server]
    echo path=%SERVER_DIR%
    echo port=3000
    echo.
    echo [macros]
    echo macros_path=%SCRIPT_DIR%Makros
    echo.
    echo [settings]
    echo auto_open_panel=true
) > "%CONFIG_FILE%"

echo  [OK] Config saved to: %CONFIG_FILE%

:: ── Step 5: Register Windows Task Scheduler job ──────────
echo.
echo  Registering auto-start task...

:: Build the command that Task Scheduler will run
:: Uses /min to start minimized and cmd /c to run node hidden
set "TASK_NAME=ChiroDX AI Server"
set "TASK_CMD=cmd /c cd /d "%SERVER_DIR%" && node server.js"

:: Delete existing task if present (ignore errors)
schtasks /Delete /TN "%TASK_NAME%" /F >nul 2>nul

:: Create new task: runs on user logon, hidden window
schtasks /Create /TN "%TASK_NAME%" /TR "\"%TASK_CMD%\"" /SC ONLOGON /RU "%USERNAME%" /F >nul 2>nul
if errorlevel 1 (
    echo  [WARNING] Could not create scheduled task.
    echo  The server will still auto-start from CorelDraw.
    echo  To start manually: open ai-server folder, run "npm start"
) else (
    echo  [OK] Server will auto-start when you log in
)

:: ── Step 6: Create a VBS launcher (hidden window) ────────
:: Task Scheduler's /TR doesn't hide the window well, so we
:: create a small VBS wrapper that launches node truly hidden
set "VBS_FILE=%CONFIG_DIR%\start-server.vbs"

(
    echo Set WshShell = CreateObject("WScript.Shell"^)
    echo WshShell.CurrentDirectory = "%SERVER_DIR%"
    echo WshShell.Run "cmd /c node server.js", 0, False
) > "%VBS_FILE%"

:: Update the scheduled task to use the VBS wrapper instead
schtasks /Delete /TN "%TASK_NAME%" /F >nul 2>nul
schtasks /Create /TN "%TASK_NAME%" /TR "wscript.exe ""%VBS_FILE%""" /SC ONLOGON /RU "%USERNAME%" /F >nul 2>nul
if not errorlevel 1 (
    echo  [OK] Hidden launcher created
)

:: ── Step 7: Start the server right now ───────────────────
echo.
echo  Starting server now...
start "" wscript.exe "%VBS_FILE%"

:: Wait a moment then check
timeout /t 3 /nobreak >nul

:: Quick health check
curl -s http://localhost:3000/health >nul 2>nul
if errorlevel 1 (
    :: curl might not be available, try powershell
    powershell -Command "try { (Invoke-WebRequest -Uri 'http://localhost:3000/health' -UseBasicParsing).StatusCode } catch { exit 1 }" >nul 2>nul
    if errorlevel 1 (
        echo  [WARNING] Server may still be starting up. Give it a few more seconds.
    ) else (
        echo  [OK] Server is running!
    )
) else (
    echo  [OK] Server is running!
)

:: ── Done ─────────────────────────────────────────────────
echo.
echo  ============================================
echo   Setup complete!
echo  ============================================
echo.
echo  What happens now:
echo    - The AI server starts automatically when you log in
echo    - In CorelDraw, the Tools panel opens automatically
echo    - No terminal, no commands, just open CorelDraw
echo.
echo  To set up CorelDraw macros:
echo    1. Open CorelDraw
echo    2. Go to Tools ^> Macros ^> Macro Editor
echo    3. In the editor: File ^> Import File
echo    4. Import these two files:
echo       %SCRIPT_DIR%Makros\ApiClient.bas
echo       %SCRIPT_DIR%Makros\ToolsPanel.frm
echo    5. Close the editor — done!
echo.
echo  Config file: %CONFIG_FILE%
echo  Server log:  check Task Manager for "node.exe" if needed
echo.
pause
