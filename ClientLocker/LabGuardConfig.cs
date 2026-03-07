using System;
using System.IO;
using System.Text.Json;

namespace ClientLocker
{
    /// <summary>
    /// Reads labguard.config.json from the application directory.
    /// Edit that file to change Firebase project, admin credentials, or ports
    /// without needing to recompile.
    /// </summary>
    public static class LabGuardConfig
    {
        private static ConfigData? _data;

        public static string FirebaseProjectId  => Load().FirebaseProjectId;
        public static string AdminUsername      => Load().AdminUsername;
        public static string AdminPassword      => Load().AdminPassword;
        public static int    ExtensionListenerPort => Load().ExtensionListenerPort;
        public static int    CommandPollIntervalSeconds => Load().CommandPollIntervalSeconds;
        public static bool   IsAdminPc          => Load().IsAdminPc;

        public static string FirebaseBaseUrl =>
            $"https://firestore.googleapis.com/v1/projects/{FirebaseProjectId}/databases/(default)/documents/";

        private static ConfigData Load()
        {
            if (_data != null) return _data;

            try
            {
                // Look next to the running exe
                string path = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "labguard.config.json");
                if (File.Exists(path))
                {
                    string json = File.ReadAllText(path);
                    _data = JsonSerializer.Deserialize<ConfigData>(json, new JsonSerializerOptions
                    {
                        PropertyNameCaseInsensitive = true
                    });
                }
            }
            catch { /* fall through to defaults */ }

            // Fallback defaults if file is missing/corrupt
            _data ??= new ConfigData();
            return _data;
        }

        private class ConfigData
        {
            public string FirebaseProjectId      { get; set; } = "lab-server-f6d09";
            public string AdminUsername          { get; set; } = "admin";
            public string AdminPassword          { get; set; } = "labsecurity";
            public int    ExtensionListenerPort  { get; set; } = 4000;
            public int    CommandPollIntervalSeconds { get; set; } = 60;
            public bool   IsAdminPc             { get; set; } = false;
        }
    }
}
