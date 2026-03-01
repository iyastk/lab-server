@echo off
setlocal
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
if not exist "node_modules\" (
    echo [INFO] First time setup detected. Installing required modules...
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
    echo [OK] Dependencies already present.
)

:: Step 3: Launching Server
echo.
echo [3/3] Starting LabGuard Local Admin Server...
echo ============================================================
echo.
node server.js
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Server crashed or failed to start.
)
pause
