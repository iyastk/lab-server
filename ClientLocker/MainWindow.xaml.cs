using System;
using System.Windows;
using System.Windows.Input;
using System.Diagnostics;
using System.Threading.Tasks;

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
                string studentId = _currentStudent?.Id ?? "";
                var parts = activity.Split('|');
                string detailedInfo = parts.Length > 1 ? parts[1] : activity;

                await _firebase.UpdateStationStatus(_pcName, _isLocked ? "frozen" : "online", studentId, detailedInfo);
                if (!string.IsNullOrEmpty(studentId))
                {
                    await _firebase.LogActivity(studentId, _pcName, activity);
                }
            };

            _monitor.OnViolationDetected += async (keyword) => {
                await _firebase.LogActivity(_currentStudent?.Id ?? "System", _pcName, $"VIOLATION|Banned Word: {keyword}");
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
            settingsTimer.Tick += async (s, e) => {
                var banned = await _firebase.GetGlobalBannedWords();
                if (banned != null) _monitor.BannedKeywords = banned;
                _monitor.BlockUninstalls = await _firebase.GetGlobalSecuritySettings();
            };
            settingsTimer.Start();
            
            // Initial fetch
            Task.Run(async () => {
                var banned = await _firebase.GetGlobalBannedWords();
                if (banned != null) _monitor.BannedKeywords = banned;
            });

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
            IdInput.Text = "admin";
            PasswordInput.Password = "";
            PasswordInput.Focus();
            SetStatus("Admin ID pre-filled. Please enter admin password.");
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
            this.Hide();
            _hook.Unhook();
        }

        private void ChangeProfile_Click(object sender, RoutedEventArgs e)
        {
            ProfileOverlay.Visibility = Visibility.Visible;
            OldIdInput.Text = IdInput.Text;
            OldPassInput.Password = PasswordInput.Password;
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

            bool success = await _firebase.UpdateStudentProfile(oldId, oldPass, newId, newPass);
            if (success)
            {
                MessageBox.Show("Profile updated successfully! Please login with your new credentials.");
                ProfileOverlay.Visibility = Visibility.Collapsed;
                IdInput.Text = newId;
                PasswordInput.Password = newPass;
            }
            else
            {
                MessageBox.Show("Failed to update profile. Please check your current credentials.");
            }
        }

        private void CancelProfile_Click(object sender, RoutedEventArgs e)
        {
            ProfileOverlay.Visibility = Visibility.Collapsed;
        }

        protected override void OnClosing(System.ComponentModel.CancelEventArgs e)
        {
            base.OnClosing(e);
        }
    }
}
