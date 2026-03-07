using System;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Threading;

namespace LabGuardWatchdog
{
    class Program
    {
        static void Main(string[] args)
        {
            // Give the main app time to start up and breathe if we just launched
            Thread.Sleep(2000);

            string clientProcessName = "ClientLocker";
            // Get the directory where the watchdog is completely assuming it's in the same folder as ClientLocker for now or passed in
            string exePath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, clientProcessName + ".exe");
            
            // If they are in different folders, we assume the watchdog is inside a Watchdog subfolder of the ClientLocker folder
            if (!File.Exists(exePath))
            {
                exePath = Path.GetFullPath(Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "..", clientProcessName + ".exe"));
            }

            while (true)
            {
                try
                {
                    Process[] processes = Process.GetProcessesByName(clientProcessName);
                    
                    if (processes.Length == 0)
                    {
                        // Client is down! Resurrect it.
                        if (File.Exists(exePath))
                        {
                            var psi = new ProcessStartInfo
                            {
                                FileName = exePath,
                                UseShellExecute = true,
                                WindowStyle = ProcessWindowStyle.Hidden // ClientLocker handles its own visibility, but typically we want it hidden or minimized
                            };
                            Process.Start(psi);
                        }
                    }
                }
                catch (Exception ex)
                {
                    // Ignore access denied exceptions for other processes
                    Console.WriteLine("Watchdog Error: " + ex.Message);
                }

                // Check every 2 seconds
                Thread.Sleep(2000);
            }
        }
    }
}
