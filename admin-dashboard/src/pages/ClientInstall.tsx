import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Shield, Download, CheckCircle, ChevronRight, ChevronLeft,
    ArrowLeft, AlertCircle, Copy, Check, Terminal
} from 'lucide-react';

const steps = [
    {
        id: 1, title: 'Download Installer',
        desc: 'Click the button below to download the LabGuard Client Setup wizard.',
        icon: Download, color: 'var(--primary)'
    },
    {
        id: 2, title: 'Run as Administrator',
        desc: 'Right-click on LabGuard_Client_Setup.exe and select "Run as Administrator". This is required to register autostart.',
        icon: Shield, color: '#f59e0b'
    },
    {
        id: 3, title: 'Accept License & Choose Path',
        desc: 'The wizard will show the License Agreement and default install location (C:\\Program Files\\LabGuard\\). Click Next.',
        icon: CheckCircle, color: 'var(--primary)'
    },
    {
        id: 4, title: 'Auto-Install .NET Runtime',
        desc: 'If .NET 6 Desktop Runtime is not found on the PC, the installer will automatically download and install it silently. No action needed.',
        icon: Terminal, color: 'var(--success)'
    },
    {
        id: 5, title: 'Complete & Launch',
        desc: 'Click Finish. ClientLocker will launch automatically and show the student login screen immediately on startup.',
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

const ClientInstallPage = () => {
    const navigate = useNavigate();
    const [activeStep, setActiveStep] = useState(0);

    return (
        <div style={{ maxWidth: '860px', margin: '0 auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '28px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <button className="btn btn-sm" onClick={() => navigate('/download')} style={{ gap: '6px' }}>
                    <ArrowLeft size={14} /> Back
                </button>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Deployment Center / Client Installer</span>
            </div>

            {/* Banner */}
            <div className="glass-panel" style={{ padding: '30px 34px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '24px', borderTop: '4px solid var(--primary)', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '18px' }}>
                    <div style={{ background: 'rgba(79,70,229,0.15)', padding: '16px', borderRadius: '16px' }}>
                        <Shield size={36} color="var(--primary)" />
                    </div>
                    <div>
                        <h1 style={{ margin: 0, fontSize: '1.7rem', fontWeight: 700 }}>LabGuard Client Setup</h1>
                        <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: '0.9rem' }}>v2.1.0 · Windows 10/11 · ~18 MB · .NET 6 auto-installed</p>
                    </div>
                </div>
                <a
                    href="/LabGuard_Client_Setup.exe"
                    download="LabGuard_Client_Setup.exe"
                    className="btn btn-primary"
                    style={{ padding: '13px 24px', fontSize: '0.95rem', gap: '9px', textDecoration: 'none' }}
                >
                    <Download size={18} /> Download Installer (.exe)
                </a>
            </div>

            {/* Step wizard */}
            <div className="glass-panel" style={{ padding: '32px' }}>
                <h3 style={{ marginBottom: '24px', fontSize: '1rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Installation Steps</h3>

                {/* Step timeline */}
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
                                        background: isActive ? 'rgba(79,70,229,0.1)' : 'transparent',
                                        border: `1px solid ${isActive ? 'rgba(79,70,229,0.3)' : 'transparent'}`,
                                        transition: 'all 0.18s ease'
                                    }}
                                >
                                    <div style={{
                                        width: '36px', height: '36px', borderRadius: '50%', flexShrink: 0,
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        background: isDone ? 'rgba(34,197,94,0.15)' : isActive ? 'rgba(79,70,229,0.2)' : 'rgba(255,255,255,0.05)',
                                        border: `2px solid ${isDone ? 'var(--success)' : isActive ? 'var(--primary)' : 'rgba(255,255,255,0.1)'}`,
                                        fontSize: '0.8rem', fontWeight: 700, color: isDone ? 'var(--success)' : isActive ? 'var(--primary)' : 'var(--text-muted)'
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

                {/* Navigation buttons */}
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '24px', gap: '12px' }}>
                    <button className="btn" onClick={() => setActiveStep(s => Math.max(0, s - 1))} disabled={activeStep === 0}>
                        <ChevronLeft size={15} /> Previous
                    </button>
                    {activeStep < steps.length - 1 ? (
                        <button className="btn btn-primary" onClick={() => setActiveStep(s => s + 1)}>
                            Next Step <ChevronRight size={15} />
                        </button>
                    ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--success)', fontSize: '0.9rem', fontWeight: 600 }}>
                            <CheckCircle size={18} /> Installation Complete!
                        </div>
                    )}
                </div>
            </div>

            {/* Repeat deployment note */}
            <div className="glass-panel" style={{ padding: '24px 28px' }}>
                <h3 style={{ display: 'flex', alignItems: 'center', gap: '9px', marginBottom: '16px', fontSize: '0.95rem' }}>
                    <Terminal size={17} color="var(--primary)" /> Batch Deploy to All 30 PCs
                </h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '14px' }}>Copy the installer to a USB drive or shared folder, then run silently from an admin command line on each PC:</p>
                <CopyBlock code='LabGuard_Client_Setup.exe /SILENT /NORESTART' />
                <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginTop: '10px' }}>/SILENT mode shows a progress bar. Use /VERYSILENT to install with no UI at all.</p>
            </div>

            {/* Warning */}
            <div style={{ display: 'flex', gap: '12px', padding: '16px 20px', background: 'rgba(245,158,11,0.08)', borderRadius: '12px', border: '1px solid rgba(245,158,11,0.2)' }}>
                <AlertCircle size={18} color="#f59e0b" style={{ flexShrink: 0, marginTop: '1px' }} />
                <p style={{ color: '#f59e0b', fontSize: '0.85rem', margin: 0, lineHeight: '1.6' }}>
                    <strong>Always install as Administrator.</strong> Without admin rights, the autostart registry key and the HttpListener (port 4000) cannot be created, and the watchdog may not work correctly.
                </p>
            </div>
        </div>
    );
};

export default ClientInstallPage;
