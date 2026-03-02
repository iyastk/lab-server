using System;
using System.Windows;
using System.Windows.Input;
using System.Diagnostics;
using System.Threading.Tasks;
using System.IO;
using System.Linq;
using System.Collections.Generic;

namespace ClientLocker
{
    public partial class MainWindow : Window
    {
        private KeyboardHook _hook;
        private FirebaseService _firebase;
        private MonitoringService _monitor;
        private System.Windows.Threading.DispatcherTimer _sessionTimer;
        private System.Windows.Threading.DispatcherTimer _commandTimer;
        private StudentData? _currentStudent = null;
        private string _pcName = Environment.MachineName;
        private bool _allowShutdown = false;
        private bool _isLocked = true; // Default state
        private List<FileSystemWatcher> _fileWatchers = new List<FileSystemWatcher>();
        private HashSet<string> _recentlyRenamed = new HashSet<string>();

        private void SetStatus(string msg, bool isError = false)
        {
            Application.Current.Dispatcher.Invoke(() => {
                StatusLabel.Text = msg;
                StatusLabel.Foreground = new System.Windows.Media.SolidColorBrush(
                    isError ? System.Windows.Media.Colors.Tomato : System.Windows.Media.Color.FromRgb(100, 116, 139));
            });
        }
        
        [System.Runtime.InteropServices.DllImport("user32.dll")]
        static extern bool SetCursorPos(int x, int y);

        [System.Runtime.InteropServices.DllImport("user32.dll")]
        public static extern void mouse_event(int dwFlags, int dx, int dy, int cButtons, int dwExtraInfo);

        private const int MOUSEEVENTF_LEFTDOWN = 0x02;
        private const int MOUSEEVENTF_LEFTUP = 0x04;

        public MainWindow()
        {
            InitializeComponent();
            _hook = new KeyboardHook();
            _firebase = new FirebaseService();
            _monitor = new MonitoringService();
            
            _hook.Hook();
            
            _monitor.OnAppChanged += async (activity) => {
                string docId = _currentStudent?.Id ?? "";
                string displayId = _currentStudent?.StudentId ?? "";
                var parts = activity.Split('|');
                string detailedInfo = parts.Length > 1 ? parts[1] : activity;

                await _firebase.UpdateStationStatus(_pcName, _isLocked ? "frozen" : "online", docId, detailedInfo);
                if (!string.IsNullOrEmpty(displayId))
                {
                    await _firebase.LogActivity(displayId, _pcName, activity);
                }
            };

            _monitor.OnViolationDetected += async (keyword) => {
                string displayId = _currentStudent?.StudentId ?? "System";
                await _firebase.LogActivity(displayId, _pcName, $"VIOLATION|Banned Word: {keyword}");
                Application.Current.Dispatcher.Invoke(() => {
                    LockPC();
                    MessageBox.Show($"Access to '{keyword}' is restricted by the administrator.", "LabGuard Security Violation", MessageBoxButton.OK, MessageBoxImage.Warning);
                });
            };

            _sessionTimer = new System.Windows.Threading.DispatcherTimer();
            _sessionTimer.Interval = TimeSpan.FromSeconds(1);
            _sessionTimer.Tick += SessionTimer_Tick;

            // Heartbeat timer (optimized throttling)
            var heartbeatTimer = new System.Windows.Threading.DispatcherTimer();
            heartbeatTimer.Interval = TimeSpan.FromSeconds(2);
            heartbeatTimer.Tick += HeartbeatTimer_Tick;
            heartbeatTimer.Start();

            _commandTimer = new System.Windows.Threading.DispatcherTimer();
            _commandTimer.Interval = TimeSpan.FromSeconds(5);
            _commandTimer.Tick += CommandTimer_Tick;
            _commandTimer.Start();

            // Periodic sync of offline logs
            var syncTimer = new System.Windows.Threading.DispatcherTimer();
            syncTimer.Interval = TimeSpan.FromMinutes(2);
            syncTimer.Tick += async (s, e) => await _firebase.SyncOfflineLogs();
            syncTimer.Start();

            // Fetch global settings periodically
            var settingsTimer = new System.Windows.Threading.DispatcherTimer();
            settingsTimer.Interval = TimeSpan.FromMinutes(5);
            settingsTimer.Tick += async (s, e) => await SyncGlobalSecurity();
            settingsTimer.Start();
            
            // Initial fetch
            Task.Run(async () => await SyncGlobalSecurity());

            RegisterForStartup();
        }

        private void RegisterForStartup()
        {
            try
            {
                var path = Environment.ProcessPath ?? System.Reflection.Assembly.GetExecutingAssembly().Location;
                try
                {
                    using (var key = Microsoft.Win32.Registry.LocalMachine.OpenSubKey(@"SOFTWARE\Microsoft\Windows\CurrentVersion\Run", true))
                    {
                        key?.SetValue("LabGuard", $"\"{path}\"");
                        return;
                    }
                }
                catch { }

                using (var key = Microsoft.Win32.Registry.CurrentUser.OpenSubKey(@"SOFTWARE\Microsoft\Windows\CurrentVersion\Run", true))
                {
                    key?.SetValue("LabGuard", $"\"{path}\"");
                }
            }
            catch { }
        }

        protected override void OnSourceInitialized(EventArgs e)
        {
            base.OnSourceInitialized(e);
            var source = System.Windows.Interop.HwndSource.FromHwnd(new System.Windows.Interop.WindowInteropHelper(this).Handle);
            source?.AddHook(WndProc);
        }

        private const int WM_QUERYENDSESSION = 0x0011;
        private const int WM_ENDSESSION = 0x0016;

        private IntPtr WndProc(IntPtr hwnd, int msg, IntPtr wParam, IntPtr lParam, ref bool handled)
        {
            if (msg == WM_QUERYENDSESSION || msg == WM_ENDSESSION)
            {
                if (_allowShutdown) return IntPtr.Zero;
                if (_currentStudent != null)
                {
                    handled = true;
                    Application.Current.Dispatcher.Invoke(() => 
                        MessageBox.Show("Shutdown is not allowed while a session is active.", "LabGuard - Blocked"));
                    return new IntPtr(0);
                }
            }
            return IntPtr.Zero;
        }

        private async void SessionTimer_Tick(object? sender, EventArgs e)
        {
            if (_currentStudent == null) return;

            _currentStudent.WeeklyRemaining--;
            _currentStudent.DailyRemaining--;

            if (_currentStudent.WeeklyRemaining <= 0 || _currentStudent.DailyRemaining <= 0)
            {
                LockPC();
            }

            if (_currentStudent.WeeklyRemaining % 60 == 0)
            {
                await _firebase.UpdateStudentTime(_currentStudent.Id, _currentStudent.WeeklyRemaining, _currentStudent.DailyRemaining);
            }
        }

        private DateTime _lastHeartbeat = DateTime.MinValue;
        private string _lastStatus = "";
        private string _lastReportedApp = "";

        private async void HeartbeatTimer_Tick(object? sender, EventArgs e)
        {
            string currentStatus = _isLocked ? "frozen" : "online";
            bool statusChanged = currentStatus != _lastStatus || _monitor.LastApp != _lastReportedApp;
            bool timeElapsed = (DateTime.Now - _lastHeartbeat).TotalSeconds >= 30;

            if (statusChanged || timeElapsed)
            {
                _lastStatus = currentStatus;
                _lastReportedApp = _monitor.LastApp;
                _lastHeartbeat = DateTime.Now;

                await _firebase.UpdateStationStatus(_pcName, currentStatus, _currentStudent?.Id ?? "", _monitor.LastApp);
            }
        }

        private async void CommandTimer_Tick(object? sender, EventArgs e)
        {
            try
            {
                string? command = await _firebase.GetPendingCommand(_pcName);
                if (!string.IsNullOrEmpty(command))
                {
                    HandleCommand(command);
                }
            }
            catch (Exception ex)
            {
                Debug.WriteLine("Command Poll Error: " + ex.Message);
            }
        }

        private void LockPC()
        {
            _isLocked = true;
            _sessionTimer.Stop();
            _monitor.Stop();
            StopFileWatchers();
            this.Show();
            this.Topmost = true;
            _hook.Hook();
        }

        private async void HandleCommand(string command)
        {
            try
            {
                switch (command.ToLower())
                {
                    case "lock":
                        SetStatus("🔒 Command: Freezing PC...");
                        Application.Current.Dispatcher.Invoke(() => LockPC());
                        break;
                    case "unlock":
                        SetStatus("🔓 Command: Unfreezing PC...");
                        Application.Current.Dispatcher.Invoke(() => UnlockPC());
                        break;
                    case "shutdown":
                        SetStatus("🔌 Command: Shutting down...");
                        _allowShutdown = true;
                        Process.Start("shutdown", "/s /t 10");
                        break;
                    case "restart":
                        SetStatus("🔄 Command: Restarting...");
                        _allowShutdown = true;
                        Process.Start("shutdown", "/r /t 10");
                        break;
                    case "sleep":
                        SetStatus("💤 Command: Putting to sleep...");
                        Process.Start("rundll32.exe", "powrprof.dll,SetSuspendState 0,1,0");
                        break;
                    case "screenshot":
                        SetStatus("📸 Command: Taking Snapshot...");
                        string base64 = _firebase.CaptureScreenBase64();
                        if (!string.IsNullOrEmpty(base64))
                        {
                            await _firebase.UpdateScreenCapture(_pcName, base64);
                            SetStatus("✅ Snapshot Sent");
                        }
                        break;
                    case "livestream_start":
                        SetStatus("📹 Command: Live Stream Started");
                        _firebase.StartLiveStream(_pcName);
                        break;
                    case "livestream_stop":
                        SetStatus("⏹️ Command: Live Stream Stopped");
                        _firebase.StopLiveStream();
                        break;
                    case string s when s.StartsWith("announcement|"):
                        string announcementMsg = command.Substring(13);
                        SetStatus("📢 Command: Announcement Received");
                        Application.Current.Dispatcher.Invoke(() => {
                            var announcement = new AnnouncementWindow(announcementMsg);
                            announcement.Show(); // Use Show instead of ShowDialog to prevent blocking
                        });
                        break;
                    case string s when s.StartsWith("file_transfer|"):
                        try {
                            var parts = command.Split('|');
                            string url = parts[1];
                            string fileName = parts[2];
                            SetStatus($"📥 Command: Receiving file {fileName}...");
                            string? localPath = await _firebase.DownloadFile(url, fileName);
                            if (localPath != null) {
                                SetStatus("✅ File Downloaded");
                                Application.Current.Dispatcher.Invoke(() => {
                                    MessageBox.Show($"Administrator sent a file: {fileName}", "File Received");
                                    Process.Start("explorer.exe", $"/select,\"{localPath}\"");
                                });
                            }
                        } catch { SetStatus("❌ File Transfer Failed", true); }
                        break;
                    case "internet_block":
                        SetStatus("🌐 Command: Blocking Internet...");
                        SetInternetAccess(false);
                        SetStatus("🚫 Internet Blocked");
                        break;
                    case "internet_allow":
                        SetStatus("🌐 Command: Allowing Internet...");
                        SetInternetAccess(true);
                        SetStatus("🟢 Internet Allowed");
                        break;
                    case "uninstall":
                        SetStatus("🗑️ Command: Uninstalling LabGuard...");
                        try
                        {
                            // 1. Remove auto-start from HKLM
                            try
                            {
                                using var lmKey = Microsoft.Win32.Registry.LocalMachine.OpenSubKey(
                                    @"SOFTWARE\Microsoft\Windows\CurrentVersion\Run", true);
                                lmKey?.DeleteValue("LabGuard", false);
                            }
                            catch { }

                            // 2. Remove auto-start from HKCU
                            try
                            {
                                using var cuKey = Microsoft.Win32.Registry.CurrentUser.OpenSubKey(
                                    @"SOFTWARE\Microsoft\Windows\CurrentVersion\Run", true);
                                cuKey?.DeleteValue("LabGuard", false);
                            }
                            catch { }

                            // 3. Schedule self-deletion via cmd (runs after process exits)
                            string exePath = Environment.ProcessPath ?? System.Reflection.Assembly.GetExecutingAssembly().Location;
                            string script = $"/C ping 127.0.0.1 -n 3 > nul & del /F /Q \"{exePath}\"";
                            Process.Start(new ProcessStartInfo("cmd.exe", script) { CreateNoWindow = true, UseShellExecute = false });

                            // 4. Update Firestore status and shut down cleanly
                            await _firebase.UpdateStationStatus(_pcName, "offline");
                            _allowShutdown = true;
                            Application.Current.Dispatcher.Invoke(() => Application.Current.Shutdown());
                        }
                        catch (Exception unEx)
                        {
                            SetStatus("❌ Uninstall failed: " + unEx.Message, true);
                        }
                        break;
                }
            }
            catch (Exception ex)
            {
                Debug.WriteLine("Error handling command: " + ex.Message);
            }
        }

        private async void RefreshStudentData()
        {
            if (_currentStudent == null) return;
            var updated = await _firebase.ValidateStudent(_currentStudent.Id, "");
            if (updated != null)
            {
                _currentStudent.WeeklyRemaining = updated.WeeklyRemaining;
                _currentStudent.DailyRemaining = updated.DailyRemaining;
            }
        }

        private async void Login_Click(object sender, RoutedEventArgs e)
        {
            string id = IdInput.Text;
            string password = PasswordInput.Password;

            // Simplified Admin Login as requested
            if (id == "admin" && password == "nopassword")
            {
                _hook.Unhook();
                this.Hide();
                OpenUserDashboard(new StudentData { Id = "System Admin", WeeklyRemaining = 9999, DailyRemaining = 9999 });
                MessageBox.Show("Welcome, Admin!");
            }
            else
            {
                var student = await _firebase.ValidateStudent(id, password);
                if (student != null)
                {
                    if (student.WeeklyRemaining <= 0 || student.DailyRemaining <= 0)
                    {
                        MessageBox.Show("Your time quota has expired.");
                        return;
                    }
                    _currentStudent = student;
                    OpenUserDashboard(student);
                    UnlockPC();
                }
                else MessageBox.Show("Invalid ID or Password");
            }
        }

        private void AdminLogin_Click(object sender, RoutedEventArgs e)
        {
            IdInput.Text = "";
            PasswordInput.Password = "";
            IdInput.Focus();
            SetStatus("Admin login mode: Please type 'admin' and your password.");
        }

        private void OpenUserDashboard(StudentData student)
        {
            Application.Current.Dispatcher.Invoke(() => {
                var dashboard = new UserDashboard(student, () => {
                    _currentStudent = null;
                    LockPC();
                });
                dashboard.Show();
            });
        }

        private void SetInternetAccess(bool allow)
        {
            try
            {
                string appPath = Environment.ProcessPath ?? System.Reflection.Assembly.GetExecutingAssembly().Location;
                RunHiddenCommand("netsh", $"advfirewall firewall add rule name=\"LabGuard_Allow\" dir=out action=allow program=\"{appPath}\" enable=yes");
                
                if (allow) RunHiddenCommand("netsh", "advfirewall firewall delete rule name=\"LabGuard_BlockWeb\"");
                else
                {
                    RunHiddenCommand("netsh", "advfirewall firewall delete rule name=\"LabGuard_BlockWeb\"");
                    RunHiddenCommand("netsh", "advfirewall firewall add rule name=\"LabGuard_BlockWeb\" dir=out action=block protocol=TCP remoteport=80,443");
                }
                _firebase.UpdateStationField(_pcName, "isInternetBlocked", (!allow).ToString().ToLower());
            }
            catch { }
        }

        private void RunHiddenCommand(string fileName, string args)
        {
            try
            {
                ProcessStartInfo psi = new ProcessStartInfo(fileName, args) { CreateNoWindow = true, UseShellExecute = false, Verb = "runas" };
                Process.Start(psi)?.WaitForExit();
            }
            catch { }
        }

        private async void UnlockPC()
        {
            _isLocked = false;
            _monitor.BlockUninstalls = await _firebase.GetGlobalSecuritySettings();
            _sessionTimer.Start();
            _monitor.Start();
            StartFileWatchers();
            this.Hide();
            _hook.Unhook();
        }

        private async void ChangeProfile_Click(object sender, RoutedEventArgs e)
        {
            ProfileOverlay.Visibility = Visibility.Visible;
            OldIdInput.Text = IdInput.Text;
            OldPassInput.Password = PasswordInput.Password;

            // Check remaining username changes and show info
            string currentId = IdInput.Text;
            string currentPass = PasswordInput.Password;
            if (!string.IsNullOrEmpty(currentId) && !string.IsNullOrEmpty(currentPass))
            {
                int changeCount = await _firebase.GetUsernameChangeCount(currentId, currentPass);
                int remaining = 2 - changeCount;
                ProfileInfoText.Text = remaining > 0
                    ? $"Username changes remaining: {remaining} of 2"
                    : "⚠ No username changes remaining (password change only)";
                ProfileInfoText.Foreground = new System.Windows.Media.SolidColorBrush(
                    remaining > 0 ? System.Windows.Media.Color.FromRgb(148, 163, 184) : System.Windows.Media.Color.FromRgb(245, 158, 11));
            }
        }

        private async void UpdateProfile_Click(object sender, RoutedEventArgs e)
        {
            string oldId = OldIdInput.Text;
            string oldPass = OldPassInput.Password;
            string newId = NewIdInput.Text;
            string newPass = NewPassInput.Password;

            if (string.IsNullOrEmpty(newId) || string.IsNullOrEmpty(newPass))
            {
                MessageBox.Show("Please enter new credentials.");
                return;
            }

            var (success, message) = await _firebase.UpdateStudentProfile(oldId, oldPass, newId, newPass);
            if (success)
            {
                MessageBox.Show(message, "Profile Updated");
                ProfileOverlay.Visibility = Visibility.Collapsed;
                IdInput.Text = newId;
                PasswordInput.Password = newPass;
            }
            else
            {
                MessageBox.Show(message, "Profile Update Failed");
            }
        }

        private void CancelProfile_Click(object sender, RoutedEventArgs e)
        {
            ProfileOverlay.Visibility = Visibility.Collapsed;
        }

        private async Task SyncGlobalSecurity()
        {
            try
            {
                var banned = await _firebase.GetGlobalBannedWords();
                if (banned != null) _monitor.BannedKeywords = banned;

                var blockedWebsites = await _firebase.GetGlobalBlockedWebsites();
                if (blockedWebsites != null)
                {
                    WebsiteBlocker.Apply(blockedWebsites);
                }

                _monitor.BlockUninstalls = await _firebase.GetGlobalSecuritySettings();
            }
            catch (Exception ex)
            {
                Debug.WriteLine("Security Sync Error: " + ex.Message);
            }
        }

        protected override void OnClosing(System.ComponentModel.CancelEventArgs e)
        {
            StopFileWatchers();
            WebsiteBlocker.Cleanup(); // Remove blocks on exit if desired, or keep them
            base.OnClosing(e);
        }

        // ─── File Naming Rule Enforcement ──────────────────────────────────────────
        private void StartFileWatchers()
        {
            StopFileWatchers();
            if (_currentStudent == null || _currentStudent.Id == "System Admin") return;

            string username = _currentStudent.StudentId;
            if (string.IsNullOrEmpty(username)) return;

            string[] watchPaths = new[]
            {
                Environment.GetFolderPath(Environment.SpecialFolder.Desktop),
                Environment.GetFolderPath(Environment.SpecialFolder.MyDocuments),
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.UserProfile), "Downloads")
            };

            foreach (string dir in watchPaths)
            {
                if (!Directory.Exists(dir)) continue;
                try
                {
                    var watcher = new FileSystemWatcher(dir)
                    {
                        NotifyFilter = NotifyFilters.FileName,
                        IncludeSubdirectories = false,
                        EnableRaisingEvents = true
                    };

                    watcher.Created += (s, e) => OnFileCreatedOrRenamed(e.FullPath, username);
                    watcher.Renamed += (s, e) => OnFileCreatedOrRenamed(e.FullPath, username);

                    _fileWatchers.Add(watcher);
                }
                catch (Exception ex)
                {
                    Debug.WriteLine($"FileWatcher Error for {dir}: {ex.Message}");
                }
            }
        }

        private void StopFileWatchers()
        {
            foreach (var watcher in _fileWatchers)
            {
                watcher.EnableRaisingEvents = false;
                watcher.Dispose();
            }
            _fileWatchers.Clear();
            _recentlyRenamed.Clear();
        }

        private async void OnFileCreatedOrRenamed(string fullPath, string username)
        {
            try
            {
                // Skip system/hidden files and temporary files
                string fileName = Path.GetFileName(fullPath);
                if (string.IsNullOrEmpty(fileName)) return;
                if (fileName.StartsWith(".") || fileName.StartsWith("~")) return;
                if (fileName.EndsWith(".tmp", StringComparison.OrdinalIgnoreCase)) return;
                if (fileName.EndsWith(".crdownload", StringComparison.OrdinalIgnoreCase)) return;

                // Prevent re-processing files we just renamed
                if (_recentlyRenamed.Contains(fullPath)) 
                {
                    _recentlyRenamed.Remove(fullPath);
                    return;
                }

                string prefix = username + "_";
                if (fileName.StartsWith(prefix, StringComparison.OrdinalIgnoreCase) ||
                    fileName.StartsWith(username + ".", StringComparison.OrdinalIgnoreCase))
                {
                    return; // Already correctly named
                }

                // Wait for file to be released by the saving app
                await Task.Delay(1000);

                if (!File.Exists(fullPath)) return;

                string dir = Path.GetDirectoryName(fullPath) ?? "";
                string newFileName = prefix + fileName;
                string newPath = Path.Combine(dir, newFileName);

                // Handle duplicate names
                int counter = 1;
                while (File.Exists(newPath))
                {
                    string nameOnly = Path.GetFileNameWithoutExtension(fileName);
                    string ext = Path.GetExtension(fileName);
                    newPath = Path.Combine(dir, $"{prefix}{nameOnly}_{counter}{ext}");
                    counter++;
                }

                _recentlyRenamed.Add(newPath);
                File.Move(fullPath, newPath);

                string displayId = _currentStudent?.StudentId ?? username;
                await _firebase.LogActivity(displayId, _pcName, $"FILE_RULE|Renamed: {fileName} → {Path.GetFileName(newPath)}");

                Application.Current.Dispatcher.Invoke(() =>
                {
                    MessageBox.Show(
                        $"Your file was renamed to follow the naming rule:\n\n{fileName}  →  {Path.GetFileName(newPath)}\n\nAll files must start with your username \"{username}\".",
                        "LabGuard - File Naming Rule",
                        MessageBoxButton.OK, MessageBoxImage.Information);
                });
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"File Naming Rule Error: {ex.Message}");
            }
        }
    }

    public static class WebsiteBlocker
    {
        private static readonly string HostsPath = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.System), @"drivers\etc\hosts");
        private const string SectionStart = "# LabGuard Blocked Websites Start";
        private const string SectionEnd = "# LabGuard Blocked Websites End";

        public static void Apply(string[] domains)
        {
            try
            {
                if (!File.Exists(HostsPath)) return;

                var lines = File.ReadAllLines(HostsPath).ToList();
                int startIdx = lines.FindIndex(l => l.Contains(SectionStart));
                int endIdx = lines.FindIndex(l => l.Contains(SectionEnd));

                if (startIdx != -1 && endIdx != -1)
                {
                    lines.RemoveRange(startIdx, endIdx - startIdx + 1);
                }

                if (domains != null && domains.Length > 0)
                {
                    lines.Add(SectionStart);
                    foreach (var domain in domains)
                    {
                        string host = domain.Trim().ToLower();
                        if (string.IsNullOrEmpty(host)) continue;
                        lines.Add($"127.0.0.1 {host}");
                        if (!host.StartsWith("www.")) lines.Add($"127.0.0.1 www.{host}");
                    }
                    lines.Add(SectionEnd);
                }

                File.WriteAllLines(HostsPath, lines);
                
                // Flush DNS cache to make it effective immediately
                Process.Start(new ProcessStartInfo("ipconfig", "/flushdns") { CreateNoWindow = true, UseShellExecute = false })?.WaitForExit();
            }
            catch (Exception ex)
            {
                Debug.WriteLine("Website Blocker Error: " + ex.Message);
            }
        }

        public static void Cleanup()
        {
            Apply(Array.Empty<string>());
        }
    }
}
