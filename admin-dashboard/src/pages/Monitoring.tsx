import React, { useState, useEffect, useCallback, useMemo, memo } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, doc, updateDoc, writeBatch, getDocs, query, where, deleteDoc, getDoc } from 'firebase/firestore';
import { Monitor, Power, Lock, Unlock, Camera, Eye, Zap, Video, VideoOff, X, RotateCcw, Clock, Maximize2, Trash2, Globe, GlobeLock, Megaphone, Send, FileUp, Shield, Settings, Moon, ChevronRight, ExternalLink, MousePointerClick, RefreshCw, Check } from 'lucide-react';
import { Station } from '../types';

interface StationCardProps {
    station: Station;
    isLive: boolean;
    isSelected: boolean;
    onSelect: (id: string) => void;
    isCommandPending: boolean;
    sendCommand: (stationId: string, command: string) => Promise<void>;
}

const StationCard = memo(({
    station, isLive, isSelected, onSelect, isCommandPending, sendCommand
}: StationCardProps) => {
    // Auto-request screenshot if missing and station is online
    useEffect(() => {
        if (station.status === 'online' && !station.lastScreenshot && !isCommandPending) {
            sendCommand(station.id, 'screenshot');
        }
    }, [station.id, station.status, station.lastScreenshot, isCommandPending, sendCommand]);

    return (
        <div
            onClick={() => onSelect(station.id)}
            className="glass-panel"
            style={{
                padding: '10px', display: 'flex', flexDirection: 'column', gap: '6px',
                cursor: 'pointer', transition: 'all 0.2s',
                border: isSelected ? '2px solid var(--primary)' : '1px solid var(--glass)',
                boxShadow: isSelected ? '0 0 15px rgba(79,70,229,0.3)' : 'none',
                background: isSelected ? 'rgba(79,70,229,0.08)' : 'rgba(255,255,255,0.02)',
                transform: isSelected ? 'scale(1.02)' : 'scale(1)',
                position: 'relative',
                zIndex: isSelected ? 10 : 1,
                minHeight: '180px',
                ...(isLive ? { borderColor: 'rgba(239,68,68,0.5)', boxShadow: '0 0 10px rgba(239,68,68,0.2)' } : {})
            }}
        >
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', overflow: 'hidden' }}>
                    <Monitor size={14} color={station.status === 'online' ? 'var(--success)' : 'var(--text-muted)'} />
                    <div style={{ overflow: 'hidden' }}>
                        <h3 style={{ margin: 0, fontSize: '0.8rem', whiteSpace: 'nowrap', textOverflow: 'ellipsis', fontWeight: isSelected ? 'bold' : 'normal' }}>{station.pcName || station.id}</h3>
                    </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    {isLive && <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--danger)', animation: 'pulse 1s infinite' }} />}
                    <span className={`status-indicator ${station.status === 'online' ? 'status-online' : 'status-offline'}`} style={{ width: '8px', height: '8px' }}></span>
                </div>
            </div>

            {/* Screenshot Preview */}
            <div style={{
                flex: 1, background: '#000', borderRadius: '6px', overflow: 'hidden',
                border: '1px solid rgba(255,255,255,0.05)', position: 'relative',
                display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
                {station.lastScreenshot ? (
                    <img
                        src={`data:image/jpeg;base64,${station.lastScreenshot}`}
                        alt="Screen"
                        style={{ width: '100%', height: '100%', objectFit: 'contain', opacity: station.status === 'online' ? 1 : 0.4 }}
                    />
                ) : (
                    <div style={{ textAlign: 'center', opacity: 0.2 }}>
                        <Monitor size={32} />
                        {station.status === 'online' && <div style={{ fontSize: '0.6rem', marginTop: '4px' }}>Requesting...</div>}
                    </div>
                )}

                {/* Overlay Info */}
                <div style={{
                    position: 'absolute', bottom: 0, left: 0, right: 0,
                    padding: '6px 8px', background: 'linear-gradient(transparent, rgba(0,0,0,0.8))',
                    fontSize: '0.65rem', color: 'white', display: 'flex', justifyContent: 'space-between',
                    alignItems: 'center'
                }}>
                    <span style={{ maxWidth: '70%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {station.currentUser || 'Available'}
                    </span>
                    {station.isLocked && <Lock size={10} color="var(--warning)" />}
                </div>
            </div>

            {/* Time Request Badge */}
            {station.timeRequest && (
                <div style={{
                    position: 'absolute', top: '-4px', right: '-4px',
                    background: 'var(--warning)', color: '#000',
                    padding: '1px 5px', borderRadius: '4px', fontSize: '0.6rem', fontWeight: 'bold',
                    boxShadow: '0 2px 5px rgba(0,0,0,0.2)', zIndex: 20
                }}>
                    TIME
                </div>
            )}
        </div>
    );
}, (prev, next) => {
    return (
        prev.isSelected === next.isSelected &&
        prev.isLive === next.isLive &&
        prev.station.status === next.station.status &&
        prev.station.isLocked === next.station.isLocked &&
        prev.station.currentUser === next.station.currentUser &&
        prev.station.lastScreenshot === next.station.lastScreenshot &&
        prev.station.timeRequest === next.station.timeRequest
    );
});

interface CommandSidebarProps {
    station?: Station;
    isLive: boolean;
    onClose: () => void;
    sendCommand: (stationId: string, command: string) => Promise<void>;
    toggleLiveView: (stationId: string) => void;
    setLightbox: (lightbox: any) => void;
    removeStation: (stationId: string) => Promise<void>;
    sendAnnouncement: (stationId?: string) => Promise<void>;
    handleFileTransfer: (stationId?: string) => Promise<void>;
    wakeStation: (macAddress: string) => Promise<void>;
    approveTimeRequest: (stationId: string, studentDocId: string, requestType: string) => Promise<void>;
    rejectTimeRequest: (stationId: string) => Promise<void>;
}

const CommandSidebar = memo(({
    station, isLive, onClose, sendCommand, toggleLiveView, setLightbox,
    removeStation, sendAnnouncement, handleFileTransfer, wakeStation,
    approveTimeRequest, rejectTimeRequest
}: CommandSidebarProps) => {
    if (!station) return (
        <div className="glass-panel" style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', borderLeft: '2px solid var(--glass)' }}>
            <div style={{ textAlign: 'center', opacity: 0.5 }}>
                <Monitor size={48} style={{ margin: '0 auto 16px' }} />
                <p>Select a station to manage</p>
            </div>
        </div>
    );

    return (
        <div className="glass-panel animate-slide-in-right" style={{
            height: '100%', display: 'flex', flexDirection: 'column', gap: '20px',
            padding: '24px', borderLeft: '2px solid var(--primary)',
            background: 'rgba(15, 23, 42, 0.4)',
            overflowY: 'auto'
        }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                <div>
                    <h2 style={{ margin: 0, fontSize: '1.2rem' }}>{station.pcName || station.id}</h2>
                    <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                        Station Controls
                    </p>
                </div>
                <button onClick={onClose} className="btn-icon" style={{ background: 'rgba(255,255,255,0.05)' }}>
                    <X size={20} />
                </button>
            </div>

            {/* Status & User */}
            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '16px', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                    <div style={{
                        background: station.status === 'online' ? 'rgba(34,197,94,0.1)' : 'rgba(148,163,184,0.1)',
                        padding: '12px', borderRadius: '10px'
                    }}>
                        <Monitor size={24} color={station.status === 'online' ? 'var(--success)' : 'var(--text-muted)'} />
                    </div>
                    <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '0.9rem', fontWeight: 'bold' }}>{station.currentUser || 'No User'}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '5px' }}>
                            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: station.status === 'online' ? 'var(--success)' : 'var(--text-muted)' }} />
                            {station.status === 'online' ? 'Connected' : 'Disconnected'}
                        </div>
                    </div>
                </div>

                <div style={{
                    borderTop: '1px solid rgba(255,255,255,0.05)',
                    paddingTop: '12px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px'
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Command Status</span>
                        {station.pendingCommand ? (
                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', color: 'var(--warning)', fontWeight: 'bold' }}>
                                <RefreshCw size={12} className="animate-spin" /> Delivering...
                            </span>
                        ) : (
                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', color: 'var(--success)', fontWeight: 'bold' }}>
                                <Check size={12} /> Ready
                            </span>
                        )}
                    </div>
                    {station.pendingCommand && (
                        <div style={{ fontSize: '0.75rem', padding: '6px 10px', background: 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: '6px', color: 'var(--warning)' }}>
                            Command: <strong>{station.pendingCommand}</strong>
                        </div>
                    )}
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                        Last Active: {station.lastSeen ? (station.lastSeen.toDate ? station.lastSeen.toDate().toLocaleTimeString() : new Date(station.lastSeen.seconds * 1000).toLocaleTimeString()) : (station.lastScreenshotTime ? new Date(station.lastScreenshotTime.seconds * 1000).toLocaleTimeString() : 'Unknown')}
                    </div>
                </div>
            </div>

            {/* Time Request Alert */}
            {station.timeRequest && (
                <div style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid var(--warning)', padding: '12px', borderRadius: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                        <Clock size={16} color="var(--warning)" />
                        <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--warning)' }}>Extra Time Requested</span>
                    </div>
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <button onClick={() => approveTimeRequest(station.id, station.currentUser!, station.timeRequest!)}
                            className="btn" style={{ flex: 1, padding: '8px', background: 'var(--success)', color: 'white' }}>
                            Approve
                        </button>
                        <button onClick={() => rejectTimeRequest(station.id)}
                            className="btn" style={{ flex: 1, padding: '8px', background: 'rgba(239,68,68,0.1)', color: 'var(--danger)' }}>
                            Deny
                        </button>
                    </div>
                </div>
            )}

            {/* Action Groups */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '25px', overflowY: 'auto', paddingRight: '5px' }}>

                {/* 1. Core Controls */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Security & Visibility</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                        <button
                            className="btn"
                            style={{ background: station.isLocked ? 'rgba(34,197,94,0.1)' : 'rgba(79,70,229,0.1)', color: station.isLocked ? 'var(--success)' : 'var(--primary)' }}
                            onClick={() => sendCommand(station.id, station.isLocked ? 'unlock' : 'lock')}
                        >
                            {station.isLocked ? <><Unlock size={16} /> Unfreeze</> : <><Lock size={16} /> Freeze UI</>}
                        </button>
                        <button
                            className="btn"
                            style={{ background: isLive ? 'rgba(239,68,68,0.1)' : 'rgba(59,130,246,0.1)', color: isLive ? 'var(--danger)' : 'var(--primary)' }}
                            onClick={() => toggleLiveView(station.id)}
                        >
                            {isLive ? <><VideoOff size={16} /> Stop Live</> : <><Video size={16} /> Live View</>}
                        </button>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                        <button className="btn" style={{ background: 'rgba(59,130,246,0.1)', color: 'var(--primary)' }}
                            onClick={() => sendCommand(station.id, 'screenshot')}>
                            <Camera size={16} /> Snapshot
                        </button>
                        <button className="btn"
                            style={{ background: station.isInternetBlocked ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)', color: station.isInternetBlocked ? 'var(--success)' : 'var(--danger)' }}
                            onClick={() => sendCommand(station.id, station.isInternetBlocked ? 'INTERNET_ALLOW' : 'INTERNET_BLOCK')}>
                            {station.isInternetBlocked ? <><Globe size={16} /> Allow Net</> : <><GlobeLock size={16} /> Block Net</>}
                        </button>
                    </div>
                </div>

                {/* 2. Power Controls */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Power Management</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                        <button className="btn" title="Restart" style={{ background: 'rgba(245,158,11,0.1)', color: 'var(--warning)' }}
                            onClick={() => { if (window.confirm(`Restart ${station.pcName || station.id}?`)) sendCommand(station.id, 'restart'); }}>
                            <RotateCcw size={16} />
                        </button>
                        <button className="btn" title="Shutdown" style={{ background: 'rgba(239,68,68,0.1)', color: 'var(--danger)' }}
                            onClick={() => { if (window.confirm(`Shutdown ${station.pcName || station.id}?`)) sendCommand(station.id, 'shutdown'); }}>
                            <Power size={16} />
                        </button>
                        <button className="btn" title="Sleep" style={{ background: 'rgba(139,92,246,0.1)', color: '#a78bfa' }}
                            onClick={() => { if (window.confirm(`Put ${station.pcName || station.id} to sleep?`)) sendCommand(station.id, 'sleep'); }}>
                            <Moon size={16} />
                        </button>
                    </div>
                    {station.status !== 'online' && station.macAddress && (
                        <button className="btn" style={{ background: 'rgba(34,197,94,0.1)', color: 'var(--success)', width: '100%' }}
                            onClick={() => wakeStation(station.macAddress!)}>
                            <Zap size={16} /> Wake Computer (WoL)
                        </button>
                    )}
                </div>

                {/* 3. Utilities */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Messaging & Tools</div>
                    <button className="btn" style={{ background: 'rgba(59,130,246,0.1)', color: 'var(--primary)', justifyContent: 'start' }}
                        onClick={() => sendAnnouncement(station.id)}>
                        <Megaphone size={16} /> Send Announcement
                    </button>
                    <button className="btn" style={{ background: 'rgba(34,197,94,0.1)', color: 'var(--success)', justifyContent: 'start' }}
                        onClick={() => handleFileTransfer(station.id)}>
                        <FileUp size={16} /> Transfer File
                    </button>
                </div>

                {/* Information */}
                {station.lastScreenshot && (
                    <div style={{ marginTop: 'auto' }}>
                        <div style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>Visual Preview</div>
                        <div style={{ position: 'relative', cursor: 'pointer' }} onClick={() => setLightbox({ pcName: station.pcName || station.id, src: station.lastScreenshot, id: station.id })}>
                            <img
                                src={`data:image/jpeg;base64,${station.lastScreenshot}`}
                                alt="Preview"
                                style={{ width: '100%', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)' }}
                            />
                            <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.3)', opacity: 0, transition: 'opacity 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '8px' }} onMouseEnter={e => e.currentTarget.style.opacity = '1'} onMouseLeave={e => e.currentTarget.style.opacity = '0'}>
                                <Maximize2 size={24} color="white" />
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Footer Actions */}
            <div style={{ marginTop: 'auto', paddingTop: '20px', borderTop: '1px solid var(--glass)' }}>
                <button className="btn" style={{ width: '100%', background: 'rgba(255,255,255,0.05)', color: 'var(--text-muted)', fontSize: '0.8rem' }}
                    onClick={() => { if (window.confirm(`Remove ${station.pcName || station.id}?`)) removeStation(station.id); }}>
                    <Trash2 size={14} /> Remove Station from Lab
                </button>
            </div>
        </div>
    );
});

const Monitoring = () => {
    const [stations, setStations] = useState<Station[]>([]);
    const [totalStudents, setTotalStudents] = useState(0);
    const [liveStations, setLiveStations] = useState<Set<string>>(new Set());
    const [lightbox, setLightbox] = useState<{ pcName: string, src: string, id: string } | null>(null);
    const [localServerIp, setLocalServerIp] = useState(window.location.hostname === 'localhost' ? 'localhost' : '');
    const [isUploading, setIsUploading] = useState(false);
    const [securitySettings, setSecuritySettings] = useState({ bannedKeywords: '', blockUninstalls: true });
    const [showSecurityModal, setShowSecurityModal] = useState(false);
    const [isGridView, setIsGridView] = useState(true);
    const [selectedStationId, setSelectedStationId] = useState<string | null>(null);
    const [showGlobalActions, setShowGlobalActions] = useState(false);

    useEffect(() => {
        const unsubscribe = onSnapshot(collection(db, 'stations'), (snapshot) => {
            const stationList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Station));
            setStations(stationList);
        });

        // Fetch security settings
        getDoc(doc(db, 'settings', 'global')).then(snap => {
            if (snap.exists()) {
                const data = snap.data() as { bannedKeywords: string; blockUninstalls: boolean };
                setSecuritySettings(data);
            }
        });

        const studentsUnsubscribe = onSnapshot(collection(db, 'students'), (snapshot) => {
            setTotalStudents(snapshot.size);
        });

        return () => {
            unsubscribe();
            studentsUnsubscribe();
        };
    }, []);

    const stats = useMemo(() => ({
        total: stations.length,
        online: stations.filter(s => s.status === 'online').length,
        frozen: stations.filter(s => s.isLocked).length,
        offline: stations.filter(s => s.status !== 'online').length,
    }), [stations]);

    const [isCommandPending, setIsCommandPending] = useState(false);

    const sendCommand = useCallback(async (stationId: string, command: string) => {
        if (isCommandPending) return;
        setIsCommandPending(true);
        try {
            await updateDoc(doc(db, 'stations', stationId), {
                pendingCommand: command,
                commandTimestamp: new Date()
            });
        } catch (err) {
            console.error("Error sending command:", err);
        } finally {
            setTimeout(() => setIsCommandPending(false), 1000);
        }
    }, [isCommandPending]);

    const removeStation = useCallback(async (stationId: string) => {
        try {
            await deleteDoc(doc(db, 'stations', stationId));
        } catch (err) {
            console.error("Error removing station:", err);
        }
    }, []);

    const sendAnnouncement = useCallback(async (stationId?: string) => {
        const msg = window.prompt("Enter announcement message:");
        if (!msg?.trim()) return;

        // Use lowercase prefix — client lowercases before switch matching
        if (stationId) {
            await sendCommand(stationId, `announcement|${msg}`);
        } else {
            const batch = writeBatch(db);
            stations.forEach(s => {
                batch.update(doc(db, 'stations', s.id), { pendingCommand: `announcement|${msg}`, commandTimestamp: new Date() });
            });
            await batch.commit();
            alert(`📢 Announcement sent to ${stations.length} station(s).`);
            return;
        }
        alert("📢 Announcement sent!");
    }, [sendCommand, stations]);

    const handleFileTransfer = useCallback(async (stationId?: string) => {
        if (!localServerIp) {
            const ip = window.prompt("Enter Local Server IP (e.g., 192.168.1.5):", "localhost");
            if (!ip) return;
            setLocalServerIp(ip);
        }

        const input = document.createElement('input');
        input.type = 'file';
        input.onchange = async (e: Event) => {
            const target = e.target as HTMLInputElement;
            const file = target?.files?.[0];
            if (!file) return;

            setIsUploading(true);
            try {
                const formData = new FormData();
                formData.append('file', file);

                const response = await fetch(`http://${localServerIp}:5000/api/files/upload`, {
                    method: 'POST',
                    body: formData
                });

                const data = await response.json();
                if (data.success) {
                    if (stationId) {
                        await sendCommand(stationId, `FILE_TRANSFER|${data.url}|${data.fileName}`);
                    } else {
                        const batch = writeBatch(db);
                        stations.forEach(s => {
                            batch.update(doc(db, 'stations', s.id), { pendingCommand: `FILE_TRANSFER|${data.url}|${data.fileName}`, commandTimestamp: new Date() });
                        });
                        await batch.commit();
                    }
                    alert("File distributed successfully!");
                }
            } catch (err) {
                console.error("Upload failed:", err);
                alert("Failed to upload to local server. Check IP and Firewall.");
            } finally {
                setIsUploading(false);
            }
        };
        input.click();
    }, [localServerIp, sendCommand, stations]);

    const wakeStation = useCallback(async (macAddress: string) => {
        if (!localServerIp) {
            const ip = window.prompt("Enter Local Server IP to send Wake packet:", "localhost");
            if (!ip) return;
            setLocalServerIp(ip);
        }

        try {
            const response = await fetch(`http://${localServerIp}:5000/api/wake`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ macAddress })
            });
            const data = await response.json();
            if (data.success) {
                alert("Wake signal sent successfully!");
            } else {
                alert("Failed to wake: " + data.error);
            }
        } catch (err) {
            console.error("Wake failed:", err);
            alert("Local Server unreachable. Check IP and firewall.");
        }
    }, [localServerIp]);

    const updateSecuritySettings = async () => {
        try {
            await updateDoc(doc(db, 'settings', 'global'), securitySettings);
            setShowSecurityModal(false);
            alert("Security settings updated!");
        } catch (err) {
            console.error("Update failed:", err);
        }
    };

    const handleAllCommand = async (command: string) => {
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

    const toggleLiveView = useCallback((stationId: string) => {
        setLiveStations(prev => {
            const newSet = new Set(prev);
            if (newSet.has(stationId)) {
                newSet.delete(stationId);
                sendCommand(stationId, 'LIVESTREAM_STOP');
            } else {
                newSet.add(stationId);
                sendCommand(stationId, 'LIVESTREAM_START');
            }
            return newSet;
        });
    }, [sendCommand]);

    const approveTimeRequest = useCallback(async (stationId: string, studentDocId: string, requestType: string) => {
        const extraMinutes = requestType === 'PENDING_60MIN' ? 60 : 30;
        try {
            // studentDocId is the document ID in Firestore
            const studentRef = doc(db, 'students', studentDocId);
            const snap = await getDoc(studentRef);

            if (snap.exists()) {
                const data = snap.data();
                const currentDaily = parseInt(data.dailyRemainingTime || 0);
                const currentWeekly = parseInt(data.remainingTime || 0);
                await updateDoc(studentRef, {
                    dailyRemainingTime: currentDaily + (extraMinutes * 60),
                    remainingTime: currentWeekly + (extraMinutes * 60)
                });
            } else {
                // Fallback: search by studentId field just in case
                const q = query(collection(db, 'students'), where('studentId', '==', studentDocId));
                const sSnap = await getDocs(q);
                if (!sSnap.empty) {
                    const sDoc = sSnap.docs[0];
                    const data = sDoc.data();
                    await updateDoc(sDoc.ref, {
                        dailyRemainingTime: parseInt(data.dailyRemainingTime || 0) + (extraMinutes * 60),
                        remainingTime: parseInt(data.remainingTime || 0) + (extraMinutes * 60)
                    });
                }
            }

            await updateDoc(doc(db, 'stations', stationId), {
                timeRequest: "",
                pendingCommand: `NOTIFY|Extra ${extraMinutes}m granted!`
            });
            alert(`Approved ${extraMinutes}m extension.`);
        } catch (err) { console.error("Approval error:", err); }
    }, []);

    const rejectTimeRequest = useCallback(async (stationId: string) => {
        try {
            await updateDoc(doc(db, 'stations', stationId), {
                timeRequest: "",
                pendingCommand: "NOTIFY|Time request denied"
            });
        } catch (err) { }
    }, []);

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
                        style={{ maxWidth: '95vw', maxHeight: '90vh', borderRadius: '8px', objectFit: 'contain', cursor: 'crosshair' }}
                        onClick={(e: React.MouseEvent<HTMLImageElement>) => {
                            const rect = (e.target as HTMLImageElement).getBoundingClientRect();
                            const x = Math.round(((e.clientX - rect.left) / rect.width) * 1000);
                            const y = Math.round(((e.clientY - rect.top) / rect.height) * 1000);
                            sendCommand(lightbox!.id, `MOUSE_CLICK|${x}|${y}`);
                        }}
                    />
                </div>
            )}

            {/* Header - Compact */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '15px' }}>
                <div>
                    <h1 style={{ fontSize: '1.5rem', marginBottom: '4px' }}>Live Monitoring</h1>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{stations.length} stations · {stats.online} online</p>
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                    <button className="btn" style={{ background: 'rgba(255,255,255,0.05)' }} onClick={() => setShowGlobalActions(!showGlobalActions)}>
                        <Settings size={18} /> {showGlobalActions ? 'Hide Global Tools' : 'Global Lab Tools'}
                    </button>
                    <button className="btn" style={{ background: 'rgba(255,255,255,0.05)' }} onClick={() => setShowSecurityModal(true)}>
                        <Shield size={18} /> Security
                    </button>
                    <button className="btn" style={{ background: 'rgba(255,255,255,0.05)' }} onClick={() => setIsGridView(!isGridView)}>
                        {isGridView ? <Monitor size={18} /> : <Zap size={18} />}
                    </button>
                </div>
            </div>

            {/* Global Actions - Collapsible */}
            {showGlobalActions && (
                <div className="glass-panel animate-fade-in" style={{ padding: '15px', display: 'flex', gap: '8px', flexWrap: 'wrap', background: 'rgba(255,255,255,0.02)' }}>
                    <button className="btn btn-sm" style={{ background: 'var(--success)' }} onClick={() => handleAllCommand('unlock')}>
                        <Zap size={14} /> Open Lab
                    </button>
                    <button className="btn btn-sm" style={{ background: 'var(--warning)', color: '#000' }} onClick={() => handleAllCommand('restart')}>
                        <RotateCcw size={14} /> Restart All
                    </button>
                    <button className="btn btn-sm" style={{ background: 'var(--danger)' }} onClick={() => handleAllCommand('shutdown')}>
                        <Power size={14} /> Shutdown All
                    </button>
                    <button className="btn btn-sm" onClick={() => handleAllCommand('lock')}>
                        <Lock size={14} /> Freeze All
                    </button>
                    <button className="btn btn-sm" style={{ background: 'var(--danger)' }} onClick={() => handleAllCommand('internet_block')}>
                        <GlobeLock size={14} /> Block Net
                    </button>
                    <button className="btn btn-sm" style={{ background: 'var(--success)' }} onClick={() => handleAllCommand('internet_allow')}>
                        <Globe size={14} /> Allow Net
                    </button>
                    <button className="btn btn-sm" style={{ background: 'var(--primary)' }} onClick={() => sendAnnouncement(undefined)}>
                        <Megaphone size={14} /> Broadcast
                    </button>
                    <button className="btn btn-sm" style={{ background: 'var(--success)' }} onClick={() => handleFileTransfer(undefined)} disabled={isUploading}>
                        <FileUp size={14} /> {isUploading ? 'Uploading...' : 'Send File'}
                    </button>
                </div>
            )}

            {/* Stats Row - Smaller */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px' }}>
                {[
                    { label: 'Total Students', value: totalStudents, color: 'var(--primary)' },
                    { label: 'Online PCs', value: stats.online, color: 'var(--success)' },
                    { label: 'Frozen', value: stats.frozen, color: 'var(--warning)' },
                    { label: 'Offline', value: stats.offline, color: 'var(--text-muted)' },
                ].map(s => (
                    <div key={s.label} className="glass-panel" style={{ padding: '10px', textAlign: 'center', borderLeft: `3px solid ${s.color}` }}>
                        <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.7rem' }}>{s.label}</p>
                        <h3 style={{ margin: '2px 0 0', color: s.color, fontSize: '1.2rem' }}>{s.value}</h3>
                    </div>
                ))}
            </div>

            {/* Stations Grid Area */}
            <div style={{ display: 'flex', gap: '20px', flex: 1, minHeight: 0 }}>
                <div style={{ flex: 1, overflowY: 'auto', paddingRight: '10px' }} className={isGridView ? "stations-grid" : "stations-list"}>
                    {stations.map(station => (
                        <StationCard
                            key={station.id}
                            station={station}
                            isLive={liveStations.has(station.id)}
                            isSelected={selectedStationId === station.id}
                            onSelect={setSelectedStationId}
                            isCommandPending={isCommandPending}
                            sendCommand={sendCommand}
                        />
                    ))}
                </div>

                {/* Command Sidebar */}
                {selectedStationId && (
                    <div style={{ width: '320px', flexShrink: 0 }} className="animate-slide-in-right">
                        <CommandSidebar
                            station={stations.find(s => s.id === selectedStationId)}
                            isLive={liveStations.has(selectedStationId)}
                            onClose={() => setSelectedStationId(null)}
                            sendCommand={sendCommand}
                            toggleLiveView={toggleLiveView}
                            setLightbox={setLightbox}
                            removeStation={removeStation}
                            sendAnnouncement={sendAnnouncement}
                            handleFileTransfer={handleFileTransfer}
                            wakeStation={wakeStation}
                            approveTimeRequest={approveTimeRequest}
                            rejectTimeRequest={rejectTimeRequest}
                        />
                    </div>
                )}
            </div>

            {/* Security Settings Modal */}
            {showSecurityModal && (
                <div className="modal-overlay">
                    <div className="glass-panel modal-content" style={{ maxWidth: '400px', width: '90%' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
                            <h3 style={{ margin: 0 }}>Security Settings</h3>
                            <button className="btn-icon" onClick={() => setShowSecurityModal(false)}><X /></button>
                        </div>

                        <div style={{ marginBottom: '15px' }}>
                            <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                                Banned Keywords (comma separated)
                            </label>
                            <input
                                type="text"
                                className="login-input"
                                value={securitySettings.bannedKeywords}
                                onChange={(e) => setSecuritySettings({ ...securitySettings, bannedKeywords: e.target.value })}
                                placeholder="e.g. YouTube, Games, Social"
                                style={{ background: 'rgba(0,0,0,0.2)', marginBottom: '5px' }}
                            />
                            <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                If these words appear in a window title, the PC will be locked.
                            </p>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '25px' }}>
                            <input
                                type="checkbox"
                                checked={securitySettings.blockUninstalls}
                                onChange={(e) => setSecuritySettings({ ...securitySettings, blockUninstalls: e.target.checked })}
                                id="blockUninstalls"
                            />
                            <label htmlFor="blockUninstalls" style={{ fontSize: '0.9rem' }}>Block uninstallation attempts</label>
                        </div>

                        <button className="btn btn-primary" style={{ width: '100%' }} onClick={updateSecuritySettings}>
                            Save Settings
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Monitoring;
