import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Download, Shield, Server, Terminal, ChevronRight,
    CheckCircle, Zap, HardDrive, Cpu, ArrowRight, Star
} from 'lucide-react';

const packages = [
    {
        id: 'client',
        title: 'LabGuard Client',
        subtitle: 'Install on all 30 Lab Computers',
        version: 'v2.1.0',
        size: '~18 MB',
        platform: 'Windows 10/11 (x64)',
        color: 'var(--primary)',
        colorBg: 'rgba(79, 70, 229, 0.12)',
        icon: Shield,
        badge: 'STUDENT PC',
        badgeColor: 'var(--primary)',
        features: [
            'Student login with time quotas',
            'Live screen capture & monitoring',
            'Anti-tamper Mutual Watchdog',
            'Browser search query tracking',
            'Blocked keyword enforcement',
            'File naming rule enforcement',
        ],
        requirements: ['Windows 10 / 11 (64-bit)', '.NET 6 Desktop Runtime (auto-installed)', '100 MB disk space'],
        route: '/install/client',
    },
    {
        id: 'server',
        title: 'LabGuard Server',
        subtitle: 'Install on the Admin / Teacher PC',
        version: 'v2.1.0',
        size: '~32 MB',
        platform: 'Windows 10/11 (x64)',
        color: 'var(--success)',
        colorBg: 'rgba(34, 197, 94, 0.12)',
        icon: Server,
        badge: 'ADMIN PC',
        badgeColor: 'var(--success)',
        features: [
            'Automated scheduling engine',
            'SQLite persistent data storage',
            'Internet tunnel (remote access)',
            'Wake-on-LAN proxy relay',
            'File transfer server',
            'Gemini AI report generation',
        ],
        requirements: ['Windows 10 / 11 (64-bit)', 'Node.js 18 LTS (auto-installed)', '200 MB disk space', 'Always-on PC recommended'],
        route: '/install/server',
    },
    {
        id: 'extension',
        title: 'Browser Extension',
        subtitle: 'Install on Chrome / Edge in each Lab PC',
        version: 'v1.0.0',
        size: '< 50 KB',
        platform: 'Chrome / Edge (Manifest V3)',
        color: '#f59e0b',
        colorBg: 'rgba(245, 158, 11, 0.12)',
        icon: Terminal,
        badge: 'CHROME / EDGE',
        badgeColor: '#f59e0b',
        features: [
            'Captures actual URLs (not just titles)',
            'Detects Incognito searches',
            'Reads DuckDuckGo, YouTube queries',
            'Sends data to ClientLocker instantly',
            'Works on all websites',
            'Manifest V3 (future-proof)',
        ],
        requirements: ['Chrome 110+ or Edge 110+', 'ClientLocker must be running on port 4000', 'Load unpacked by admin'],
        route: '/install/extension',
    },
];

const DownloadPage = () => {
    const navigate = useNavigate();

    return (
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '40px' }}>

            {/* Hero */}
            <div style={{ textAlign: 'center', padding: '20px 0 10px' }}>
                <div style={{
                    display: 'inline-flex', alignItems: 'center', gap: '8px',
                    background: 'rgba(79,70,229,0.12)', border: '1px solid rgba(79,70,229,0.3)',
                    borderRadius: '99px', padding: '4px 16px', fontSize: '0.78rem',
                    color: 'var(--primary)', fontWeight: 600, marginBottom: '18px', letterSpacing: '0.05em'
                }}>
                    <Zap size={13} /> DEPLOYMENT CENTER
                </div>
                <h1 style={{ fontSize: '2.8rem', fontWeight: 700, letterSpacing: '-0.03em', marginBottom: '12px' }}>
                    Download & Install LabGuard
                </h1>
                <p style={{ color: 'var(--text-muted)', fontSize: '1.05rem', maxWidth: '540px', margin: '0 auto' }}>
                    Each package includes a step-by-step setup wizard that automatically installs all required dependencies.
                </p>
            </div>

            {/* Package Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '24px' }}>
                {packages.map((pkg) => {
                    const Icon = pkg.icon;
                    return (
                        <div
                            key={pkg.id}
                            className="glass-panel"
                            style={{
                                padding: '32px',
                                display: 'flex', flexDirection: 'column', gap: '22px',
                                borderTop: `4px solid ${pkg.color}`,
                                transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                            }}
                            onMouseEnter={e => {
                                (e.currentTarget as HTMLElement).style.transform = 'translateY(-4px)';
                                (e.currentTarget as HTMLElement).style.boxShadow = `0 20px 40px rgba(0,0,0,0.3)`;
                            }}
                            onMouseLeave={e => {
                                (e.currentTarget as HTMLElement).style.transform = '';
                                (e.currentTarget as HTMLElement).style.boxShadow = '';
                            }}
                        >
                            {/* Header */}
                            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                                    <div style={{ background: pkg.colorBg, padding: '12px', borderRadius: '14px' }}>
                                        <Icon size={28} color={pkg.color} />
                                    </div>
                                    <div>
                                        <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700 }}>{pkg.title}</h2>
                                        <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.82rem', marginTop: '2px' }}>{pkg.subtitle}</p>
                                    </div>
                                </div>
                                <span style={{
                                    fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.06em',
                                    background: `rgba(${pkg.color === 'var(--primary)' ? '79,70,229' : pkg.color === 'var(--success)' ? '34,197,94' : '245,158,11'}, 0.15)`,
                                    color: pkg.color, padding: '3px 9px', borderRadius: '6px', border: `1px solid ${pkg.colorBg}`,
                                    whiteSpace: 'nowrap'
                                }}>
                                    {pkg.badge}
                                </span>
                            </div>

                            {/* Meta info */}
                            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                                {[
                                    { label: 'Version', value: pkg.version },
                                    { label: 'Size', value: pkg.size },
                                    { label: 'Platform', value: pkg.platform },
                                ].map(meta => (
                                    <div key={meta.label} style={{ fontSize: '0.78rem' }}>
                                        <div style={{ color: 'var(--text-muted)', marginBottom: '1px' }}>{meta.label}</div>
                                        <div style={{ color: 'var(--text-main)', fontWeight: 600 }}>{meta.value}</div>
                                    </div>
                                ))}
                            </div>

                            {/* Features */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {pkg.features.map(f => (
                                    <div key={f} style={{ display: 'flex', alignItems: 'center', gap: '9px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                        <CheckCircle size={14} color={pkg.color} style={{ flexShrink: 0 }} />
                                        {f}
                                    </div>
                                ))}
                            </div>

                            {/* Requirements */}
                            <div style={{ background: 'rgba(0,0,0,0.2)', borderRadius: '10px', padding: '12px 16px' }}>
                                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: '8px' }}>System Requirements</div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    {pkg.requirements.map(r => (
                                        <div key={r} style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <span style={{ width: '4px', height: '4px', background: pkg.color, borderRadius: '50%', flexShrink: 0, display: 'inline-block' }} />
                                            {r}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* CTA */}
                            <button
                                className="btn btn-primary"
                                onClick={() => navigate(pkg.route)}
                                style={{
                                    background: pkg.color === 'var(--primary)' ? 'var(--primary)' : pkg.color === 'var(--success)' ? 'var(--success)' : '#f59e0b',
                                    color: 'white', border: 'none', padding: '13px 20px',
                                    fontSize: '0.95rem', justifyContent: 'space-between', marginTop: 'auto'
                                }}
                            >
                                <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <Download size={17} /> View Installation Guide
                                </span>
                                <ChevronRight size={17} />
                            </button>
                        </div>
                    );
                })}
            </div>

            {/* Quick Deployment Order Timeline */}
            <div className="glass-panel" style={{ padding: '36px' }}>
                <h3 style={{ marginBottom: '6px', fontSize: '1.1rem' }}>Recommended Deployment Order</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '28px' }}>Follow this order on first deployment to ensure everything links correctly.</p>
                <div style={{ display: 'flex', gap: '0', position: 'relative' }}>
                    {/* connector line */}
                    <div style={{ position: 'absolute', top: '22px', left: '22px', right: '22px', height: '2px', background: 'rgba(255,255,255,0.05)', zIndex: 0 }} />
                    {[
                        { step: 1, label: 'Install Server', sub: 'Admin PC', color: 'var(--success)', icon: Server },
                        { step: 2, label: 'Deploy Client', sub: 'All 30 Lab PCs', color: 'var(--primary)', icon: Shield },
                        { step: 3, label: 'Load Extension', sub: 'Chrome / Edge', color: '#f59e0b', icon: Terminal },
                        { step: 4, label: 'Open Dashboard', sub: 'Monitor & manage', color: 'var(--brand-blue)', icon: Star },
                    ].map((item, i) => {
                        const StepIcon = item.icon;
                        return (
                            <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', position: 'relative', zIndex: 1 }}>
                                <div style={{
                                    width: '44px', height: '44px', borderRadius: '50%',
                                    background: `rgba(${item.color === 'var(--success)' ? '34,197,94' : item.color === 'var(--primary)' ? '79,70,229' : item.color === '#f59e0b' ? '245,158,11' : '59,130,246'}, 0.15)`,
                                    border: `2px solid ${item.color}`,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                                }}>
                                    <StepIcon size={18} color={item.color} />
                                </div>
                                <div style={{ textAlign: 'center' }}>
                                    <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{item.label}</div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{item.sub}</div>
                                </div>
                                {i < 3 && (
                                    <div style={{ position: 'absolute', top: '12px', right: '-8px', zIndex: 2 }}>
                                        <ArrowRight size={14} color="var(--text-muted)" />
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default DownloadPage;
