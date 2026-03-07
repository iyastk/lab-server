import React, { useState, useEffect } from 'react';
import { Clock, Calendar, Power, RotateCcw, Trash2, Plus, Bell, Shield } from 'lucide-react';
import { db } from '../firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

const DAYS_OF_WEEK = [
    { value: 0, label: 'Sun' },
    { value: 1, label: 'Mon' },
    { value: 2, label: 'Tue' },
    { value: 3, label: 'Wed' },
    { value: 4, label: 'Thu' },
    { value: 5, label: 'Fri' },
    { value: 6, label: 'Sat' },
];

interface Schedule {
    id: string;
    type: 'shutdown' | 'restart';
    time: string;
    days: string;
    enabled: boolean;
}

const Scheduling = () => {
    const [schedules, setSchedules] = useState<Schedule[]>([]);
    const [newType, setNewType] = useState('shutdown');
    const [newTime, setNewTime] = useState('22:00');
    const [newDays, setNewDays] = useState('1,2,3,4,5'); // Mon-Fri
    const [loading, setLoading] = useState(false);
    const [serverUnreachable, setServerUnreachable] = useState(false);
    const [blockUninstalls, setBlockUninstalls] = useState(true);
    const [localServerUrl, setLocalServerUrl] = useState<string>('http://localhost:5000');

    useEffect(() => {
        const init = async () => {
            await fetchSecuritySettings();
            await fetchServerUrl();
        };
        init();
    }, []);

    const fetchServerUrl = async () => {
        try {
            const settingsRef = doc(db, 'settings', 'network');
            const settingsDoc = await getDoc(settingsRef);
            if (settingsDoc.exists() && settingsDoc.data().serverAddress) {
                const url = settingsDoc.data().serverAddress;
                setLocalServerUrl(url);
                fetchSchedules(url);
            } else {
                fetchSchedules(localServerUrl); // fallback
            }
        } catch (err) {
            console.error("Error fetching network settings:", err);
            fetchSchedules(localServerUrl);
        }
    };

    const fetchSecuritySettings = async () => {
        try {
            const docRef = doc(db, 'settings', 'security');
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                setBlockUninstalls(docSnap.data().blockUninstalls !== false); // default true
            }
        } catch (e) {
            console.error(e);
        }
    };

    const toggleSecuritySetting = async () => {
        const newValue = !blockUninstalls;
        try {
            await setDoc(doc(db, 'settings', 'security'), { blockUninstalls: newValue }, { merge: true });
            setBlockUninstalls(newValue);
            alert(`Uninstall Protection is now ${newValue ? 'ON' : 'OFF'}`);
        } catch (e) {
            alert("Failed to update security settings");
        }
    };

    const fetchSchedules = async (url: string = localServerUrl) => {
        try {
            const resp = await fetch(`${url}/api/schedules`);
            if (resp.ok) {
                setSchedules(await resp.json());
                setServerUnreachable(false);
            }
        } catch (e) {
            setServerUnreachable(true);
        }
    };

    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!newDays) {
            alert("Please select at least one day.");
            return;
        }

        setLoading(true);
        try {
            const resp = await fetch(`${localServerUrl}/api/schedules`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type: newType, time: newTime, days: newDays })
            });
            if (resp.ok) {
                fetchSchedules();
                alert("Schedule added successfully.");
            }
        } catch (e) {
            alert("Local Admin Server unreachable.");
        } finally {
            setLoading(false);
        }
    };

    const handleDayToggle = (dayValue: number) => {
        let daysArray = newDays ? newDays.split(',').map(Number) : [];
        if (daysArray.includes(dayValue)) {
            daysArray = daysArray.filter(d => d !== dayValue);
        } else {
            daysArray.push(dayValue);
            daysArray.sort((a, b) => a - b);
        }
        setNewDays(daysArray.join(','));
    };

    const currentDaysArray = newDays ? newDays.split(',').map(Number) : [];


    const handleDelete = async (id: string) => {
        if (!window.confirm("Delete this schedule?")) return;
        try {
            const resp = await fetch(`${localServerUrl}/api/schedules/${id}`, { method: 'DELETE' });
            if (resp.ok) fetchSchedules(localServerUrl);
        } catch (e) {
            alert("Error deleting schedule.");
        }
    };

    const getDayLabels = (days: string) => {
        if (days === 'all' || !days) return 'Every Day';
        const labels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        return days.split(',').map(d => labels[parseInt(d)]).join(', ');
    };

    return (
        <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h1>Automated Lab Control</h1>
                    <p style={{ color: 'var(--text-muted)' }}>Configure automatic shutdown and restart times.</p>
                </div>
                {serverUnreachable && (
                    <div className="badge badge-danger">
                        Local Server Offline
                    </div>
                )}
            </div>

            <div className="glass-panel" style={{ padding: '30px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h3 style={{ marginTop: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <Shield size={20} color={blockUninstalls ? "var(--success)" : "var(--danger)"} />
                        Uninstall Protection
                    </h3>
                    <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                        When ON, actively prevents students from running uninstallers (msiexec, unins000) while logged in to their sessions.
                    </p>
                </div>
                <button
                    onClick={toggleSecuritySetting}
                    className={`btn ${blockUninstalls ? 'btn-danger' : 'btn-success'}`}
                    style={{ padding: '10px 20px' }}>
                    {blockUninstalls ? 'Disable Protection' : 'Enable Protection'}
                </button>
            </div>

            <div className="glass-panel" style={{ padding: '30px' }}>
                <h3 style={{ marginTop: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Plus size={20} color="var(--primary)" /> Add New Schedule
                </h3>
                <form onSubmit={handleAdd} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', alignItems: 'flex-end' }}>
                    <div>
                        <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem' }}>Action Type</label>
                        <select
                            value={newType}
                            onChange={(e) => setNewType(e.target.value)}
                            className="btn"
                            style={{ width: '100%', padding: '10px', background: 'rgba(255,255,255,0.05)', color: 'white', border: '1px solid var(--glass)' }}
                        >
                            <option value="shutdown">Shutdown All PCs</option>
                            <option value="restart">Restart All PCs</option>
                        </select>
                    </div>
                    <div>
                        <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem' }}>Time (24h)</label>
                        <input
                            type="time"
                            value={newTime}
                            onChange={(e) => setNewTime(e.target.value)}
                            className="btn"
                            style={{ width: '100%', padding: '10px', background: 'rgba(255,255,255,0.05)', color: 'white', border: '1px solid var(--glass)' }}
                        />
                    </div>
                    <div>
                        <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem' }}>Active Days</label>
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                            {DAYS_OF_WEEK.map(day => {
                                const isActive = currentDaysArray.includes(day.value);
                                return (
                                    <button
                                        key={day.value}
                                        type="button"
                                        onClick={() => handleDayToggle(day.value)}
                                        className={`btn ${isActive ? 'btn-primary' : ''}`}
                                        style={{
                                            padding: '10px 14px',
                                            minWidth: '40px',
                                            background: isActive ? 'var(--primary)' : 'rgba(255,255,255,0.05)',
                                            borderColor: isActive ? 'var(--primary)' : 'var(--glass)'
                                        }}
                                    >
                                        {day.label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                    <button type="submit" disabled={loading} className="btn btn-primary" style={{ padding: '12px' }}>
                        {loading ? 'Adding...' : 'Add Schedule'}
                    </button>
                </form>
            </div>

            <div className="glass-panel" style={{ padding: '0' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--glass)' }}>
                            <th style={{ padding: '20px' }}>Action</th>
                            <th style={{ padding: '20px' }}>Time</th>
                            <th style={{ padding: '20px' }}>Days</th>
                            <th style={{ padding: '20px' }}>Status</th>
                            <th style={{ padding: '20px' }}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {schedules.map(sched => (
                            <tr key={sched.id} style={{ borderBottom: '1px solid var(--glass)' }}>
                                <td style={{ padding: '20px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        {sched.type === 'shutdown' ? <Power size={18} color="var(--danger)" /> : <RotateCcw size={18} color="var(--success)" />}
                                        <span style={{ textTransform: 'capitalize' }}>{sched.type}</span>
                                    </div>
                                </td>
                                <td style={{ padding: '20px', fontWeight: 'bold' }}>{sched.time}</td>
                                <td style={{ padding: '20px', color: 'var(--text-muted)' }}>{getDayLabels(sched.days)}</td>
                                <td style={{ padding: '20px' }}>
                                    <span style={{ color: sched.enabled ? 'var(--success)' : 'var(--text-muted)' }}>
                                        {sched.enabled ? '● Active' : '○ Paused'}
                                    </span>
                                </td>
                                <td style={{ padding: '20px' }}>
                                    <button onClick={() => handleDelete(sched.id)} className="btn-icon" style={{ color: 'var(--danger)' }}>
                                        <Trash2 size={18} />
                                    </button>
                                </td>
                            </tr>
                        ))}
                        {schedules.length === 0 && (
                            <tr><td colSpan={5} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>No automation schedules active.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default Scheduling;
