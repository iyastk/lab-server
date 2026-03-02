import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { doc, getDoc, setDoc, collection, getDocs, writeBatch } from 'firebase/firestore';
import {
    Settings, Clock, Shield, Wrench, Info, Save, AlertTriangle,
    Trash2, Power, RefreshCw, CheckCircle, Monitor, Terminal, WifiOff,
    X
} from 'lucide-react';

import { LucideIcon } from 'lucide-react';
import { Station } from '../types';

// ─── Section Wrapper ──────────────────────────────────────────────────────────
interface SectionProps { icon: LucideIcon; title: string; color?: string; children: React.ReactNode; }
const Section = ({ icon: Icon, title, color = 'var(--primary)', children }: SectionProps) => (
    <div className="glass-panel animate-fade-in" style={{ padding: '28px', display: 'flex', flexDirection: 'column', gap: '20px', borderTop: `3px solid ${color}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ background: `${color}18`, padding: '10px', borderRadius: '10px' }}>
                <Icon size={22} color={color} />
            </div>
            <h2 style={{ margin: 0, fontSize: '1.1rem' }}>{title}</h2>
        </div>
        {children}
    </div>
);

// ─── Field Row ─────────────────────────────────────────────────────────────
interface FieldProps { label: string; hint?: string; children: React.ReactNode; }
const Field = ({ label, hint, children }: FieldProps) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)' }}>{label}</label>
        {children}
        {hint && <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--text-muted)' }}>{hint}</p>}
    </div>
);

const inputStyle: React.CSSProperties = {
    background: 'rgba(0,0,0,0.25)', border: '1px solid var(--glass)',
    borderRadius: '8px', padding: '10px 14px', color: 'var(--text-main)',
    fontSize: '0.9rem', fontFamily: 'inherit', width: '100%'
};

// ─── Main Component ───────────────────────────────────────────────────────────
const SettingsPage = () => {
    const [saved, setSaved] = useState(false);
    const [loading, setLoading] = useState(true);

    // Lab Config
    const [labName, setLabName] = useState('Computer Lab');
    const [adminEmail, setAdminEmail] = useState('');
    const [maxSessions, setMaxSessions] = useState('30');

    // Time Quotas (in minutes)
    const [defaultDaily, setDefaultDaily] = useState('120');
    const [defaultWeekly, setDefaultWeekly] = useState('600');

    // Security Defaults
    const [bannedKeywords, setBannedKeywords] = useState<string[]>([]);
    const [keywordInput, setKeywordInput] = useState('');
    const [blockedWebsites, setBlockedWebsites] = useState<string[]>([]);
    const [websiteInput, setWebsiteInput] = useState('');
    const [blockUninstalls, setBlockUninstalls] = useState(true);
    const [screenshotInterval, setScreenshotInterval] = useState('30');

    // Remote Management
    const [uninstallStatus, setUninstallStatus] = useState('');
    const [isUninstalling, setIsUninstalling] = useState(false);
    const [stations, setStations] = useState<Station[]>([]);

    useEffect(() => {
        const load = async () => {
            try {
                const labSnap = await getDoc(doc(db, 'settings', 'lab'));
                if (labSnap.exists()) {
                    const d = labSnap.data();
                    setLabName(d.labName ?? 'Computer Lab');
                    setAdminEmail(d.adminEmail ?? '');
                    setMaxSessions(String(d.maxSessions ?? 30));
                    setDefaultDaily(String(d.defaultDailyMinutes ?? 120));
                    setDefaultWeekly(String(d.defaultWeeklyMinutes ?? 600));
                    setBlockUninstalls(d.blockUninstalls ?? true);
                    setScreenshotInterval(String(d.screenshotInterval ?? 30));
                }

                // Global Security
                const globalSnap = await getDoc(doc(db, 'settings', 'global'));
                if (globalSnap.exists()) {
                    const d = globalSnap.data();
                    setBannedKeywords(d.bannedKeywords ? d.bannedKeywords.split(',').filter((s: string) => s) : []);
                    setBlockedWebsites(d.blockedWebsites ? d.blockedWebsites.split(',').filter((s: string) => s) : []);
                }

                // Load stations for uninstall picker
                const stSnap = await getDocs(collection(db, 'stations'));
                setStations(stSnap.docs.map(d => ({ id: d.id, ...d.data() } as Station)));
            } catch { }
            setLoading(false);
        };
        load();
    }, []);

    const save = async () => {
        try {
            // Lab config
            await setDoc(doc(db, 'settings', 'lab'), {
                labName, adminEmail,
                maxSessions: parseInt(maxSessions) || 30,
                defaultDailyMinutes: parseInt(defaultDaily) || 120,
                defaultWeeklyMinutes: parseInt(defaultWeekly) || 600,
                blockUninstalls,
                screenshotInterval: parseInt(screenshotInterval) || 30,
            }, { merge: true });

            // Global security
            await setDoc(doc(db, 'settings', 'global'), {
                bannedKeywords: bannedKeywords.join(','),
                blockedWebsites: blockedWebsites.join(','),
            }, { merge: true });

            setSaved(true);
            setTimeout(() => setSaved(false), 3000);
        } catch (e: any) {
            alert('Failed to save settings: ' + e.message);
        }
    };

    const sendUninstallToAll = async () => {
        if (!window.confirm('⚠️ This will remotely uninstall LabGuard from ALL connected PCs. Are you sure?')) return;
        setIsUninstalling(true);
        setUninstallStatus('Sending uninstall command to all stations...');
        try {
            const batch = writeBatch(db);
            const onlineStations = stations.filter(s => s.status === 'online');
            onlineStations.forEach(s => {
                // Use 'pendingCommand' — the field the client polls every 5 seconds
                batch.update(doc(db, 'stations', s.id), { pendingCommand: 'uninstall', commandTimestamp: new Date() });
            });
            await batch.commit();
            setUninstallStatus(`✅ Uninstall sent to ${onlineStations.length} online station(s). Clients will remove themselves shortly.`);
        } catch (e: any) {
            setUninstallStatus('❌ Failed: ' + e.message);
        }
        setIsUninstalling(false);
    };

    const sendUninstallToOne = async (stationId: string) => {
        if (!window.confirm(`Uninstall LabGuard from station "${stationId}"?`)) return;
        try {
            // Use 'pendingCommand' — the field the client polls every 5 seconds
            await setDoc(doc(db, 'stations', stationId), { pendingCommand: 'uninstall', commandTimestamp: new Date() }, { merge: true });
            setUninstallStatus(`✅ Uninstall command sent to ${stationId}.`);
        } catch (e: any) {
            setUninstallStatus('❌ Failed: ' + e.message);
        }
    };

    const sendAnnouncement = async () => {
        const msg = window.prompt('Enter announcement message to broadcast to all online stations:');
        if (!msg?.trim()) return;
        try {
            const batch = writeBatch(db);
            const onlineStations = stations.filter(s => s.status === 'online');
            onlineStations.forEach(s => {
                // Lowercase prefix so the client switch-case matches after .ToLower()
                batch.update(doc(db, 'stations', s.id), { pendingCommand: `announcement|${msg}`, commandTimestamp: new Date() });
            });
            await batch.commit();
            alert(`📢 Announcement sent to ${onlineStations.length} online station(s).`);
        } catch (e: any) {
            alert('Failed to send announcement: ' + e.message);
        }
    };

    if (loading) return (
        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading settings...</div>
    );

    return (
        <div style={{ maxWidth: '900px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* Header */}
            <div>
                <h1 style={{ marginBottom: '4px' }}>Settings</h1>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Lab configuration and system preferences</p>
            </div>

            {/* 1. Lab Configuration */}
            <Section icon={Settings} title="Lab Configuration">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <Field label="Lab Name" hint="Displayed in the dashboard header">
                        <input style={inputStyle} value={labName} onChange={e => setLabName(e.target.value)} />
                    </Field>
                    <Field label="Admin Email" hint="For alerts and notifications (future use)">
                        <input style={inputStyle} type="email" value={adminEmail} onChange={e => setAdminEmail(e.target.value)} placeholder="admin@school.edu" />
                    </Field>
                    <Field label="Max Expected Stations" hint="How many PCs this lab has">
                        <input style={inputStyle} type="number" value={maxSessions} onChange={e => setMaxSessions(e.target.value)} min={1} max={200} />
                    </Field>
                    <Field label="Auto-Screenshot Interval (sec)" hint="How often the client captures a screenshot automatically">
                        <input style={inputStyle} type="number" value={screenshotInterval} onChange={e => setScreenshotInterval(e.target.value)} min={10} max={300} />
                    </Field>
                </div>
            </Section>

            {/* 2. Default Time Quotas */}
            <Section icon={Clock} title="Default Time Quotas" color="var(--success)">
                <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    These values are applied to newly registered students. Existing students keep their current quotas.
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <Field label="Daily Limit (minutes)" hint="e.g. 120 = 2 hours/day">
                        <input style={inputStyle} type="number" value={defaultDaily} onChange={e => setDefaultDaily(e.target.value)} min={0} />
                    </Field>
                    <Field label="Weekly Limit (minutes)" hint="e.g. 600 = 10 hours/week">
                        <input style={inputStyle} type="number" value={defaultWeekly} onChange={e => setDefaultWeekly(e.target.value)} min={0} />
                    </Field>
                </div>
                <div style={{ background: 'rgba(34,197,94,0.07)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: '10px', padding: '12px 16px', fontSize: '0.83rem', color: 'var(--text-muted)' }}>
                    💡 Daily: <strong>{Math.floor(parseInt(defaultDaily || '0') / 60)}h {parseInt(defaultDaily || '0') % 60}m</strong> &nbsp;|&nbsp; Weekly: <strong>{Math.floor(parseInt(defaultWeekly || '0') / 60)}h {parseInt(defaultWeekly || '0') % 60}m</strong>
                </div>
            </Section>

            {/* 3. Global Security & Filtering */}
            <Section icon={Shield} title="Global Security & Filtering" color="var(--warning)">
                <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    These security rules are enforced on all student PCs. Word filtering monitors active window titles, and website blocking restricts browser access.
                </p>

                {/* Keyword Filter */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <Field label="Banned Keywords" hint="The PC will be locked if a window title contains any of these words.">
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <input
                                style={inputStyle}
                                value={keywordInput}
                                onChange={e => setKeywordInput(e.target.value)}
                                onKeyPress={e => e.key === 'Enter' && (setBannedKeywords([...bannedKeywords, keywordInput]), setKeywordInput(''))}
                                placeholder="Add keyword (e.g. YouTube, Games)..."
                            />
                            <button
                                className="btn btn-primary"
                                onClick={() => { if (keywordInput) { setBannedKeywords([...bannedKeywords, keywordInput]); setKeywordInput(''); } }}
                            >
                                Add
                            </button>
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '8px' }}>
                            {bannedKeywords.map((word, i) => (
                                <span key={i} style={{ background: 'rgba(245,158,11,0.15)', color: 'var(--warning)', padding: '4px 10px', borderRadius: '6px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '8px', border: '1px solid rgba(245,158,11,0.2)' }}>
                                    {word}
                                    <X size={12} style={{ cursor: 'pointer' }} onClick={() => setBannedKeywords(bannedKeywords.filter((_, idx) => idx !== i))} />
                                </span>
                            ))}
                        </div>
                    </Field>
                </div>

                {/* Website Blocking */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '10px' }}>
                    <Field label="Blocked Websites (Domains)" hint="Restrict access to specific domains on student PCs.">
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <input
                                style={inputStyle}
                                value={websiteInput}
                                onChange={e => setWebsiteInput(e.target.value)}
                                onKeyPress={e => e.key === 'Enter' && (setBlockedWebsites([...blockedWebsites, websiteInput]), setWebsiteInput(''))}
                                placeholder="Add domain (e.g. facebook.com)..."
                            />
                            <button
                                className="btn btn-primary"
                                onClick={() => { if (websiteInput) { setBlockedWebsites([...blockedWebsites, websiteInput]); setWebsiteInput(''); } }}
                            >
                                Add
                            </button>
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '8px' }}>
                            {blockedWebsites.map((site, i) => (
                                <span key={i} style={{ background: 'rgba(59,130,246,0.15)', color: 'var(--primary)', padding: '4px 10px', borderRadius: '6px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '8px', border: '1px solid rgba(59,130,246,0.2)' }}>
                                    {site}
                                    <X size={12} style={{ cursor: 'pointer' }} onClick={() => setBlockedWebsites(blockedWebsites.filter((_, idx) => idx !== i))} />
                                </span>
                            ))}
                        </div>
                    </Field>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '10px' }}>
                    <input
                        type="checkbox" id="blockUninstalls" checked={blockUninstalls}
                        onChange={e => setBlockUninstalls(e.target.checked)}
                        style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                    />
                    <label htmlFor="blockUninstalls" style={{ fontSize: '0.9rem', cursor: 'pointer' }}>
                        Block uninstallation attempts on student PCs
                    </label>
                </div>
            </Section>

            {/* 4. Remote Management */}
            <Section icon={Wrench} title="Remote Management" color="var(--danger)">
                <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    Remotely manage client installations. These actions are sent as commands to the connected client software.
                </p>

                {uninstallStatus && (
                    <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: '10px', padding: '12px 16px', fontSize: '0.85rem' }}>
                        {uninstallStatus}
                    </div>
                )}

                {/* Per-station uninstall */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Individual Stations
                    </div>
                    {stations.length === 0 ? (
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No stations connected.</p>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {stations.map(s => (
                                <div key={s.id} style={{
                                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                    background: 'rgba(255,255,255,0.02)', borderRadius: '10px', padding: '12px 16px',
                                    border: '1px solid var(--glass)'
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        <Monitor size={16} color={s.status === 'online' ? 'var(--success)' : 'var(--text-muted)'} />
                                        <div>
                                            <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>{s.pcName || s.id}</div>
                                            <div style={{ fontSize: '0.72rem', color: s.status === 'online' ? 'var(--success)' : 'var(--text-muted)' }}>
                                                {s.status === 'online' ? '● Online' : '○ Offline'}
                                            </div>
                                        </div>
                                    </div>
                                    <button
                                        className="btn btn-sm"
                                        style={{ background: s.status === 'online' ? 'rgba(239,68,68,0.1)' : 'rgba(255,255,255,0.05)', color: s.status === 'online' ? 'var(--danger)' : 'var(--text-muted)' }}
                                        disabled={s.status !== 'online'}
                                        onClick={() => sendUninstallToOne(s.id)}
                                        title={s.status !== 'online' ? 'Station must be online to uninstall' : 'Uninstall client remotely'}
                                    >
                                        <Trash2 size={14} /> Uninstall
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Bulk uninstall */}
                <div style={{ borderTop: '1px solid var(--glass)', paddingTop: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Bulk Actions
                    </div>
                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                        <button
                            className="btn"
                            style={{ background: 'rgba(59,130,246,0.1)', color: 'var(--primary)' }}
                            onClick={sendAnnouncement}
                            disabled={stations.filter(s => s.status === 'online').length === 0}
                        >
                            <Terminal size={16} /> Broadcast Announcement
                        </button>
                        <button
                            className="btn"
                            style={{ background: 'rgba(239,68,68,0.1)', color: 'var(--danger)' }}
                            onClick={sendUninstallToAll}
                            disabled={isUninstalling || stations.filter(s => s.status === 'online').length === 0}
                        >
                            <Trash2 size={16} /> Uninstall All Online Clients
                        </button>
                    </div>
                    <div style={{ background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: '8px', padding: '10px 14px', fontSize: '0.8rem', color: 'var(--warning)', display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                        <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: '2px' }} />
                        Uninstalling removes the registry startup entry and deletes the client executable. The PC will reboot normally after removal.
                    </div>
                </div>
            </Section>

            {/* 5. About */}
            <Section icon={Info} title="About LabGuard" color="var(--brand-blue)">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    {[
                        { label: 'Dashboard Version', value: 'v1.9.2 (Unified Controls)' },
                        { label: 'Client Version', value: 'v2.0 (Self-contained)' },
                        { label: 'Platform', value: 'Windows 10/11 + Firebase' },
                        { label: 'Database', value: 'Firestore (lab-server-f6d09)' },
                    ].map(({ label, value }) => (
                        <div key={label} style={{ background: 'rgba(255,255,255,0.02)', borderRadius: '8px', padding: '12px 16px', border: '1px solid var(--glass)' }}>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '4px' }}>{label}</div>
                            <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>{value}</div>
                        </div>
                    ))}
                </div>
            </Section>

            {/* Save Button */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', paddingBottom: '20px' }}>
                {saved && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--success)', fontSize: '0.9rem' }}>
                        <CheckCircle size={16} /> Settings saved!
                    </div>
                )}
                <button className="btn btn-primary" style={{ padding: '12px 28px' }} onClick={save}>
                    <Save size={16} /> Save Settings
                </button>
            </div>
        </div>
    );
};

export default SettingsPage;
