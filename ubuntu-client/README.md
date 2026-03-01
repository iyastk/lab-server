# LabGuard Ubuntu Client

A Python-based monitoring client for Ubuntu 20.04+ lab computers.

## Features
- Student login with time quotas (daily & weekly)
- Remote lock/unlock via Admin Dashboard
- Remote shutdown/restart (Admin only)
- Screenshot capture for Live View
- Activity monitoring (window titles / active apps)
- Sync to Firebase Firestore

## Quick Install

```bash
# Run as root
sudo bash install.sh
```

Then edit your Firebase credentials:
```bash
sudo nano /etc/labguard/config.json
```

Replace `YOUR_FIREBASE_PROJECT_ID` and `YOUR_FIREBASE_API_KEY` with your values from the Firebase Console.

## Manual Dependencies

```bash
sudo apt-get install python3 python3-pip scrot xdotool libnotify-bin
sudo pip3 install requests Pillow pynput
```

## Service Commands

```bash
sudo systemctl status labguard    # Check status
sudo systemctl restart labguard   # Restart
sudo systemctl stop labguard      # Stop
sudo journalctl -u labguard -f    # View logs
```

## Dual-Boot Note

This client and the Windows client are **independent**. Whichever OS is booted will respond to Admin commands.
Both use the same PC hostname as the station ID in Firebase.

## Admin Escape

At the login prompt, use:
- **Student ID**: `Admin`
- **Password**: `nopassword`
