; ============================================================
; LabGuard Client Setup Script — Inno Setup 6
; Installs ClientLocker.exe + LabGuardWatchdog.exe
; Auto-downloads .NET 6 Desktop Runtime if missing
; ============================================================
#define AppName       "LabGuard Client"
#define AppVersion    "2.1.0"
#define AppPublisher  "LabGuard"
#define AppExeName    "ClientLocker.exe"
#define WatchdogExe   "LabGuardWatchdog.exe"

[Setup]
AppId={{A1B2C3D4-E5F6-7890-ABCD-EF1234567890}
AppName={#AppName}
AppVersion={#AppVersion}
AppPublisher={#AppPublisher}
DefaultDirName={autopf}\LabGuard\Client
DefaultGroupName=LabGuard
OutputDir=.
OutputBaseFilename=LabGuard_Client_Setup
SetupIconFile=
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
PrivilegesRequired=admin
PrivilegesRequiredOverridesAllowed=dialog
; Uninstall info
UninstallDisplayName={#AppName}
UninstallDisplayIcon={app}\{#AppExeName}

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Files]
; ⚠️  PRE-REQUISITE: Run a Release build (or dotnet publish) for ClientLocker FIRST.
;     Client_Payload must contain ClientLocker.exe before compiling this script.
;     See installers\HOW_TO_BUILD.md for full instructions.
; Main client executable
Source: "..\ClientLocker\RELEASE_PACKAGE\Client_Payload\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs
; Watchdog in its own subfolder
Source: "..\ClientLocker\Watchdog\bin\Release\net48\*"; DestDir: "{app}\Watchdog"; Flags: ignoreversion recursesubdirs createallsubdirs
; Browser extension (bundled for convenience)
Source: "..\browser-extension\*"; DestDir: "{app}\browser-extension"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{group}\LabGuard Client"; Filename: "{app}\{#AppExeName}"
Name: "{group}\Uninstall LabGuard Client"; Filename: "{uninstallexe}"

[Registry]
; Register ClientLocker to auto-start with Windows (HKLM — all users)
Root: HKLM; Subkey: "SOFTWARE\Microsoft\Windows\CurrentVersion\Run"; ValueType: string; ValueName: "LabGuard"; ValueData: """{app}\{#AppExeName}"""; Flags: uninsdeletevalue

; Register Watchdog to auto-start as well
Root: HKLM; Subkey: "SOFTWARE\Microsoft\Windows\CurrentVersion\Run"; ValueType: string; ValueName: "LabGuardWatchdog"; ValueData: """{app}\Watchdog\{#WatchdogExe}"""; Flags: uninsdeletevalue

[Run]
; ── Step 1: Check & Install .NET 6 Desktop Runtime if missing ──
Filename: "{tmp}\dotnet_check.bat"; Parameters: ""; Flags: runhidden waituntilterminated; BeforeInstall: ExtractDotnetCheckScript
; ── Step 2: Register HTTP port 4000 in Windows URLACL (for the HttpListener) ──
Filename: "netsh"; Parameters: "http add urlacl url=http://127.0.0.1:4000/report/ user=Everyone"; Flags: runhidden waituntilterminated shellexec
; ── Step 3: Open Windows Firewall for port 4000 ──
Filename: "netsh"; Parameters: "advfirewall firewall add rule name=""LabGuard Extension Port"" dir=in action=allow protocol=TCP localport=4000"; Flags: runhidden waituntilterminated shellexec
; ── Step 4: Launch the client at the end ──
Filename: "{app}\{#AppExeName}"; Description: "Launch LabGuard Client now"; Flags: nowait postinstall skipifsilent

[UninstallRun]
; Remove URL ACL reservation on uninstall
Filename: "netsh"; Parameters: "http delete urlacl url=http://127.0.0.1:4000/report/"; Flags: runhidden
; Remove firewall rule on uninstall
Filename: "netsh"; Parameters: "advfirewall firewall delete rule name=""LabGuard Extension Port"""; Flags: runhidden

[Code]
const
  DOTNET_RUNTIME_URL = 'https://download.visualstudio.microsoft.com/download/pr/windowsdesktop-runtime-6.0.36-win-x64.exe';

{ ── Kill any running LabGuard processes so the installer can replace files ── }
procedure KillLabGuardProcesses();
var
  ResultCode: Integer;
begin
  { Kill the main client — ignore errors if it is not running }
  Exec('taskkill.exe', '/f /im ClientLocker.exe',     '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
  { Kill the watchdog too, otherwise it will restart the client moments later }
  Exec('taskkill.exe', '/f /im LabGuardWatchdog.exe', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
  { Brief pause so the OS fully releases the file handles before extraction starts }
  Sleep(1500);
end;

procedure ExtractDotnetCheckScript();
var
  ScriptPath: string;
  Lines: TArrayOfString;
begin
  ScriptPath := ExpandConstant('{tmp}\dotnet_check.bat');
  SetArrayLength(Lines, 16);
  Lines[0]  := '@echo off';
  Lines[1]  := 'set "RT_PATH=%TEMP%\dotnet6_runtime.exe"';
  Lines[2]  := 'dotnet --list-runtimes 2>nul | findstr /C:"Microsoft.WindowsDesktop.App 6." >nul';
  Lines[3]  := 'if not errorlevel 1 goto :found';
  Lines[4]  := '';
  Lines[5]  := ':install';
  Lines[6]  := 'echo .NET 6 Desktop Runtime not found. Downloading...';
  Lines[7]  := 'powershell -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; try { Invoke-WebRequest -Uri ''' + DOTNET_RUNTIME_URL + ''' -OutFile ''%RT_PATH%'' -UseBasicParsing -ErrorAction Stop } catch { exit 1 }"';
  Lines[8]  := 'if errorlevel 1 (';
  Lines[9]  := '  echo DOWNLOAD FAILED! Please ensure you have internet access.';
  Lines[10] := '  pause';
  Lines[11] := '  exit /b 1';
  Lines[12] := ')';
  Lines[13] := 'if exist "%RT_PATH%" start /wait "" "%RT_PATH%" /install /quiet /norestart';
  Lines[14] := ':found';
  Lines[15] := ':end';
  SaveStringsToFile(ScriptPath, Lines, False);
end;

function InitializeSetup(): Boolean;
var
  UninstallStr: String;
  ResultCode: Integer;
  AppIdKey: String;
begin
  Result := True;

  { ── FIRST: stop all LabGuard processes so files can be replaced ── }
  KillLabGuardProcesses();

  AppIdKey := 'Software\Microsoft\Windows\CurrentVersion\Uninstall\{A1B2C3D4-E5F6-7890-ABCD-EF1234567890}_is1';

  // Check HKLM first (admin install), then HKCU (user install)
  if not RegQueryStringValue(HKLM, AppIdKey, 'UninstallString', UninstallStr) then
    RegQueryStringValue(HKCU, AppIdKey, 'UninstallString', UninstallStr);

  if UninstallStr <> '' then
  begin
    // Silently remove the old version before installing the new one
    Exec(RemoveQuotes(UninstallStr), '/SILENT /NORESTART', '', SW_HIDE,
         ewWaitUntilTerminated, ResultCode);
    { Kill again — the old uninstaller may have re-triggered the watchdog }
    KillLabGuardProcesses();
  end;
end;

{ ── Extra safety: kill processes right before Inno Setup extracts files ── }
procedure CurStepChanged(CurStep: TSetupStep);
begin
  if CurStep = ssInstall then
    KillLabGuardProcesses();
end;
