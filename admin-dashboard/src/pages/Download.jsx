import React from 'react';
import { Download, Shield, HardDrive, Cpu } from 'lucide-react';

const DownloadPage = () => {
    return (
        <div style={{ maxWidth: '800px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '30px' }}>
            <div className="glass-panel" style={{ padding: '40px', textAlign: 'center' }}>
                <div style={{ background: 'var(--primary)', width: '80px', height: '80px', borderRadius: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                    <Shield size={40} color="white" />
                </div>
                <h1 style={{ fontSize: '2.5rem', marginBottom: '10px' }}>Download LabGuard</h1>
                <p style={{ color: 'var(--text-muted)', fontSize: '1.2rem' }}>Deploy the monitoring client to your laboratory stations.</p>

                <div style={{ marginTop: '40px', display: 'flex', justifyContent: 'center', gap: '20px' }}>
                    <button className="btn btn-primary" style={{ padding: '15px 30px', fontSize: '1.1rem', gap: '12px' }}>
                        <Download size={24} />
                        Download Installer (.exe)
                    </button>
                    <button className="btn" style={{ background: 'rgba(255,255,255,0.05)', padding: '15px 30px', border: '1px solid var(--glass)' }}>
                        Installation Guide
                    </button>
                </div>
                <p style={{ marginTop: '20px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>Version 1.0.0 (Stable) • for Windows 10/11 x64</p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                <div className="glass-panel" style={{ padding: '30px' }}>
                    <h3 style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '15px' }}>
                        <Cpu size={20} color="var(--primary)" /> System Requirements
                    </h3>
                    <ul style={{ color: 'var(--text-muted)', lineHeight: '1.8' }}>
                        <li>Windows 10 or Windows 11 (x64)</li>
                        <li>.NET 6.0 Desktop Runtime (Auto-checked)</li>
                        <li>Active Internet Connection</li>
                        <li>Administrator Privileges</li>
                    </ul>
                </div>
                <div className="glass-panel" style={{ padding: '30px' }}>
                    <h3 style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '15px' }}>
                        <HardDrive size={20} color="var(--primary)" /> Quick Setup
                    </h3>
                    <ol style={{ color: 'var(--text-muted)', lineHeight: '1.8' }}>
                        <li>Download the `LabGuard_Setup.exe`.</li>
                        <li>Run the installer as Administrator.</li>
                        <li>Follow the on-screen setup wizard.</li>
                        <li>The PC will automatically lock and sync.</li>
                    </ol>
                </div>
            </div>
        </div>
    );
};

export default DownloadPage;
