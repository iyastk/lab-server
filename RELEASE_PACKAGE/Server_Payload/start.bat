@echo off
setlocal EnableDelayedExpansion
:: Ensure the script runs from its own directory
cd /d "%~dp0"

title LabGuard Local Server Setup Wizard

echo ============================================================
echo   LABGUARD LOCAL ADMIN SERVER - SETUP WIZARD
echo ============================================================
echo.

:: Step 1: Check for Node.js
echo [1/3] Checking environment...
node -v >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed!
    echo.
    echo Please install Node.js (Version 18 or higher) from:
    echo https://nodejs.org/
    echo.
    echo After installing, please restart this wizard.
    pause
    exit /b
)
echo [OK] Node.js detected.

:: Step 2: Check for Dependencies
echo.
echo [2/3] Verifying dependencies...
set "INSTALL_NEEDED=0"

if not exist "node_modules\" set "INSTALL_NEEDED=1"
if not exist "node_modules\express\" set "INSTALL_NEEDED=1"
if not exist "node_modules\sqlite3\" set "INSTALL_NEEDED=1"

if "%INSTALL_NEEDED%"=="1" (
    echo [INFO] Dependencies missing or incomplete. Starting installation...
    echo.
    npm install
    if %errorlevel% neq 0 (
        echo.
        echo [ERROR] Dependency installation failed. 
        echo Please ensure you have an active internet connection and try again.
        pause
        exit /b
    )
    echo.
    echo [OK] Dependencies installed successfully.
) else (
    echo [OK] Dependencies verified.
)

:: Step 3: Launching Server
echo.
echo [3/3] Starting LabGuard Local Admin Server...
echo ============================================================
echo.
if not exist "server.js" (
    echo [ERROR] server.js not found in !CD!
    echo Please ensure you unzipped all files including server.js.
    pause
    exit /b
)

:: Launch the Status Dashboard in the browser after a short delay
start /b cmd /c "timeout /t 5 /nobreak >nul && start http://localhost:5000"

node server.js
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Server crashed or failed to start.
    pause
)
pause
