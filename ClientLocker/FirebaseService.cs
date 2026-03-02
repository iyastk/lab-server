using System;
using System.Collections.Generic;
using System.Linq;
using System.Net.Http;
using System.Text;
using System.Threading.Tasks;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using System.IO;
using System.Net.Http.Headers;

namespace ClientLocker
{
    public class StudentData
    {
        public string Id { get; set; } // Firestore Document ID
        public string StudentId { get; set; } // Human-readable ID (e.g. 123)
        public int WeeklyRemaining { get; set; }
        public int DailyRemaining { get; set; }
    }

    public class FirebaseService
    {
        private const string ProjectId = "lab-server-f6d09";
        private const string BaseUrl = "https://firestore.googleapis.com/v1/projects/" + ProjectId + "/databases/(default)/documents/";
        
        // Use a static HttpClient to prevent socket exhaustion
        private static readonly HttpClient _http = new HttpClient();

        public FirebaseService()
        {
            // _http is now static and initialized inline
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
                    string docStudentId = fields?["studentId"]?["stringValue"]?.ToString() ?? "";
                    string docPassword = fields?["password"]?["stringValue"]?.ToString() ?? "";

                    if (docStudentId == studentId && (string.IsNullOrEmpty(password) || docPassword == password))
                    {
                        return new StudentData
                        {
                            Id = doc["name"].ToString().Split('/').Last(),
                            StudentId = docStudentId,
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

        public async Task UpdateStationStatus(string pcName, string status, string studentId = "", string currentApp = "")
        {
            try
            {
                var body = new
                {
                    fields = new
                    {
                        status = new { stringValue = status },
                        pcName = new { stringValue = pcName },
                        currentUser = new { stringValue = studentId },
                        currentApp = new { stringValue = currentApp },
                        macAddress = new { stringValue = GetMacAddress() },
                        lastSeen = new { timestampValue = DateTime.UtcNow.ToString("yyyy-MM-ddTHH:mm:ss.fffZ") }
                    }
                };

                var json = JsonConvert.SerializeObject(body);
                var content = new StringContent(json, Encoding.UTF8, "application/json");

                await _http.PatchAsync(BaseUrl + "stations/" + pcName + "?updateMask.fieldPaths=status&updateMask.fieldPaths=currentUser&updateMask.fieldPaths=currentApp&updateMask.fieldPaths=macAddress&updateMask.fieldPaths=lastSeen", content);
            }
            catch { }
        }

        public async Task<string[]> GetGlobalBannedWords()
        {
            try
            {
                var response = await _http.GetAsync(BaseUrl + "settings/global");
                if (!response.IsSuccessStatusCode) return Array.Empty<string>();

                var content = await response.Content.ReadAsStringAsync();
                var data = JObject.Parse(content);
                var fields = data["fields"];

                string raw = fields?["bannedKeywords"]?["stringValue"]?.ToString() ?? "";
                return raw.Split(',', StringSplitOptions.RemoveEmptyEntries).Select(s => s.Trim()).ToArray();
            }
            catch { return Array.Empty<string>(); }
        }

        public async Task<string[]> GetGlobalBlockedWebsites()
        {
            try
            {
                var response = await _http.GetAsync(BaseUrl + "settings/global");
                if (!response.IsSuccessStatusCode) return Array.Empty<string>();

                var content = await response.Content.ReadAsStringAsync();
                var data = JObject.Parse(content);
                var fields = data["fields"];

                string raw = fields?["blockedWebsites"]?["stringValue"]?.ToString() ?? "";
                return raw.Split(',', StringSplitOptions.RemoveEmptyEntries).Select(s => s.Trim()).ToArray();
            }
            catch { return Array.Empty<string>(); }
        }

        public async Task UpdateStationField(string pcName, string fieldName, object value)
        {
            try
            {
                var body = new
                {
                    fields = new Dictionary<string, object>
                    {
                        { fieldName, new { stringValue = value.ToString() } }
                    }
                };
                var json = JsonConvert.SerializeObject(body);
                var content = new StringContent(json, Encoding.UTF8, "application/json");
                await _http.PatchAsync(BaseUrl + "stations/" + pcName + "?updateMask.fieldPaths=" + fieldName, content);
            }
            catch { }
        }

        public async Task<string?> DownloadFile(string url, string fileName)
        {
            try
            {
                string downloadsPath = System.IO.Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.UserProfile), "Downloads", "LabGuard");
                if (!System.IO.Directory.Exists(downloadsPath)) System.IO.Directory.CreateDirectory(downloadsPath);

                string filePath = System.IO.Path.Combine(downloadsPath, fileName);
                var data = await _http.GetByteArrayAsync(url);
                System.IO.File.WriteAllBytes(filePath, data);
                return filePath;
            }
            catch { return null; }
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
                // Append _t=ticks to prevent HTTP GET caching by the OS
                var response = await _http.GetAsync(BaseUrl + "stations/" + pcName + "?_t=" + DateTime.UtcNow.Ticks);
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

        private System.Timers.Timer? _liveTimer;
        public void StartLiveStream(string pcName)
        {
            if (_liveTimer == null)
            {
                _liveTimer = new System.Timers.Timer(5000);
                _liveTimer.Elapsed += async (s, e) => {
                    string base64 = CaptureScreenBase64();
                    if (!string.IsNullOrEmpty(base64))
                    {
                        await UpdateScreenCapture(pcName, base64);
                    }
                };
            }
            _liveTimer.Start();
        }

        public void StopLiveStream()
        {
            _liveTimer?.Stop();
        }

        public async Task<bool> GetGlobalSecuritySettings()
        {
            try
            {
                var response = await _http.GetAsync(BaseUrl + "settings/security");
                if (!response.IsSuccessStatusCode) return true; // Default to blocked
                
                var content = await response.Content.ReadAsStringAsync();
                var data = JObject.Parse(content);
                var fields = data["fields"];
                
                if (fields?["blockUninstalls"]?["booleanValue"] != null)
                {
                    return fields["blockUninstalls"]["booleanValue"].ToObject<bool>();
                }
                return true;
            }
            catch { return true; }
        }

        /// <summary>Returns (success, message). Message explains why it failed if not successful.</summary>
        public async Task<(bool Success, string Message)> UpdateStudentProfile(string oldId, string oldPass, string newId, string newPass)
        {
            try
            {
                // First, find the student document by oldId and oldPass
                var response = await _http.GetAsync(BaseUrl + "students");
                if (!response.IsSuccessStatusCode) return (false, "Could not connect to server.");

                var content = await response.Content.ReadAsStringAsync();
                var data = JObject.Parse(content);
                var documents = data["documents"];
                if (documents == null) return (false, "No students found.");

                string? docId = null;
                int currentChangeCount = 0;
                foreach (var doc in documents)
                {
                    var fields = doc["fields"];
                    if (fields?["studentId"]?["stringValue"]?.ToString() == oldId &&
                        fields?["password"]?["stringValue"]?.ToString() == oldPass)
                    {
                        docId = doc["name"].ToString().Split('/').Last();
                        currentChangeCount = int.Parse(fields?["usernameChanges"]?["integerValue"]?.ToString() ?? "0");
                        break;
                    }
                }

                if (docId == null) return (false, "Invalid current credentials.");

                // Check if username is being changed (not just password)
                bool isUsernameChange = oldId != newId;
                if (isUsernameChange && currentChangeCount >= 2)
                {
                    return (false, "Username change limit reached (max 2). You can still change your password.");
                }

                int newChangeCount = isUsernameChange ? currentChangeCount + 1 : currentChangeCount;

                // Update the document with new credentials + change counter
                var body = new
                {
                    fields = new
                    {
                        studentId = new { stringValue = newId },
                        password = new { stringValue = newPass },
                        usernameChanges = new { integerValue = newChangeCount.ToString() }
                    }
                };

                var json = JsonConvert.SerializeObject(body);
                var patchContent = new StringContent(json, Encoding.UTF8, "application/json");

                var patchResponse = await _http.PatchAsync(BaseUrl + "students/" + docId + "?updateMask.fieldPaths=studentId&updateMask.fieldPaths=password&updateMask.fieldPaths=usernameChanges", patchContent);
                if (patchResponse.IsSuccessStatusCode)
                {
                    int remaining = 2 - newChangeCount;
                    string msg = isUsernameChange
                        ? $"Profile updated! Username changes remaining: {remaining}"
                        : "Password updated successfully!";
                    return (true, msg);
                }
                return (false, "Server error while updating profile.");
            }
            catch (Exception ex) { return (false, "Error: " + ex.Message); }
        }

        public async Task<int> GetUsernameChangeCount(string studentId, string password)
        {
            try
            {
                var response = await _http.GetAsync(BaseUrl + "students");
                if (!response.IsSuccessStatusCode) return 0;

                var content = await response.Content.ReadAsStringAsync();
                var data = JObject.Parse(content);
                var documents = data["documents"];
                if (documents == null) return 0;

                foreach (var doc in documents)
                {
                    var fields = doc["fields"];
                    if (fields?["studentId"]?["stringValue"]?.ToString() == studentId &&
                        fields?["password"]?["stringValue"]?.ToString() == password)
                    {
                        return int.Parse(fields?["usernameChanges"]?["integerValue"]?.ToString() ?? "0");
                    }
                }
                return 0;
            }
            catch { return 0; }
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
        public async Task UpdateScreenCapture(string pcName, string base64Image)
        {
            try
            {
                var body = new
                {
                    fields = new
                    {
                        lastScreenshot = new { stringValue = base64Image },
                        lastScreenshotTime = new { timestampValue = DateTime.UtcNow.ToString("yyyy-MM-ddTHH:mm:ss.fffZ") }
                    }
                };

                var json = JsonConvert.SerializeObject(body);
                var content = new StringContent(json, Encoding.UTF8, "application/json");

                await _http.PatchAsync(BaseUrl + "stations/" + pcName + "?updateMask.fieldPaths=lastScreenshot&updateMask.fieldPaths=lastScreenshotTime", content);
            }
            catch { }
        }

        public string CaptureScreenBase64()
        {
            try
            {
                int screenWidth = (int)System.Windows.SystemParameters.PrimaryScreenWidth;
                int screenHeight = (int)System.Windows.SystemParameters.PrimaryScreenHeight;

                int targetWidth = screenWidth;
                int targetHeight = screenHeight;
                if (screenWidth > 1280)
                {
                    targetWidth = 1280;
                    targetHeight = (int)(screenHeight * (1280.0 / screenWidth));
                }

                using (var bitmap = new System.Drawing.Bitmap(screenWidth, screenHeight))
                {
                    using (var graphics = System.Drawing.Graphics.FromImage(bitmap))
                    {
                        graphics.CopyFromScreen(0, 0, 0, 0, bitmap.Size);
                    }
                    
                    using (var resized = new System.Drawing.Bitmap(bitmap, targetWidth, targetHeight))
                    {
                        using (var ms = new System.IO.MemoryStream())
                        {
                            var encoder = System.Drawing.Imaging.ImageCodecInfo.GetImageEncoders().First(c => c.FormatID == System.Drawing.Imaging.ImageFormat.Jpeg.Guid);
                            var parameters = new System.Drawing.Imaging.EncoderParameters(1);
                            parameters.Param[0] = new System.Drawing.Imaging.EncoderParameter(System.Drawing.Imaging.Encoder.Quality, 60L);

                            resized.Save(ms, encoder, parameters);
                            return Convert.ToBase64String(ms.ToArray());
                        }
                    }
                }
            }
            catch { return ""; }
        }

        public async Task<string?> GetNetworkSettings()
        {
            try
            {
                var response = await _http.GetAsync(BaseUrl + "settings/network");
                if (!response.IsSuccessStatusCode) return null;
                var content = await response.Content.ReadAsStringAsync();
                var data = JObject.Parse(content);
                return data["fields"]?["serverAddress"]?["stringValue"]?.ToString();
            }
            catch { return null; }
        }

        public async Task<List<string>> GetAllStations()
        {
            try
            {
                var response = await _http.GetAsync(BaseUrl + "stations");
                if (!response.IsSuccessStatusCode) return new List<string>();
                var content = await response.Content.ReadAsStringAsync();
                var data = JObject.Parse(content);
                var documents = data["documents"];
                var stations = new List<string>();
                if (documents != null)
                {
                    foreach (var doc in documents)
                    {
                        string name = doc["name"].ToString().Split('/').Last();
                        stations.Add(name);
                    }
                }
                return stations;
            }
            catch { return new List<string>(); }
        }

        public async Task<string?> UploadFileToLocalServer(string filePath, string serverUrl)
        {
            try
            {
                using (var content = new MultipartFormDataContent())
                {
                    var fileContent = new ByteArrayContent(System.IO.File.ReadAllBytes(filePath));
                    fileContent.Headers.ContentType = MediaTypeHeaderValue.Parse("application/octet-stream");
                    content.Add(fileContent, "file", System.IO.Path.GetFileName(filePath));

                    var response = await _http.PostAsync(serverUrl + "/api/files/upload", content);
                    if (!response.IsSuccessStatusCode) return null;

                    var result = await response.Content.ReadAsStringAsync();
                    var data = JObject.Parse(result);
                    return data["url"]?.ToString();
                }
            }
            catch { return null; }
        }

        private string GetMacAddress()
        {
            try
            {
                var nics = System.Net.NetworkInformation.NetworkInterface.GetAllNetworkInterfaces();
                var activeNic = nics.FirstOrDefault(n => n.OperationalStatus == System.Net.NetworkInformation.OperationalStatus.Up && 
                                                        n.NetworkInterfaceType != System.Net.NetworkInformation.NetworkInterfaceType.Loopback);
                
                if (activeNic != null)
                {
                    return string.Join(":", activeNic.GetPhysicalAddress().GetAddressBytes().Select(b => b.ToString("X2")));
                }
                return "00:00:00:00:00:00";
            }
            catch { return "00:00:00:00:00:00"; }
        }
    }
}
