@echo off
setlocal enabledelayedexpansion
echo ==============================================
echo   LABGUARD HYBRID PACKAGER (v1.1)
echo ==============================================

set ROOT_DIR=c:\Users\iyas\Desktop\lab server
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
powershell -Command "Compress-Archive -Path '%OUTPUT_DIR%\Client_Payload\*' -DestinationPath '%OUTPUT_DIR%\LabGuard_Client.zip' -Force"

echo 3. Packaging Local Admin Server...
mkdir "%OUTPUT_DIR%\Server_Payload"
robocopy "%LOCAL_SERVER_DIR%" "%OUTPUT_DIR%\Server_Payload" /E /XD node_modules .git /R:0 /W:0
powershell -Command "Compress-Archive -Path '%OUTPUT_DIR%\Server_Payload\*' -DestinationPath '%OUTPUT_DIR%\LabGuard_LocalServer.zip' -Force"

echo 3b. Packaging Ubuntu Client...
set UBUNTU_CLIENT_DIR=%ROOT_DIR%\ubuntu-client
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
    copy /Y "%OUTPUT_DIR%\LabGuard_Ubuntu.zip" "%DASHBOARD_PUBLIC%\LabGuard_Ubuntu.tar.gz"
)

echo ==============================================
echo   DONE! Packages available in:
echo   %OUTPUT_DIR%
echo   Also copied to Dashboard Public for instant download.
echo ==============================================
pause
