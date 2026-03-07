import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Server, Download, CheckCircle, ChevronRight, ChevronLeft,
    ArrowLeft, AlertCircle, Copy, Check, Terminal, Zap, Database
} from 'lucide-react';
import { db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';
import { useEffect } from 'react';

const steps = [
    {
        id: 1, title: 'Download Installer',
        desc: 'Click the Download button above to get LabGuard_Server_Setup.exe. Store it on the teacher/admin PC.',
        icon: Download, color: 'var(--success)'
    },
    {
        id: 2, title: 'Run as Administrator',
        desc: 'Right-click on LabGuard_Server_Setup.exe → Run as Administrator. Required to install Node.js and create Windows services.',
        icon: Server, color: '#f59e0b'
    },
    {
        id: 3, title: 'Auto-Install Node.js 18 LTS',
        desc: 'The wizard detects if Node.js is installed. If not, it downloads and installs Node.js 18 LTS silently in the background. This may take 1–2 minutes.',
        icon: Terminal, color: '#f59e0b'
    },
    {
        id: 4, title: 'Install npm Packages',
        desc: 'The wizard runs `npm install` automatically inside the server folder. All dependencies (express, sqlite3, localtunnel, etc.) are installed.',
        icon: Database, color: 'var(--primary)'
    },
    {
        id: 5, title: 'Install PM2 Windows Service',
        desc: 'PM2 is installed globally and the server is registered as a Windows Service, so it auto-starts when the PC boots — no manual start needed.',
        icon: Zap, color: 'var(--success)'
    },
    {
        id: 6, title: 'Finish & Verify',
        desc: 'Click Finish. Open a browser and go to http://localhost:5000 to verify the server is running. The tunnel URL will appear in the console.',
        icon: CheckCircle, color: 'var(--success)'
    },
];

const CopyBlock = ({ code }: { code: string }) => {
    const [copied, setCopied] = useState(false);
    return (
        <div style={{ position: 'relative', background: 'rgba(0,0,0,0.3)', borderRadius: '10px', padding: '14px 16px', fontFamily: 'monospace', fontSize: '0.82rem', color: '#94a3b8', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
            <span>{code}</span>
            <button className="btn btn-sm" style={{ flexShrink: 0, gap: '5px' }} onClick={() => { navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 2000); }}>
                {copied ? <Check size={13} color="var(--success)" /> : <Copy size={13} />}
                {copied ? 'Copied' : 'Copy'}
            </button>
        </div>
    );
};

const ServerInstallPage = () => {
    const navigate = useNavigate();
    const [activeStep, setActiveStep] = useState(0);
    const [localServerUrl, setLocalServerUrl] = useState<string>('http://localhost:5000');

    useEffect(() => {
        getDoc(doc(db, 'settings', 'network')).then(snap => {
            if (snap.exists() && snap.data().serverAddress) {
                setLocalServerUrl(snap.data().serverAddress);
            }
        });
    }, []);

    const downloadUrl = `${localServerUrl}/installers/LabGuard_Server_Setup.exe`;

    return (
        <div style={{ maxWidth: '860px', margin: '0 auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '28px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <button className="btn btn-sm" onClick={() => navigate('/download')} style={{ gap: '6px' }}>
                    <ArrowLeft size={14} /> Back
                </button>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Deployment Center / Server Installer</span>
            </div>

            {/* Banner */}
            <div className="glass-panel" style={{ padding: '30px 34px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '24px', borderTop: '4px solid var(--success)', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '18px' }}>
                    <div style={{ background: 'rgba(34,197,94,0.15)', padding: '16px', borderRadius: '16px' }}>
                        <Server size={36} color="var(--success)" />
                    </div>
                    <div>
                        <h1 style={{ margin: 0, fontSize: '1.7rem', fontWeight: 700 }}>LabGuard Server Setup</h1>
                        <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: '0.9rem' }}>v2.1.0 · Windows 10/11 · ~32 MB · Node.js 18 auto-installed</p>
                    </div>
                </div>
                <a
                    href={downloadUrl}
                    download="LabGuard_Server_Setup.exe"
                    className="btn"
                    style={{ padding: '13px 24px', fontSize: '0.95rem', gap: '9px', textDecoration: 'none', background: 'var(--success)', color: 'white', border: 'none' }}
                >
                    <Download size={18} /> Download Installer (.exe)
                </a>
            </div>

            {/* Step wizard */}
            <div className="glass-panel" style={{ padding: '32px' }}>
                <h3 style={{ marginBottom: '24px', fontSize: '1rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Installation Steps</h3>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {steps.map((step, idx) => {
                        const StepIcon = step.icon;
                        const isActive = idx === activeStep;
                        const isDone = idx < activeStep;
                        return (
                            <div key={step.id}>
                                <div
                                    onClick={() => setActiveStep(idx)}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: '16px',
                                        padding: '14px 18px', borderRadius: '12px', cursor: 'pointer',
                                        background: isActive ? 'rgba(34,197,94,0.08)' : 'transparent',
                                        border: `1px solid ${isActive ? 'rgba(34,197,94,0.25)' : 'transparent'}`,
                                        transition: 'all 0.18s ease'
                                    }}
                                >
                                    <div style={{
                                        width: '36px', height: '36px', borderRadius: '50%', flexShrink: 0,
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        background: isDone ? 'rgba(34,197,94,0.15)' : isActive ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.05)',
                                        border: `2px solid ${isDone ? 'var(--success)' : isActive ? 'var(--success)' : 'rgba(255,255,255,0.1)'}`,
                                        fontSize: '0.8rem', fontWeight: 700,
                                        color: isDone ? 'var(--success)' : isActive ? 'var(--success)' : 'var(--text-muted)'
                                    }}>
                                        {isDone ? <CheckCircle size={16} color="var(--success)" /> : step.id}
                                    </div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontWeight: 600, fontSize: '0.9rem', color: isActive ? 'var(--text-main)' : 'var(--text-muted)' }}>{step.title}</div>
                                        {isActive && <div style={{ fontSize: '0.83rem', color: 'var(--text-muted)', marginTop: '4px', lineHeight: '1.6' }}>{step.desc}</div>}
                                    </div>
                                    <ChevronRight size={16} color="var(--text-muted)" style={{ flexShrink: 0, transform: isActive ? 'rotate(90deg)' : '', transition: 'transform 0.2s' }} />
                                </div>
                                {idx < steps.length - 1 && (
                                    <div style={{ width: '2px', height: '10px', background: 'rgba(255,255,255,0.06)', marginLeft: '31px' }} />
                                )}
                            </div>
                        );
                    })}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '24px', gap: '12px' }}>
                    <button className="btn" onClick={() => setActiveStep(s => Math.max(0, s - 1))} disabled={activeStep === 0}>
                        <ChevronLeft size={15} /> Previous
                    </button>
                    {activeStep < steps.length - 1 ? (
                        <button className="btn" onClick={() => setActiveStep(s => s + 1)} style={{ background: 'rgba(34,197,94,0.15)', color: 'var(--success)', border: '1px solid rgba(34,197,94,0.25)' }}>
                            Next Step <ChevronRight size={15} />
                        </button>
                    ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--success)', fontSize: '0.9rem', fontWeight: 600 }}>
                            <CheckCircle size={18} /> Server is Running!
                        </div>
                    )}
                </div>
            </div>

            {/* Verify server */}
            <div className="glass-panel" style={{ padding: '24px 28px' }}>
                <h3 style={{ display: 'flex', alignItems: 'center', gap: '9px', marginBottom: '16px', fontSize: '0.95rem' }}>
                    <Terminal size={17} color="var(--success)" /> Verify Server is Running
                </h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '14px' }}>After installation, open a browser on any device in the network and visit:</p>
                <CopyBlock code="http://localhost:5000" />
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '14px', marginBottom: '10px' }}>To manually restart the server or check its status:</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <CopyBlock code="pm2 status" />
                    <CopyBlock code="pm2 restart labguard-server" />
                    <CopyBlock code="pm2 logs labguard-server" />
                </div>
            </div>

            {/* Warning */}
            <div style={{ display: 'flex', gap: '12px', padding: '16px 20px', background: 'rgba(245,158,11,0.08)', borderRadius: '12px', border: '1px solid rgba(245,158,11,0.2)' }}>
                <AlertCircle size={18} color="#f59e0b" style={{ flexShrink: 0, marginTop: '1px' }} />
                <p style={{ color: '#f59e0b', fontSize: '0.85rem', margin: 0, lineHeight: '1.6' }}>
                    <strong>Keep the server PC always on.</strong> Clients sync logs and receive commands through this server. If it's off, the localtunnel URL will expire and the Admin Dashboard will lose connectivity to historical data.
                </p>
            </div>
        </div>
    );
};

export default ServerInstallPage;
