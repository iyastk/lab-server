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
        private StudentData? _currentStudent = null;
        private string _pcName = Environment.MachineName;

        public MainWindow()
        {
            InitializeComponent();
            _hook = new KeyboardHook();
            _firebase = new FirebaseService();
            _monitor = new MonitoringService();
            
            _hook.Hook();
            
            _monitor.OnAppChanged += async (activity) => {
                string studentId = _currentStudent?.Id ?? "";
                
                // activity is "Category|DetailedInfo"
                var parts = activity.Split('|');
                string category = parts[0];
                string detailedInfo = parts.Length > 1 ? parts[1] : activity;

                await _firebase.UpdateStationStatus(_pcName, "online", studentId, detailedInfo);
                if (!string.IsNullOrEmpty(studentId))
                {
                    await _firebase.LogActivity(studentId, _pcName, activity);
                }
            };

            _sessionTimer = new System.Windows.Threading.DispatcherTimer();
            _sessionTimer.Interval = TimeSpan.FromSeconds(1);
            _sessionTimer.Tick += SessionTimer_Tick;

            // Start listening for remote commands
            StartRemoteCommandListener();

            // Register for startup (Optional: requires admin)
            RegisterForStartup();

            // Periodic sync of offline logs
            var syncTimer = new System.Windows.Threading.DispatcherTimer();
            syncTimer.Interval = TimeSpan.FromMinutes(2);
            syncTimer.Tick += async (s, e) => await _firebase.SyncOfflineLogs();
            syncTimer.Start();

            // Heartbeat timer (every 60s even if no app change)
            var heartbeatTimer = new System.Windows.Threading.DispatcherTimer();
            heartbeatTimer.Interval = TimeSpan.FromSeconds(60);
            heartbeatTimer.Tick += async (s, e) => {
                if (_currentStudent != null)
                {
                    var parts = _monitor.LastApp.Split('|');
                    string detailedInfo = parts.Length > 1 ? parts[1] : _monitor.LastApp;
                    await _firebase.UpdateStationStatus(_pcName, "online", _currentStudent.Id, detailedInfo);
                }
                else
                {
                    await _firebase.UpdateStationStatus(_pcName, "offline");
                }
            };
            heartbeatTimer.Start();
        }

        private void RegisterForStartup()
        {
            try
            {
                var path = System.Reflection.Assembly.GetExecutingAssembly().Location;
                var key = Microsoft.Win32.Registry.CurrentUser.OpenSubKey(@"SOFTWARE\Microsoft\Windows\CurrentVersion\Run", true);
                key?.SetValue("LabGuard", $"\"{path}\"");
            }
            catch { /* Might fail without admin or UAC */ }
        }

        // Block student-initiated shutdown/restart
        // Return FALSE to WM_QUERYENDSESSION to cancel
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
                // Only block if a student is active
                if (_currentStudent != null)
                {
                    handled = true;
                    Application.Current.Dispatcher.Invoke(() => 
                        MessageBox.Show("Shutdown is not allowed while a session is active.\nContact Lab Admin.", "LabGuard - Blocked"));
                    return new IntPtr(0); // Cancel shutdown
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

            // Sync to Firebase every 60 seconds
            if (_currentStudent.WeeklyRemaining % 60 == 0)
            {
                await _firebase.UpdateStudentTime(_currentStudent.Id, _currentStudent.WeeklyRemaining, _currentStudent.DailyRemaining);
            }
        }

        private void LockPC()
        {
            _sessionTimer.Stop();
            _monitor.Stop();
            this.Show();
            this.Topmost = true;
            _hook.Hook();
        }

        private async void StartRemoteCommandListener()
        {
            while (true)
            {
                try
                {
                    string? command = await _firebase.GetPendingCommand(_pcName);
                    if (!string.IsNullOrEmpty(command))
                    {
                        switch (command.ToLower())
                        {
                            case "lock":
                                Application.Current.Dispatcher.Invoke(() => LockPC());
                                break;
                            case "unlock":
                                Application.Current.Dispatcher.Invoke(() => UnlockPC());
                                break;
                            case "shutdown":
                                Process.Start("shutdown", "/s /t 10"); // 10s delay to show message
                                Application.Current.Dispatcher.Invoke(() => 
                                    MessageBox.Show("This PC will shutdown in 10 seconds (Admin command).", "LabGuard"));
                                break;
                            case "restart":
                                Process.Start("shutdown", "/r /t 10");
                                Application.Current.Dispatcher.Invoke(() =>
                                    MessageBox.Show("This PC will restart in 10 seconds (Admin command).", "LabGuard"));
                                break;
                            case "screenshot":
                                string base64 = _firebase.CaptureScreenBase64();
                                if (!string.IsNullOrEmpty(base64))
                                {
                                    await _firebase.UpdateScreenCapture(_pcName, base64);
                                }
                                break;
                            default:
                                if (command.StartsWith("notify|", StringComparison.OrdinalIgnoreCase))
                                {
                                    string msg = command.Substring(7);
                                    Application.Current.Dispatcher.Invoke(() => {
                                        MessageBox.Show(msg, "LabGuard Notification");
                                        if (msg.Contains("granted") && _currentStudent != null)
                                        {
                                            RefreshStudentData();
                                        }
                                    });
                                }
                                break;
                        }
                    }
                }
                catch { }
                await Task.Delay(2000); // Poll every 2 seconds
            }
        }

        private async void RefreshStudentData()
        {
            if (_currentStudent == null) return;
            // Re-validate or fetch student to get new time
            var updated = await _firebase.ValidateStudent(_currentStudent.Id, ""); // Need to handle passwordless fetch or store password
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

            // Simple validation for admin
            if ((id == "admin" && password == "admin123") || (id == "Admin" && password == "nopassword"))
            {
                _hook.Unhook();
                this.Hide();
                if (id == "Admin") {
                    OpenUserDashboard(new StudentData { Id = "System Admin", WeeklyRemaining = 9999, DailyRemaining = 9999 });
                }
                MessageBox.Show("Welcome, Admin! (System unlocked)");
            }
            else
            {
                // Verify with Firebase
                var student = await _firebase.ValidateStudent(id, password);
                if (student != null)
                {
                    if (student.WeeklyRemaining <= 0 || student.DailyRemaining <= 0)
                    {
                        MessageBox.Show("Your time quota has expired (Weekly or Daily). Please contact Admin.", "Access Denied", MessageBoxButton.OK, MessageBoxImage.Warning);
                        return;
                    }

                    _currentStudent = student;
                    UnlockPC();
                    OpenUserDashboard(student);
                    MessageBox.Show($"Welcome, {id}!");
                }
                else
                {
                    MessageBox.Show("Invalid Student ID or Password", "Login Failed", MessageBoxButton.OK, MessageBoxImage.Error);
                }
            }
        }

        private void OpenUserDashboard(StudentData student)
        {
            Application.Current.Dispatcher.Invoke(() => {
                var dashboard = new UserDashboard(student, () => {
                    // This is the onLogout callback
                    _currentStudent = null;
                    LockPC();
                    this.Show();
                    this.Activate();
                });
                dashboard.Show();
            });
        }

        private void ChangeProfile_Click(object sender, RoutedEventArgs e)
        {
            ProfileOverlay.Visibility = Visibility.Visible;
        }

        private void CancelProfile_Click(object sender, RoutedEventArgs e)
        {
            ProfileOverlay.Visibility = Visibility.Collapsed;
        }

        private async void UpdateProfile_Click(object sender, RoutedEventArgs e)
        {
            string oldId = OldIdInput.Text;
            string oldPass = OldPassInput.Password;
            string newId = NewIdInput.Text;
            string newPass = NewPassInput.Password;

            if (string.IsNullOrEmpty(oldId) || string.IsNullOrEmpty(oldPass) || string.IsNullOrEmpty(newId) || string.IsNullOrEmpty(newPass))
            {
                MessageBox.Show("Please fill all fields.");
                return;
            }

            bool success = await _firebase.UpdateStudentProfile(oldId, oldPass, newId, newPass);
            if (success)
            {
                MessageBox.Show("Profile updated successfully! You can now login with your new credentials.");
                ProfileOverlay.Visibility = Visibility.Collapsed;
            }
            else
            {
                MessageBox.Show("Failed to update profile. Please verify your current ID and Password.");
            }
        }

        private void UnlockPC()
        {
            _sessionTimer.Start();
            _monitor.Start();
            this.Hide();
            _hook.Unhook();
        }

        protected override void OnClosing(System.ComponentModel.CancelEventArgs e)
        {
            // Prevent closing unless authorized
            // e.Cancel = true; 
            base.OnClosing(e);
        }
    }
}
