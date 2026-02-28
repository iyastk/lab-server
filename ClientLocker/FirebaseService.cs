using System;
using System.Collections.Generic;
using System.Linq;
using System.Net.Http;
using System.Text;
using System.Threading.Tasks;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace ClientLocker
{
    public class StudentData
    {
        public string Id { get; set; }
        public int WeeklyRemaining { get; set; }
        public int DailyRemaining { get; set; }
    }

    public class FirebaseService
    {
        private const string ProjectId = "lab-server-f6d09";
        private const string BaseUrl = "https://firestore.googleapis.com/v1/projects/" + ProjectId + "/databases/(default)/documents/";
        private readonly HttpClient _http;

        public FirebaseService()
        {
            _http = new HttpClient();
        }

        public async Task<StudentData?> ValidateStudent(string studentId, string password)
        {
            try
            {
                var response = await _http.GetAsync(BaseUrl + "students");
                if (!response.IsSuccessStatusCode) return null;

                var content = await response.Content.ReadAsStringAsync();
                var data = JObject.Parse(content);
                var documents = data["documents"];

                if (documents == null) return null;

                foreach (var doc in documents)
                {
                    var fields = doc["fields"];
                    if (fields?["studentId"]?["stringValue"]?.ToString() == studentId &&
                        fields?["password"]?["stringValue"]?.ToString() == password)
                    {
                        return new StudentData
                        {
                            Id = doc["name"].ToString().Split('/').Last(),
                            WeeklyRemaining = int.Parse(fields?["remainingTime"]?["integerValue"]?.ToString() ?? "0"),
                            DailyRemaining = int.Parse(fields?["dailyRemainingTime"]?["integerValue"]?.ToString() ?? "0")
                        };
                    }
                }
                return null;
            }
            catch (Exception ex)
            {
                Console.WriteLine("Auth error: " + ex.Message);
                return null;
            }
        }

        public async Task UpdateStudentTime(string docId, int weeklyRemaining, int dailyRemaining)
        {
            try
            {
                var body = new
                {
                    fields = new
                    {
                        remainingTime = new { integerValue = weeklyRemaining.ToString() },
                        dailyRemainingTime = new { integerValue = dailyRemaining.ToString() }
                    }
                };

                var json = JsonConvert.SerializeObject(body);
                var content = new StringContent(json, Encoding.UTF8, "application/json");

                await _http.PatchAsync(BaseUrl + "students/" + docId + "?updateMask.fieldPaths=remainingTime&updateMask.fieldPaths=dailyRemainingTime", content);
            }
            catch { }
        }

        public async Task UpdateStationStatus(string pcName, string status, string user = "", string currentApp = "")
        {
            try
            {
                var body = new
                {
                    fields = new
                    {
                        status = new { stringValue = status },
                        pcName = new { stringValue = pcName },
                        currentUser = new { stringValue = user },
                        currentApp = new { stringValue = currentApp },
                        lastSeen = new { timestampValue = DateTime.UtcNow.ToString("yyyy-MM-ddTHH:mm:ss.fffZ") }
                    }
                };

                var json = JsonConvert.SerializeObject(body);
                var content = new StringContent(json, Encoding.UTF8, "application/json");

                // Using patch (Update) - if document doesn't exist, this might fail or create depending on query params
                // For simplicity in REST, we'll try to update specific document
                await _http.PatchAsync(BaseUrl + "stations/" + pcName + "?updateMask.fieldPaths=status&updateMask.fieldPaths=currentUser&updateMask.fieldPaths=currentApp&updateMask.fieldPaths=lastSeen", content);
            }
            catch { /* Ignore status update failures */ }
        }

        public async Task LogActivity(string studentId, string pcName, string activity)
        {
            try
            {
                var body = new
                {
                    fields = new
                    {
                        studentId = new { stringValue = studentId },
                        pcName = new { stringValue = pcName },
                        activity = new { stringValue = activity },
                        timestamp = new { timestampValue = DateTime.UtcNow.ToString("yyyy-MM-ddTHH:mm:ss.fffZ") }
                    }
                };

                var json = JsonConvert.SerializeObject(body);
                var content = new StringContent(json, Encoding.UTF8, "application/json");

                var resp = await _http.PostAsync(BaseUrl + "history", content);
                if (!resp.IsSuccessStatusCode)
                {
                    SaveToOfflineCache(studentId, pcName, activity);
                }
            }
            catch
            {
                SaveToOfflineCache(studentId, pcName, activity);
            }
        }

        private void SaveToOfflineCache(string studentId, string pcName, string activity)
        {
            try
            {
                var cacheFile = "offline_logs.json";
                var log = new { studentId, pcName, activity, timestamp = DateTime.UtcNow };
                
                List<object> logs = new List<object>();
                if (System.IO.File.Exists(cacheFile))
                {
                    var text = System.IO.File.ReadAllText(cacheFile);
                    logs = JsonConvert.DeserializeObject<List<object>>(text) ?? new List<object>();
                }
                
                logs.Add(log);
                System.IO.File.WriteAllText(cacheFile, JsonConvert.SerializeObject(logs));
            }
            catch { }
        }

        public async Task<string?> GetPendingCommand(string pcName)
        {
            try
            {
                var response = await _http.GetAsync(BaseUrl + "stations/" + pcName);
                if (!response.IsSuccessStatusCode) return null;

                var content = await response.Content.ReadAsStringAsync();
                var data = JObject.Parse(content);
                var fields = data["fields"];

                string command = fields?["pendingCommand"]?["stringValue"]?.ToString() ?? "";
                if (string.IsNullOrEmpty(command)) return null;

                // Clear the command once read so we don't repeat it
                await ClearPendingCommand(pcName);
                
                return command;
            }
            catch { return null; }
        }

        private async Task ClearPendingCommand(string pcName)
        {
            var body = new { fields = new { pendingCommand = new { stringValue = "" } } };
            var content = new StringContent(JsonConvert.SerializeObject(body), Encoding.UTF8, "application/json");
            await _http.PatchAsync(BaseUrl + "stations/" + pcName + "?updateMask.fieldPaths=pendingCommand", content);
        }

        public async Task SyncOfflineLogs()
        {
            var cacheFile = "offline_logs.json";
            if (!System.IO.File.Exists(cacheFile)) return;

            try
            {
                var text = System.IO.File.ReadAllText(cacheFile);
                var logs = JsonConvert.DeserializeObject<List<JObject>>(text);
                if (logs == null || logs.Count == 0) return;

                foreach (var log in logs.ToList())
                {
                    await LogActivity(log["studentId"]?.ToString() ?? "", log["pcName"]?.ToString() ?? "", log["activity"]?.ToString() ?? "");
                    logs.Remove(log);
                }

                if (logs.Count == 0) System.IO.File.Delete(cacheFile);
                else System.IO.File.WriteAllText(cacheFile, JsonConvert.SerializeObject(logs));
            }
            catch { }
        }
    }
}
