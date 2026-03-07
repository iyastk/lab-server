using System;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Net;
using System.Text.Json;
using System.Threading.Tasks;
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
        public event Action<string>? OnViolationDetected;

        private HttpListener _httpListener;
        private bool _isListening = false;

        // Configuration
        public bool BlockUninstalls { get; set; } = true;
        public string[] BannedKeywords { get; set; } = Array.Empty<string>();

        public MonitoringService()
        {
            _timer = new Timer(5000); // Check every 5 seconds
            _timer.Elapsed += (s, e) => CheckActiveWindow();

            _securityTimer = new Timer(2000); // Check every 2 seconds for security
            _securityTimer.Elapsed += (s, e) => {
                EnforceSecurity();
                CheckForBannedWords();
            };

            _httpListener = new HttpListener();
            _httpListener.Prefixes.Add($"http://127.0.0.1:{LabGuardConfig.ExtensionListenerPort}/report/");
        }

        private void CheckForBannedWords()
        {
            if (BannedKeywords.Length == 0) return;
            
            // Check current app title
            foreach (var keyword in BannedKeywords)
            {
                if (_lastApp.Contains(keyword, StringComparison.OrdinalIgnoreCase))
                {
                    OnViolationDetected?.Invoke(keyword);
                    break;
                }
            }
        }

        public void Start() 
        {
            _timer.Start();
            _securityTimer.Start();
            StartHttpListener();
        }
        
        public void Stop() 
        {
            _timer.Stop();
            _securityTimer.Stop();
            StopHttpListener();
        }

        private void EnforceSecurity()
        {
            EnforceWatchdog();

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

        private void EnforceWatchdog()
        {
            try
            {
                string watchdogName = "LabGuardWatchdog";
                var processes = Process.GetProcessesByName(watchdogName);
                if (processes.Length == 0)
                {
                    // Watchdog is dead, resurrect it!
                    string watchdogPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "Watchdog", watchdogName + ".exe");
                    if (File.Exists(watchdogPath))
                    {
                        var psi = new ProcessStartInfo
                        {
                            FileName = watchdogPath,
                            UseShellExecute = true,
                            WindowStyle = ProcessWindowStyle.Hidden
                        };
                        Process.Start(psi);
                    }
                    else 
                    {
                        // Fallback check in same directory
                        watchdogPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, watchdogName + ".exe");
                        if (File.Exists(watchdogPath))
                        {
                            var psi = new ProcessStartInfo
                            {
                                FileName = watchdogPath,
                                UseShellExecute = true,
                                WindowStyle = ProcessWindowStyle.Hidden
                            };
                            Process.Start(psi);
                        }
                    }
                }
            }
            catch { /* Ignore launch errors */ }
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

        // --- Browser Extension Telemetry Listener ---
        
        private void StartHttpListener()
        {
            if (_isListening) return;
            try
            {
                _httpListener.Start();
                _isListening = true;
                Task.Run(ListenForExtensionData);
            }
            catch (Exception ex)
            {
                Debug.WriteLine("Failed to start HTTP Listener for extensions: " + ex.Message);
            }
        }

        private void StopHttpListener()
        {
            if (!_isListening) return;
            try
            {
                _isListening = false;
                _httpListener.Stop();
            }
            catch { }
        }

        private async Task ListenForExtensionData()
        {
            while (_isListening)
            {
                try
                {
                    var context = await _httpListener.GetContextAsync();
                    var request = context.Request;
                    
                    if (request.HttpMethod == "POST" && request.HasEntityBody)
                    {
                        using (var reader = new StreamReader(request.InputStream, request.ContentEncoding))
                        {
                            string json = await reader.ReadToEndAsync();
                            var data = JsonSerializer.Deserialize<JsonElement>(json);
                            
                            string type = data.GetProperty("type").GetString() ?? "";
                            string url = data.GetProperty("url").GetString() ?? "";
                            string domain = data.GetProperty("domain").GetString() ?? "";
                            
                            string query = "";
                            if (data.TryGetProperty("searchQuery", out var qProp) && qProp.ValueKind == JsonValueKind.String)
                                query = qProp.GetString() ?? "";

                            string title = "";
                            if (data.TryGetProperty("title", out var tProp) && tProp.ValueKind == JsonValueKind.String)
                                title = tProp.GetString() ?? "";

                            // 1. Log exact searches
                            if (!string.IsNullOrEmpty(query))
                            {
                                OnAppChanged?.Invoke($"Search|{domain} -> {query}");
                                
                                // Check banned keywords specifically on the search query
                                foreach (var keyword in BannedKeywords)
                                {
                                    if (query.Contains(keyword, StringComparison.OrdinalIgnoreCase))
                                    {
                                        OnViolationDetected?.Invoke(keyword);
                                        break;
                                    }
                                }
                            }
                            else if (type == "tab_update" && !string.IsNullOrEmpty(title))
                            {
                                // Overwrite the window title with the extension's precise title if it's currently focused
                                if (_lastApp.Contains("chrome") || _lastApp.Contains("msedge"))
                                {
                                    // Update details to be more precise
                                    string category = title.Contains("YouTube", StringComparison.OrdinalIgnoreCase) ? "YouTube" : "Web Browsing";
                                    OnAppChanged?.Invoke($"{category}|{title} ({domain})");
                                }
                            }
                        }
                    }

                    context.Response.AddHeader("Access-Control-Allow-Origin", "*");
                    context.Response.StatusCode = 200;
                    context.Response.Close();
                }
                catch (HttpListenerException) { break; } // Usually happens on stop
                catch (Exception ex)
                {
                    Debug.WriteLine("Extension Listener Error: " + ex.Message);
                }
            }
        }
    }
}
