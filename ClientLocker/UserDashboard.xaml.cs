using System;
using System.Windows;
using System.Windows.Threading;

namespace ClientLocker
{
    public partial class UserDashboard : Window
    {
        private StudentData _student;
        private DispatcherTimer _timer;
        private Action _onLogout;
        private FirebaseService _firebaseService;

        public UserDashboard(StudentData student, Action onLogout)
        {
            InitializeComponent();
            _student = student;
            _onLogout = onLogout;
            _firebaseService = new FirebaseService();

            UserTitle.Text = $"Logged in as: {student.Id}";
            PcNameText.Text = $"PC: {Environment.MachineName}";

            _timer = new DispatcherTimer();
            _timer.Interval = TimeSpan.FromSeconds(1);
            _timer.Tick += Timer_Tick;
            _timer.Start();

            UpdateTimeDisplays();

            // Position it on the right side of the screen
            this.Left = SystemParameters.WorkArea.Width - this.Width - 20;
            this.Top = 50;
        }

        private void Timer_Tick(object? sender, EventArgs e)
        {
            UpdateTimeDisplays();
        }

        private void UpdateTimeDisplays()
        {
            DailyText.Text = FormatTime(_student.DailyRemaining);
            WeeklyText.Text = FormatTime(_student.WeeklyRemaining);
        }

        private string FormatTime(int seconds)
        {
            TimeSpan ts = TimeSpan.FromSeconds(seconds);
            return $"{(int)ts.TotalHours:00}:{ts.Minutes:00}:{ts.Seconds:00}";
        }

        private void ChangePass_Click(object sender, RoutedEventArgs e)
        {
            MessageBox.Show("Please contact Lab Admin to reset your password or use the Change Profile option on the lock screen.", "Change Password");
        }

        private void ViewLogs_Click(object sender, RoutedEventArgs e)
        {
            MessageBox.Show("Activity logging is active. Your usage history is being recorded securely.", "Activity Monitoring");
        }

        private async void RequestTime_Click(object sender, RoutedEventArgs e)
        {
            var result = MessageBox.Show("Do you want to request 60 minutes of extra time from the Admin?", "Request Time", MessageBoxButton.YesNo);
            if (result == MessageBoxResult.Yes)
            {
                try
                {
                    await _firebaseService.UpdateStationField(Environment.MachineName, "timeRequest", "PENDING_60MIN");
                    MessageBox.Show("Request sent! Please wait for Admin approval.", "Success");
                }
                catch (Exception ex)
                {
                    MessageBox.Show("Error sending request: " + ex.Message);
                }
            }
        }

        private void ShareFile_Click(object sender, RoutedEventArgs e)
        {
            var peerWin = new PeerTransferWindow(_firebaseService, Environment.MachineName);
            peerWin.Owner = this;
            peerWin.ShowDialog();
        }

        private void Logout_Click(object sender, RoutedEventArgs e)
        {
            var result = MessageBox.Show("Are you sure you want to end your session and lock this computer?", "Logout", MessageBoxButton.YesNo, MessageBoxImage.Question);
            if (result == MessageBoxResult.Yes)
            {
                _timer.Stop();
                this.Close();
                _onLogout?.Invoke();
            }
        }
    }
}
