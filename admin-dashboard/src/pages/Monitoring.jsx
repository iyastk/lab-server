import React, { useState, useEffect, useCallback, memo } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, doc, updateDoc, writeBatch, getDocs, query, where, deleteDoc } from 'firebase/firestore';
import { Monitor, Power, Lock, Unlock, Camera, Eye, Zap, Video, VideoOff, X, RotateCcw, Clock, Maximize2 } from 'lucide-react';

const StationCard = memo(({ station, isLive, approveTimeRequest, rejectTimeRequest, sendCommand, toggleLiveView, setLightbox, removeStation }) => (
    <div className="glass-panel" style={{
        padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px',
        ...(isLive ? { borderColor: 'rgba(239,68,68,0.5)', boxShadow: '0 0 0 2px rgba(239,68,68,0.2)' } : {})
    }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <div style={{
                    background: station.status === 'online' ? 'rgba(34,197,94,0.1)' : 'rgba(148,163,184,0.1)',
                    padding: '10px', borderRadius: '10px',
                    border: `1px solid ${station.status === 'online' ? 'var(--success)' : 'var(--text-muted)'}`
                }}>
                    <Monitor size={22} color={station.status === 'online' ? 'var(--success)' : 'var(--text-muted)'} />
                </div>
                <div>
                    <h3 style={{ margin: 0, fontSize: '1rem' }}>{station.pcName || station.id}</h3>
                    <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        {station.currentUser ? `👤 ${station.currentUser}` : 'Available'}
                    </p>
                </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {isLive && <span style={{ fontSize: '0.7rem', color: 'var(--danger)', fontWeight: 'bold', animation: 'livePulse 2s infinite' }}>● LIVE</span>}
                <span className={`status-indicator ${station.status === 'online' ? 'status-online' : 'status-offline'}`}></span>
            </div>
        </div>

        {/* Time Request Alert */}
        {station.timeRequest && (
            <div style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid var(--warning)', padding: '10px', borderRadius: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <Clock size={14} color="var(--warning)" />
                    <span style={{ fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--warning)' }}>Extra Time Requested</span>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={() => approveTimeRequest(station.id, station.currentUser, station.timeRequest)}
                        className="btn" style={{ flex: 1, padding: '5px', fontSize: '0.75rem', background: 'var(--success)', color: 'white' }}>
                        ✓ Approve 1h
                    </button>
                    <button onClick={() => rejectTimeRequest(station.id)}
                        className="btn" style={{ flex: 1, padding: '5px', fontSize: '0.75rem', background: 'rgba(239,68,68,0.1)', color: 'var(--danger)' }}>
                        ✗ Deny
                    </button>
                </div>
            </div>
        )}

        {/* Active App */}
        {station.currentApp && (
            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '8px 12px', borderRadius: '8px', fontSize: '0.85rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Active: </span>{station.currentApp}
            </div>
        )}

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            <button className="btn" style={{ flex: 1, background: 'rgba(255,255,255,0.05)', fontSize: '0.8rem', minWidth: '80px' }}
                onClick={() => sendCommand(station.id, station.isLocked ? 'unlock' : 'lock')}>
                {station.isLocked ? <><Unlock size={14} /> Unlock</> : <><Lock size={14} /> Freeze</>}
            </button>

            {/* Live View Toggle */}
            <button className="btn" title={isLive ? 'Stop Live View' : 'Start Live View (5s refresh)'}
                style={{ background: isLive ? 'rgba(239,68,68,0.15)' : 'rgba(59,130,246,0.1)', color: isLive ? 'var(--danger)' : 'var(--primary)' }}
                onClick={() => toggleLiveView(station.id)}>
                {isLive ? <VideoOff size={16} /> : <Video size={16} />}
            </button>

            {/* One-time Snapshot */}
            <button className="btn" title="Take Snapshot" style={{ background: 'rgba(59,130,246,0.1)', color: 'var(--primary)' }}
                onClick={() => sendCommand(station.id, 'screenshot')}>
                <Camera size={16} />
            </button>

            {/* Restart */}
            <button className="btn" title="Restart PC" style={{ background: 'rgba(245,158,11,0.1)', color: 'var(--warning)' }}
                onClick={() => { if (window.confirm(`Restart ${station.pcName || station.id}?`)) sendCommand(station.id, 'restart'); }}>
                <RotateCcw size={16} />
            </button>

            {/* Shutdown */}
            <button className="btn" title="Shutdown PC" style={{ background: 'rgba(239,68,68,0.1)', color: 'var(--danger)' }}
                onClick={() => { if (window.confirm(`Shutdown ${station.pcName || station.id}?`)) sendCommand(station.id, 'shutdown'); }}>
                <Power size={16} />
            </button>

            {/* Remove Station */}
            <button className="btn" title="Remove Station" style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-muted)' }}
                onClick={() => { if (window.confirm(`Remove ${station.pcName || station.id} from the dashboard entirely?`)) removeStation(station.id); }}>
                <Trash2 size={16} />
            </button>
        </div>

        {/* Screenshot Preview */}
        {station.lastScreenshot && (
            <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {isLive ? '🔴 Streaming' : '📷 Last Snapshot'}
                    </span>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                        {station.lastScreenshotTime?.toDate
                            ? new Date(station.lastScreenshotTime.toDate()).toLocaleTimeString()
                            : 'Just now'}
                    </span>
                </div>
                <div style={{ position: 'relative' }}>
                    <img
                        src={`data:image/jpeg;base64,${station.lastScreenshot}`}
                        alt="Screen"
                        style={{ width: '100%', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', cursor: 'zoom-in', display: 'block' }}
                        onClick={() => setLightbox({ pcName: station.pcName || station.id, src: station.lastScreenshot })}
                    />
                    <button
                        onClick={() => setLightbox({ pcName: station.pcName || station.id, src: station.lastScreenshot })}
                        style={{
                            position: 'absolute', bottom: '8px', right: '8px',
                            background: 'rgba(0,0,0,0.6)', border: 'none', borderRadius: '6px',
                            color: 'white', padding: '4px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem'
                        }}
                    >
                        <Maximize2 size={12} /> Fullscreen
                    </button>
                </div>
            </div>
        )}
    </div>
), (prev, next) => {
    return (
        prev.isLive === next.isLive &&
        prev.station.status === next.station.status &&
        prev.station.isLocked === next.station.isLocked &&
        prev.station.currentUser === next.station.currentUser &&
        prev.station.currentApp === next.station.currentApp &&
        prev.station.lastScreenshot === next.station.lastScreenshot &&
        prev.station.timeRequest === next.station.timeRequest
    );
});

const Monitoring = () => {
    const [stations, setStations] = useState([]);
    const [totalStudents, setTotalStudents] = useState(0);
    const [liveStations, setLiveStations] = useState(new Set()); // stations in live mode
    const [lightbox, setLightbox] = useState(null); // { pcName, src } for fullscreen view
    const [liveIntervals, setLiveIntervals] = useState({});

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
            // Clear all live intervals on unmount
            Object.values(liveIntervals).forEach(interval => clearInterval(interval));
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
            const snapshot = await getDocs(collection(db, 'stations'));
            snapshot.docs.forEach(stationDoc => {
                batch.update(stationDoc.ref, { pendingCommand: command, commandTimestamp: new Date() });
            });
            await batch.commit();
            alert(`Bulk command ${command} sent.`);
        } catch (err) {
            console.error("Global command error:", err);
        }
    };

    const toggleLiveView = (stationId) => {
        const isLive = liveStations.has(stationId);
        const newSet = new Set(liveStations);

        if (isLive) {
            // Stop live stream
            newSet.delete(stationId);
            sendCommand(stationId, 'LIVESTREAM_STOP');
            if (liveIntervals[stationId]) {
                clearInterval(liveIntervals[stationId]);
                const newIntervals = { ...liveIntervals };
                delete newIntervals[stationId];
                setLiveIntervals(newIntervals);
            }
        } else {
            // Start live stream: request screenshot every 5 seconds
            newSet.add(stationId);
            sendCommand(stationId, 'screenshot');
            const interval = setInterval(() => {
                sendCommand(stationId, 'screenshot');
            }, 5000);
            setLiveIntervals(prev => ({ ...prev, [stationId]: interval }));
        }
        setLiveStations(newSet);
    };

    const approveTimeRequest = async (stationId, studentId, requestType) => {
        const extraMinutes = requestType === 'PENDING_60MIN' ? 60 : 30;
        try {
            const studentSnap = await getDocs(query(collection(db, 'students'), where('studentId', '==', studentId)));
            if (!studentSnap.empty) {
                const studentDoc = studentSnap.docs[0];
                const currentDaily = parseInt(studentDoc.data().dailyRemainingTime || 0);
                const currentWeekly = parseInt(studentDoc.data().remainingTime || 0);
                await updateDoc(studentDoc.ref, {
                    dailyRemainingTime: currentDaily + (extraMinutes * 60),
                    remainingTime: currentWeekly + (extraMinutes * 60)
                });
            }
            await updateDoc(doc(db, 'stations', stationId), {
                timeRequest: "",
                pendingCommand: `NOTIFY|Extra ${extraMinutes}m granted!`
            });
            alert(`Approved ${extraMinutes}m for ${studentId}`);
        } catch (err) { console.error("Approval error:", err); }
    };

    const rejectTimeRequest = async (stationId) => {
        try {
            await updateDoc(doc(db, 'stations', stationId), {
                timeRequest: "",
                pendingCommand: "NOTIFY|Time request denied"
            });
        } catch (err) { }
    };

    return (
        <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
            {/* Lightbox Modal */}
            {lightbox && (
                <div
                    onClick={() => setLightbox(null)}
                    style={{
                        position: 'fixed', inset: 0, zIndex: 9999,
                        background: 'rgba(0,0,0,0.92)',
                        display: 'flex', flexDirection: 'column',
                        alignItems: 'center', justifyContent: 'center',
                        cursor: 'zoom-out'
                    }}
                >
                    <div style={{ position: 'absolute', top: '20px', right: '20px', display: 'flex', gap: '15px', alignItems: 'center' }}>
                        <span style={{ color: 'white', fontSize: '1rem', fontWeight: 'bold' }}>{lightbox.pcName}</span>
                        <button onClick={() => setLightbox(null)} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer' }}>
                            <X size={32} />
                        </button>
                    </div>
                    <img
                        src={`data:image/jpeg;base64,${lightbox.src}`}
                        alt="Full Screen"
                        style={{ maxWidth: '95vw', maxHeight: '90vh', borderRadius: '8px', objectFit: 'contain' }}
                        onClick={e => e.stopPropagation()}
                    />
                </div>
            )}

            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px' }}>
                <div>
                    <h1>Live Monitoring</h1>
                    <p style={{ color: 'var(--text-muted)' }}>{stations.length} stations · {stats.online} online</p>
                </div>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    <button className="btn btn-primary" style={{ background: 'var(--success)' }} onClick={() => handleAllCommand('unlock')}>
                        <Zap size={18} /> Open Lab
                    </button>
                    <button className="btn btn-primary" style={{ background: 'var(--warning)', color: '#000' }} onClick={() => handleAllCommand('restart')}>
                        <RotateCcw size={18} /> Restart All
                    </button>
                    <button className="btn btn-primary" style={{ background: 'var(--danger)' }} onClick={() => handleAllCommand('shutdown')}>
                        <Power size={18} /> Shutdown All
                    </button>
                    <button className="btn btn-primary" onClick={() => handleAllCommand('lock')}>
                        <Lock size={18} /> Freeze All
                    </button>
                </div>
            </div>

            {/* Stats Row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '15px' }}>
                {[
                    { label: 'Total Students', value: totalStudents, color: 'var(--primary)' },
                    { label: 'Online PCs', value: stats.online, color: 'var(--success)' },
                    { label: 'Frozen', value: stats.frozen, color: 'var(--warning)' },
                    { label: 'Offline', value: stats.offline, color: 'var(--text-muted)' },
                ].map(s => (
                    <div key={s.label} className="glass-panel" style={{ padding: '15px', textAlign: 'center', borderLeft: `3px solid ${s.color}` }}>
                        <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.75rem' }}>{s.label}</p>
                        <h2 style={{ margin: '5px 0 0', color: s.color }}>{s.value}</h2>
                    </div>
                ))}
            </div>

            {/* Station Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(310px, 1fr))', gap: '20px' }}>
                {stations.map(station => (
                    <StationCard
                        key={station.id}
                        station={station}
                        isLive={liveStations.has(station.id)}
                        approveTimeRequest={approveTimeRequest}
                        rejectTimeRequest={rejectTimeRequest}
                        sendCommand={sendCommand}
                        toggleLiveView={toggleLiveView}
                        setLightbox={setLightbox}
                        removeStation={removeStation}
                    />
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
