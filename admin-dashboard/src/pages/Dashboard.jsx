import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot } from 'firebase/firestore';
import { Users, Monitor, ShieldAlert, Activity } from 'lucide-react';

const Dashboard = () => {
    const [stats, setStats] = useState({
        totalStudents: 0,
        activePCs: 0,
        lockedPCs: 0,
        offlinePCs: 0
    });

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

        return () => { unsubStudents(); unsubStations(); };
    }, []);

    const statCards = [
        { label: 'Total Enrolled', value: stats.totalStudents, icon: <Users />, color: 'var(--primary)' },
        { label: 'Currently Active', value: stats.activePCs, icon: <Activity />, color: 'var(--success)' },
        { label: 'Frozen Stations', value: stats.lockedPCs, icon: <ShieldAlert />, color: 'var(--warning)' },
        { label: 'Offline / Disconnected', value: stats.offlinePCs, icon: <Monitor />, color: 'var(--text-muted)' },
    ];

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

            <div className="glass-panel" style={{ padding: '30px', minHeight: '300px' }}>
                <h3>Recent Activity</h3>
                <p style={{ color: 'var(--text-muted)' }}>No recent security alerts or session starts recorded.</p>
            </div>
        </div>
    );
};

export default Dashboard;
