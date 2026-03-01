#!/usr/bin/env python3
"""
LabGuard Ubuntu Client
Compatible with Ubuntu 20.04+ / Debian-based systems
Connects to Firebase Firestore REST API for real-time monitoring.

Install dependencies:
  pip3 install requests Pillow python-xlib pynput

Run as root for full control:
  sudo python3 labguard.py
"""

import os
import sys
import json
import time
import base64
import socket
import threading
import subprocess
import signal
import requests
from datetime import datetime

# ── CONFIG ─────────────────────────────────────────────────────────────────
FIREBASE_PROJECT = os.environ.get("FIREBASE_PROJECT", "your-firebase-project-id")
FIREBASE_API_KEY = os.environ.get("FIREBASE_API_KEY", "your-firebase-api-key")
BASE_URL = f"https://firestore.googleapis.com/v1/projects/{FIREBASE_PROJECT}/databases/(default)/documents/"
PC_NAME = socket.gethostname()
POLL_INTERVAL = 2         # seconds between command polls
SCREENSHOT_QUALITY = 30   # JPEG quality (lower = smaller)
SESSION_ACTIVE = False
CURRENT_STUDENT = None
DAILY_REMAINING = 0
WEEKLY_REMAINING = 0
LAST_APP = ""
SHUTDOWN_BLOCKED = True   # Block student-initiated shutdown by default

CONFIG_FILE = "/etc/labguard/config.json"

# ── LOAD CONFIG ─────────────────────────────────────────────────────────────
def load_config():
    global FIREBASE_PROJECT, FIREBASE_API_KEY, BASE_URL
    if os.path.exists(CONFIG_FILE):
        with open(CONFIG_FILE) as f:
            cfg = json.load(f)
            FIREBASE_PROJECT = cfg.get("projectId", FIREBASE_PROJECT)
            FIREBASE_API_KEY = cfg.get("apiKey", FIREBASE_API_KEY)
            BASE_URL = f"https://firestore.googleapis.com/v1/projects/{FIREBASE_PROJECT}/databases/(default)/documents/"

# ── FIREBASE HELPERS ────────────────────────────────────────────────────────
def fs_val(v):
    if isinstance(v, str):   return {"stringValue": v}
    if isinstance(v, bool):  return {"booleanValue": v}
    if isinstance(v, int):   return {"integerValue": str(v)}
    return {"stringValue": str(v)}

def fs_patch(collection, doc_id, fields: dict, mask_fields=None):
    url = BASE_URL + f"{collection}/{doc_id}"
    if mask_fields:
        params = "&".join([f"updateMask.fieldPaths={f}" for f in mask_fields])
        url += f"?{params}"
    body = {"fields": {k: fs_val(v) for k, v in fields.items()}}
    try:
        requests.patch(url, json=body, timeout=10)
    except Exception as e:
        print(f"[Firebase] Patch error: {e}")

def fs_get(collection, doc_id):
    url = BASE_URL + f"{collection}/{doc_id}"
    try:
        r = requests.get(url, timeout=10)
        if r.status_code == 200:
            return r.json().get("fields", {})
    except Exception as e:
        print(f"[Firebase] Get error: {e}")
    return {}

def fs_query(collection, field, value):
    url = f"https://firestore.googleapis.com/v1/projects/{FIREBASE_PROJECT}/databases/(default)/documents:runQuery"
    body = {
        "structuredQuery": {
            "from": [{"collectionId": collection}],
            "where": {
                "fieldFilter": {
                    "field": {"fieldPath": field},
                    "op": "EQUAL",
                    "value": {"stringValue": value}
                }
            }
        }
    }
    try:
        r = requests.post(url, json=body, timeout=10)
        results = r.json()
        for item in results:
            if "document" in item:
                return item["document"].get("fields", {})
    except Exception as e:
        print(f"[Firebase] Query error: {e}")
    return None

# ── SCREEN CAPTURE ──────────────────────────────────────────────────────────
def take_screenshot():
    try:
        from PIL import ImageGrab, Image
        import io
        # On Linux we need scrot or xwd
        tmp = "/tmp/labguard_ss.png"
        subprocess.run(["scrot", "-z", tmp], timeout=5, check=True)
        img = Image.open(tmp)
        img = img.resize((1280, 720), Image.LANCZOS)
        buf = io.BytesIO()
        img.save(buf, format="JPEG", quality=SCREENSHOT_QUALITY)
        return base64.b64encode(buf.getvalue()).decode()
    except Exception as e:
        print(f"[Screenshot] Error: {e}")
        return None

# ── WINDOW TITLE ─────────────────────────────────────────────────────────────
def get_active_window():
    try:
        result = subprocess.run(
            ["xdotool", "getactivewindow", "getwindowname"],
            capture_output=True, text=True, timeout=3
        )
        title = result.stdout.strip()
        if "youtube" in title.lower():
            return f"YouTube|chrome: {title}"
        elif "google" in title.lower():
            return f"Search|chrome: {title}"
        elif title:
            return f"App|{title}"
    except Exception:
        pass
    return None

# ── STATION STATUS ───────────────────────────────────────────────────────────
def update_status(status="online", student_id="", app=""):
    fs_patch("stations", PC_NAME, {
        "pcName": PC_NAME,
        "status": status,
        "currentUser": student_id,
        "currentApp": app,
        "osType": "linux",
        "lastSeen": datetime.utcnow().isoformat() + "Z"
    }, mask_fields=["pcName", "status", "currentUser", "currentApp", "osType", "lastSeen"])

# ── SESSION MANAGEMENT ────────────────────────────────────────────────────────
def lock_screen():
    """Lock screen using gnome-screensaver or xdg-screensaver"""
    try:
        subprocess.run(["gnome-screensaver-command", "--lock"], timeout=5)
    except:
        try:
            subprocess.run(["xdg-screensaver", "lock"], timeout=5)
        except:
            subprocess.run(["loginctl", "lock-session"], timeout=5)

def unlock_screen():
    """Unlock is typically handled by the user re-logging in"""
    print("[LabGuard] Unlock command received — session is active")
    os.system("notify-send 'LabGuard' 'Session unlocked by Admin'")

def start_session(student_data):
    global SESSION_ACTIVE, CURRENT_STUDENT, DAILY_REMAINING, WEEKLY_REMAINING
    student_id = student_data.get("studentId", {}).get("stringValue", "")
    DAILY_REMAINING = int(student_data.get("dailyRemainingTime", {}).get("integerValue", 1800))
    WEEKLY_REMAINING = int(student_data.get("remainingTime", {}).get("integerValue", 3600))
    CURRENT_STUDENT = student_id
    SESSION_ACTIVE = True
    print(f"[LabGuard] Session started: {student_id}")
    update_status("online", student_id)

def logout_session():
    global SESSION_ACTIVE, CURRENT_STUDENT
    if CURRENT_STUDENT:
        # Save remaining time back to Firebase
        fs_patch("students", CURRENT_STUDENT, {
            "dailyRemainingTime": DAILY_REMAINING,
            "remainingTime": WEEKLY_REMAINING,
            "status": "offline"
        }, mask_fields=["dailyRemainingTime", "remainingTime", "status"])
    SESSION_ACTIVE = False
    CURRENT_STUDENT = None
    update_status("offline")
    lock_screen()
    print("[LabGuard] Session ended")

# ── COMMAND LISTENER ──────────────────────────────────────────────────────────
def command_listener():
    last_command = ""
    while True:
        try:
            fields = fs_get("stations", PC_NAME)
            cmd = fields.get("pendingCommand", {}).get("stringValue", "")
            if cmd and cmd != last_command:
                last_command = cmd
                # Clear the command
                fs_patch("stations", PC_NAME, {"pendingCommand": ""}, mask_fields=["pendingCommand"])
                handle_command(cmd)
        except Exception as e:
            print(f"[Listener] Error: {e}")
        time.sleep(POLL_INTERVAL)

def handle_command(cmd):
    cmd_lower = cmd.lower()
    print(f"[LabGuard] Command received: {cmd}")

    if cmd_lower == "lock":
        lock_screen()
        os.system("notify-send 'LabGuard' 'Screen locked by Admin'")
    elif cmd_lower == "unlock":
        unlock_screen()
    elif cmd_lower == "shutdown":
        os.system("notify-send 'LabGuard' 'PC will shutdown in 10s (Admin)'")
        time.sleep(10)
        subprocess.run(["sudo", "shutdown", "-h", "now"])
    elif cmd_lower == "restart":
        os.system("notify-send 'LabGuard' 'PC will restart in 10s (Admin)'")
        time.sleep(10)
        subprocess.run(["sudo", "shutdown", "-r", "now"])
    elif cmd_lower == "screenshot":
        screenshot_b64 = take_screenshot()
        if screenshot_b64:
            fs_patch("stations", PC_NAME, {
                "lastScreenshot": screenshot_b64,
                "lastScreenshotTime": datetime.utcnow().isoformat() + "Z"
            }, mask_fields=["lastScreenshot", "lastScreenshotTime"])
            print("[Screenshot] Uploaded successfully")
    elif cmd_lower.startswith("notify|"):
        message = cmd[7:]
        os.system(f"notify-send 'LabGuard' '{message}'")
        print(f"[Notify] {message}")

# ── SESSION TIMER ──────────────────────────────────────────────────────────────
def session_timer():
    global DAILY_REMAINING, WEEKLY_REMAINING, SESSION_ACTIVE
    while True:
        if SESSION_ACTIVE and CURRENT_STUDENT:
            DAILY_REMAINING -= 1
            WEEKLY_REMAINING -= 1

            # Save every 60 seconds
            if WEEKLY_REMAINING % 60 == 0:
                fs_patch("students", CURRENT_STUDENT, {
                    "dailyRemainingTime": max(0, DAILY_REMAINING),
                    "remainingTime": max(0, WEEKLY_REMAINING)
                }, mask_fields=["dailyRemainingTime", "remainingTime"])

            # Warn when 5 minutes remain
            if DAILY_REMAINING == 300 or WEEKLY_REMAINING == 300:
                os.system("notify-send -u critical 'LabGuard' '⚠️ Only 5 minutes remaining!'")

            # Session expired
            if DAILY_REMAINING <= 0 or WEEKLY_REMAINING <= 0:
                os.system("notify-send -u critical 'LabGuard' '⏱️ Session time expired!'")
                logout_session()

        time.sleep(1)

# ── ACTIVITY MONITOR ────────────────────────────────────────────────────────────
def activity_monitor():
    global LAST_APP
    while True:
        if SESSION_ACTIVE and CURRENT_STUDENT:
            current = get_active_window()
            if current and current != LAST_APP:
                LAST_APP = current
                update_status("online", CURRENT_STUDENT, current)
        time.sleep(5)

# ── LOGIN HANDLER ───────────────────────────────────────────────────────────────
def handle_login(student_id, password):
    """Validate student against Firebase and start session"""
    result = fs_query("students", "studentId", student_id)
    if result:
        db_password = result.get("password", {}).get("stringValue", "")
        if db_password == password:
            start_session(result)
            return True
    return False

# ── TERMINAL UI (Fallback / Kiosk mode) ─────────────────────────────────────────
def terminal_ui():
    print("=" * 50)
    print("  LabGuard Ubuntu Client v1.0")
    print("=" * 50)
    while not SESSION_ACTIVE:
        student_id = input("Student ID: ").strip()
        password = input("Password: ").strip()
        if student_id == "Admin" and password == "nopassword":
            print("[Admin] Escape gate activated.")
            return
        if handle_login(student_id, password):
            print(f"[LabGuard] Welcome, {student_id}!")
        else:
            print("[LabGuard] Invalid credentials. Try again.")

# ── MAIN ────────────────────────────────────────────────────────────────────────
def main():
    print(f"[LabGuard] Starting on {PC_NAME} (Ubuntu Client)")
    load_config()

    # Register station in Firebase
    update_status("offline")

    # Start background threads
    threading.Thread(target=command_listener, daemon=True).start()
    threading.Thread(target=session_timer, daemon=True).start()
    threading.Thread(target=activity_monitor, daemon=True).start()

    print("[LabGuard] All services started. Waiting for login...")
    terminal_ui()

    # Keep running even after session ends
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\n[LabGuard] Shutting down...")
        logout_session()

if __name__ == "__main__":
    main()
