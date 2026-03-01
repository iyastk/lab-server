#!/bin/bash
# LabGuard Ubuntu Service Installer
# Run as root: sudo bash install.sh

set -e

echo "================================================"
echo "  LabGuard Ubuntu Client - Installer"
echo "================================================"

# Check running as root
if [ "$EUID" -ne 0 ]; then
  echo "[ERROR] Please run as root: sudo bash install.sh"
  exit 1
fi

# Install dependencies
echo "[1/5] Installing Python dependencies..."
apt-get update -q
apt-get install -y python3 python3-pip scrot xdotool libnotify-bin
pip3 install requests Pillow pynput --quiet

# Create config directory and default config
echo "[2/5] Creating configuration..."
mkdir -p /etc/labguard
if [ ! -f /etc/labguard/config.json ]; then
  echo '{
  "projectId": "YOUR_FIREBASE_PROJECT_ID",
  "apiKey": "YOUR_FIREBASE_API_KEY"
}' > /etc/labguard/config.json
  echo "  ⚠️  Please edit /etc/labguard/config.json with your Firebase credentials."
fi

# Copy client file
echo "[3/5] Installing client..."
mkdir -p /opt/labguard
cp labguard.py /opt/labguard/
chmod +x /opt/labguard/labguard.py

# Create systemd service
echo "[4/5] Creating systemd service..."
cat > /etc/systemd/system/labguard.service << 'EOF'
[Unit]
Description=LabGuard Lab Monitoring Client
After=network.target

[Service]
Type=simple
ExecStart=/usr/bin/python3 /opt/labguard/labguard.py
Restart=always
RestartSec=5
Environment=DISPLAY=:0
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

# Enable and start service
echo "[5/5] Enabling service..."
systemctl daemon-reload
systemctl enable labguard.service
systemctl start labguard.service

echo ""
echo "================================================"
echo "  LabGuard Installed Successfully!"
echo "  Status: $(systemctl is-active labguard.service)"
echo ""
echo "  Important: Edit Firebase credentials:"
echo "  sudo nano /etc/labguard/config.json"
echo ""
echo "  View logs: sudo journalctl -u labguard -f"
echo "================================================"
