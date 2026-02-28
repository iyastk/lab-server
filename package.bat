@echo off
echo ==============================================
echo   LABGUARD ONE-CLICK PACKAGER
echo ==============================================

set CLIENT_DIR=c:\Users\iyas\Desktop\lab server\ClientLocker
set INSTALLER_DIR=c:\Users\iyas\Desktop\lab server\LabGuardInstaller
set OUTPUT_DIR=c:\Users\iyas\Desktop\lab server\RELEASE_PACKAGE

echo 1. Cleaning old build...
if exist "%OUTPUT_DIR%" rd /s /q "%OUTPUT_DIR%"
mkdir "%OUTPUT_DIR%"
mkdir "%OUTPUT_DIR%\payload"

echo 2. Publishing Native Client (Single File)...
cd /d "%CLIENT_DIR%"
dotnet publish -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true -o "%OUTPUT_DIR%\payload"

echo 3. Building Installer...
cd /d "%INSTALLER_DIR%"
dotnet build -c Release -o "%OUTPUT_DIR%"

echo 4. Finalizing Layout...
move "%OUTPUT_DIR%\LabGuardInstaller.exe" "%OUTPUT_DIR%\LabGuard_Setup.exe"

echo ==============================================
echo   DONE! Your installer is in:
echo   %OUTPUT_DIR%
echo ==============================================
pause
