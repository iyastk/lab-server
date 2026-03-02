import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import {
    collection, query, orderBy, limit, onSnapshot, getDocs,
    writeBatch, where, doc
} from 'firebase/firestore';
import {
    User, Clock, Monitor, Activity, Database, ChevronRight,
    Calendar, Layers, Search, Youtube, Globe, Cpu, X
} from 'lucide-react';

const CATEGORY_COLORS = {
    'YouTube': { bg: 'rgba(239,68,68,0.12)', color: '#ef4444' },
    'Search': { bg: 'rgba(251,191,36,0.12)', color: '#fbbf24' },
    'Web Browsing': { bg: 'rgba(59,130,246,0.12)', color: '#60a5fa' },
    'General App': { bg: 'rgba(139,92,246,0.12)', color: '#a78bfa' },
    'App': { bg: 'rgba(34,197,94,0.12)', color: '#4ade80' },
};

const catStyle = (cat) => CATEGORY_COLORS[cat] || { bg: 'rgba(255,255,255,0.05)', color: 'var(--text-muted)' };
const catIcon = (cat) => {
    if (cat === 'YouTube') return <Youtube size={12} />;
    if (cat === 'Search') return <Search size={12} />;
    if (cat === 'Web Browsing') return <Globe size={12} />;
    return <Cpu size={12} />;
};

const fmtDuration = (s) => {
    if (!s) return '—';
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
};

const fmtTime = (ts) => {
    if (!ts) return '—';
    const d = typeof ts === 'string' ? new Date(ts) : ts?.toDate?.();
    return d ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—';
};

const fmtDate = (ts) => {
    if (!ts) return '—';
    const d = typeof ts === 'string' ? new Date(ts) : ts?.toDate?.();
    return d ? d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' }) : '—';
};

// ── Helpers ──────────────────────────────────────────────────────────────────
const LOCAL_SERVER_URL = 'http://localhost:5000';

/** Group flat activity logs into sessions (gap > 30 min = new session) */
function groupIntoSessions(logs) {
    if (!logs.length) return [];
    const sorted = [...logs].sort((a, b) => {
        const ta = typeof a.timestamp === 'string' ? new Date(a.timestamp) : a.timestamp?.toDate?.();
        const tb = typeof b.timestamp === 'string' ? new Date(b.timestamp) : b.timestamp?.toDate?.();
        return (ta || 0) - (tb || 0);
    });

    const sessions = [];
    let current = { logs: [sorted[0]], start: sorted[0].timestamp, end: sorted[0].timestamp };

    for (let i = 1; i < sorted.length; i++) {
        const prev = typeof sorted[i - 1].timestamp === 'string' ? new Date(sorted[i - 1].timestamp) : sorted[i - 1].timestamp?.toDate?.();
        const curr = typeof sorted[i].timestamp === 'string' ? new Date(sorted[i].timestamp) : sorted[i].timestamp?.toDate?.();
        const gapMin = curr && prev ? (curr - prev) / 60000 : 0;

        if (gapMin > 30) {
            sessions.push(current);
            current = { logs: [sorted[i]], start: sorted[i].timestamp, end: sorted[i].timestamp };
        } else {
            current.logs.push(sorted[i]);
            current.end = sorted[i].timestamp;
        }
    }
    sessions.push(current);
    return sessions.slice(-5).reverse(); // Last 5 sessions, newest first
}

// ────────────────────────────────────────────────────────────────────────────
const History = () => {
    const [students, setStudents] = useState([]);
    const [selectedStudent, setSelected] = useState(null);
    const [logs, setLogs] = useState([]);
    const [sessions, setSessions] = useState([]);
    const [activeSession, setActiveSession] = useState(null);
    const [filter, setFilter] = useState('All');
    const [isSyncing, setIsSyncing] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [loadingLogs, setLoadingLogs] = useState(false);
    const [viewMode, setViewMode] = useState('cloud'); // 'cloud' | 'local'

    const categories = ['All', 'YouTube', 'Search', 'Web Browsing', 'General App'];

    // Load student list
    useEffect(() => {
        const q = query(collection(db, 'students'), orderBy('studentId', 'asc'));
        const unsub = onSnapshot(q, snap => {
            setStudents(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        });
        return () => unsub();
    }, []);

    // Load logs for selected student
    useEffect(() => {
        if (!selectedStudent) return;
        setLoadingLogs(true);
        setLogs([]);
        setSessions([]);

        if (viewMode === 'cloud') {
            const q = query(
                collection(db, 'history'),
                where('studentId', '==', selectedStudent.studentId),
                orderBy('timestamp', 'desc'),
                limit(500)
            );
            const unsub = onSnapshot(q, snap => {
                const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
                setLogs(data);
                setSessions(groupIntoSessions(data));
                setActiveSession(null);
                setLoadingLogs(false);
            }, (err) => {
                console.error("Firestore history error:", err);
                setLoadingLogs(false);
                setLogs([]);
            });
            return () => unsub();
        } else {
            // Fetch from local server
            const fetchLocal = async () => {
                try {
                    const resp = await fetch(`${LOCAL_SERVER_URL}/api/history?studentId=${selectedStudent.studentId}`);
                    if (!resp.ok) throw new Error('Local server error');
                    const data = await resp.json();
                    setLogs(data);
                    setSessions(groupIntoSessions(data));
                    setActiveSession(null);
                } catch (e) {
                    console.error("Local history error:", e);
                    setLogs([]);
                } finally {
                    setLoadingLogs(false);
                }
            };
            fetchLocal();
        }
    }, [selectedStudent, viewMode]);

    // Filter logs for active session
    const sessionLogs = activeSession
        ? activeSession.logs.filter(l => filter === 'All' || (l.activity || '').startsWith(filter))
        : [];

    const handleOffload = async () => {
        if (!window.confirm('Move cloud logs to Local Server? This cannot be undone.')) return;
        setIsSyncing(true);
        try {
            const snapshot = await getDocs(collection(db, 'history'));
            if (snapshot.empty) {
                alert("No logs to archive.");
                return;
            }
            const cloudLogs = snapshot.docs.map(d => ({
                id: d.id, ...d.data(),
                timestamp: d.data().timestamp?.toDate?.().toISOString() || d.data().timestamp
            }));
            const resp = await fetch(`${LOCAL_SERVER_URL}/api/offload/logs`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ logs: cloudLogs })
            });
            if (!resp.ok) throw new Error('Server rejected');
            const batch = writeBatch(db);
            snapshot.docs.forEach(d => batch.delete(d.ref));
            await batch.commit();
            alert(`Archived ${cloudLogs.length} logs.`);
        } catch (e) { alert('Sync error: ' + e.message); }
        finally { setIsSyncing(false); }
    };

    const filteredStudents = students.filter(s =>
        s.studentId?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.name?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                    <h1>Student History</h1>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '4px' }}>
                        Per-student activity · Last 5 sessions stored in Firebase
                    </p>
                </div>
                <button onClick={handleOffload} disabled={isSyncing} className="btn btn-primary" style={{ fontSize: '0.85rem' }}>
                    <Database size={16} /> {isSyncing ? 'Archiving…' : 'Archive to Local'}
                </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: '20px' }}>
                {/* ── Left Sidebar: Student List ── */}
                <div className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px', height: 'fit-content', maxHeight: '80vh', overflow: 'hidden' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', background: 'rgba(255,255,255,0.04)', borderRadius: '8px', border: '1px solid var(--glass)' }}>
                        <Search size={14} color="var(--text-muted)" />
                        <input
                            type="text"
                            placeholder="Search students…"
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            style={{ background: 'none', border: 'none', outline: 'none', color: 'var(--text-main)', fontSize: '0.85rem', width: '100%' }}
                        />
                    </div>

                    <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px', paddingRight: '2px' }}>
                        {filteredStudents.map(s => {
                            const isSelected = selectedStudent?.id === s.id;
                            return (
                                <button
                                    key={s.id}
                                    onClick={() => { setSelected(s); setActiveSession(null); }}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: '10px',
                                        padding: '10px 12px', border: 'none', borderRadius: '8px', cursor: 'pointer',
                                        background: isSelected ? 'rgba(79,70,229,0.15)' : 'rgba(255,255,255,0.03)',
                                        borderLeft: isSelected ? '3px solid var(--primary)' : '3px solid transparent',
                                        color: isSelected ? 'var(--text-main)' : 'var(--text-muted)',
                                        textAlign: 'left', transition: 'all 0.15s'
                                    }}
                                >
                                    <div style={{ background: isSelected ? 'var(--primary)' : 'rgba(255,255,255,0.06)', padding: '6px', borderRadius: '6px' }}>
                                        <User size={14} color={isSelected ? 'white' : 'var(--text-muted)'} />
                                    </div>
                                    <div style={{ overflow: 'hidden' }}>
                                        <div style={{ fontSize: '0.85rem', fontWeight: '500', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {s.name || s.studentId}
                                        </div>
                                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{s.studentId}</div>
                                    </div>
                                    {isSelected && <ChevronRight size={14} style={{ marginLeft: 'auto', flexShrink: 0 }} />}
                                </button>
                            );
                        })}
                        {filteredStudents.length === 0 && (
                            <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem', padding: '20px 0' }}>No students found</p>
                        )}
                    </div>
                </div>

                {/* ── Right Area ── */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div style={{ display: 'flex', gap: '8px', background: 'rgba(255,255,255,0.03)', padding: '4px', borderRadius: '12px', width: 'fit-content' }}>
                        <button
                            onClick={() => setViewMode('cloud')}
                            style={{
                                padding: '8px 16px', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '0.85rem',
                                background: viewMode === 'cloud' ? 'var(--primary)' : 'transparent',
                                color: viewMode === 'cloud' ? 'white' : 'var(--text-muted)',
                                fontWeight: '600', transition: 'all 0.2s'
                            }}
                        >
                            Cloud History
                        </button>
                        <button
                            onClick={() => setViewMode('local')}
                            style={{
                                padding: '8px 16px', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '0.85rem',
                                background: viewMode === 'local' ? 'var(--primary)' : 'transparent',
                                color: viewMode === 'local' ? 'white' : 'var(--text-muted)',
                                fontWeight: '600', transition: 'all 0.2s'
                            }}
                        >
                            Local (Archived)
                        </button>
                    </div>

                    {!selectedStudent ? (
                        <div className="glass-panel" style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>
                            <User size={48} style={{ margin: '0 auto 16px', opacity: 0.3 }} />
                            <p style={{ fontSize: '1.1rem' }}>Select a student to view their history</p>
                        </div>
                    ) : (
                        <>
                            {/* Student summary card */}
                            <div className="glass-panel" style={{ padding: '20px', display: 'flex', gap: '20px', alignItems: 'center', flexWrap: 'wrap' }}>
                                <div style={{ background: 'rgba(79,70,229,0.1)', padding: '16px', borderRadius: '12px' }}>
                                    <User size={32} color="var(--primary)" />
                                </div>
                                <div>
                                    <h2 style={{ margin: 0 }}>{selectedStudent.name || selectedStudent.studentId}</h2>
                                    <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                                        ID: {selectedStudent.studentId} · {sessions.length} sessions recorded
                                    </p>
                                </div>
                                <div style={{ marginLeft: 'auto', display: 'flex', gap: '10px' }}>
                                    <div style={{ textAlign: 'center', padding: '10px 20px', background: 'rgba(255,255,255,0.04)', borderRadius: '8px' }}>
                                        <div style={{ fontSize: '1.4rem', fontWeight: 'bold', color: 'var(--success)' }}>{Math.floor((selectedStudent.weeklyTime || 60) * 60 - (selectedStudent.remainingTime || 0)) > 0 ? Math.floor(((selectedStudent.weeklyTime || 60) * 60 - (selectedStudent.remainingTime || (selectedStudent.weeklyTime || 60) * 60)) / 60) : 0}m</div>
                                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Weekly Used</div>
                                    </div>
                                    <div style={{ textAlign: 'center', padding: '10px 20px', background: 'rgba(255,255,255,0.04)', borderRadius: '8px' }}>
                                        <div style={{ fontSize: '1.4rem', fontWeight: 'bold', color: 'var(--primary)' }}>{sessions.length}</div>
                                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Sessions</div>
                                    </div>
                                    <div style={{ textAlign: 'center', padding: '10px 20px', background: 'rgba(255,255,255,0.04)', borderRadius: '8px' }}>
                                        <div style={{ fontSize: '1.4rem', fontWeight: 'bold', color: 'var(--warning)' }}>{logs.length}</div>
                                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Activities</div>
                                    </div>
                                </div>
                            </div>

                            {/* Session List */}
                            {loadingLogs ? (
                                <div className="glass-panel" style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading history…</div>
                            ) : sessions.length === 0 ? (
                                <div className="glass-panel" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                                    No activity recorded for this student yet.
                                </div>
                            ) : (
                                <>
                                    <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '-6px' }}>
                                        LAST {sessions.length} SESSION{sessions.length > 1 ? 'S' : ''} (click to expand)
                                    </p>
                                    {sessions.map((session, idx) => {
                                        const isOpen = activeSession === session;
                                        const startD = typeof session.start === 'string' ? new Date(session.start) : session.start?.toDate?.();
                                        const endD = typeof session.end === 'string' ? new Date(session.end) : session.end?.toDate?.();
                                        const durationSec = startD && endD ? Math.round((endD - startD) / 1000) + 30 : null;

                                        return (
                                            <div key={idx} className="glass-panel" style={{ overflow: 'hidden', transition: 'all 0.2s' }}>
                                                {/* Session header */}
                                                <button
                                                    onClick={() => setActiveSession(isOpen ? null : session)}
                                                    style={{
                                                        width: '100%', display: 'flex', alignItems: 'center', gap: '16px',
                                                        padding: '16px 20px', background: 'none', border: 'none', cursor: 'pointer',
                                                        color: 'var(--text-main)', textAlign: 'left',
                                                        borderBottom: isOpen ? '1px solid var(--glass)' : 'none'
                                                    }}
                                                >
                                                    <div style={{ background: 'rgba(79,70,229,0.1)', padding: '10px', borderRadius: '8px' }}>
                                                        <Calendar size={18} color="var(--primary)" />
                                                    </div>
                                                    <div style={{ flex: 1 }}>
                                                        <div style={{ fontWeight: '600', fontSize: '0.95rem' }}>
                                                            Session {sessions.length - idx} · {fmtDate(session.start)}
                                                        </div>
                                                        <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '3px' }}>
                                                            {fmtTime(session.start)} → {fmtTime(session.end)} · {fmtDuration(durationSec)}
                                                        </div>
                                                    </div>
                                                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginRight: '8px' }}>
                                                        <span style={{ background: 'rgba(79,70,229,0.1)', color: 'var(--primary)', padding: '3px 10px', borderRadius: '99px', fontSize: '0.75rem' }}>
                                                            {session.logs.length} events
                                                        </span>
                                                    </div>
                                                    <ChevronRight size={16} color="var(--text-muted)"
                                                        style={{ transform: isOpen ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }} />
                                                </button>

                                                {/* Session detail */}
                                                {isOpen && (
                                                    <div style={{ padding: '16px 20px' }}>
                                                        {/* Category filter */}
                                                        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', overflowX: 'auto', paddingBottom: '4px' }}>
                                                            {categories.map(cat => (
                                                                <button key={cat} onClick={() => setFilter(cat)}
                                                                    style={{
                                                                        padding: '5px 14px', border: 'none', borderRadius: '99px', cursor: 'pointer', fontSize: '0.75rem', whiteSpace: 'nowrap',
                                                                        background: filter === cat ? 'var(--primary)' : 'rgba(255,255,255,0.06)',
                                                                        color: filter === cat ? 'white' : 'var(--text-muted)',
                                                                        fontWeight: filter === cat ? '600' : 'normal'
                                                                    }}>
                                                                    {cat}
                                                                </button>
                                                            ))}
                                                        </div>

                                                        {/* Activity list */}
                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '400px', overflowY: 'auto' }}>
                                                            {sessionLogs.map((log, i) => {
                                                                const parts = (log.activity || '').split('|');
                                                                const cat = parts[0];
                                                                const detail = parts.length > 1 ? parts[1] : log.activity;
                                                                const cs = catStyle(cat);
                                                                return (
                                                                    <div key={i} style={{
                                                                        display: 'flex', gap: '12px', alignItems: 'center',
                                                                        padding: '9px 12px', borderRadius: '8px',
                                                                        background: 'rgba(255,255,255,0.025)'
                                                                    }}>
                                                                        <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', whiteSpace: 'nowrap', minWidth: '70px' }}>
                                                                            {fmtTime(log.timestamp)}
                                                                        </span>
                                                                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px', background: cs.bg, color: cs.color, padding: '2px 8px', borderRadius: '99px', fontSize: '0.68rem', whiteSpace: 'nowrap' }}>
                                                                            {catIcon(cat)} {cat}
                                                                        </span>
                                                                        <span style={{ fontSize: '0.85rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}
                                                                            title={detail}>
                                                                            {detail}
                                                                        </span>
                                                                        <Monitor size={13} color="var(--text-muted)" />
                                                                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{log.pcName}</span>
                                                                    </div>
                                                                );
                                                            })}
                                                            {sessionLogs.length === 0 && (
                                                                <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '24px 0' }}>
                                                                    No {filter !== 'All' ? filter : ''} activity in this session.
                                                                </p>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default History;
