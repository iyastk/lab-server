====================================================================
  LabGuard Admin Dashboard — Public Assets Folder
====================================================================

This folder is served by Vite at the ROOT path ("/") automatically.
Any file placed here is accessible at: http://localhost:5173/<filename>

--------------------------------------------------------------------
INSTALLER FILES — REQUIRED FOR DOWNLOAD LINKS TO WORK
--------------------------------------------------------------------

After compiling the Inno Setup installers, copy the output files HERE:

  installers\LabGuard_Client_Setup.exe   --> public\LabGuard_Client_Setup.exe
  installers\LabGuard_Server_Setup.exe   --> public\LabGuard_Server_Setup.exe

The admin dashboard download links point to:
  /LabGuard_Client_Setup.exe   (ClientInstall.tsx)
  /LabGuard_Server_Setup.exe   (ServerInstall.tsx)

These .exe files are NOT committed to git (see .gitignore).
They must be compiled fresh and copied here before each release.

--------------------------------------------------------------------
HOW TO BUILD THE INSTALLERS
--------------------------------------------------------------------
See: installers\HOW_TO_BUILD.md for full build instructions.

Quick summary:
  1. Build ClientLocker in Visual Studio (Release mode)
  2. Compile installers\LabGuard_Client_Setup.iss with Inno Setup 6
  3. Compile installers\LabGuard_Server_Setup.iss with Inno Setup 6
  4. Copy resulting .exe files to THIS folder

====================================================================
