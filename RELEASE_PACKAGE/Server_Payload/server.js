const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const axios = require('axios');
const multer = require('multer');
const schedule = require('node-schedule');
const fs = require('fs');
const os = require('os');

const app = express();
const PORT = 5000;
const SERVER_START_TIME = Date.now();

app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));

// root route for Status Dashboard
app.get('/', (req, res) => {
    const uptime = Math.floor((Date.now() - SERVER_START_TIME) / 1000);
    const hours = Math.floor(uptime / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    const seconds = uptime % 60;

    const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>LabGuard | Local Server Status</title>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600&display=swap" rel="stylesheet">
        <style>
            :root {
                --primary: #4f46e5;
                --success: #22c55e;
                --bg: #0f172a;
                --glass: rgba(30, 41, 59, 0.7);
            }
            body {
                font-family: 'Inter', sans-serif;
                background-color: var(--bg);
                color: #f8fafc;
                margin: 0;
                display: flex;
                align-items: center;
                justify-content: center;
                height: 100vh;
                overflow: hidden;
            }
            .background {
                position: fixed;
                top: 0; left: 0; width: 100%; height: 100%;
                background: radial-gradient(circle at 20% 30%, rgba(79, 70, 229, 0.15) 0%, transparent 50%),
                            radial-gradient(circle at 80% 70%, rgba(34, 197, 94, 0.1) 0%, transparent 50%);
                z-index: -1;
            }
            .dashboard {
                background: var(--glass);
                backdrop-filter: blur(12px);
                border: 1px solid rgba(255, 255, 255, 0.1);
                border-radius: 24px;
                padding: 40px;
                width: 90%;
                max-width: 500px;
                box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
                text-align: center;
                animation: fadeIn 0.8s ease-out;
            }
            @keyframes fadeIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
            h1 { font-size: 2rem; margin-bottom: 8px; font-weight: 600; letter-spacing: -0.025em; }
            .badge {
                display: inline-flex;
                align-items: center;
                background: rgba(34, 197, 94, 0.1);
                color: var(--success);
                padding: 4px 12px;
                border-radius: 99px;
                font-size: 0.8rem;
                font-weight: 600;
                margin-bottom: 30px;
            }
            .badge::before {
                content: '';
                display: inline-block;
                width: 8px; height: 8px;
                background: var(--success);
                border-radius: 50%;
                margin-right: 8px;
                box-shadow: 0 0 10px var(--success);
            }
            .stats-grid {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 20px;
                margin-bottom: 30px;
            }
            .stat-card {
                background: rgba(255, 255, 255, 0.03);
                border-radius: 16px;
                padding: 16px;
                border: 1px solid rgba(255, 255, 255, 0.05);
            }
            .stat-label { font-size: 0.75rem; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px; }
            .stat-value { font-size: 1.1rem; font-weight: 600; color: #f1f5f9; }
            .footer { font-size: 0.85rem; color: #64748b; margin-top: 20px; }
            .btn {
                background: var(--primary);
                color: white;
                border: none;
                padding: 12px 24px;
                border-radius: 12px;
                cursor: pointer;
                font-weight: 600;
                transition: all 0.2s;
            }
            .btn:hover { background: #4338ca; transform: translateY(-2px); }
        </style>
    </head>
    <body>
        <div class="background"></div>
        <div class="dashboard">
            <h1>LabGuard Admin Server</h1>
            <div class="badge">SYSTEM ONLINE</div>
            
            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-label">Uptime</div>
                    <div class="stat-value">${hours}h ${minutes}m ${seconds}s</div>
                </div>
                <div class="stat-card">
                    <div class="stat-label">Local Port</div>
                    <div class="stat-value">${PORT}</div>
                </div>
                <div class="stat-card">
                    <div class="stat-label">Database</div>
                    <div class="stat-value">SQLite Connected</div>
                </div>
                <div class="stat-card">
                    <div class="stat-label">History Logs</div>
                    <div class="stat-value">Vault Syncing...</div>
                </div>
            </div>

            <button class="btn" onclick="location.reload()">Refresh Status</button>
            <p class="footer">This server is a background runner for LabGuard Cloud. Manage sessions via the Online Dashboard.</p>
        </div>
    </body>
    </html>
    `;
    res.send(html);
});

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
        type TEXT,
        time TEXT,
        days TEXT,
        enabled INTEGER DEFAULT 1
    )`);
});

// Scheduling Engine
const FIREBASE_BASE_URL = 'https://firestore.googleapis.com/v1/projects/lab-server-f6d09/databases/(default)/documents/';

const runScheduledTask = async (type) => {
    console.log(`Running scheduled task: ${type}`);
    try {
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

reloadSchedules();

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

app.get('/api/stats', (req, res) => {
    db.get("SELECT COUNT(*) as count FROM history", (err, row) => {
        res.json({ totalLogs: row ? row.count : 0 });
    });
});

app.get('/api/analytics/usage', (req, res) => {
    const { date } = req.query;
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

app.post('/api/files/upload', upload.single('file'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });
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

const registerServer = async () => {
    try {
        const nets = os.networkInterfaces();
        let localIp = '127.0.0.1';
        for (const name of Object.keys(nets)) {
            for (const net of nets[name]) {
                if (net.family === 'IPv4' && !net.internal) {
                    localIp = net.address;
                    break;
                }
            }
            if (localIp !== '127.0.0.1') break;
        }

        const body = {
            fields: {
                serverAddress: { stringValue: `http://${localIp}:${PORT}` },
                lastUpdated: { timestampValue: new Date().toISOString() }
            }
        };

        await axios.patch(`${FIREBASE_BASE_URL}settings/network?updateMask.fieldPaths=serverAddress&updateMask.fieldPaths=lastUpdated`, body);
        console.log(`Server registered in Firebase with IP: ${localIp}`);
    } catch (err) {
        console.error("Server registration error:", err.message);
    }
};

const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`Local Admin Server running on http://localhost:${PORT}`);
    console.log(`To allow client access, ensure firewall allows port ${PORT}`);
    registerServer();
});

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
