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

:: ── Step 4: Create config directory + copy HTA panel ─────
set "CONFIG_DIR=%APPDATA%\ChiroDX"
set "CONFIG_FILE=%CONFIG_DIR%\config.ini"

if not exist "%CONFIG_DIR%" mkdir "%CONFIG_DIR%"

set "HTA_SRC=%SCRIPT_DIR%Makros\ChiroDXTools.hta"
set "HTA_DST=%CONFIG_DIR%\ChiroDXTools.hta"

:: The HTA is the fallback panel: AutoExec opens the Electron app, and this
:: is what you double-click if Node or the app will not start.
if not exist "%HTA_SRC%" (
    echo  [WARNING] ChiroDXTools.hta not found in Makros folder.
    echo  The fallback panel will not be available.
) else (
    copy /Y "%HTA_SRC%" "%HTA_DST%" >nul
    echo  [OK] Fallback panel copied to: %HTA_DST%
)

:: ── Step 5: Write config file ──────────────────────────────

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

:: ── Step 6: Create a VBS launcher (hidden window) ────────
:: We use a small VBS wrapper so node runs truly hidden
:: (no black terminal window flashing on login)
set "TASK_NAME=ChiroDX AI Server"
set "VBS_FILE=%CONFIG_DIR%\start-server.vbs"

(
    echo Set WshShell = CreateObject("WScript.Shell"^)
    echo WshShell.CurrentDirectory = "%SERVER_DIR%"
    echo WshShell.Run "cmd /c node server.js", 0, False
) > "%VBS_FILE%"

echo  [OK] Hidden launcher created

:: ── Step 7: Register Windows Task Scheduler job ──────────
echo.
echo  Registering auto-start task...

:: Delete existing task if present (ignore errors)
schtasks /Delete /TN "%TASK_NAME%" /F >nul 2>nul

:: Create new task: runs VBS launcher on user logon
schtasks /Create /TN "%TASK_NAME%" /TR "wscript.exe \"%VBS_FILE%\"" /SC ONLOGON /RL LIMITED /F >nul 2>nul
if errorlevel 1 (
    echo  [WARNING] Could not create scheduled task.
    echo  The server will still auto-start from CorelDraw via AutoExec.
    echo  To start manually: double-click %VBS_FILE%
) else (
    echo  [OK] Server will auto-start when you log in
)

:: ── Step 8: Start the server right now ───────────────────
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
echo  To finish setup in CorelDraw (one-time per PC):
echo    1. Open CorelDraw
echo    2. Press Alt+F11 to open the VBA Editor
echo    3. In the Project Explorer (left panel),
echo       find "GlobalMacros" or your GMS project
echo    4. File ^> Import File -- import these three:
echo       %SCRIPT_DIR%Makros\ApiClient.bas
echo       %SCRIPT_DIR%Makros\modules\ShapeSerializer.bas
echo       %SCRIPT_DIR%Makros\modules\ShapeDeserializer.bas
echo    5. Close the VBA Editor
echo    6. Restart CorelDraw -- the panel opens automatically!
echo.
echo  ApiClient alone is not enough: "Send Selection" needs
echo  ShapeSerializer and "Apply from AI" needs ShapeDeserializer.
echo  Optional: also import Makros\ToolsPanel.frm for the panel
echo  that lives inside CorelDraw instead of the desktop app.
echo.
echo  Config file: %CONFIG_FILE%
echo  Server log:  check Task Manager for "node.exe" if needed
echo.
pause
