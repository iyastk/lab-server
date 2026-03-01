import React from 'react';
import { Download, Shield, HardDrive, Cpu, Server, Box, Terminal } from 'lucide-react';

const DownloadPage = () => {
    return (
        <div style={{ maxWidth: '1100px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '30px', padding: '20px' }}>
            <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                <h1 style={{ fontSize: '2.5rem', marginBottom: '10px' }}>Deployment Center</h1>
                <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem' }}>Download the necessary components to secure and monitor your lab.</p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
                {/* Student Client Section */}
                <div className="glass-panel" style={{ padding: '35px', display: 'flex', flexDirection: 'column', gap: '20px', borderTop: '4px solid var(--primary)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                        <div style={{ background: 'rgba(79, 70, 229, 0.1)', padding: '12px', borderRadius: '12px' }}>
                            <Shield size={32} color="var(--primary)" />
                        </div>
                        <div>
                            <h2 style={{ margin: 0 }}>Student Client</h2>
                            <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.9rem' }}>Install on all laboratory PCs</p>
                        </div>
                    </div>

                    <ul style={{ color: 'var(--text-muted)', fontSize: '0.9rem', paddingLeft: '20px', lineHeight: '1.6' }}>
                        <li>Locks PC on startup / Login required</li>
                        <li>Captures live screens and active apps</li>
                        <li>Enforces daily/weekly time quotas</li>
                        <li>Anti-tamper keyboard & task protection</li>
                    </ul>

                    <div style={{ marginTop: 'auto', display: 'flex', gap: '10px' }}>
                        <a
                            href="/LabGuard_Client.zip"
                            download
                            className="btn btn-primary"
                            style={{ flex: 1, textDecoration: 'none' }}
                        >
                            <Download size={18} /> Download Client
                        </a>
                    </div>
                </div>

                {/* Local Admin Server Section */}
                <div className="glass-panel" style={{ padding: '35px', display: 'flex', flexDirection: 'column', gap: '20px', borderTop: '4px solid var(--success)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                        <div style={{ background: 'rgba(34, 197, 94, 0.1)', padding: '12px', borderRadius: '12px' }}>
                            <Server size={32} color="var(--success)" />
                        </div>
                        <div>
                            <h2 style={{ margin: 0 }}>Local Admin Server</h2>
                            <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.9rem' }}>Install on the Admin/Server PC</p>
                        </div>
                    </div>

                    <ul style={{ color: 'var(--text-muted)', fontSize: '0.9rem', paddingLeft: '20px', lineHeight: '1.6' }}>
                        <li>Enables Automated Power Actions (Schedule)</li>
                        <li>Persistent SQLite data archiving (No-cost Storage)</li>
                        <li>Analyzes App Usage & Time Analytics</li>
                        <li>Syncs logs from Cloud to Local Vault</li>
                    </ul>

                    <div style={{ marginTop: 'auto', display: 'flex', gap: '10px' }}>
                        <a
                            href="/LabGuard_LocalServer.zip"
                            download
                            className="btn"
                            style={{ flex: 1, background: 'rgba(34, 197, 94, 0.1)', color: 'var(--success)', textDecoration: 'none', border: 'none' }}
                        >
                            <Download size={18} /> Download Server
                        </a>
                    </div>
                </div>

                {/* Ubuntu Client Section */}
                <div className="glass-panel" style={{ padding: '35px', display: 'flex', flexDirection: 'column', gap: '20px', borderTop: '4px solid #dd4814' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                        <div style={{ background: 'rgba(221, 72, 20, 0.1)', padding: '12px', borderRadius: '12px' }}>
                            <Terminal size={32} color="#dd4814" />
                        </div>
                        <div>
                            <h2 style={{ margin: 0 }}>
                                Ubuntu Client
                                <span style={{ fontSize: '0.65rem', background: 'rgba(221,72,20,0.15)', color: '#dd4814', padding: '2px 8px', borderRadius: '99px', marginLeft: '8px', verticalAlign: 'middle' }}>Linux</span>
                            </h2>
                            <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.9rem' }}>For dual-boot / Linux lab computers</p>
                        </div>
                    </div>

                    <ul style={{ color: 'var(--text-muted)', fontSize: '0.9rem', paddingLeft: '20px', lineHeight: '1.6' }}>
                        <li>Python 3 — runs on Ubuntu 20.04+</li>
                        <li>Auto-starts as a systemd service</li>
                        <li>Responds to same Admin remote commands</li>
                        <li>Compatible with dual-boot setups</li>
                    </ul>

                    <div style={{ background: 'rgba(0,0,0,0.25)', borderRadius: '8px', padding: '12px', fontFamily: 'monospace', fontSize: '0.8rem', lineHeight: '1.8' }}>
                        <div style={{ color: '#22c55e' }}>$ sudo bash install.sh</div>
                        <div style={{ color: '#94a3b8' }}>$ sudo nano /etc/labguard/config.json</div>
                    </div>

                    <div style={{ marginTop: 'auto', display: 'flex', gap: '10px' }}>
                        <a href="/LabGuard_Ubuntu.tar.gz" download className="btn"
                            style={{ flex: 1, background: 'rgba(221, 72, 20, 0.1)', color: '#dd4814', textDecoration: 'none', border: 'none' }}>
                            <Download size={18} /> Download Ubuntu Client
                        </a>
                    </div>
                </div>
            </div>

            <div className="glass-panel" style={{ padding: '30px' }}>
                <h3 style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '15px' }}>
                    <Box size={20} color="var(--primary)" /> Deployment Instructions
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '30px' }}>
                    <div>
                        <h4 style={{ color: 'var(--text-main)', marginBottom: '10px' }}>1. Start Local Server</h4>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                            Unzip the Server package on your main Admin PC. Run <code>npm install</code> then <code>start.bat</code> to begin archiving.
                        </p>
                    </div>
                    <div>
                        <h4 style={{ color: 'var(--text-main)', marginBottom: '10px' }}>2. Deploy Clients</h4>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                            Copy the Client zip to student PCs. Run the executable and enter your Firebase credentials.
                        </p>
                    </div>
                    <div>
                        <h4 style={{ color: 'var(--text-main)', marginBottom: '10px' }}>3. Sync & Monitor</h4>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                            Login to this dashboard to see live feeds. Data will automatically move to your local server once a session ends.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DownloadPage;
