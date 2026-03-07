import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, query, query as fsQuery, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { BarChart2, Users, UserX, Filter, Search, ShieldAlert, Award, Calendar, Activity } from 'lucide-react';
import { Student, HistoryLog } from '../types';

// --- Helpers ---
const toDate = (ts: any): Date | null => {
    if (!ts) return null;
    if (ts instanceof Date) return ts;
    if (typeof ts === 'string') return new Date(ts);
    if (ts.toDate && typeof ts.toDate === 'function') return ts.toDate();
    return null;
};

const Analytics = () => {
    const [students, setStudents] = useState<Student[]>([]);
    const [logs, setLogs] = useState<HistoryLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedClass, setSelectedClass] = useState('All');
    const [localServerUrl, setLocalServerUrl] = useState('http://localhost:5000');

    // Load data
    useEffect(() => {
        // Fetch network settings for local server URL
        getDoc(doc(db, 'settings', 'network')).then(snap => {
            if (snap.exists() && snap.data().serverAddress) {
                setLocalServerUrl(snap.data().serverAddress);
            }
        });

        // Load all students
        const unsubStudents = onSnapshot(collection(db, 'students'), (snap) => {
            setStudents(snap.docs.map(d => ({ id: d.id, ...d.data() } as Student)));
        });

        // Load all cloud logs (limit 1000 for performance)
        const unsubLogs = onSnapshot(collection(db, 'history'), (snap) => {
            setLogs(snap.docs.map(d => ({ id: d.id, ...d.data() } as HistoryLog)));
            setLoading(false);
        });

        return () => {
            unsubStudents();
            unsubLogs();
        };
    }, []);

    const classGroups = useMemo(() => {
        const groups = new Set(students.map(s => s.classGroup).filter(Boolean));
        return ['All', ...Array.from(groups).sort() as string[]];
    }, [students]);

    const filteredStudents = useMemo(() =>
        selectedClass === 'All' ? students : students.filter(s => s.classGroup === selectedClass)
        , [students, selectedClass]);

    const analyticsData = useMemo(() => {
        const studentStats = filteredStudents.map(student => {
            // Count cloud logs for this student
            // Supports both old and new ID formats
            const cloudCount = logs.filter(l => l.studentId === student.studentId || l.studentId === student.id).length;

            return {
                ...student,
                cloudCount
            };
        });

        // Sort by utilization
        const topUtilizers = [...studentStats]
            .filter(s => s.cloudCount > 0)
            .sort((a, b) => b.cloudCount - a.cloudCount)
            .slice(0, 10);

        // Find students with zero activity
        const nonAttendees = studentStats.filter(s => s.cloudCount === 0);

        return { topUtilizers, nonAttendees, totalInClass: filteredStudents.length };
    }, [filteredStudents, logs]);

    return (
        <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h1 style={{ marginBottom: '4px' }}>Lab Analytics</h1>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Deep dive into student utilization and attendance.</p>
                </div>

                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <Filter size={16} color="var(--text-muted)" />
                    <select
                        value={selectedClass}
                        onChange={(e) => setSelectedClass(e.target.value)}
                        style={{
                            padding: '8px 14px', background: 'rgba(255,255,255,0.05)',
                            border: '1px solid var(--glass)', borderRadius: '8px',
                            color: 'white', outline: 'none', cursor: 'pointer'
                        }}
                    >
                        {classGroups.map(c => <option key={c} value={c} style={{ background: '#1e293b' }}>{c}</option>)}
                    </select>
                </div>
            </div>

            {/* Stats Overview */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                <div className="glass-panel" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '16px', borderLeft: '4px solid var(--primary)' }}>
                    <div style={{ background: 'rgba(79,70,229,0.1)', padding: '12px', borderRadius: '12px' }}>
                        <Users size={24} color="var(--primary)" />
                    </div>
                    <div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Students In Filter</div>
                        <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{analyticsData.totalInClass}</div>
                    </div>
                </div>
                <div className="glass-panel" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '16px', borderLeft: '4px solid var(--success)' }}>
                    <div style={{ background: 'rgba(34,197,94,0.1)', padding: '12px', borderRadius: '12px' }}>
                        <Activity size={24} color="var(--success)" />
                    </div>
                    <div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Active Today</div>
                        <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{analyticsData.totalInClass - analyticsData.nonAttendees.length}</div>
                    </div>
                </div>
                <div className="glass-panel" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '16px', borderLeft: '4px solid var(--danger)' }}>
                    <div style={{ background: 'rgba(239,68,68,0.1)', padding: '12px', borderRadius: '12px' }}>
                        <UserX size={24} color="var(--danger)" />
                    </div>
                    <div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Non-Attendees</div>
                        <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{analyticsData.nonAttendees.length}</div>
                    </div>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '20px' }}>
                {/* Utilization Chart */}
                <div className="glass-panel" style={{ padding: '24px' }}>
                    <h3 style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                        <Award size={20} color="var(--warning)" /> Top Lab Utilizers
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                        {analyticsData.topUtilizers.map(student => (
                            <div key={student.id} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <div style={{ width: '120px', fontSize: '0.85rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {student.name}
                                </div>
                                <div style={{ flex: 1, height: '12px', background: 'rgba(255,255,255,0.05)', borderRadius: '6px', overflow: 'hidden' }}>
                                    <div
                                        style={{
                                            width: `${Math.min(100, (student.cloudCount / (analyticsData.topUtilizers[0]?.cloudCount || 1)) * 100)}%`,
                                            height: '100%', background: 'linear-gradient(90deg, var(--primary), #a78bfa)',
                                            transition: 'width 1s ease-out'
                                        }}
                                    />
                                </div>
                                <div style={{ width: '80px', fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'right' }}>
                                    {student.cloudCount} events
                                </div>
                            </div>
                        ))}
                        {analyticsData.topUtilizers.length === 0 && (
                            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                                No activity recorded for this class group.
                            </div>
                        )}
                    </div>
                </div>

                {/* Non-Attendee List */}
                <div className="glass-panel" style={{ padding: '24px' }}>
                    <h3 style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                        <ShieldAlert size={20} color="var(--danger)" /> Missing Students
                    </h3>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '15px' }}>
                        Enrolled students with zero activity in the current filter.
                    </p>
                    <div style={{ maxHeight: '400px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {analyticsData.nonAttendees.map(student => (
                            <div key={student.id} style={{ padding: '10px 14px', background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.1)', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                    <div style={{ fontSize: '0.85rem', fontWeight: '500' }}>{student.name}</div>
                                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>ID: {student.studentId}</div>
                                </div>
                                <span style={{ fontSize: '0.7rem', color: 'var(--danger)', fontWeight: 'bold', textTransform: 'uppercase' }}>NEVER LOGGED IN</span>
                            </div>
                        ))}
                        {analyticsData.nonAttendees.length === 0 && (
                            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                                All students in this group have used the lab! 🎉
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Analytics;
