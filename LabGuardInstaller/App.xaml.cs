using System;
using System.Diagnostics;
using System.IO;
using System.Net;
using System.Windows;
using Microsoft.Win32;
using IWshRuntimeLibrary;

namespace LabGuardInstaller
{
    public partial class App : Application
    {
        private const string DotNetDownloadUrl = "https://dotnet.microsoft.com/en-us/download/dotnet/thank-you/runtime-desktop-6.0.28-windows-x64-installer";
        private const string NodeJsDownloadUrl = "https://nodejs.org/en/download/";
        private const string AppFolderName = "LabGuard";

        protected override async void OnStartup(StartupEventArgs e)
        {
            base.OnStartup(e);

            if (!CheckDotNetRuntime())
            {
                var result = MessageBox.Show(
                    "This software requires the .NET 6.0 Desktop Runtime to run. \n\nWould you like to download and install it now?",
                    "Requirement Missing",
                    MessageBoxButton.YesNo,
                    MessageBoxImage.Warning);

                if (result == MessageBoxResult.Yes)
                {
                    Process.Start(new ProcessStartInfo(DotNetDownloadUrl) { UseShellExecute = true });
                }
                Current.Shutdown();
                return;
            }

            if (!CheckNodeJs())
            {
                var result = MessageBox.Show(
                    "This software requires Node.js to run the local server. \n\nWould you like to download it now?",
                    "Requirement Missing",
                    MessageBoxButton.YesNo,
                    MessageBoxImage.Warning);

                if (result == MessageBoxResult.Yes)
                {
                    Process.Start(new ProcessStartInfo(NodeJsDownloadUrl) { UseShellExecute = true });
                }
                Current.Shutdown();
                return;
            }

            await InstallAndLaunchAsync();
        }

        private bool CheckDotNetRuntime()
        {
            try
            {
                // Simple way to check if .NET 6.0 is installed by checking registry or running a command
                // For a bootstrapper, we can try to check the Program Files folder
                return Directory.Exists(@"C:\Program Files\dotnet\shared\Microsoft.WindowsDesktop.App\6.0");
            }
            catch { return false; }
        }

        private bool CheckNodeJs()
        {
            try
            {
                ProcessStartInfo psi = new ProcessStartInfo("node", "-v")
                {
                    RedirectStandardOutput = true,
                    UseShellExecute = false,
                    CreateNoWindow = true
                };
                using (Process proc = Process.Start(psi))
                {
                    proc.WaitForExit();
                    return proc.ExitCode == 0;
                }
            }
            catch { return false; }
        }

        private async System.Threading.Tasks.Task InstallAndLaunchAsync()
        {
            string programData = Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData);
            string installPath = Path.Combine(programData, AppFolderName);

            try
            {
                if (!Directory.Exists(installPath))
                    Directory.CreateDirectory(installPath);

                // In a real scenario, the installer would contain the app as an embedded resource
                // For this demonstration, we'll assume the files are in a 'payload' subfolder
                string sourcePath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "payload");
                
                if (Directory.Exists(sourcePath))
                {
                    // Run the file copy operation on a background thread to keep the UI responsive
                    await System.Threading.Tasks.Task.Run(async () =>
                    {
                        foreach (string file in Directory.GetFiles(sourcePath))
                        {
                            string dest = Path.Combine(installPath, Path.GetFileName(file));
                            using (FileStream sourceStream = File.Open(file, FileMode.Open, FileAccess.Read))
                            using (FileStream destStream = File.Create(dest))
                            {
                                await sourceStream.CopyToAsync(destStream);
                            }
                        }
                    });
                    
                    MessageBox.Show("LabGuard has been installed successfully!", "Installation Complete");
                    
                    string clientExe = Path.Combine(installPath, "ClientLocker.exe");
                    string serverDir = Path.Combine(installPath, "local-server");
                    string serverBat = Path.Combine(serverDir, "start.bat");

                    // Install server dependencies (npm install)
                    await InstallServerDependencies(serverDir);

                    RegisterStartup("LabGuardClient", clientExe);
                    RegisterStartup("LabGuardServer", $"cmd.exe /c start /min \"\" \"{serverBat}\"");
                    CreateDesktopShortcut(clientExe);

                    Process.Start(new ProcessStartInfo(clientExe) { UseShellExecute = true });
                }
                else
                {
                    MessageBox.Show("Installation source files not found. Please ensure the 'payload' folder is present.", "Error");
                }
            }
            catch (Exception ex)
            {
                MessageBox.Show("Installation failed: " + ex.Message);
            }

        private async System.Threading.Tasks.Task InstallServerDependencies(string serverPath)
        {
            try
            {
                // Run npm install in the server directory
                ProcessStartInfo psi = new ProcessStartInfo("npm", "install")
                {
                    WorkingDirectory = serverPath,
                    UseShellExecute = false,
                    CreateNoWindow = true
                };

                await System.Threading.Tasks.Task.Run(() =>
                {
                    using (Process proc = Process.Start(psi))
                    {
                        proc.WaitForExit();
                    }
                });
            }
            catch (Exception ex)
            {
                MessageBox.Show($"Failed to install server dependencies: {ex.Message}. You may need to run 'npm install' manually in {serverPath}.", "Dependency Error");
            }
        }

        private void RegisterStartup(string name, string path)
        {
            try
            {
                using (RegistryKey key = Registry.LocalMachine.OpenSubKey(@"SOFTWARE\Microsoft\Windows\CurrentVersion\Run", true))
                {
                    key?.SetValue(name, $"\"{path}\"");
                }
            }
            catch (Exception ex)
            {
                MessageBox.Show($"Failed to register {name} for startup: {ex.Message}", "Registry Error");
            }
        }

        private void CreateDesktopShortcut(string targetPath)
        {
            try
            {
                string desktopPath = Environment.GetFolderPath(Environment.SpecialFolder.CommonDesktopDirectory);
                if (string.IsNullOrEmpty(desktopPath)) desktopPath = Environment.GetFolderPath(Environment.SpecialFolder.Desktop);

                string shortcutPath = Path.Combine(desktopPath, "LabGuard.lnk");
                WshShell shell = new WshShell();
                IWshShortcut shortcut = (IWshShortcut)shell.CreateShortcut(shortcutPath);
                shortcut.TargetPath = targetPath;
                shortcut.WorkingDirectory = Path.GetDirectoryName(targetPath);
                shortcut.Description = "Launch LabGuard Client";
                shortcut.Save();
            }
            catch { /* Non-critical if shortcut fails */ }
        }

        Current.Shutdown();
    }
}
}
