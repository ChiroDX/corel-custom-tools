@echo off
:: ============================================================
:: ChiroDX Tools — Uninstall Auto-Start
:: ============================================================
:: Removes the scheduled task and config files created by setup.bat.
:: Does NOT delete the project files themselves.
:: No admin rights needed.
:: ============================================================

title ChiroDX Tools Uninstall

echo.
echo  ============================================
echo   ChiroDX Tools - Uninstall Auto-Start
echo  ============================================
echo.

:: ── Step 1: Stop the running server ─────────────────────────
echo  Stopping server if running...
taskkill /FI "WINDOWTITLE eq ChiroDX*" /F >nul 2>nul

:: Kill any node process running server.js from our directory
:: (Be careful: only kill our specific process)
for /f "tokens=2" %%p in ('wmic process where "CommandLine like '%%corel-custom-tools%%server.js%%'" get ProcessId /format:value 2^>nul ^| find "="') do (
    taskkill /PID %%p /F >nul 2>nul
)
echo  [OK] Server stopped

:: ── Step 2: Remove scheduled task ───────────────────────────
echo.
echo  Removing scheduled task...
set "TASK_NAME=ChiroDX AI Server"
schtasks /Delete /TN "%TASK_NAME%" /F >nul 2>nul
if errorlevel 1 (
    echo  [INFO] No scheduled task found (already removed or never created)
) else (
    echo  [OK] Scheduled task removed
)

:: ── Step 3: Remove config files ─────────────────────────────
echo.
echo  Removing config files...

set "CONFIG_DIR=%APPDATA%\ChiroDX"

if exist "%CONFIG_DIR%\start-server.vbs" (
    del "%CONFIG_DIR%\start-server.vbs"
    echo  [OK] Removed start-server.vbs
)

if exist "%CONFIG_DIR%\config.ini" (
    del "%CONFIG_DIR%\config.ini"
    echo  [OK] Removed config.ini
)

:: Remove the directory if it's now empty
if exist "%CONFIG_DIR%" (
    rmdir "%CONFIG_DIR%" 2>nul
    if not exist "%CONFIG_DIR%" (
        echo  [OK] Removed %CONFIG_DIR% directory
    ) else (
        echo  [INFO] %CONFIG_DIR% not empty, keeping it
    )
)

:: ── Done ────────────────────────────────────────────────────
echo.
echo  ============================================
echo   Uninstall complete!
echo  ============================================
echo.
echo  What was removed:
echo    - Windows Task Scheduler job "ChiroDX AI Server"
echo    - Config file: %APPDATA%\ChiroDX\config.ini
echo    - VBS launcher: %APPDATA%\ChiroDX\start-server.vbs
echo.
echo  What was NOT removed:
echo    - The project files (corel-custom-tools folder)
echo    - VBA macros in CorelDraw (remove manually via Macro Editor)
echo    - Node.js or npm
echo.
pause
