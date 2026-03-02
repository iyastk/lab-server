====================================================
  LabGuard Local Admin Server - Setup Instructions
====================================================

REQUIREMENTS:
  - Node.js 18+ installed (https://nodejs.org)

SETUP STEPS:
  1. Extract this folder anywhere on the Admin PC
  2. Double-click  start.bat  to launch the server
     (First run will auto-install dependencies)

OR manually:
  1. Open a terminal in this folder
  2. Run: npm install
  3. Run: node server.js

SERVER RUNS ON: http://localhost:5000

FEATURES:
  - Archives student activity logs (SQLite database)
  - Enables scheduled PC power actions (shutdown/restart)
  - Wake-on-LAN support for remote wake
  - File transfer to lab PCs

NOTE: Keep this server running on the Admin PC at all times
      for auto-archiving of Firebase logs to work correctly.

====================================================
