@echo off
setlocal enabledelayedexpansion
echo ==============================================
echo   LABGUARD HYBRID PACKAGER (v1.1)
echo ==============================================

set "ROOT_DIR=%~dp0"
REM Strip trailing backslash from %~dp0
if "%ROOT_DIR:~-1%"=="\" set "ROOT_DIR=%ROOT_DIR:~0,-1%"
set CLIENT_DIR=%ROOT_DIR%\ClientLocker
set LOCAL_SERVER_DIR=%ROOT_DIR%\local-server
set DASHBOARD_PUBLIC=%ROOT_DIR%\admin-dashboard\public
set OUTPUT_DIR=%ROOT_DIR%\RELEASE_PACKAGE

echo 1. Cleaning old build...
if exist "%OUTPUT_DIR%" rd /s /q "%OUTPUT_DIR%"
mkdir "%OUTPUT_DIR%"

echo 2. Packaging Student Client...
mkdir "%OUTPUT_DIR%\Client_Payload"
cd /d "%CLIENT_DIR%"
dotnet publish -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true -o "%OUTPUT_DIR%\Client_Payload"
REM Clean up any stray zip files from publish output recursively (prevents zip-inside-zip)
powershell -Command "Get-ChildItem '%OUTPUT_DIR%\Client_Payload' -Filter '*.zip' -Recurse | Remove-Item -Force"
powershell -Command "Get-ChildItem '%OUTPUT_DIR%\Client_Payload' -Filter '*.nupkg' -Recurse | Remove-Item -Force"
powershell -Command "Compress-Archive -Path '%OUTPUT_DIR%\Client_Payload\*' -DestinationPath '%OUTPUT_DIR%\LabGuard_Client.zip' -Force"
REM Verify no nested zips inside the archive
powershell -Command "$zip = [IO.Compression.ZipFile]::OpenRead('%OUTPUT_DIR%\LabGuard_Client.zip'); $nested = $zip.Entries | Where-Object { $_.Name -like '*.zip' }; $zip.Dispose(); if ($nested) { Write-Host 'WARNING: Nested zip files still found:' -ForegroundColor Red; $nested | ForEach-Object { Write-Host $_.FullName } } else { Write-Host 'VERIFIED: No nested zip files found.' -ForegroundColor Green }"

echo 3. Packaging Local Admin Server...
REM Only include required files (no node_modules, no .git)
powershell -Command "Compress-Archive -Path '%LOCAL_SERVER_DIR%\package.json','%LOCAL_SERVER_DIR%\package-lock.json','%LOCAL_SERVER_DIR%\server.js','%LOCAL_SERVER_DIR%\start.bat','%LOCAL_SERVER_DIR%\README_INSTALL.txt' -DestinationPath '%OUTPUT_DIR%\LabGuard_LocalServer.zip' -Force"

echo 3b. Packaging Ubuntu Client...
set UBUNTU_CLIENT_DIR=%ROOT_DIR%\ubuntu-client
REM Package ubuntu client as a proper zip (NOT tar.gz)
powershell -Command "Compress-Archive -Path '%UBUNTU_CLIENT_DIR%\*' -DestinationPath '%OUTPUT_DIR%\LabGuard_Ubuntu.zip' -Force"

echo 4. Copying to Dashboard Public folder...
if exist "%OUTPUT_DIR%\LabGuard_Client.zip" (
    copy /Y "%OUTPUT_DIR%\LabGuard_Client.zip" "%DASHBOARD_PUBLIC%\LabGuard_Client.zip"
) else (
    echo ERROR: LabGuard_Client.zip was not generated!
)
if exist "%OUTPUT_DIR%\LabGuard_LocalServer.zip" (
    copy /Y "%OUTPUT_DIR%\LabGuard_LocalServer.zip" "%DASHBOARD_PUBLIC%\LabGuard_LocalServer.zip"
)
if exist "%OUTPUT_DIR%\LabGuard_Ubuntu.zip" (
    copy /Y "%OUTPUT_DIR%\LabGuard_Ubuntu.zip" "%DASHBOARD_PUBLIC%\LabGuard_Ubuntu.zip"
    REM Remove stale .tar.gz if it exists
    if exist "%DASHBOARD_PUBLIC%\LabGuard_Ubuntu.tar.gz" del /Q "%DASHBOARD_PUBLIC%\LabGuard_Ubuntu.tar.gz"
)

echo ==============================================
echo   DONE! Packages available in:
echo   %OUTPUT_DIR%
echo   Also copied to Dashboard Public for instant download.
echo ==============================================
pause
