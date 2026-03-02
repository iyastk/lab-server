import React, { useState, useEffect, useMemo, memo } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import { Users, Monitor, ShieldAlert, Activity, Youtube, Search, Globe, Cpu, Clock, Code, Gamepad2, MessageSquare } from 'lucide-react';
import { HistoryLog } from '../types';

// ─── Types ────────────────────────────────────────────────────────────────────
interface ActivityLog extends HistoryLog {
    // extends shared HistoryLog type
}

interface CategoryStyle {
    bg: string;
    color: string;
}

const CATEGORY_COLORS: Record<string, CategoryStyle> = {
    'YouTube': { bg: 'rgba(239,68,68,0.12)', color: '#ef4444' },
    'Search': { bg: 'rgba(251,191,36,0.12)', color: '#fbbf24' },
    'Web Browsing': { bg: 'rgba(59,130,246,0.12)', color: '#60a5fa' },
    'Coding': { bg: 'rgba(34,197,94,0.12)', color: '#22c55e' },
    'Gaming': { bg: 'rgba(168,85,247,0.12)', color: '#a855f7' },
    'Social': { bg: 'rgba(14,165,233,0.12)', color: '#0ea5e9' },
    'General App': { bg: 'rgba(139,92,246,0.12)', color: '#a78bfa' },
    'VIOLATION': { bg: 'rgba(239,68,68,0.15)', color: '#ef4444' },
};
const DEFAULT_CAT_STYLE: CategoryStyle = { bg: 'rgba(255,255,255,0.05)', color: 'var(--text-muted)' };

// ─── Helpers ──────────────────────────────────────────────────────────────────
function parseActivity(activity: string): { cat: string; detail: string } {
    if (!activity) return { cat: 'General App', detail: '' };
    if (activity.includes('|')) {
        const [cat, ...rest] = activity.split('|');
        return { cat: cat.trim(), detail: rest.join('|').trim() };
    }
    return { cat: 'General App', detail: activity };
}

function getCatIcon(cat: string) {
    switch (cat) {
        case 'YouTube': return <Youtube size={13} />;
        case 'Search': return <Search size={13} />;
        case 'Web Browsing': return <Globe size={13} />;
        case 'Coding': return <Code size={13} />;
        case 'Gaming': return <Gamepad2 size={13} />;
        case 'Social': return <MessageSquare size={13} />;
        case 'VIOLATION': return <ShieldAlert size={13} />;
        default: return <Cpu size={13} />;
    }
}

function fmtTime(ts: any): string {
    if (!ts) return '';
    const d: Date | null = typeof ts === 'string' ? new Date(ts) : ts?.toDate?.() ?? null;
    return d ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
}

// ─── Sub-components ───────────────────────────────────────────────────────────
interface StatCardProps { label: string; value: number; icon: React.ReactNode; color: string; }
const StatCard = memo(({ label, value, icon, color }: StatCardProps) => (
    <div className="glass-panel" style={{ padding: '25px', display: 'flex', alignItems: 'center', gap: '20px' }}>
        <div style={{ background: `${color}20`, color, padding: '15px', borderRadius: '12px', flexShrink: 0 }}>
            {icon}
        </div>
        <div>
            <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.88rem' }}>{label}</p>
            <h2 style={{ margin: '4px 0 0', fontSize: '2rem', fontWeight: 700 }}>{value}</h2>
        </div>
    </div>
));

interface ActivityRowProps { log: ActivityLog; }
const ActivityRow = memo(({ log }: ActivityRowProps) => {
    const { cat, detail } = parseActivity(log.activity);
    const cs = CATEGORY_COLORS[cat] ?? DEFAULT_CAT_STYLE;
    return (
        <div style={{
            display: 'flex', gap: '12px', alignItems: 'center',
            padding: '11px 14px', background: 'rgba(255,255,255,0.02)',
            borderRadius: '10px', border: '1px solid rgba(255,255,255,0.04)'
        }}>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', minWidth: '52px', flexShrink: 0 }}>
                {fmtTime(log.timestamp)}
            </span>
            <span style={{
                background: cs.bg, color: cs.color, padding: '3px 9px',
                borderRadius: '99px', fontSize: '0.68rem', display: 'flex',
                alignItems: 'center', gap: '5px', whiteSpace: 'nowrap', flexShrink: 0
            }}>
                {getCatIcon(cat)} {cat}
            </span>
            <span style={{ flex: 1, fontSize: '0.88rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                <strong style={{ color: 'var(--primary)' }}>{log.studentId}</strong>
                {' '}
                <span style={{ color: 'var(--text-muted)' }}>{detail}</span>
            </span>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.05)', padding: '2px 8px', borderRadius: '4px', flexShrink: 0 }}>
                {log.pcName}
            </span>
        </div>
    );
});

// ─── Main Component ───────────────────────────────────────────────────────────
interface StatsState { totalStudents: number; activePCs: number; lockedPCs: number; offlinePCs: number; }

const Dashboard = () => {
    const [stats, setStats] = useState<StatsState>({ totalStudents: 0, activePCs: 0, lockedPCs: 0, offlinePCs: 0 });
    const [recentActivities, setRecentActivities] = useState<ActivityLog[]>([]);

    useEffect(() => {
        const unsubStudents = onSnapshot(collection(db, 'students'), (snap) => {
            setStats(prev => ({ ...prev, totalStudents: snap.size }));
        });

        const unsubStations = onSnapshot(collection(db, 'stations'), (snap) => {
            const data = snap.docs.map(doc => doc.data());
            setStats(prev => ({
                ...prev,
                activePCs: data.filter(s => s.status === 'online').length,
                lockedPCs: data.filter(s => s.isLocked).length,
                offlinePCs: data.filter(s => s.status !== 'online').length,
            }));
        });

        const qHistory = query(collection(db, 'history'), orderBy('timestamp', 'desc'), limit(15));
        const unsubHistory = onSnapshot(qHistory, (snap) => {
            setRecentActivities(snap.docs.map(d => ({ id: d.id, ...d.data() } as ActivityLog)));
        });

        return () => { unsubStudents(); unsubStations(); unsubHistory(); };
    }, []);

    const statCards: StatCardProps[] = useMemo(() => [
        { label: 'Total Enrolled', value: stats.totalStudents, icon: <Users size={22} />, color: 'var(--primary)' },
        { label: 'Currently Active', value: stats.activePCs, icon: <Activity size={22} />, color: 'var(--success)' },
        { label: 'Frozen Stations', value: stats.lockedPCs, icon: <ShieldAlert size={22} />, color: 'var(--warning)' },
        { label: 'Offline / Disconnected', value: stats.offlinePCs, icon: <Monitor size={22} />, color: 'var(--text-muted)' },
    ], [stats]);

    return (
        <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
            <div>
                <h1 style={{ marginBottom: '4px' }}>Laboratory Overview</h1>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Real-time monitoring of all stations and student activity.</p>
            </div>

            {/* Stat Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px' }}>
                {statCards.map((card) => <StatCard key={card.label} {...card} />)}
            </div>

            {/* Recent Activity */}
            <div className="glass-panel" style={{ padding: '28px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ margin: 0 }}>Recent Global Activity</h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--success)', fontSize: '0.8rem' }}>
                        <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: 'var(--success)', animation: 'pulse 2s infinite', display: 'inline-block' }} />
                        Live Sync Active
                    </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {recentActivities.length > 0
                        ? recentActivities.map(log => <ActivityRow key={log.id} log={log} />)
                        : (
                            <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>
                                <Activity size={48} style={{ margin: '0 auto 16px', opacity: 0.2, display: 'block' }} />
                                <p>No activity recorded yet.</p>
                            </div>
                        )
                    }
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
