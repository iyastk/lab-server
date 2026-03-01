using System.Windows;

namespace ClientLocker
{
    public partial class AnnouncementWindow : Window
    {
        public AnnouncementWindow(string message)
        {
            InitializeComponent();
            MessageText.Text = message;
        }

        private void Acknowledge_Click(object sender, RoutedEventArgs e)
        {
            this.Close();
        }
    }
}
