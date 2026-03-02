import React, { useState, useEffect, useRef, useMemo } from 'react';
import { db } from '../firebase';
import {
    collection, query, orderBy, limit, onSnapshot, getDocs,
    writeBatch, where, doc
} from 'firebase/firestore';
import {
    User, Clock, Monitor, Activity, Database, ChevronRight, ChevronDown,
    Calendar, Search, Youtube, Globe, Cpu, X, Sparkles, ShieldAlert,
    RefreshCw, BarChart2, Server, Cloud, Layers, Zap
} from 'lucide-react';
import { GoogleGenerativeAI } from '@google/generative-ai';

import { Station, Student, HistoryLog } from '../types';

// ─── Config ───────────────────────────────────────────────────────────────────
const GEMINI_API_KEY = 'AIzaSyCTA4El4GxN79h89s-eGuj5PNfnkhP7FSI';
const LOCAL_SERVER_URL = 'http://localhost:5000';
const MAX_CLOUD_SESSIONS = 5; // Auto-offload when exceeding this

// ─── Category Helpers ─────────────────────────────────────────────────────────
interface CategoryStyle {
    bg: string;
    color: string;
}

const CATS: Record<string, CategoryStyle> = {
    YouTube: { bg: 'rgba(239,68,68,0.12)', color: '#ef4444' },
    Search: { bg: 'rgba(251,191,36,0.12)', color: '#fbbf24' },
    'Web Browsing': { bg: 'rgba(59,130,246,0.12)', color: '#60a5fa' },
    'General App': { bg: 'rgba(139,92,246,0.12)', color: '#a78bfa' },
    VIOLATION: { bg: 'rgba(239,68,68,0.15)', color: '#ef4444' },
    App: { bg: 'rgba(34,197,94,0.12)', color: '#4ade80' },
    Social: { bg: 'rgba(236,72,153,0.12)', color: '#ec4899' },
    Gaming: { bg: 'rgba(245,158,11,0.12)', color: '#f59e0b' },
    Coding: { bg: 'rgba(16,185,129,0.12)', color: '#10b981' },
    System: { bg: 'rgba(107,114,128,0.12)', color: '#9ca3af' },
};

const catStyle = (cat: string): CategoryStyle => CATS[cat] || { bg: 'rgba(255,255,255,0.05)', color: 'var(--text-muted)' };
const catIcon = (cat: string) => {
    if (cat === 'YouTube') return <Youtube size={12} />;
    if (cat === 'Search') return <Search size={12} />;
    if (cat === 'Web Browsing') return <Globe size={12} />;
    if (cat === 'VIOLATION') return <ShieldAlert size={12} />;
    if (cat === 'Gaming') return <Zap size={12} />;
    if (cat === 'Coding') return <Layers size={12} />;
    return <Cpu size={12} />;
};

const parse = (raw: string = '') => {
    const [cat, ...rest] = raw.split('|');
    const category = cat.trim();
    const detail = (rest.join('|') || category).trim();

    // Auto-categorize based on detail if it's "General App" or "Web Browsing"
    if (category === 'General App' || category === 'App') {
        const d = detail.toLowerCase();
        if (d.includes('code') || d.includes('studio') || d.includes('sublime') || d.includes('python')) return { cat: 'Coding', detail };
        if (d.includes('discord') || d.includes('facebook') || d.includes('instagram') || d.includes('twitter')) return { cat: 'Social', detail };
        if (d.includes('steam') || d.includes('game') || d.includes('roblox') || d.includes('minecraft')) return { cat: 'Gaming', detail };
    }

    return { cat: category, detail };
};

// ─── Formatters ───────────────────────────────────────────────────────────────
const toDate = (ts: any): Date | null => {
    if (!ts) return null;
    if (ts instanceof Date) return ts;
    if (typeof ts === 'string') return new Date(ts);
    if (ts.toDate && typeof ts.toDate === 'function') return ts.toDate();
    return null;
};
const fmtTime = (ts: any) => { const d = toDate(ts); return d ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—'; };
const fmtDate = (ts: any) => { const d = toDate(ts); return d ? d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' }) : '—'; };
const fmtDur = (sec: number) => { if (!sec) return '—'; const m = Math.floor(sec / 60), s = sec % 60; return m ? `${m}m ${s}s` : `${s}s`; };

interface Session {
    logs: HistoryLog[];
    start: any;
    end: any;
}

function groupSessions(logs: HistoryLog[]): Session[] {
    if (!logs.length) return [];
    const sorted = [...logs].sort((a, b) => (toDate(a.timestamp)?.getTime() || 0) - (toDate(b.timestamp)?.getTime() || 0));
    const sessions: Session[] = [];
    let cur: Session = { logs: [sorted[0]], start: sorted[0].timestamp, end: sorted[0].timestamp };
    for (let i = 1; i < sorted.length; i++) {
        const gap = ((toDate(sorted[i].timestamp)?.getTime() || 0) - (toDate(sorted[i - 1].timestamp)?.getTime() || 0)) / 60000;
        if (gap > 30) { sessions.push(cur); cur = { logs: [sorted[i]], start: sorted[i].timestamp, end: sorted[i].timestamp }; }
        else { cur.logs.push(sorted[i]); cur.end = sorted[i].timestamp; }
    }
    sessions.push(cur);
    return sessions.reverse(); // newest first
}

interface StatItem {
    cat: string;
    count: number;
    pct: number;
}

function calcStats(logs: HistoryLog[]): StatItem[] {
    const counts: Record<string, number> = {};
    logs.forEach(l => { const { cat } = parse(l.activity); counts[cat] = (counts[cat] || 0) + 1; });
    const total = logs.length || 1;
    return Object.entries(counts).map(([cat, count]) => ({ cat, count, pct: Math.round(count / total * 100) })).sort((a, b) => b.count - a.count);
}

// ─── Gemini Prompt ────────────────────────────────────────────────────────────
function buildPrompt(student: Student, sessions: Session[]) {
    const name = student.name || student.studentId;
    const allLogs = sessions.flatMap(s => s.logs);
    const stats = calcStats(allLogs);
    const topActivities = [...new Set(allLogs.map(l => parse(l.activity).detail))].slice(0, 25).join(', ');
    const sessionLines = sessions.map((s, i) => {
        const dur = Math.round(((toDate(s.end)?.getTime() || 0) - (toDate(s.start)?.getTime() || 0)) / 60000);
        const cats = [...new Set(s.logs.map(l => parse(l.activity).cat))].join(', ');
        return `  Session ${sessions.length - i}: ${fmtDate(s.start)}, ~${dur}m — ${cats}`;
    }).join('\n');
    const statLines = stats.map(s => `  ${s.cat}: ${s.count} (${s.pct}%)`).join('\n');

    return `You are an educational AI assistant for a lab administrator. Analyze the lab computer usage of student "${name}" (ID: ${student.studentId}) and generate a structured "Student Usage Profile".

Include these sections:
1. **Usage Summary** – 2-3 sentences on overall patterns
2. **Detected Interests** – bullet list of likely interests based on activity
3. **Productivity Score** – /10 with brief reasoning (deduct for violations/gaming)
4. **Admin Recommendations** – 2-3 actionable tips

Keep the response under 220 words. Be specific and insightful.

### Data (${sessions.length} sessions, ${allLogs.length} total activities):
${sessionLines}

**Activity distribution:**
${statLines}

**Observed window titles / apps (sample):**
${topActivities}`;
}

async function offloadOldSessions(studentId: string, allCloudDocs: HistoryLog[], sessionsToKeep: Session[]) {
    // sessionsToKeep = last MAX_CLOUD_SESSIONS sessions (already sorted newest-first)
    const keepIds = new Set(sessionsToKeep.flatMap(s => s.logs.map(l => l.id)));
    const toOffload = allCloudDocs.filter(d => !keepIds.has(d.id));
    if (!toOffload.length) return;

    try {
        const payload = toOffload.map(d => ({
            id: d.id, studentId: d.studentId, pcName: d.pcName,
            activity: d.activity,
            timestamp: toDate(d.timestamp)?.toISOString() || d.timestamp
        }));

        const resp = await fetch(`${LOCAL_SERVER_URL}/api/offload/logs`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ logs: payload })
        });
        if (!resp.ok) return; // local server offline — skip silently

        // Delete from Firestore
        const batch = writeBatch(db);
        toOffload.forEach(d => {
            if (d.id) batch.delete(doc(db, 'history', d.id));
        });
        await batch.commit();
        console.log(`[AutoOffload] Moved ${toOffload.length} logs for ${studentId} to local server.`);
    } catch {
        // Local server not running — skip silently
    }
}

interface LogRowProps {
    log: HistoryLog;
}

const LogRow = ({ log }: LogRowProps) => {
    const { cat, detail } = parse(log.activity);
    const cs = catStyle(cat);
    return (
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', padding: '8px 12px', borderRadius: '8px', background: 'rgba(255,255,255,0.025)' }}>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem', whiteSpace: 'nowrap', minWidth: '70px' }}>{fmtTime(log.timestamp)}</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px', background: cs.bg, color: cs.color, padding: '2px 8px', borderRadius: '99px', fontSize: '0.68rem', whiteSpace: 'nowrap' }}>
                {catIcon(cat)} {cat}
            </span>
            <span style={{ fontSize: '0.82rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }} title={detail}>{detail}</span>
            <Monitor size={12} color="var(--text-muted)" />
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{log.pcName}</span>
        </div>
    );
};

interface CategoryBarProps {
    cat: string;
    count: number;
    pct: number;
}

const CategoryBar = ({ cat, count, pct }: CategoryBarProps) => {
    const cs = catStyle(cat);
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', width: '110px', flexShrink: 0 }}>
                <span style={{ color: cs.color }}>{catIcon(cat)}</span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cat}</span>
            </div>
            <div style={{ flex: 1, background: 'rgba(255,255,255,0.06)', borderRadius: '99px', height: '6px' }}>
                <div style={{ width: `${pct}%`, background: cs.color, borderRadius: '99px', height: '6px', transition: 'width 0.6s' }} />
            </div>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', width: '45px', textAlign: 'right' }}>{count} ({pct}%)</span>
        </div>
    );
};

const RenderReport = ({ text }: { text: string }) => text.split('\n').map((line, i) => (
    <p key={i} style={{ margin: '4px 0', fontSize: '0.88rem', lineHeight: '1.7' }}
        dangerouslySetInnerHTML={{ __html: line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }} />
));

const History = () => {
    const [students, setStudents] = useState<Student[]>([]);
    const [selected, setSelected] = useState<Student | null>(null);
    const [cloudLogs, setCloudLogs] = useState<HistoryLog[]>([]);
    const [cloudSessions, setCloudSessions] = useState<Session[]>([]); // capped at 5
    const [localLogs, setLocalLogs] = useState<HistoryLog[]>([]);
    const [localSessions, setLocalSessions] = useState<Session[]>([]);
    const [activeSession, setActiveSession] = useState<Session | null>(null);
    const [filter, setFilter] = useState('All');
    const [loadingCloud, setLoadingCloud] = useState(false);
    const [loadingLocal, setLoadingLocal] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [isSyncing, setIsSyncing] = useState(false);

    // AI state
    const [aiReport, setAiReport] = useState('');
    const [aiLoading, setAiLoading] = useState(false);
    const [showReport, setShowReport] = useState(false);
    const [aiSource, setAiSource] = useState<'cloud' | 'all'>('cloud'); // 'cloud' | 'all'

    const categories = ['All', 'YouTube', 'Search', 'Web Browsing', 'General App', 'Coding', 'Social', 'Gaming', 'VIOLATION'];
    const allDocsRef = useRef<HistoryLog[]>([]); // keep raw cloud docs for offload

    // Load students
    useEffect(() => {
        const q = query(collection(db, 'students'), orderBy('studentId', 'asc'));
        const unsub = onSnapshot(q, snap => setStudents(snap.docs.map(d => ({ id: d.id, ...d.data() } as Student))));
        return () => unsub();
    }, []);

    // Load cloud logs + auto-offload
    useEffect(() => {
        if (!selected) return;
        setLoadingCloud(true);
        setCloudLogs([]); setCloudSessions([]); setActiveSession(null);
        setAiReport(''); setShowReport(false);

        // Query using both human-readable ID (new client) and doc ID (old client)
        // This ensures logs from old client versions are still visible
        const ids = [selected.studentId, selected.id].filter(Boolean);
        const q = query(
            collection(db, 'history'),
            where('studentId', 'in', ids),
            orderBy('timestamp', 'desc'),
            limit(500)
        );
        const unsub = onSnapshot(q, async (snap) => {
            const docs = snap.docs.map(d => ({ id: d.id, ...d.data() } as HistoryLog));
            allDocsRef.current = docs;

            const allSessions = groupSessions(docs);
            const sessionsToKeep = allSessions.slice(0, MAX_CLOUD_SESSIONS);

            setCloudLogs(sessionsToKeep.flatMap(s => s.logs));
            setCloudSessions(sessionsToKeep);
            setLoadingCloud(false);

            // Auto-offload sessions beyond MAX_CLOUD_SESSIONS
            if (allSessions.length > MAX_CLOUD_SESSIONS) {
                await offloadOldSessions(selected.studentId, docs, sessionsToKeep);
            }
        }, () => setLoadingCloud(false));

        return () => unsub();
    }, [selected]);

    // Load local/archived logs (try both IDs to cover old+new client versions)
    useEffect(() => {
        if (!selected) return;
        setLoadingLocal(true);
        const ids = [selected.studentId, selected.id].filter(Boolean);
        Promise.all(
            ids.map(id => fetch(`${LOCAL_SERVER_URL}/api/history?studentId=${id}`).then(r => r.ok ? r.json() : []).catch(() => []))
        ).then(results => {
            // Merge and de-duplicate by id
            const seen = new Set();
            const merged = results.flat().filter(l => { if (seen.has(l.id)) return false; seen.add(l.id); return true; });
            setLocalLogs(merged);
            setLocalSessions(groupSessions(merged));
        }).finally(() => setLoadingLocal(false));
    }, [selected]);

    // Combined data for full report
    const allLogs = useMemo(() => [...cloudLogs, ...localLogs], [cloudLogs, localLogs]);
    const allSessions = useMemo(() => groupSessions(allLogs), [allLogs]);
    const globalStats = useMemo(() => calcStats(cloudLogs), [cloudLogs]);

    // Filtered logs for open session
    const sessionLogs = useMemo(() =>
        activeSession
            ? activeSession.logs.filter(l => filter === 'All' || parse(l.activity).cat === filter)
            : [],
        [activeSession, filter]);

    // Generate AI report
    const generateAI = async (source: 'cloud' | 'all' = aiSource) => {
        const sessions = source === 'all' ? allSessions : cloudSessions;
        if (!sessions.length || !selected) return;
        setAiLoading(true); setShowReport(true); setAiReport(''); setAiSource(source);
        try {
            const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
            const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
            const result = await model.generateContent(buildPrompt(selected, sessions.slice(0, 15)));
            setAiReport(result.response.text());
        } catch (e: any) {
            const stats = calcStats(sessions.flatMap(s => s.logs));
            setAiReport(`**Usage Summary**\n${selected.name || selected.studentId} has ${sessions.length} recorded sessions with ${sessions.flatMap(s => s.logs).length} total activities.\n\n**Activity Breakdown**\n${stats.map(s => `• ${s.cat}: ${s.pct}%`).join('\n')}\n\n**Error:** ${e.message}`);
        } finally { setAiLoading(false); }
    };

    const handleManualOffload = async () => {
        if (!window.confirm('Move all cloud logs to Local Server?')) return;
        setIsSyncing(true);
        try {
            const snapshot = await getDocs(collection(db, 'history'));
            const logs = snapshot.docs.map(d => ({ id: d.id, ...d.data(), timestamp: toDate(d.data().timestamp)?.toISOString() || d.data().timestamp }));
            const resp = await fetch(`${LOCAL_SERVER_URL}/api/offload/logs`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ logs }) });
            if (!resp.ok) throw new Error('Server rejected');
            const batch = writeBatch(db);
            snapshot.docs.forEach(d => batch.delete(d.ref));
            await batch.commit();
            alert(`Archived ${logs.length} logs to local server.`);
        } catch (e: any) { alert('Error: ' + e.message); }
        finally { setIsSyncing(false); }
    };

    const filteredStudents = students.filter(s =>
        s.studentId?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.name?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const renderSessions = (sessions: Session[], label: 'cloud' | 'local') => (
        <>
            {sessions.length > 0 && (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginBottom: '-6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {label === 'cloud' ? <Cloud size={12} /> : <Server size={12} />}
                    {label === 'cloud' ? `LAST ${sessions.length} CLOUD SESSION${sessions.length > 1 ? 'S' : ''}` : `${sessions.length} ARCHIVED SESSION${sessions.length > 1 ? 'S' : ''}`}
                    {' · CLICK TO EXPAND'}
                </p>
            )}
            {sessions.map((session, idx) => {
                const isOpen = activeSession === session;
                const dur = Math.round(((toDate(session.end)?.getTime() || 0) - (toDate(session.start)?.getTime() || 0)) / 1000) + 30;
                const sStats = calcStats(session.logs);
                return (
                    <div key={idx} className="glass-panel" style={{ overflow: 'hidden', borderLeft: label === 'cloud' ? '3px solid rgba(79,70,229,0.3)' : '3px solid rgba(34,197,94,0.3)' }}>
                        <button onClick={() => setActiveSession(isOpen ? null : session)}
                            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '14px', padding: '14px 18px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-main)', textAlign: 'left', borderBottom: isOpen ? '1px solid var(--glass)' : 'none' }}>
                            <div style={{ background: label === 'cloud' ? 'rgba(79,70,229,0.1)' : 'rgba(34,197,94,0.1)', padding: '8px', borderRadius: '8px' }}>
                                <Calendar size={14} color={label === 'cloud' ? 'var(--primary)' : 'var(--success)'} />
                            </div>
                            <div style={{ flex: 1 }}>
                                <div style={{ fontWeight: '600', fontSize: '0.9rem' }}>
                                    {fmtDate(session.start)}
                                </div>
                                <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '2px' }}>
                                    {fmtTime(session.start)} → {fmtTime(session.end)} · {fmtDur(dur)}
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', maxWidth: '180px', justifyContent: 'flex-end' }}>
                                {sStats.slice(0, 3).map(s => {
                                    const cs = catStyle(s.cat);
                                    return <span key={s.cat} style={{ background: cs.bg, color: cs.color, padding: '2px 7px', borderRadius: '99px', fontSize: '0.62rem', display: 'flex', alignItems: 'center', gap: '3px' }}>{catIcon(s.cat)} {s.pct}%</span>;
                                })}
                            </div>
                            <span style={{ background: 'rgba(79,70,229,0.1)', color: 'var(--primary)', padding: '2px 9px', borderRadius: '99px', fontSize: '0.7rem', whiteSpace: 'nowrap' }}>
                                {session.logs.length} events
                            </span>
                            {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        </button>
                        {isOpen && (
                            <div style={{ padding: '14px 18px' }}>
                                <div style={{ display: 'flex', gap: '6px', marginBottom: '12px', overflowX: 'auto', paddingBottom: '4px' }}>
                                    {categories.map(cat => {
                                        const cnt = cat === 'All' ? session.logs.length : session.logs.filter(l => parse(l.activity).cat === cat).length;
                                        if (cnt === 0 && cat !== 'All') return null;
                                        return (
                                            <button key={cat} onClick={() => setFilter(cat)}
                                                style={{
                                                    padding: '3px 11px', border: 'none', borderRadius: '99px', cursor: 'pointer', fontSize: '0.7rem', whiteSpace: 'nowrap',
                                                    background: filter === cat ? 'var(--primary)' : 'rgba(255,255,255,0.06)',
                                                    color: filter === cat ? 'white' : 'var(--text-muted)', fontWeight: filter === cat ? '600' : 'normal'
                                                }}>
                                                {cat} {cat !== 'All' && `(${cnt})`}
                                            </button>
                                        );
                                    })}
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', maxHeight: '360px', overflowY: 'auto' }}>
                                    {sessionLogs.map((log, i) => <LogRow key={i} log={log} />)}
                                    {sessionLogs.length === 0 && <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '20px 0' }}>No {filter !== 'All' ? filter : ''} activity.</p>}
                                </div>
                            </div>
                        )}
                    </div>
                );
            })}
        </>
    );

    return (
        <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                    <h1>Student History</h1>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', marginTop: '4px' }}>
                        Firebase keeps last 5 sessions · older sessions auto-archived to local server · AI profile reports
                    </p>
                </div>
                <button onClick={handleManualOffload} disabled={isSyncing} className="btn btn-primary" style={{ fontSize: '0.83rem' }}>
                    <Database size={15} /> {isSyncing ? 'Archiving…' : 'Archive All Now'}
                </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '250px 1fr', gap: '20px' }}>
                {/* Student list */}
                <div className="glass-panel" style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '85vh', overflow: 'hidden' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 10px', background: 'rgba(255,255,255,0.04)', borderRadius: '8px', border: '1px solid var(--glass)' }}>
                        <Search size={13} color="var(--text-muted)" />
                        <input type="text" placeholder="Search students…" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                            style={{ background: 'none', border: 'none', outline: 'none', color: 'var(--text-main)', fontSize: '0.82rem', width: '100%' }} />
                    </div>
                    <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                        {filteredStudents.map(s => {
                            const isSel = selected?.id === s.id;
                            return (
                                <button key={s.id} onClick={() => setSelected(s)}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: '9px', padding: '9px 11px', border: 'none', borderRadius: '8px', cursor: 'pointer',
                                        background: isSel ? 'rgba(79,70,229,0.15)' : 'rgba(255,255,255,0.03)',
                                        borderLeft: isSel ? '3px solid var(--primary)' : '3px solid transparent',
                                        color: isSel ? 'var(--text-main)' : 'var(--text-muted)', textAlign: 'left', transition: 'all 0.15s'
                                    }}>
                                    <div style={{ background: isSel ? 'var(--primary)' : 'rgba(255,255,255,0.06)', padding: '5px', borderRadius: '6px' }}>
                                        <User size={12} color={isSel ? 'white' : 'var(--text-muted)'} />
                                    </div>
                                    <div style={{ overflow: 'hidden' }}>
                                        <div style={{ fontSize: '0.82rem', fontWeight: '500', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name || s.studentId}</div>
                                        <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{s.studentId}</div>
                                    </div>
                                    {isSel && <ChevronRight size={12} style={{ marginLeft: 'auto', flexShrink: 0 }} />}
                                </button>
                            );
                        })}
                        {filteredStudents.length === 0 && <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem', padding: '16px 0' }}>No students found</p>}
                    </div>
                </div>

                {/* Right panel */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', minWidth: 0 }}>
                    {!selected ? (
                        <div className="glass-panel" style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>
                            <User size={48} style={{ margin: '0 auto 16px', opacity: 0.3 }} />
                            <p style={{ fontSize: '1.1rem' }}>Select a student to view their activity</p>
                        </div>
                    ) : (
                        <>
                            {/* Student header card */}
                            <div className="glass-panel" style={{ padding: '20px' }}>
                                <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap', marginBottom: cloudSessions.length ? '16px' : 0 }}>
                                    <div style={{ background: 'rgba(79,70,229,0.1)', padding: '14px', borderRadius: '12px' }}>
                                        <User size={28} color="var(--primary)" />
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <h2 style={{ margin: 0, fontSize: '1.3rem' }}>{selected.name || selected.studentId}</h2>
                                        <p style={{ margin: '3px 0 0', color: 'var(--text-muted)', fontSize: '0.83rem' }}>
                                            ID: {selected.studentId}
                                            <span style={{ margin: '0 8px', color: 'rgba(255,255,255,0.15)' }}>·</span>
                                            <Cloud size={11} style={{ verticalAlign: 'middle', marginRight: 3 }} />{cloudSessions.length} cloud sessions
                                            <span style={{ margin: '0 8px', color: 'rgba(255,255,255,0.15)' }}>·</span>
                                            <Server size={11} style={{ verticalAlign: 'middle', marginRight: 3 }} />{localSessions.length} archived
                                        </p>
                                    </div>

                                    {/* Stats */}
                                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                        {[
                                            { l: 'Cloud', v: cloudLogs.length, c: 'var(--primary)' },
                                            { l: 'Archived', v: localLogs.length, c: 'var(--success)' },
                                            { l: 'Total', v: allLogs.length, c: 'var(--warning)' },
                                        ].map(s => (
                                            <div key={s.l} style={{ textAlign: 'center', padding: '8px 16px', background: 'rgba(255,255,255,0.04)', borderRadius: '8px' }}>
                                                <div style={{ fontSize: '1.3rem', fontWeight: 'bold', color: s.c }}>{s.v}</div>
                                                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>{s.l}</div>
                                            </div>
                                        ))}
                                    </div>

                                    {/* AI report buttons */}
                                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                        <button className="btn btn-primary" onClick={() => generateAI('cloud')} disabled={!cloudSessions.length || aiLoading}
                                            style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', opacity: !cloudSessions.length ? 0.5 : 1 }}>
                                            {aiLoading && aiSource === 'cloud' ? <RefreshCw size={14} className="spin" /> : <Sparkles size={14} />}
                                            Recent Report
                                        </button>
                                        <button className="btn" onClick={() => generateAI('all')} disabled={!allSessions.length || aiLoading}
                                            style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', background: 'rgba(34,197,94,0.1)', color: 'var(--success)', opacity: !allSessions.length ? 0.5 : 1 }}>
                                            {aiLoading && aiSource === 'all' ? <RefreshCw size={14} className="spin" /> : <Layers size={14} />}
                                            Full Report
                                        </button>
                                    </div>
                                </div>

                                {/* Usage breakdown bars */}
                                {cloudSessions.length > 0 && globalStats.length > 0 && (
                                    <div style={{ borderTop: '1px solid var(--glass)', paddingTop: '14px', display: 'flex', flexDirection: 'column', gap: '7px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                                            <BarChart2 size={13} color="var(--text-muted)" />
                                            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Current Cloud Sessions — Usage Breakdown</span>
                                        </div>
                                        {globalStats.map(s => <CategoryBar key={s.cat} {...s} />)}
                                    </div>
                                )}
                            </div>

                            {/* AI Report Panel */}
                            {showReport && (
                                <div className="glass-panel animate-fade-in" style={{ padding: '22px', border: '1px solid rgba(139,92,246,0.3)', background: 'rgba(139,92,246,0.04)' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            <div style={{ background: 'rgba(139,92,246,0.15)', padding: '8px', borderRadius: '8px' }}>
                                                <Sparkles size={16} color="#a78bfa" />
                                            </div>
                                            <div>
                                                <h3 style={{ margin: 0, fontSize: '0.95rem' }}>AI Usage Profile — {selected.name || selected.studentId}</h3>
                                                <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                                    {aiSource === 'all' ? `All ${allSessions.length} sessions (cloud + archived)` : `Last ${cloudSessions.length} cloud sessions`}
                                                </p>
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', gap: '6px' }}>
                                            <button className="btn" style={{ fontSize: '0.78rem', padding: '5px 10px' }} onClick={() => generateAI()} disabled={aiLoading}>
                                                <RefreshCw size={12} /> Retry
                                            </button>
                                            <button className="btn-icon" onClick={() => setShowReport(false)}><X size={14} /></button>
                                        </div>
                                    </div>
                                    {aiLoading
                                        ? <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--text-muted)', padding: '16px' }}><RefreshCw size={16} className="spin" /> Analyzing with Gemini AI…</div>
                                        : <div style={{ color: 'var(--text-main)', lineHeight: '1.7' }}><RenderReport text={aiReport} /></div>
                                    }
                                </div>
                            )}

                            {/* Cloud Sessions */}
                            {loadingCloud ? (
                                <div className="glass-panel" style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading cloud history…</div>
                            ) : (
                                renderSessions(cloudSessions, 'cloud')
                            )}

                            {/* Archived (local) sessions */}
                            {loadingLocal ? (
                                <div className="glass-panel" style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>Checking local archive…</div>
                            ) : localSessions.length > 0 ? (
                                <>{renderSessions(localSessions, 'local')}</>
                            ) : (
                                cloudSessions.length === 0 && (
                                    <div className="glass-panel" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                                        <Activity size={48} style={{ margin: '0 auto 16px', opacity: 0.2 }} />
                                        <p>No activity recorded for this student yet.</p>
                                    </div>
                                )
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default History;
