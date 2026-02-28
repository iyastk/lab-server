import React from 'react';
import { LayoutDashboard, Users, Monitor, Settings, LogOut, ShieldCheck } from 'lucide-react';
import { NavLink } from 'react-router-dom';

const Sidebar = () => {
    const navItems = [
        { icon: <LayoutDashboard size={20} />, label: 'Dashboard', path: '/' },
        { icon: <Monitor size={20} />, label: 'Live Monitoring', path: '/monitoring' },
        { icon: <LayoutDashboard size={20} />, label: 'History', path: '/history' },
        { icon: <Users size={20} />, label: 'User Management', path: '/users' },
        { icon: <ShieldCheck size={20} />, label: 'Download Client', path: '/download' },
        { icon: <Settings size={20} />, label: 'Settings', path: '/settings' },
    ];

    return (
        <aside className="glass-panel" style={{ width: '280px', height: 'calc(100vh - 40px)', margin: '20px', padding: '20px', display: 'flex', flexDirection: 'column', position: 'fixed' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '40px', padding: '0 10px' }}>
                <div style={{ background: 'var(--primary)', padding: '8px', borderRadius: '10px' }}>
                    <ShieldCheck color="white" size={24} />
                </div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>LabGuard <span style={{ color: 'var(--primary)', fontSize: '0.8rem' }}>ADMIN</span></h2>
            </div>

            <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {navItems.map((item) => (
                    <NavLink
                        key={item.path}
                        to={item.path}
                        className={({ isActive }) => `btn ${isActive ? 'btn-primary' : ''}`}
                        style={({ isActive }) => ({
                            textDecoration: 'none',
                            color: isActive ? 'white' : 'var(--text-muted)',
                            background: isActive ? 'var(--primary)' : 'transparent',
                            justifyContent: 'flex-start',
                            padding: '12px 16px',
                        })}
                    >
                        {item.icon}
                        <span>{item.label}</span>
                    </NavLink>
                ))}
            </nav>

            <button className="btn" style={{ background: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)', marginTop: 'auto', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                <LogOut size={20} />
                <span>Logout</span>
            </button>
        </aside>
    );
};

export default Sidebar;
