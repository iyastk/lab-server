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

procedure ExtractDotnetCheckScript();
var
  ScriptPath: string;
  Lines: TArrayOfString;
begin
  ScriptPath := ExpandConstant('{tmp}\dotnet_check.bat');
  SetArrayLength(Lines, 12);
  Lines[0]  := '@echo off';
  Lines[1]  := 'FOR /F "tokens=*" %%i IN (''dotnet --list-runtimes 2^>nul'') DO (';
  Lines[2]  := '  echo %%i | findstr /C:"Microsoft.WindowsDesktop.App 6." >nul';
  Lines[3]  := '  if not errorlevel 1 goto :found';
  Lines[4]  := ')';
  Lines[5]  := ':install';
  Lines[6]  := 'echo .NET 6 Desktop Runtime not found. Downloading...';
  Lines[7]  := 'powershell -Command "Invoke-WebRequest -Uri ''' + DOTNET_RUNTIME_URL + ''' -OutFile ''%TEMP%\dotnet6_runtime.exe'' -UseBasicParsing"';
  Lines[8]  := 'start /wait %TEMP%\dotnet6_runtime.exe /install /quiet /norestart';
  Lines[9]  := 'goto :end';
  Lines[10] := ':found';
  Lines[11] := ':end';
  SaveStringsToFile(ScriptPath, Lines, False);
end;

function InitializeSetup(): Boolean;
var
  UninstallStr: String;
  ResultCode: Integer;
  AppIdKey: String;
begin
  Result := True;
  AppIdKey := 'Software\Microsoft\Windows\CurrentVersion\Uninstall\{A1B2C3D4-E5F6-7890-ABCD-EF1234567890}_is1';

  // Check HKLM first (admin install), then HKCU (user install)
  if not RegQueryStringValue(HKLM, AppIdKey, 'UninstallString', UninstallStr) then
    RegQueryStringValue(HKCU, AppIdKey, 'UninstallString', UninstallStr);

  if UninstallStr <> '' then
  begin
    // Silently remove the old version before installing the new one
    Exec(RemoveQuotes(UninstallStr), '/SILENT /NORESTART', '', SW_HIDE,
         ewWaitUntilTerminated, ResultCode);
  end;
end;
