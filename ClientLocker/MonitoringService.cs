using System;
using System.Diagnostics;
using System.Linq;
using System.Timers;

namespace ClientLocker
{
    public class MonitoringService
    {
        private Timer _timer;
        private Timer _securityTimer;
        private string _lastApp = "";
        public string LastApp => _lastApp;
        public event Action<string>? OnAppChanged;

        // Security flag that can be toggled by the admin
        public bool BlockUninstalls { get; set; } = true;

        public MonitoringService()
        {
            _timer = new Timer(5000); // Check every 5 seconds
            _timer.Elapsed += (s, e) => CheckActiveWindow();

            _securityTimer = new Timer(2000); // Check every 2 seconds for security
            _securityTimer.Elapsed += (s, e) => EnforceSecurity();
        }

        public void Start() 
        {
            _timer.Start();
            _securityTimer.Start();
        }
        
        public void Stop() 
        {
            _timer.Stop();
            _securityTimer.Stop();
        }

        private void EnforceSecurity()
        {
            if (!BlockUninstalls) return;

            // List of sensitive processes to block for regular students
            string[] blockedProcesses = { "msiexec", "unins000", "uninstall" };
            
            try
            {
                foreach (var procName in blockedProcesses)
                {
                    var procs = Process.GetProcessesByName(procName);
                    foreach (var p in procs)
                    {
                        try { p.Kill(); } catch { }
                    }
                }
            }
            catch { /* Ignore enumeration errors */ }
        }

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
                    
                    // Categorize: YouTube vs Search vs Apps
                    string category = "General App";
                    if (currentApp.Contains("chrome", StringComparison.OrdinalIgnoreCase) || currentApp.Contains("msedge", StringComparison.OrdinalIgnoreCase))
                    {
                        if (windowTitle.Contains("YouTube", StringComparison.OrdinalIgnoreCase)) category = "YouTube";
                        else if (windowTitle.Contains("Google Search", StringComparison.OrdinalIgnoreCase)) category = "Search";
                        else category = "Web Browsing";
                    }

                    OnAppChanged?.Invoke($"{category}|{detailedInfo}");
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
