import React, { useState, useEffect, useMemo, memo, useCallback } from 'react';
import { db } from '../firebase';
import { collection, addDoc, getDocs, query, orderBy, onSnapshot, deleteDoc, doc, writeBatch, updateDoc } from 'firebase/firestore';
import { UserPlus, Clock, Trash2, Edit3, AlertTriangle, Check, X, Search } from 'lucide-react';
import { Student } from '../types';

// ─── Types ────────────────────────────────────────────────────────────────────
interface NewUser { name: string; studentId: string; password: string; classGroup: string; weeklyTime: number; dailyTime: number; }
interface BulkConfig { prefix: string; start: number; end: number; classGroup: string; weeklyTime: number; dailyTime: number; }
interface EditState { id: string; field: 'weeklyTime' | 'dailyTime' | 'name' | 'classGroup'; value: string; }

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmtMin = (sec: number) => `${Math.floor(sec / 60)}m`;

const inputCls: React.CSSProperties = {
    padding: '10px 12px', border: '1px solid rgba(255,255,255,0.1)',
    background: 'rgba(255,255,255,0.05)', color: 'white',
    borderRadius: '8px', fontFamily: 'inherit', fontSize: '0.9rem',
};

// ─── Student Row ──────────────────────────────────────────────────────────────
interface StudentRowProps {
    user: Student;
    onDelete: (id: string) => void;
    onEdit: (id: string, field: EditState['field'], value: number | string) => void;
}

const StudentRow = memo(({ user, onDelete, onEdit }: StudentRowProps) => {
    const [editing, setEditing] = useState<EditState | null>(null);

    const save = () => {
        if (!editing) return;
        const val = (editing.field === 'name' || editing.field === 'classGroup') ? editing.value : parseInt(editing.value) * 60;
        onEdit(user.id, editing.field, val);
        setEditing(null);
    };

    const weekly = user.remainingTime ?? 0;
    const daily = user.dailyRemainingTime ?? 0;
    const renames = user.usernameChanges ?? 0;

    return (
        <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            {/* Name */}
            <td style={{ padding: '12px 15px' }}>
                {editing?.field === 'name' ? (
                    <div style={{ display: 'flex', gap: '6px' }}>
                        <input style={{ ...inputCls, width: '130px', padding: '6px 10px', fontSize: '0.82rem' }}
                            value={editing.value} onChange={e => setEditing({ ...editing, value: e.target.value })} autoFocus />
                        <button className="btn btn-sm" style={{ padding: '4px 8px' }} onClick={save}><Check size={12} /></button>
                        <button className="btn btn-sm" style={{ padding: '4px 8px' }} onClick={() => setEditing(null)}><X size={12} /></button>
                    </div>
                ) : (
                    <span style={{ fontWeight: 500 }}>{user.name}</span>
                )}
            </td>
            {/* ID */}
            <td style={{ padding: '12px 15px', color: 'var(--text-muted)', fontSize: '0.88rem' }}>{user.studentId}</td>
            {/* Class */}
            <td style={{ padding: '12px 15px' }}>
                {editing?.field === 'classGroup' ? (
                    <div style={{ display: 'flex', gap: '4px' }}>
                        <input style={{ ...inputCls, width: '90px', padding: '5px 8px', fontSize: '0.8rem' }}
                            value={editing.value} onChange={e => setEditing({ ...editing, value: e.target.value })} autoFocus />
                        <button className="btn btn-sm" onClick={save}><Check size={11} /></button>
                    </div>
                ) : (
                    <span style={{ fontSize: '0.82rem', color: 'var(--primary)', fontWeight: 'bold', background: 'rgba(79,70,229,0.1)', padding: '2px 8px', borderRadius: '4px' }}
                        onClick={() => setEditing({ id: user.id, field: 'classGroup', value: user.classGroup ?? '' })}>
                        {user.classGroup || 'N/A'}
                    </span>
                )}
            </td>
            {/* Remaining */}
            <td style={{ padding: '12px 15px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                    <span style={{ color: weekly < 600 ? 'var(--danger)' : 'var(--success)', fontSize: '0.88rem' }}>
                        W: {fmtMin(weekly)}
                    </span>
                    <span style={{ color: daily < 300 ? 'var(--danger)' : 'var(--text-muted)', fontSize: '0.78rem' }}>
                        D: {fmtMin(daily)}
                    </span>
                </div>
            </td>
            {/* Renames */}
            <td style={{ padding: '12px 15px' }}>
                <span style={{
                    fontSize: '0.78rem', padding: '2px 8px', borderRadius: '6px',
                    color: renames >= 2 ? 'var(--danger)' : 'var(--text-muted)',
                    background: renames >= 2 ? 'rgba(239,68,68,0.1)' : 'rgba(255,255,255,0.05)',
                }}>
                    {renames}/2
                </span>
            </td>
            {/* Actions */}
            <td style={{ padding: '12px 15px' }}>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <button className="btn btn-sm" title="Edit Name"
                        onClick={() => setEditing({ id: user.id, field: 'name', value: user.name ?? '' })}>
                        <Edit3 size={14} />
                    </button>
                    <button className="btn btn-sm" style={{ color: 'var(--danger)', background: 'rgba(239,68,68,0.1)' }}
                        title="Delete" onClick={() => onDelete(user.id)}>
                        <Trash2 size={14} />
                    </button>
                </div>
            </td>
        </tr>
    );
});

// ─── Main Component ───────────────────────────────────────────────────────────
const UserManagement = () => {
    const [users, setUsers] = useState<Student[]>([]);
    const [search, setSearch] = useState('');
    const [newUser, setNewUser] = useState<NewUser>({ name: '', studentId: '', password: '', classGroup: '', weeklyTime: 60, dailyTime: 30 });
    const [bulkConfig, setBulkConfig] = useState<BulkConfig>({ prefix: 'class9_', start: 1, end: 40, classGroup: 'Class 9', weeklyTime: 60, dailyTime: 30 });
    const [loading, setLoading] = useState(true);
    const [bulkLoading, setBulkLoading] = useState(false);
    const [importing, setImporting] = useState(false);

    useEffect(() => {
        const q = query(collection(db, 'students'), orderBy('studentId', 'asc'));
        const unsub = onSnapshot(q, (snap) => {
            setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() } as Student)));
            setLoading(false);
        });
        return () => unsub();
    }, []);

    const filteredUsers = useMemo(() =>
        users.filter(u =>
            u.studentId.toLowerCase().includes(search.toLowerCase()) ||
            (u.name ?? '').toLowerCase().includes(search.toLowerCase())
        ), [users, search]);

    const handleAddUser = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newUser.name || !newUser.studentId || !newUser.password) return;
        try {
            await addDoc(collection(db, 'students'), {
                ...newUser,
                remainingTime: newUser.weeklyTime * 60,
                dailyRemainingTime: newUser.dailyTime * 60,
                usernameChanges: 0,
                status: 'offline',
                createdAt: new Date(),
            });
            setNewUser({ name: '', studentId: '', password: '', classGroup: newUser.classGroup, weeklyTime: 60, dailyTime: 30 });
        } catch (err) { console.error('Add student error:', err); }
    };

    const handleDeleteUser = useCallback(async (id: string) => {
        if (!window.confirm('Delete this student?')) return;
        await deleteDoc(doc(db, 'students', id));
    }, []);

    const handleEditUser = useCallback(async (id: string, field: EditState['field'], value: number | string) => {
        try {
            if (field === 'weeklyTime') {
                await updateDoc(doc(db, 'students', id), { remainingTime: value as number });
            } else if (field === 'dailyTime') {
                await updateDoc(doc(db, 'students', id), { dailyRemainingTime: value as number });
            } else if (field === 'name') {
                await updateDoc(doc(db, 'students', id), { name: value as string });
            } else if (field === 'classGroup') {
                await updateDoc(doc(db, 'students', id), { classGroup: value as string });
            }
        } catch (err) { console.error('Edit error:', err); }
    }, []);

    const handleDeleteAll = async () => {
        if (!window.confirm('CRITICAL: Delete ALL student data? This cannot be undone.')) return;
        setLoading(true);
        try {
            const batch = writeBatch(db);
            const snap = await getDocs(collection(db, 'students'));
            snap.docs.forEach(d => batch.delete(d.ref));
            await batch.commit();
        } catch (err) { console.error('Clear error:', err); }
        setLoading(false);
    };

    // Optimized: use writeBatch instead of sequential addDoc calls
    const handleBulkCreate = async () => {
        const count = bulkConfig.end - bulkConfig.start + 1;
        if (!window.confirm(`Create ${count} student accounts?`)) return;
        setBulkLoading(true);
        try {
            // Firestore batch max is 500 writes — chunk if needed
            const CHUNK = 499;
            for (let offset = 0; offset < count; offset += CHUNK) {
                const batch = writeBatch(db);
                const end = Math.min(bulkConfig.start + offset + CHUNK - 1, bulkConfig.end);
                for (let i = bulkConfig.start + offset; i <= end; i++) {
                    const id = `${bulkConfig.prefix}${i.toString().padStart(2, '0')}`;
                    const ref = doc(collection(db, 'students'));
                    batch.set(ref, {
                        name: `Student ${id}`, studentId: id, password: id,
                        classGroup: bulkConfig.classGroup,
                        weeklyTime: bulkConfig.weeklyTime, dailyTime: bulkConfig.dailyTime,
                        remainingTime: bulkConfig.weeklyTime * 60,
                        dailyRemainingTime: bulkConfig.dailyTime * 60,
                        usernameChanges: 0, status: 'offline', createdAt: new Date(),
                    });
                }
                await batch.commit();
            }
            alert(`✅ ${count} accounts created.`);
        } catch (err) { console.error('Bulk create error:', err); }
        setBulkLoading(false);
    };

    const handleCsvImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setImporting(true);
        const reader = new FileReader();
        reader.onload = async (event) => {
            const csv = event.target?.result as string;
            const lines = csv.split('\n').map(l => l.trim()).filter(l => l.length > 0);

            // Expected format: Name, StudentID, Class, Password, WeeklyMin, DailyMin
            // Skip header if it looks like one
            const startIndex = (lines[0].toLowerCase().includes('name') || lines[0].toLowerCase().includes('id')) ? 1 : 0;

            const studentsToAdd = lines.slice(startIndex).map(line => {
                const [name, id, className, pwd, weekly, daily] = line.split(',').map(s => s?.trim());
                if (!id) return null;
                const w = parseInt(weekly) || bulkConfig.weeklyTime;
                const d = parseInt(daily) || bulkConfig.dailyTime;
                return {
                    name: name || `Student ${id}`,
                    studentId: id,
                    password: pwd || id,
                    classGroup: className || 'Imported',
                    weeklyTime: w,
                    dailyTime: d,
                    remainingTime: w * 60,
                    dailyRemainingTime: d * 60,
                    usernameChanges: 0,
                    status: 'offline',
                    createdAt: new Date()
                };
            }).filter(s => s !== null);

            if (!window.confirm(`Import ${studentsToAdd.length} students from CSV?`)) {
                setImporting(false);
                return;
            }

            try {
                const CHUNK = 499;
                for (let i = 0; i < studentsToAdd.length; i += CHUNK) {
                    const batch = writeBatch(db);
                    const chunk = studentsToAdd.slice(i, i + CHUNK);
                    chunk.forEach(s => {
                        const ref = doc(collection(db, 'students'));
                        batch.set(ref, s);
                    });
                    await batch.commit();
                }
                alert(`✅ ${studentsToAdd.length} students imported successfully.`);
            } catch (err) {
                console.error("Import error:", err);
                alert("Import failed. Check CSV format.");
            }
            setImporting(false);
        };
        reader.readAsText(file);
    };

    const numInput = (label: string, val: number, onChange: (v: number) => void, width = '90px') => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{label}</label>
            <input type="number" style={{ ...inputCls, width }} value={val}
                onChange={e => onChange(parseInt(e.target.value) || 0)} />
        </div>
    );

    return (
        <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div>
                <h1 style={{ marginBottom: '4px' }}>User Management</h1>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Manage student accounts and time quotas.</p>
            </div>

            {/* ── Add Student ── */}
            <div className="glass-panel" style={{ padding: '28px' }}>
                <h3 style={{ margin: '0 0 18px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <UserPlus size={20} color="var(--primary)" /> Add Student
                </h3>
                <form onSubmit={handleAddUser} style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                    {[
                        { ph: 'Full Name', key: 'name' as const, type: 'text', flex: '2' },
                        { ph: 'Class (e.g. 9A)', key: 'classGroup' as const, type: 'text', flex: '1' },
                        { ph: 'Student ID', key: 'studentId' as const, type: 'text', flex: '1' },
                        { ph: 'Password', key: 'password' as const, type: 'password', flex: '1' },
                    ].map(({ ph, key, type, flex }) => (
                        <input key={key} type={type} placeholder={ph} required
                            style={{ ...inputCls, flex, minWidth: '130px' }}
                            value={newUser[key] as string}
                            onChange={e => setNewUser(p => ({ ...p, [key]: e.target.value }))} />
                    ))}
                    <div style={{ display: 'flex', gap: '10px' }}>
                        {numInput('Weekly (min)', newUser.weeklyTime, v => setNewUser(p => ({ ...p, weeklyTime: v })))}
                        {numInput('Daily (min)', newUser.dailyTime, v => setNewUser(p => ({ ...p, dailyTime: v })))}
                    </div>
                    <button type="submit" className="btn btn-primary" style={{ height: '42px' }}>Add Student</button>
                    <div style={{ marginLeft: 'auto' }}>
                        <input type="file" id="csv-import" accept=".csv" style={{ display: 'none' }} onChange={handleCsvImport} />
                        <label htmlFor="csv-import" className="btn" style={{ height: '42px', background: 'rgba(59,130,246,0.1)', color: 'var(--primary)', border: '1px solid rgba(59,130,246,0.2)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                            {importing ? 'Importing...' : 'Excel/CSV Import'}
                        </label>
                    </div>
                </form>
            </div>

            {/* ── Bulk Generator ── */}
            <div className="glass-panel" style={{ padding: '28px', borderTop: '3px solid var(--primary)' }}>
                <h3 style={{ margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <UserPlus size={20} color="var(--primary)" /> Bulk Generator
                </h3>
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', flex: 1, minWidth: '140px' }}>
                        <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>ID Prefix</label>
                        <input style={{ ...inputCls }} value={bulkConfig.prefix}
                            onChange={e => setBulkConfig(p => ({ ...p, prefix: e.target.value }))} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', flex: 1, minWidth: '100px' }}>
                        <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Class Name</label>
                        <input style={{ ...inputCls }} value={bulkConfig.classGroup}
                            onChange={e => setBulkConfig(p => ({ ...p, classGroup: e.target.value }))} />
                    </div>
                    {numInput('Start #', bulkConfig.start, v => setBulkConfig(p => ({ ...p, start: v })), '75px')}
                    {numInput('End #', bulkConfig.end, v => setBulkConfig(p => ({ ...p, end: v })), '75px')}
                    {numInput('Weekly Min', bulkConfig.weeklyTime, v => setBulkConfig(p => ({ ...p, weeklyTime: v })))}
                    {numInput('Daily Min', bulkConfig.dailyTime, v => setBulkConfig(p => ({ ...p, dailyTime: v })))}
                    <button className="btn btn-primary" style={{ height: '42px', background: 'var(--success)' }}
                        onClick={handleBulkCreate} disabled={bulkLoading}>
                        {bulkLoading ? 'Creating...' : `Create ${bulkConfig.end - bulkConfig.start + 1} Accounts`}
                    </button>
                </div>
                <p style={{ marginTop: '12px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    Preview: <code style={{ color: 'var(--primary)' }}>{bulkConfig.prefix}{String(bulkConfig.start).padStart(2, '0')}</code>
                    {' → '}
                    <code style={{ color: 'var(--primary)' }}>{bulkConfig.prefix}{String(bulkConfig.end).padStart(2, '0')}</code>
                    {' (password = ID, uses batch writes for performance)'}
                </p>
            </div>

            {/* ── Student Table ── */}
            <div className="glass-panel" style={{ padding: '28px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
                    <h3 style={{ margin: 0 }}>Enrolled Students <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>({filteredUsers.length}/{users.length})</span></h3>
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                        <div style={{ position: 'relative' }}>
                            <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                            <input placeholder="Search by name or ID..." style={{ ...inputCls, paddingLeft: '32px', width: '220px' }}
                                value={search} onChange={e => setSearch(e.target.value)} />
                        </div>
                        <button className="btn btn-sm" style={{ color: 'var(--danger)', background: 'rgba(239,68,68,0.1)' }}
                            onClick={handleDeleteAll}>
                            <AlertTriangle size={14} /> Clear All
                        </button>
                    </div>
                </div>

                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                                {['Name', 'Student ID', 'Class', 'Remaining (W/D)', 'Renames', 'Actions'].map(h => (
                                    <th key={h} style={{ padding: '10px 15px', textAlign: 'left', fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {filteredUsers.map(user => (
                                <StudentRow key={user.id} user={user} onDelete={handleDeleteUser} onEdit={handleEditUser} />
                            ))}
                            {filteredUsers.length === 0 && !loading && (
                                <tr>
                                    <td colSpan={5} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                                        {search ? 'No students match your search.' : 'No students enrolled yet.'}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default UserManagement;
