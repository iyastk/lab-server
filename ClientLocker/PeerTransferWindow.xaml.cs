using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Threading.Tasks;
using System.Windows;
using Microsoft.Win32;

namespace ClientLocker
{
    public partial class PeerTransferWindow : Window
    {
        private FirebaseService _firebase;
        private string? _selectedFilePath;
        private string _currentPcName;

        public PeerTransferWindow(FirebaseService firebase, string currentPcName)
        {
            InitializeComponent();
            _firebase = firebase;
            _currentPcName = currentPcName;
            LoadStations();
        }

        private async void LoadStations()
        {
            try
            {
                var stations = await _firebase.GetAllStations();
                // Don't show current PC in the list
                StationsList.ItemsSource = stations.Where(s => s != _currentPcName).ToList();
            }
            catch (Exception ex)
            {
                MessageBox.Show("Error loading stations: " + ex.Message);
            }
        }

        private void SelectFile_Click(object sender, RoutedEventArgs e)
        {
            var dialog = new OpenFileDialog();
            if (dialog.ShowDialog() == true)
            {
                _selectedFilePath = dialog.FileName;
                SelectedFileText.Text = Path.GetFileName(_selectedFilePath);
                SendButton.IsEnabled = true;
            }
        }

        private async void Send_Click(object sender, RoutedEventArgs e)
        {
            var targetPc = StationsList.SelectedItem as string;
            if (string.IsNullOrEmpty(targetPc))
            {
                MessageBox.Show("Please select a destination PC.");
                return;
            }

            if (string.IsNullOrEmpty(_selectedFilePath) || !File.Exists(_selectedFilePath))
            {
                MessageBox.Show("Please select a valid file.");
                return;
            }

            SendButton.IsEnabled = false;
            SendButton.Content = "Uploading...";

            try
            {
                // 1. Get Local Server IP from Firebase
                string? serverUrl = await _firebase.GetNetworkSettings();
                if (string.IsNullOrEmpty(serverUrl))
                {
                    MessageBox.Show("Could not find Local Server. Ensure it is running.");
                    SendButton.IsEnabled = true;
                    SendButton.Content = "Send File";
                    return;
                }

                // 2. Upload to Local Server
                string? downloadUrl = await _firebase.UploadFileToLocalServer(_selectedFilePath, serverUrl);
                if (string.IsNullOrEmpty(downloadUrl))
                {
                    MessageBox.Show("Upload failed. Ensure the Local Server is accessible.");
                    SendButton.IsEnabled = true;
                    SendButton.Content = "Send File";
                    return;
                }

                // 3. Send command to peer via Firebase
                string fileName = Path.GetFileName(_selectedFilePath);
                string command = $"file_transfer|{downloadUrl}|{fileName}";
                await _firebase.UpdateStationField(targetPc, "pendingCommand", command);

                MessageBox.Show($"File '{fileName}' sent successfully to {targetPc}!");
                this.Close();
            }
            catch (Exception ex)
            {
                MessageBox.Show("Error during transfer: " + ex.Message);
                SendButton.IsEnabled = true;
                SendButton.Content = "Send File";
            }
        }

        private void Cancel_Click(object sender, RoutedEventArgs e)
        {
            this.Close();
        }
    }
}
