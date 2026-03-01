const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const schedule = require('node-schedule');
const axios = require('axios');
const multer = require('multer');
const fs = require('fs');

const app = express();
const PORT = 5000;

app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));

// File Upload Configuration
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = path.join(__dirname, 'transfers');
        if (!fs.existsSync(dir)) fs.mkdirSync(dir);
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname);
    }
});
const upload = multer({ storage });

// Database initialization
const dbPath = path.join(__dirname, 'lab_history.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) console.error("Database opening error:", err);
    console.log("Connected to local SQLite database.");
});

// Create tables
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS history (
        id TEXT PRIMARY KEY,
        studentId TEXT,
        pcName TEXT,
        activity TEXT,
        category TEXT,
        details TEXT,
        timestamp DATETIME
    )`);

    // Add indexes for efficient querying
    db.run(`CREATE INDEX IF NOT EXISTS idx_history_studentId ON history(studentId)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_history_category ON history(category)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_history_timestamp ON history(timestamp)`);

    db.run(`CREATE TABLE IF NOT EXISTS daily_usage (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        studentId TEXT,
        pcName TEXT,
        date TEXT,
        totalSeconds INTEGER,
        UNIQUE(studentId, pcName, date)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS schedules (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT, -- 'shutdown' or 'restart'
        time TEXT, -- 'HH:mm'
        days TEXT, -- '1,2,3,4,5' (0=Sun)
        enabled INTEGER DEFAULT 1
    )`);
});

// Scheduling Engine
const FIREBASE_BASE_URL = 'https://firestore.googleapis.com/v1/projects/lab-server-f6d09/databases/(default)/documents/';

const runScheduledTask = async (type) => {
    console.log(`Running scheduled task: ${type}`);
    try {
        // Get all stations from Firebase
        const resp = await axios.get(`${FIREBASE_BASE_URL}stations`);
        const stations = resp.data.documents || [];

        for (const doc of stations) {
            const pcName = doc.name.split('/').pop();
            const body = {
                fields: {
                    pendingCommand: { stringValue: type.toUpperCase() },
                    commandTimestamp: { timestampValue: new Date().toISOString() }
                }
            };
            await axios.patch(`${FIREBASE_BASE_URL}stations/${pcName}?updateMask.fieldPaths=pendingCommand&updateMask.fieldPaths=commandTimestamp`, body);
            console.log(`Sent ${type} to ${pcName}`);
        }
    } catch (err) {
        console.error("Scheduled task error:", err.message);
    }
};

let activeJobs = [];
const reloadSchedules = () => {
    activeJobs.forEach(job => job.cancel());
    activeJobs = [];

    db.all("SELECT * FROM schedules WHERE enabled = 1", (err, rows) => {
        if (err) return console.error(err);
        rows.forEach(sched => {
            const [hour, minute] = sched.time.split(':');
            const rule = new schedule.RecurrenceRule();
            rule.hour = parseInt(hour);
            rule.minute = parseInt(minute);
            if (sched.days && sched.days !== 'all') {
                rule.dayOfWeek = sched.days.split(',').map(Number);
            }

            const job = schedule.scheduleJob(rule, () => runScheduledTask(sched.type));
            activeJobs.push(job);
            console.log(`Scheduled ${sched.type} at ${sched.time} (Days: ${sched.days})`);
        });
    });
};

// Initial load
reloadSchedules();

// Cleanup transfers folder older than 24 hours
schedule.scheduleJob('0 0 * * *', () => {
    const dir = path.join(__dirname, 'transfers');
    if (!fs.existsSync(dir)) return;

    fs.readdir(dir, (err, files) => {
        if (err) return;
        const now = Date.now();
        files.forEach(file => {
            const filePath = path.join(dir, file);
            fs.stat(filePath, (err, stats) => {
                if (!err && (now - stats.mtimeMs) > 86400000) {
                    fs.unlink(filePath, () => { });
                }
            });
        });
    });
});

// Endpoint to receive offloaded logs from Firebase
app.post('/api/offload/logs', (req, res) => {
    const logs = req.body.logs;
    if (!Array.isArray(logs)) return res.status(400).json({ error: "Invalid logs format" });

    const stmt = db.prepare(`INSERT OR IGNORE INTO history (id, studentId, pcName, activity, category, details, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?)`);

    db.serialize(() => {
        logs.forEach(log => {
            const parts = (log.activity || "").split('|');
            const category = parts[0];
            const details = parts.length > 1 ? parts[1] : log.activity;
            stmt.run(log.id, log.studentId, log.pcName, log.activity, category, details, log.timestamp);
        });
        stmt.finalize();
    });

    res.json({ success: true, count: logs.length });
});

// Endpoint to fetch local history with filters
app.get('/api/history', (req, res) => {
    const { category, studentId, pcName } = req.query;
    let query = "SELECT * FROM history WHERE 1=1";
    const params = [];

    if (category && category !== 'All') {
        query += " AND category = ?";
        params.push(category);
    }
    if (studentId) {
        query += " AND studentId = ?";
        params.push(studentId);
    }

    query += " ORDER BY timestamp DESC LIMIT 500";

    db.all(query, params, (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// Basic stats endpoint
app.get('/api/stats', (req, res) => {
    db.get("SELECT COUNT(*) as count FROM history", (err, row) => {
        res.json({ totalLogs: row ? row.count : 0 });
    });
});

// Endpoint to fetch app usage analytics
app.get('/api/analytics/usage', (req, res) => {
    const { date } = req.query; // Expects YYYY-MM-DD
    let query = `
        SELECT category, details as app, COUNT(*) * 5 as estimatedSeconds 
        FROM history 
        WHERE 1=1
    `;
    const params = [];
    if (date) {
        query += " AND timestamp LIKE ?";
        params.push(`${date}%`);
    }
    query += " GROUP BY category, details ORDER BY estimatedSeconds DESC";

    db.all(query, params, (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// Schedules CRUD
app.get('/api/schedules', (req, res) => {
    db.all("SELECT * FROM schedules", (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.post('/api/schedules', (req, res) => {
    const { type, time, days } = req.body;
    db.run("INSERT INTO schedules (type, time, days) VALUES (?, ?, ?)", [type, time, days], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        reloadSchedules();
        res.json({ id: this.lastID });
    });
});

app.delete('/api/schedules/:id', (req, res) => {
    db.run("DELETE FROM schedules WHERE id = ?", [req.params.id], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        reloadSchedules();
        res.json({ success: true });
    });
});

// File Transfer Endpoints
app.post('/api/files/upload', upload.single('file'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    // Return the download URL for the client to use
    // Since the client connects to this server, we use the server's own IP/Port
    const downloadUrl = `http://${req.hostname}:${PORT}/api/files/download/${req.file.filename}`;
    res.json({
        success: true,
        url: downloadUrl,
        fileName: req.file.originalname,
        savedName: req.file.filename
    });
});

app.get('/api/files/download/:filename', (req, res) => {
    const filePath = path.join(__dirname, 'transfers', req.params.filename);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: "File not found" });
    res.download(filePath);
});

const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`Local Admin Server running on http://localhost:${PORT}`);
    console.log(`To allow client access, ensure firewall allows port ${PORT}`);
});

// Graceful Shutdown
const shutdown = () => {
    console.log('Shutting down server safely...');
    server.close(() => {
        console.log('HTTP server closed.');
        activeJobs.forEach(job => job.cancel());
        db.close((err) => {
            if (err) console.error('Error closing database', err);
            else console.log('Database connection closed safely.');
            process.exit(0);
        });
    });
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
