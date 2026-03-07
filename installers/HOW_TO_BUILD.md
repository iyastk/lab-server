# How to Build the LabGuard Installers
# =========================================
# Complete production build reference — Inno Setup 6 + Visual Studio

---

## Requirements

| Tool | Version | Download |
|------|---------|----------|
| **Visual Studio** | 2022 (Community OK) | [visualstudio.microsoft.com](https://visualstudio.microsoft.com) |
| **.NET 6 SDK** | 6.0+ | [dot.net/download](https://dotnet.microsoft.com/download) |
| **.NET Framework 4.8 SDK** | 4.8 | Included with VS |
| **Inno Setup 6** | 6.x (free) | [jrsoftware.org/isdl.php](https://jrsoftware.org/isdl.php) |

---

## Build Order

### Step 1 — Build ClientLocker (Visual Studio)

1. Open `ClientLocker\ClientLocker.csproj` in Visual Studio
2. Set Configuration to **Release** | Platform: **Any CPU**
3. Press **Ctrl+Shift+B** (Build Solution)
4. Output lands in: `ClientLocker\bin\Release\net6.0-windows\`

> ⚠️ The `.iss` script expects files in `ClientLocker\RELEASE_PACKAGE\Client_Payload\`.
> Use **Publish** (not just Build) for a self-contained single-file exe, or run `package.bat` which calls `dotnet publish` automatically.

#### Alternative — dotnet publish (CLI)
```batch
cd ClientLocker
dotnet publish -c Release -r win-x64 --self-contained true ^
  -p:PublishSingleFile=true ^
  -o "..\ClientLocker\RELEASE_PACKAGE\Client_Payload"
```

---

### Step 2 — Build Watchdog

1. Open `ClientLocker\Watchdog\Watchdog.csproj` in Visual Studio
2. Set Configuration to **Release**
3. Build — output in: `ClientLocker\Watchdog\bin\Release\net48\`

> The watchdog targets **.NET Framework 4.8** (not .NET 6) so it is always present on Windows 10/11 without any runtime install.

---

### Step 3 — Run package.bat (Optional Quick Build)

`package.bat` at the repo root automates the publish + zip steps:

```batch
cd "lab-server"
package.bat
```

It will:
1. `dotnet publish` the ClientLocker to `RELEASE_PACKAGE\Client_Payload\`
2. Package the local-server files (excluding `node_modules`)
3. Copy outputs to `admin-dashboard\public\` for instant dashboard download

> **Note:** `package.bat` creates **zip archives** for download links, not the `.exe` installers. Run both if you need both.

---

### Step 4 — Compile Client Installer

1. Open `installers\LabGuard_Client_Setup.iss` in Inno Setup Compiler
2. Press **F9** (Build → Compile)
3. Output: `installers\LabGuard_Client_Setup.exe`

**What this installer does:**
- Copies `ClientLocker\RELEASE_PACKAGE\Client_Payload\*` → `%ProgramFiles%\LabGuard\Client\`
- Copies `ClientLocker\Watchdog\bin\Release\net48\*` → `%ProgramFiles%\LabGuard\Client\Watchdog\`
- Copies `browser-extension\` → `%ProgramFiles%\LabGuard\Client\browser-extension\`
- Registers both `ClientLocker.exe` and `LabGuardWatchdog.exe` in HKLM Run (auto-start)
- Reserves `http://127.0.0.1:4000/report/` with `netsh urlacl` for the HttpListener
- Opens Windows Firewall for port 4000
- Auto-downloads + installs **.NET 6 Desktop Runtime** if not present

---

### Step 5 — Compile Server Installer

1. Open `installers\LabGuard_Server_Setup.iss` in Inno Setup Compiler
2. Press **F9**
3. Output: `installers\LabGuard_Server_Setup.exe`

**What this installer does:**
- Copies `local-server\*` (excluding `node_modules`, `.env`) → `%ProgramFiles%\LabGuard\Server\`
- Copies `browser-extension\` → `%ProgramFiles%\LabGuard\Server\browser-extension\`
- Auto-downloads + installs **Node.js 18 LTS** if not present
- Runs `npm install` inside the server folder
- Installs **PM2** globally + registers the server as a Windows auto-start service via `pm2-windows-startup`
- Starts `server.js` under PM2 with the name `labguard-server`

---

## Deploy to Admin Dashboard

Copy the compiled `.exe` files to the Vite public folder so the download buttons work:

```
admin-dashboard\public\
├── LabGuard_Client_Setup.exe   ← copy from installers\
└── LabGuard_Server_Setup.exe   ← copy from installers\
```

**Quick copy (run from repo root):**
```batch
copy installers\LabGuard_Client_Setup.exe admin-dashboard\public\
copy installers\LabGuard_Server_Setup.exe admin-dashboard\public\
```

Vite automatically serves everything in `public\` at the root path, so:
- `/LabGuard_Client_Setup.exe` → served by Vite dev server and Firebase Hosting
- `/LabGuard_Server_Setup.exe` → served by Vite dev server and Firebase Hosting

---

## Silent / Batch Install

Both installers are standard Inno Setup 6 and support all Inno silent flags:

| Flag | Behavior |
|------|----------|
| `/SILENT` | Shows a progress bar, no user prompts |
| `/VERYSILENT` | Fully hidden — no UI at all |
| `/NORESTART` | Suppresses any reboot prompts |
| `/DIR="C:\path"` | Override install directory |

### Batch deploy to all 30 lab PCs (via shared drive or USB):
```batch
\\server\labguard\LabGuard_Client_Setup.exe /VERYSILENT /NORESTART
```

### PowerShell remote deploy (PsExec / Invoke-Command):
```powershell
Invoke-Command -ComputerName PC01, PC02, PC03 -ScriptBlock {
    Start-Process "\\server\labguard\LabGuard_Client_Setup.exe" `
        -ArgumentList "/VERYSILENT /NORESTART" -Wait
}
```

---

## Uninstall

Both installers register a standard Add/Remove Programs entry:
- **LabGuard Client** — removes files, autostart keys, URL ACL, and firewall rule
- **LabGuard Server** — stops PM2 service (`pm2 stop labguard-server`), removes startup service, removes files

Silent uninstall:
```batch
"%ProgramFiles%\LabGuard\Client\unins000.exe" /VERYSILENT
"%ProgramFiles%\LabGuard\Server\unins000.exe" /VERYSILENT
```
