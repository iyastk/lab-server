; ============================================================
; LabGuard Server Setup Script — Inno Setup 6
; Installs the Node.js local server + PM2 Windows Service
; Auto-downloads Node.js 18 LTS if not installed
; ============================================================
#define AppName       "LabGuard Server"
#define AppVersion    "2.1.0"
#define AppPublisher  "LabGuard"
#define NodeJsUrl     "https://nodejs.org/dist/v18.20.4/node-v18.20.4-x64.msi"
#define NodeJsVersion "18.20.4"

[Setup]
AppId={{B2C3D4E5-F6A7-8901-BCDE-F12345678901}
AppName={#AppName}
AppVersion={#AppVersion}
AppPublisher={#AppPublisher}
DefaultDirName={autopf}\LabGuard\Server
DefaultGroupName=LabGuard Server
OutputDir=.
OutputBaseFilename=LabGuard_Server_Setup
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
PrivilegesRequired=admin
; Show the wizard info page
WizardImageFile=
UninstallDisplayName={#AppName}

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Files]
; Copy the entire local-server folder
Source: "..\local-server\*"; Excludes: "node_modules\*,.env"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

; Also include the browser-extension — IT GOES ON EVERY PC
Source: "..\browser-extension\*"; DestDir: "{app}\browser-extension"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{group}\LabGuard Server"; Filename: "{app}\start.bat"
Name: "{group}\Check Server Status"; Filename: "cmd.exe"; Parameters: "/K pm2 status"
Name: "{group}\Uninstall LabGuard Server"; Filename: "{uninstallexe}"

[Code]
const
  NODE_MSI_URL = 'https://nodejs.org/dist/v18.20.4/node-v18.20.4-x64.msi';

function NodeJsIsInstalled(): Boolean;
var
  ResultCode: Integer;
begin
  // Check if node.exe exists somewhere in PATH by running it
  Result := Exec('cmd.exe', '/C node --version >nul 2>&1', '', SW_HIDE, ewWaitUntilTerminated, ResultCode) and (ResultCode = 0);
end;

procedure DownloadAndInstallNodeJs();
var
  MsiPath: string;
  ResultCode: Integer;
begin
  MsiPath := ExpandConstant('{tmp}\nodejs_installer.msi');
  // Download using PowerShell
  Exec('powershell.exe',
    '-Command "Invoke-WebRequest -Uri ''' + NODE_MSI_URL + ''' -OutFile ''' + MsiPath + ''' -UseBasicParsing"',
    '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
  // Silently install Node.js MSI
  Exec('msiexec.exe', '/i "' + MsiPath + '" /quiet /norestart ADDLOCAL=ALL', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
end;

function InstallNpmDependencies(): Boolean;
var
  ResultCode: Integer;
begin
  // Run npm install in the installed directory
  Result := Exec('cmd.exe',
    '/C cd /d "' + ExpandConstant('{app}') + '" && npm install --prefer-offline',
    ExpandConstant('{app}'), SW_HIDE, ewWaitUntilTerminated, ResultCode);
end;

function InstallPm2Service(): Boolean;
var
  ResultCode: Integer;
  AppDir: string;
begin
  AppDir := ExpandConstant('{app}');
  // Install pm2 globally
  Exec('cmd.exe', '/C npm install -g pm2 pm2-windows-startup', AppDir, SW_HIDE, ewWaitUntilTerminated, ResultCode);
  // Setup pm2 to survive reboots on Windows
  Exec('cmd.exe', '/C pm2-startup install', AppDir, SW_HIDE, ewWaitUntilTerminated, ResultCode);
  // Start the server via pm2 with a named process
  Exec('cmd.exe', '/C pm2 start server.js --name labguard-server', AppDir, SW_HIDE, ewWaitUntilTerminated, ResultCode);
  // Save pm2 state so it auto-starts on reboot
  Result := Exec('cmd.exe', '/C pm2 save', AppDir, SW_HIDE, ewWaitUntilTerminated, ResultCode);
end;

procedure CurStepChanged(CurStep: TSetupStep);
var
  AppDir: string;
begin
  AppDir := ExpandConstant('{app}');

  if CurStep = ssInstall then
  begin
    // ── Step 1: Ensure Node.js is installed ──
    if not NodeJsIsInstalled() then
    begin
      WizardForm.StatusLabel.Caption := 'Downloading Node.js 18 LTS... (this may take 2–3 minutes)';
      DownloadAndInstallNodeJs();
    end;
  end;

  if CurStep = ssPostInstall then
  begin
    // ── Step 2: npm install ──
    WizardForm.StatusLabel.Caption := 'Installing npm dependencies...';
    InstallNpmDependencies();

    // ── Step 3: PM2 service ──
    WizardForm.StatusLabel.Caption := 'Setting up PM2 Windows Service (auto-start)...';
    InstallPm2Service();
  end;
end;

[Run]
; Open status check in browser after install
Filename: "{pf64}\Google\Chrome\Application\chrome.exe"; Parameters: "http://localhost:5000"; Description: "Open Server Status Page in Chrome"; Flags: nowait postinstall skipifsilent unchecked shellexec
Filename: "http://localhost:5000"; Description: "Open Server Status Page in browser"; Flags: nowait postinstall skipifsilent shellexec

[UninstallRun]
; Stop pm2 process and remove the service on uninstall
Filename: "cmd.exe"; Parameters: "/C pm2 stop labguard-server && pm2 delete labguard-server && pm2 save"; Flags: runhidden
Filename: "cmd.exe"; Parameters: "/C pm2-startup uninstall"; Flags: runhidden

[Code]
function InitializeSetup(): Boolean;
var
  UninstallStr: String;
  ResultCode: Integer;
  AppIdKey: String;
begin
  Result := True;
  AppIdKey := 'Software\Microsoft\Windows\CurrentVersion\Uninstall\{B2C3D4E5-F6A7-8901-BCDE-F12345678901}_is1';

  if not RegQueryStringValue(HKLM, AppIdKey, 'UninstallString', UninstallStr) then
    RegQueryStringValue(HKCU, AppIdKey, 'UninstallString', UninstallStr);

  if UninstallStr <> '' then
    Exec(RemoveQuotes(UninstallStr), '/SILENT /NORESTART', '', SW_HIDE,
         ewWaitUntilTerminated, ResultCode);
end;
