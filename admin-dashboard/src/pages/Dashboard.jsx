import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import { Users, Monitor, ShieldAlert, Activity, Youtube, Search, Globe, Cpu, Clock } from 'lucide-react';

const CATEGORY_COLORS = {
    'YouTube': { bg: 'rgba(239,68,68,0.12)', color: '#ef4444' },
    'Search': { bg: 'rgba(251,191,36,0.12)', color: '#fbbf24' },
    'Web Browsing': { bg: 'rgba(59,130,246,0.12)', color: '#60a5fa' },
    'General App': { bg: 'rgba(139,92,246,0.12)', color: '#a78bfa' },
    'VIOLATION': { bg: 'rgba(239,68,68,0.15)', color: '#ef4444' },
};

const getCatIcon = (activity) => {
    if (activity.startsWith('YouTube')) return <Youtube size={14} />;
    if (activity.startsWith('Search')) return <Search size={14} />;
    if (activity.startsWith('Web Browsing')) return <Globe size={14} />;
    if (activity.startsWith('VIOLATION')) return <ShieldAlert size={14} />;
    return <Cpu size={14} />;
};

const getCatName = (activity) => {
    if (activity.includes('|')) return activity.split('|')[0];
    return 'App';
};

const Dashboard = () => {
    const [stats, setStats] = useState({
        totalStudents: 0,
        activePCs: 0,
        lockedPCs: 0,
        offlinePCs: 0
    });
    const [recentActivities, setRecentActivities] = useState([]);

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
                offlinePCs: data.filter(s => s.status !== 'online').length
            }));
        });

        // Live Recent Activity
        const qHistory = query(collection(db, 'history'), orderBy('timestamp', 'desc'), limit(15));
        const unsubHistory = onSnapshot(qHistory, (snap) => {
            setRecentActivities(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        });

        return () => { unsubStudents(); unsubStations(); unsubHistory(); };
    }, []);

    const statCards = [
        { label: 'Total Enrolled', value: stats.totalStudents, icon: <Users />, color: 'var(--primary)' },
        { label: 'Currently Active', value: stats.activePCs, icon: <Activity />, color: 'var(--success)' },
        { label: 'Frozen Stations', value: stats.lockedPCs, icon: <ShieldAlert />, color: 'var(--warning)' },
        { label: 'Offline / Disconnected', value: stats.offlinePCs, icon: <Monitor />, color: 'var(--text-muted)' },
    ];

    const fmtTime = (ts) => {
        if (!ts) return '';
        const d = typeof ts === 'string' ? new Date(ts) : ts?.toDate?.();
        return d ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
    };

    return (
        <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
            <h1>Laboratory Overview</h1>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px' }}>
                {statCards.map((card, i) => (
                    <div key={i} className="glass-panel" style={{ padding: '25px', display: 'flex', alignItems: 'center', gap: '20px' }}>
                        <div style={{ background: `${card.color}20`, color: card.color, padding: '15px', borderRadius: '12px' }}>
                            {card.icon}
                        </div>
                        <div>
                            <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.9rem' }}>{card.label}</p>
                            <h2 style={{ margin: 0, fontSize: '1.8rem' }}>{card.value}</h2>
                        </div>
                    </div>
                ))}
            </div>

            <div className="glass-panel" style={{ padding: '30px', minHeight: '400px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ margin: 0 }}>Recent Global Activity</h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                        <Clock size={14} /> Live Sync Active
                    </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {recentActivities.map((log, i) => {
                        const cat = getCatName(log.activity);
                        const detail = log.activity.includes('|') ? log.activity.split('|')[1] : log.activity;
                        const cs = CATEGORY_COLORS[cat] || { bg: 'rgba(255,255,255,0.05)', color: 'var(--text-muted)' };

                        return (
                            <div key={log.id || i} style={{
                                display: 'flex', gap: '15px', alignItems: 'center',
                                padding: '12px 16px', background: 'rgba(255,255,255,0.02)',
                                borderRadius: '10px', border: '1px solid rgba(255,255,255,0.03)'
                            }}>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', minWidth: '55px' }}>
                                    {fmtTime(log.timestamp)}
                                </div>
                                <div style={{
                                    background: cs.bg, color: cs.color, padding: '4px 10px',
                                    borderRadius: '99px', fontSize: '0.7rem', display: 'flex',
                                    alignItems: 'center', gap: '6px', whiteSpace: 'nowrap'
                                }}>
                                    {getCatIcon(log.activity)} {cat}
                                </div>
                                <div style={{ flex: 1, fontSize: '0.9rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    <span style={{ color: 'var(--primary)', fontWeight: 'bold', marginRight: '8px' }}>{log.studentId}</span>
                                    <span style={{ color: 'var(--text-main)' }}>{detail}</span>
                                </div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.05)', padding: '2px 8px', borderRadius: '4px' }}>
                                    {log.pcName}
                                </div>
                            </div>
                        );
                    })}
                    {recentActivities.length === 0 && (
                        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>
                            <Activity size={48} style={{ margin: '0 auto 16px', opacity: 0.2 }} />
                            <p>No activity recorded yet.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
