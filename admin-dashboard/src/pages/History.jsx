import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, orderBy, limit, onSnapshot, getDocs, writeBatch } from 'firebase/firestore';
import { History as HistoryIcon, Clock, Monitor, User, Trash2 } from 'lucide-react';

const History = () => {
    const [logs, setLogs] = useState([]);

    useEffect(() => {
        const q = query(collection(db, 'history'), orderBy('timestamp', 'desc'), limit(100));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const logList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setLogs(logList);
        });

        return () => unsubscribe();
    }, []);

    const handleClearHistory = async () => {
        if (!window.confirm("Are you sure you want to clear all usage history? This cannot be undone.")) return;

        try {
            const batch = writeBatch(db);
            const snapshot = await getDocs(collection(db, 'history'));
            snapshot.docs.forEach((doc) => {
                batch.delete(doc.ref);
            });
            await batch.commit();
            alert("History cleared.");
        } catch (err) {
            console.error("Error clearing logs:", err);
        }
    };

    return (
        <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                    <h1>Usage History</h1>
                    <p style={{ color: 'var(--text-muted)' }}>Last 100 activities recorded across the lab</p>
                </div>
                <button onClick={handleClearHistory} className="btn" style={{ background: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)', gap: '8px', fontSize: '0.85rem' }}>
                    <Trash2 size={16} /> Clear Logs
                </button>
            </div>

            <div className="glass-panel" style={{ padding: '30px' }}>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--glass)' }}>
                                <th style={{ padding: '15px' }}>Time</th>
                                <th style={{ padding: '15px' }}>Student</th>
                                <th style={{ padding: '15px' }}>PC</th>
                                <th style={{ padding: '15px' }}>Activity / Window Title</th>
                            </tr>
                        </thead>
                        <tbody>
                            {logs.map(log => (
                                <tr key={log.id} style={{ borderBottom: '1px solid var(--glass)' }}>
                                    <td style={{ padding: '15px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                                        {log.timestamp?.toDate().toLocaleString()}
                                    </td>
                                    <td style={{ padding: '15px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <User size={14} color="var(--primary)" /> {log.studentId}
                                        </div>
                                    </td>
                                    <td style={{ padding: '15px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <Monitor size={14} /> {log.pcName}
                                        </div>
                                    </td>
                                    <td style={{ padding: '15px', maxWidth: '400px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {log.activity}
                                    </td>
                                </tr>
                            ))}
                            {logs.length === 0 && (
                                <tr><td colSpan="4" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>No history logs recorded yet.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default History;
