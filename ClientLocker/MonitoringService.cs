using System;
using System.Diagnostics;
using System.Linq;
using System.Timers;

namespace ClientLocker
{
    public class MonitoringService
    {
        private Timer _timer;
        private string _lastApp = "";
        public event Action<string>? OnAppChanged;

        public MonitoringService()
        {
            _timer = new Timer(5000); // Check every 5 seconds
            _timer.Elapsed += (s, e) => CheckActiveWindow();
        }

        public void Start() => _timer.Start();
        public void Stop() => _timer.Stop();

        private void CheckActiveWindow()
        {
            try
            {
                var handle = GetForegroundWindow();
                const int nChars = 256;
                System.Text.StringBuilder buff = new System.Text.StringBuilder(nChars);
                string windowTitle = "";
                if (GetWindowText(handle, buff, nChars) > 0)
                {
                    windowTitle = buff.ToString();
                }

                uint processId;
                GetWindowThreadProcessId(handle, out processId);
                var process = Process.GetProcessById((int)processId);
                
                string currentApp = process.ProcessName;
                string detailedInfo = $"{currentApp}: {windowTitle}";

                if (detailedInfo != _lastApp)
                {
                    _lastApp = detailedInfo;
                    OnAppChanged?.Invoke(detailedInfo);
                }
            }
            catch { /* Ignore brief errors during focus switches */ }
        }

        [System.Runtime.InteropServices.DllImport("user32.dll")]
        private static extern IntPtr GetForegroundWindow();

        [System.Runtime.InteropServices.DllImport("user32.dll", CharSet = System.Runtime.InteropServices.CharSet.Auto, SetLastError = true)]
        private static extern int GetWindowText(IntPtr hWnd, System.Text.StringBuilder lpString, int nMaxCount);

        [System.Runtime.InteropServices.DllImport("user32.dll")]
        private static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);
    }
}
