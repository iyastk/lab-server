import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Terminal, Chrome, CheckCircle, ChevronRight, ChevronLeft,
    ArrowLeft, AlertCircle, Copy, Check, Puzzle
} from 'lucide-react';

const steps = [
    {
        id: 1, title: 'Open Chrome or Edge Extensions',
        desc: 'In Chrome, navigate to chrome://extensions — in Edge, navigate to edge://extensions. Enable "Developer mode" using the toggle in the top-right corner.',
        icon: Chrome, color: '#f59e0b'
    },
    {
        id: 2, title: 'Click "Load Unpacked"',
        desc: 'Click the "Load unpacked" button that appears after enabling developer mode. Browse to the LabGuard server folder.',
        icon: Puzzle, color: '#f59e0b'
    },
    {
        id: 3, title: 'Select the browser-extension Folder',
        desc: 'Navigate to: C:\\Program Files\\LabGuard Server\\browser-extension\\ and click "Select Folder". The extension will appear in your list.',
        icon: Terminal, color: 'var(--primary)'
    },
    {
        id: 4, title: 'Pin the Extension',
        desc: 'Click the puzzle piece icon in the browser toolbar, find "LabGuard Monitor", and click the pin icon so it\'s always visible.',
        icon: CheckCircle, color: 'var(--primary)'
    },
    {
        id: 5, title: 'Verify it Works',
        desc: 'Search something on Google or YouTube. Open the ClientLocker app on this PC — the search query should appear in the activity log within seconds.',
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

const ExtensionInstallPage = () => {
    const navigate = useNavigate();
    const [activeStep, setActiveStep] = useState(0);

    return (
        <div style={{ maxWidth: '860px', margin: '0 auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '28px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <button className="btn btn-sm" onClick={() => navigate('/download')} style={{ gap: '6px' }}>
                    <ArrowLeft size={14} /> Back
                </button>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Deployment Center / Browser Extension</span>
            </div>

            {/* Banner */}
            <div className="glass-panel" style={{ padding: '30px 34px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '24px', borderTop: '4px solid #f59e0b', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '18px' }}>
                    <div style={{ background: 'rgba(245,158,11,0.15)', padding: '16px', borderRadius: '16px' }}>
                        <Puzzle size={36} color="#f59e0b" />
                    </div>
                    <div>
                        <h1 style={{ margin: 0, fontSize: '1.7rem', fontWeight: 700 }}>LabGuard Browser Extension</h1>
                        <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: '0.9rem' }}>v1.0.0 · Chrome 110+ / Edge 110+ · Built-in with Server Package · Manifest V3</p>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    <div style={{ padding: '10px 16px', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: '10px', fontSize: '0.82rem', color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '7px' }}>
                        <Puzzle size={14} /> No download needed — bundled with Server
                    </div>
                </div>
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
                                        background: isActive ? 'rgba(245,158,11,0.08)' : 'transparent',
                                        border: `1px solid ${isActive ? 'rgba(245,158,11,0.25)' : 'transparent'}`,
                                        transition: 'all 0.18s ease'
                                    }}
                                >
                                    <div style={{
                                        width: '36px', height: '36px', borderRadius: '50%', flexShrink: 0,
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        background: isDone ? 'rgba(34,197,94,0.15)' : isActive ? 'rgba(245,158,11,0.15)' : 'rgba(255,255,255,0.05)',
                                        border: `2px solid ${isDone ? 'var(--success)' : isActive ? '#f59e0b' : 'rgba(255,255,255,0.1)'}`,
                                        fontSize: '0.8rem', fontWeight: 700,
                                        color: isDone ? 'var(--success)' : isActive ? '#f59e0b' : 'var(--text-muted)'
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
                        <button className="btn" onClick={() => setActiveStep(s => s + 1)} style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.25)' }}>
                            Next Step <ChevronRight size={15} />
                        </button>
                    ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--success)', fontSize: '0.9rem', fontWeight: 600 }}>
                            <CheckCircle size={18} /> Extension Active!
                        </div>
                    )}
                </div>
            </div>

            {/* Extension path */}
            <div className="glass-panel" style={{ padding: '24px 28px' }}>
                <h3 style={{ display: 'flex', alignItems: 'center', gap: '9px', marginBottom: '14px', fontSize: '0.95rem' }}>
                    <Terminal size={17} color="#f59e0b" /> Extension Location
                </h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '12px' }}>
                    The extension folder is installed automatically with the Server package. Point "Load Unpacked" to this path:
                </p>
                <CopyBlock code="C:\Program Files\LabGuard Server\browser-extension\" />
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '12px', marginBottom: '10px' }}>
                    You can also find it relative to where you installed the server package:
                </p>
                <CopyBlock code=".\browser-extension\" />
            </div>

            {/* Warning */}
            <div style={{ display: 'flex', gap: '12px', padding: '16px 20px', background: 'rgba(245,158,11,0.08)', borderRadius: '12px', border: '1px solid rgba(245,158,11,0.2)' }}>
                <AlertCircle size={18} color="#f59e0b" style={{ flexShrink: 0, marginTop: '1px' }} />
                <p style={{ color: '#f59e0b', fontSize: '0.85rem', margin: 0, lineHeight: '1.6' }}>
                    <strong>ClientLocker must be running for the extension to report data.</strong> The extension sends HTTP requests to <code style={{ fontFamily: 'monospace', background: 'rgba(0,0,0,0.3)', padding: '1px 5px', borderRadius: '4px' }}>localhost:4000/report</code>. If ClientLocker is not running, the data is silently dropped.
                </p>
            </div>
        </div>
    );
};

export default ExtensionInstallPage;
