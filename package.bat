@echo off
setlocal enabledelayedexpansion
echo ==============================================
echo   LABGUARD HYBRID PACKAGER (v1.4)
echo ==============================================

set "ROOT_DIR=%~dp0"
if "%ROOT_DIR:~-1%"=="\" set "ROOT_DIR=%ROOT_DIR:~0,-1%"

:: Export paths as environment variables for PowerShell to consume safely
set "ENV_ROOT_DIR=%ROOT_DIR%"
set "ENV_OUTPUT_DIR=%ROOT_DIR%\RELEASE_PACKAGE"
set "ENV_CLIENT_DIR=%ROOT_DIR%\ClientLocker"
set "ENV_SERVER_DIR=%ROOT_DIR%\local-server"
set "ENV_UBUNTU_DIR=%ROOT_DIR%\ubuntu-client"
set "ENV_PUBLIC_DIR=%ROOT_DIR%\admin-dashboard\public"

set "PS_SESS=%TEMP%\build_helper_%RANDOM%.ps1"

echo 1. Generating build script...
echo $ErrorActionPreference = 'Stop' > "%PS_SESS%"
echo $rootDir = $env:ENV_ROOT_DIR >> "%PS_SESS%"
echo $outputDir = $env:ENV_OUTPUT_DIR >> "%PS_SESS%"
echo $clientDir = $env:ENV_CLIENT_DIR >> "%PS_SESS%"
echo $serverDir = $env:ENV_SERVER_DIR >> "%PS_SESS%"
echo $ubuntuDir = $env:ENV_UBUNTU_DIR >> "%PS_SESS%"
echo $publicDir = $env:ENV_PUBLIC_DIR >> "%PS_SESS%"
echo. >> "%PS_SESS%"
echo Write-Host "--- 1. Cleaning ---" -ForegroundColor Cyan >> "%PS_SESS%"
echo if (Test-Path $outputDir) { Remove-Item -Recurse -Force $outputDir } >> "%PS_SESS%"
echo New-Item -ItemType Directory -Path (Join-Path $outputDir 'Client_Payload') ^| Out-Null >> "%PS_SESS%"
echo. >> "%PS_SESS%"
echo Write-Host "--- 2. Building Client ---" -ForegroundColor Cyan >> "%PS_SESS%"
echo Set-Location $clientDir >> "%PS_SESS%"
echo dotnet publish -c Release -o (Join-Path $outputDir 'Client_Payload') >> "%PS_SESS%"
echo. >> "%PS_SESS%"
echo Write-Host "--- 3. Zipping Client ---" -ForegroundColor Cyan >> "%PS_SESS%"
echo Add-Type -AssemblyName System.IO.Compression.FileSystem >> "%PS_SESS%"
echo $clientPayload = Join-Path $outputDir 'Client_Payload' >> "%PS_SESS%"
echo Get-ChildItem $clientPayload -Filter '*.zip'   -Recurse ^| Remove-Item -Force >> "%PS_SESS%"
echo Get-ChildItem $clientPayload -Filter '*.nupkg' -Recurse ^| Remove-Item -Force >> "%PS_SESS%"
echo $clientZip = Join-Path $outputDir 'LabGuard_Client.zip' >> "%PS_SESS%"
echo Compress-Archive -Path "$clientPayload\*" -DestinationPath $clientZip -Force >> "%PS_SESS%"
echo. >> "%PS_SESS%"
echo Write-Host "--- 4. Zipping Server ---" -ForegroundColor Cyan >> "%PS_SESS%"
echo $serverFiles = @( >> "%PS_SESS%"
echo   (Join-Path $serverDir 'package.json'), >> "%PS_SESS%"
echo   (Join-Path $serverDir 'package-lock.json'), >> "%PS_SESS%"
echo   (Join-Path $serverDir 'server.js'), >> "%PS_SESS%"
echo   (Join-Path $serverDir 'start.bat'), >> "%PS_SESS%"
echo   (Join-Path $serverDir 'README_INSTALL.txt') >> "%PS_SESS%"
echo ) >> "%PS_SESS%"
echo $serverZip = Join-Path $outputDir 'LabGuard_LocalServer.zip' >> "%PS_SESS%"
echo Compress-Archive -Path $serverFiles -DestinationPath $serverZip -Force >> "%PS_SESS%"
echo. >> "%PS_SESS%"
echo Write-Host "--- 5. Zipping Ubuntu ---" -ForegroundColor Cyan >> "%PS_SESS%"
echo $ubuntuZip = Join-Path $outputDir 'LabGuard_Ubuntu.zip' >> "%PS_SESS%"
echo Compress-Archive -Path "$ubuntuDir\*" -DestinationPath $ubuntuZip -Force >> "%PS_SESS%"
echo. >> "%PS_SESS%"
echo Write-Host "--- 6. Copying to Dashboard ---" -ForegroundColor Cyan >> "%PS_SESS%"
echo if (Test-Path $clientZip) { Copy-Item $clientZip (Join-Path $publicDir 'LabGuard_Client.zip') -Force } >> "%PS_SESS%"
echo if (Test-Path $serverZip) { Copy-Item $serverZip (Join-Path $publicDir 'LabGuard_LocalServer.zip') -Force } >> "%PS_SESS%"
echo if (Test-Path $ubuntuZip) { Copy-Item $ubuntuZip (Join-Path $publicDir 'LabGuard_Ubuntu.zip') -Force } >> "%PS_SESS%"
echo. >> "%PS_SESS%"
echo Write-Host "==============================================" -ForegroundColor Green >> "%PS_SESS%"
echo Write-Host "   DONE! Packages in RELEASE_PACKAGE" -ForegroundColor Green >> "%PS_SESS%"
echo Write-Host "==============================================" -ForegroundColor Green >> "%PS_SESS%"

echo 2. Executing build script...
powershell -ExecutionPolicy Bypass -File "%PS_SESS%"
set "EXIT_CODE=%ERRORLEVEL%"

del "%PS_SESS%"
if %EXIT_CODE% neq 0 (
    echo.
    echo ERROR: Build failed with code %EXIT_CODE%
    pause
    exit /b %EXIT_CODE%
)

pause
