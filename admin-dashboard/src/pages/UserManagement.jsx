import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, addDoc, getDocs, query, orderBy, onSnapshot, deleteDoc, doc, writeBatch } from 'firebase/firestore';
import { UserPlus, Clock, Trash2, Edit, AlertTriangle } from 'lucide-react';

const UserManagement = () => {
    const [users, setUsers] = useState([]);
    const [newUser, setNewUser] = useState({ name: '', studentId: '', password: '', weeklyTime: 60, dailyTime: 30 });
    const [bulkConfig, setBulkConfig] = useState({ prefix: 'class9_', start: 1, end: 40, weeklyTime: 60, dailyTime: 30 });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const q = query(collection(db, 'students'), orderBy('studentId', 'asc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const userList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setUsers(userList);
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const handleAddUser = async (e) => {
        e.preventDefault();
        if (!newUser.name || !newUser.studentId || !newUser.password) return;

        try {
            await addDoc(collection(db, 'students'), {
                ...newUser,
                remainingTime: newUser.weeklyTime * 60,
                dailyRemainingTime: newUser.dailyTime * 60,
                usernameChanges: 0,
                status: 'offline',
                createdAt: new Date()
            });
            setNewUser({ name: '', studentId: '', password: '', weeklyTime: 60, dailyTime: 30 });
        } catch (err) {
            console.error("Error adding student:", err);
        }
    };

    const handleDeleteUser = async (id) => {
        if (!window.confirm("Are you sure you want to delete this student?")) return;
        try {
            await deleteDoc(doc(db, 'students', id));
        } catch (err) {
            console.error("Error deleting user:", err);
        }
    };

    const handleDeleteAll = async () => {
        if (!window.confirm("CRITICAL: This will delete ALL student data. This action cannot be undone. Proceed?")) return;

        setLoading(true);
        try {
            const batch = writeBatch(db);
            const snapshot = await getDocs(collection(db, 'students'));
            snapshot.docs.forEach((doc) => {
                batch.delete(doc.ref);
            });
            await batch.commit();
            alert("All student data cleared.");
        } catch (err) {
            console.error("Error clearing data:", err);
        }
        setLoading(false);
    };

    const handleBulkCreate = async () => {
        const confirm = window.confirm(`Create ${bulkConfig.end - bulkConfig.start + 1} users?`);
        if (!confirm) return;

        setLoading(true);
        try {
            for (let i = bulkConfig.start; i <= bulkConfig.end; i++) {
                const id = `${bulkConfig.prefix}${i.toString().padStart(2, '0')}`;
                await addDoc(collection(db, 'students'), {
                    name: `Student ${id}`,
                    studentId: id,
                    password: id,
                    weeklyTime: bulkConfig.weeklyTime,
                    dailyTime: bulkConfig.dailyTime,
                    remainingTime: bulkConfig.weeklyTime * 60,
                    dailyRemainingTime: bulkConfig.dailyTime * 60,
                    usernameChanges: 0,
                    status: 'offline',
                    createdAt: new Date()
                });
            }
            alert("Bulk creation complete!");
        } catch (err) {
            console.error("Bulk creation error:", err);
        }
        setLoading(false);
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
            {/* Manual Creation */}
            <div className="glass-panel animate-fade-in" style={{ padding: '30px' }}>
                <h2 style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <UserPlus size={24} color="var(--primary)" /> Add New Student
                </h2>
                <form onSubmit={handleAddUser} style={{ display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
                    <input
                        type="text"
                        placeholder="Student Name"
                        className="glass-panel"
                        style={{ padding: '12px', border: 'none', background: 'rgba(255,255,255,0.05)', color: 'white', flex: 1, minWidth: '200px' }}
                        value={newUser.name}
                        onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                    />
                    <input
                        type="text"
                        placeholder="Student ID"
                        className="glass-panel"
                        style={{ padding: '12px', border: 'none', background: 'rgba(255,255,255,0.05)', color: 'white', flex: 1, minWidth: '150px' }}
                        value={newUser.studentId}
                        onChange={(e) => setNewUser({ ...newUser, studentId: e.target.value })}
                    />
                    <input
                        type="password"
                        placeholder="Login Password"
                        className="glass-panel"
                        style={{ padding: '12px', border: 'none', background: 'rgba(255,255,255,0.05)', color: 'white', flex: 1, minWidth: '150px' }}
                        value={newUser.password}
                        onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                    />
                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>W:</span>
                            <input
                                type="number"
                                placeholder="Min/Week"
                                className="glass-panel"
                                style={{ padding: '12px', border: 'none', background: 'rgba(255,255,255,0.05)', color: 'white', width: '80px' }}
                                value={newUser.weeklyTime}
                                onChange={(e) => setNewUser({ ...newUser, weeklyTime: parseInt(e.target.value) })}
                            />
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>D:</span>
                            <input
                                type="number"
                                placeholder="Min/Day"
                                className="glass-panel"
                                style={{ padding: '12px', border: 'none', background: 'rgba(255,255,255,0.05)', color: 'white', width: '80px' }}
                                value={newUser.dailyTime}
                                onChange={(e) => setNewUser({ ...newUser, dailyTime: parseInt(e.target.value) })}
                            />
                        </div>
                    </div>
                    <button type="submit" className="btn btn-primary">Add Student</button>
                </form>
            </div>

            {/* Bulk Creation */}
            <div className="glass-panel animate-fade-in" style={{ padding: '30px', border: '1px solid rgba(79, 70, 229, 0.3)' }}>
                <h2 style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <UserPlus size={24} color="var(--primary)" /> Bulk User Generator
                </h2>
                <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                    <div style={{ flex: 1, minWidth: '150px' }}>
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '5px' }}>ID Prefix</p>
                        <input
                            type="text"
                            className="glass-panel"
                            style={{ padding: '12px', border: 'none', background: 'rgba(255,255,255,0.05)', color: 'white', width: '100%' }}
                            value={bulkConfig.prefix}
                            onChange={(e) => setBulkConfig({ ...bulkConfig, prefix: e.target.value })}
                        />
                    </div>
                    <div style={{ width: '80px' }}>
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '5px' }}>Start</p>
                        <input
                            type="number"
                            className="glass-panel"
                            style={{ padding: '12px', border: 'none', background: 'rgba(255,255,255,0.05)', color: 'white', width: '100%' }}
                            value={bulkConfig.start}
                            onChange={(e) => setBulkConfig({ ...bulkConfig, start: parseInt(e.target.value) })}
                        />
                    </div>
                    <div style={{ width: '80px' }}>
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '5px' }}>End</p>
                        <input
                            type="number"
                            className="glass-panel"
                            style={{ padding: '12px', border: 'none', background: 'rgba(255,255,255,0.05)', color: 'white', width: '100%' }}
                            value={bulkConfig.end}
                            onChange={(e) => setBulkConfig({ ...bulkConfig, end: parseInt(e.target.value) })}
                        />
                    </div>
                    <div style={{ width: '100px' }}>
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '5px' }}>Weekly Min</p>
                        <input
                            type="number"
                            className="glass-panel"
                            style={{ padding: '12px', border: 'none', background: 'rgba(255,255,255,0.05)', color: 'white', width: '100%' }}
                            value={bulkConfig.weeklyTime}
                            onChange={(e) => setBulkConfig({ ...bulkConfig, weeklyTime: parseInt(e.target.value) })}
                        />
                    </div>
                    <div style={{ width: '100px' }}>
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '5px' }}>Daily Min</p>
                        <input
                            type="number"
                            className="glass-panel"
                            style={{ padding: '12px', border: 'none', background: 'rgba(255,255,255,0.05)', color: 'white', width: '100%' }}
                            value={bulkConfig.dailyTime}
                            onChange={(e) => setBulkConfig({ ...bulkConfig, dailyTime: parseInt(e.target.value) })}
                        />
                    </div>
                    <button onClick={handleBulkCreate} className="btn btn-primary" disabled={loading} style={{ background: 'var(--success)', height: '45px' }}>
                        {loading ? 'Generating...' : 'Generate Bulk Accounts'}
                    </button>
                </div>
                <p style={{ marginTop: '15px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    Example: {bulkConfig.prefix}{bulkConfig.start.toString().padStart(2, '0')} to {bulkConfig.prefix}{bulkConfig.end.toString().padStart(2, '0')} (Password will match ID)
                </p>
            </div>

            <div className="glass-panel animate-fade-in" style={{ padding: '30px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <h2>Enrolled Students ({users.length})</h2>
                    <button
                        onClick={handleDeleteAll}
                        className="btn"
                        style={{ background: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)', border: '1px solid rgba(239, 68, 68, 0.2)', fontSize: '0.8rem', gap: '8px' }}
                    >
                        <AlertTriangle size={16} /> Clear All Student Data
                    </button>
                </div>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--glass)' }}>
                                <th style={{ padding: '15px' }}>Student Name</th>
                                <th style={{ padding: '15px' }}>ID</th>
                                <th style={{ padding: '15px' }}>Quota (W / D)</th>
                                <th style={{ padding: '15px' }}>Remaining (W / D)</th>
                                <th style={{ padding: '15px' }}>Renames</th>
                                <th style={{ padding: '15px' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {users.map(user => (
                                <tr key={user.id} style={{ borderBottom: '1px solid var(--glass)' }}>
                                    <td data-label="Name" style={{ padding: '15px' }}>{user.name}</td>
                                    <td data-label="ID" style={{ padding: '15px', color: 'var(--text-muted)' }}>{user.studentId}</td>
                                    <td data-label="Quota" style={{ padding: '15px' }}>{user.weeklyTime}m / {user.dailyTime}m</td>
                                    <td data-label="Status" style={{ padding: '15px' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                            <span style={{ color: user.remainingTime < 600 ? 'var(--danger)' : 'var(--success)', fontSize: '0.9rem' }}>
                                                W: {Math.floor(user.remainingTime / 60)} min
                                            </span>
                                            <span style={{ color: user.dailyRemainingTime < 300 ? 'var(--danger)' : 'var(--text-muted)', fontSize: '0.8rem' }}>
                                                D: {Math.floor(user.dailyRemainingTime / 60)} min
                                            </span>
                                        </div>
                                    </td>
                                    <td data-label="Renames" style={{ padding: '15px' }}>
                                        <span style={{
                                            fontSize: '0.8rem',
                                            color: (user.usernameChanges || 0) >= 2 ? 'var(--danger)' : 'var(--text-muted)',
                                            background: (user.usernameChanges || 0) >= 2 ? 'rgba(239,68,68,0.1)' : 'rgba(255,255,255,0.05)',
                                            padding: '2px 8px', borderRadius: '6px'
                                        }}>
                                            {user.usernameChanges || 0}/2
                                        </span>
                                    </td>
                                    <td data-label="Actions" style={{ padding: '15px', display: 'flex', gap: '10px' }}>
                                        <button className="btn" style={{ background: 'rgba(255,255,255,0.05)', padding: '8px' }}><Edit size={16} /></button>
                                        <button
                                            onClick={() => handleDeleteUser(user.id)}
                                            className="btn"
                                            style={{ background: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)', padding: '8px' }}
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {users.length === 0 && !loading && (
                                <tr><td colSpan="6" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>No students enrolled yet.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
            <style>{`
                @media (max-width: 768px) {
                    .glass-panel { padding: 20px !important; }
                    input, .btn { width: 100% !important; margin-right: 0 !important; }
                    thead { display: none; }
                    tr { 
                        display: flex; 
                        flex-direction: column; 
                        padding: 15px 0; 
                        border-bottom: 2px solid var(--glass) !important; 
                    }
                    td { 
                        padding: 5px 15px !important; 
                        display: flex; 
                        justify-content: space-between; 
                        align-items: center;
                    }
                    td::before {
                        content: attr(data-label);
                        font-weight: bold;
                        color: var(--text-muted);
                        font-size: 0.8rem;
                    }
                    .mobile-stack { flex-direction: column !important; gap: 10px !important; }
                }
            `}</style>
        </div>
    );
};

export default UserManagement;
