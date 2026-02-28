import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, doc, updateDoc, writeBatch } from 'firebase/firestore';
import { Monitor, Power, Lock, Unlock, PlayCircle } from 'lucide-react';

const Monitoring = () => {
    const [stations, setStations] = useState([]);
    const [totalStudents, setTotalStudents] = useState(0);

    useEffect(() => {
        const unsubscribe = onSnapshot(collection(db, 'stations'), (snapshot) => {
            const stationList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setStations(stationList);
        });

        const studentsUnsubscribe = onSnapshot(collection(db, 'students'), (snapshot) => {
            setTotalStudents(snapshot.size);
        });

        return () => {
            unsubscribe();
            studentsUnsubscribe();
        };
    }, []);

    const stats = {
        total: stations.length,
        online: stations.filter(s => s.status === 'online').length,
        frozen: stations.filter(s => s.isLocked).length,
        offline: stations.filter(s => s.status !== 'online').length
    };

    const sendCommand = async (stationId, command) => {
        try {
            await updateDoc(doc(db, 'stations', stationId), {
                pendingCommand: command,
                commandTimestamp: new Date()
            });
        } catch (err) {
            console.error("Error sending command:", err);
        }
    };

    const handleAllCommand = async (command) => {
        if (!window.confirm(`Are you sure you want to ${command.toUpperCase()} all stations?`)) return;

        try {
            const batch = writeBatch(db);
            stations.forEach(station => {
                const ref = doc(db, 'stations', station.id);
                batch.update(ref, {
                    pendingCommand: command,
                    commandTimestamp: new Date()
                });
            });
            await batch.commit();
        } catch (err) {
            console.error("Global command error:", err);
        }
    };

    return (
        <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h1>Live Monitoring</h1>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <button className="btn btn-primary" style={{ background: 'var(--danger)' }} onClick={() => handleAllCommand('shutdown')}>
                        <Power size={18} /> Shutdown All
                    </button>
                    <button className="btn btn-primary" onClick={() => handleAllCommand('lock')}>
                        <Lock size={18} /> Freeze All
                    </button>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px' }}>
                <div className="glass-panel" style={{ padding: '20px', textAlign: 'center' }}>
                    <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.8rem' }}>Total Students</p>
                    <h2 style={{ margin: '5px 0 0' }}>{totalStudents}</h2>
                </div>
                <div className="glass-panel" style={{ padding: '20px', textAlign: 'center', borderLeft: '3px solid var(--success)' }}>
                    <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.8rem' }}>Online PCs</p>
                    <h2 style={{ margin: '5px 0 0', color: 'var(--success)' }}>{stats.online}</h2>
                </div>
                <div className="glass-panel" style={{ padding: '20px', textAlign: 'center', borderLeft: '3px solid var(--warning)' }}>
                    <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.8rem' }}>Frozen</p>
                    <h2 style={{ margin: '5px 0 0', color: 'var(--warning)' }}>{stats.frozen}</h2>
                </div>
                <div className="glass-panel" style={{ padding: '20px', textAlign: 'center' }}>
                    <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.8rem' }}>Offline</p>
                    <h2 style={{ margin: '5px 0 0', color: 'var(--text-muted)' }}>{stats.offline}</h2>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
                {stations.map(station => (
                    <div key={station.id} className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                                <div style={{
                                    background: station.status === 'online' ? 'rgba(34, 197, 94, 0.1)' : 'rgba(148, 163, 184, 0.1)',
                                    padding: '12px',
                                    borderRadius: '12px',
                                    border: `1px solid ${station.status === 'online' ? 'var(--success)' : 'var(--text-muted)'}`
                                }}>
                                    <Monitor size={24} color={station.status === 'online' ? 'var(--success)' : 'var(--text-muted)'} />
                                </div>
                                <div>
                                    <h3 style={{ margin: 0 }}>{station.pcName || station.id}</h3>
                                    <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                        {station.currentUser ? `User: ${station.currentUser}` : 'Available'}
                                    </p>
                                </div>
                            </div>
                            <span className={`status-indicator ${station.status === 'online' ? 'status-online' : 'status-offline'}`}></span>
                        </div>

                        {station.currentApp && (
                            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '10px', borderRadius: '8px', fontSize: '0.9rem' }}>
                                <span style={{ color: 'var(--text-muted)' }}>Active:</span> {station.currentApp}
                            </div>
                        )}

                        <div style={{ display: 'flex', gap: '8px', marginTop: 'auto' }}>
                            <button
                                className="btn"
                                style={{ flex: 1, background: 'rgba(255,255,255,0.05)', fontSize: '0.85rem' }}
                                onClick={() => sendCommand(station.id, station.isLocked ? 'unlock' : 'lock')}
                            >
                                {station.isLocked ? <Unlock size={16} /> : <Lock size={16} />}
                                {station.isLocked ? 'Unlock' : 'Freeze'}
                            </button>
                            <button
                                className="btn"
                                style={{ background: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)' }}
                                onClick={() => sendCommand(station.id, 'shutdown')}
                            >
                                <Power size={16} />
                            </button>
                        </div>
                    </div>
                ))}

                {stations.length === 0 && (
                    <div className="glass-panel" style={{ gridColumn: '1 / -1', padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>
                        No stations connected yet. Install the client on PCs to see them here.
                    </div>
                )}
            </div>
        </div>
    );
};

export default Monitoring;
