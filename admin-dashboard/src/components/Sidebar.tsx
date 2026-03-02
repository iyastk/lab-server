import React, { useState } from 'react';
import { LayoutDashboard, Users, Monitor, Settings, LogOut, ShieldCheck, Clock, Menu, X } from 'lucide-react';
import { NavLink } from 'react-router-dom';

const Sidebar = () => {
    const [isOpen, setIsOpen] = useState(false);

    const navItems = [
        { icon: <LayoutDashboard size={20} />, label: 'Dashboard', path: '/' },
        { icon: <Monitor size={20} />, label: 'Live Monitoring', path: '/monitoring' },
        { icon: <Clock size={20} />, label: 'Automation', path: '/automation' },
        { icon: <LayoutDashboard size={20} />, label: 'History', path: '/history' },
        { icon: <Users size={20} />, label: 'User Management', path: '/users' },
        { icon: <ShieldCheck size={20} />, label: 'Download Client', path: '/download' },
        { icon: <Settings size={20} />, label: 'Settings', path: '/settings' },
    ];

    const toggleSidebar = () => setIsOpen(!isOpen);

    return (
        <>
            {/* Mobile Toggle Button */}
            <button
                onClick={toggleSidebar}
                style={{
                    position: 'fixed',
                    top: '20px',
                    left: '20px',
                    zIndex: 1000,
                    display: 'none',
                    padding: '10px',
                    background: 'var(--panel-bg)',
                    border: '1px solid var(--glass)',
                    borderRadius: '10px',
                    color: 'white'
                }}
                className="mobile-only"
            >
                {isOpen ? <X size={24} /> : <Menu size={24} />}
            </button>

            {/* Mobile Overlay */}
            {isOpen && (
                <div
                    className="mobile-only"
                    onClick={() => setIsOpen(false)}
                    style={{
                        position: 'fixed',
                        inset: 0,
                        backgroundColor: 'rgba(0, 0, 0, 0.5)',
                        zIndex: 998,
                        backdropFilter: 'blur(4px)'
                    }}
                />
            )}

            <aside
                className={`glass-panel sidebar ${isOpen ? 'open' : ''}`}
                style={{
                    width: '280px',
                    height: 'calc(100vh - 40px)',
                    margin: '20px',
                    padding: '20px',
                    display: 'flex',
                    flexDirection: 'column',
                    position: 'fixed',
                    zIndex: 999,
                    transition: 'transform 0.3s ease'
                }}
            >
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
                            onClick={() => setIsOpen(false)}
                            className={({ isActive }) => `btn ${isActive ? 'btn-primary' : ''}`}
                            style={({ isActive }) => ({
                                textDecoration: 'none',
                                color: isActive ? 'white' : 'var(--text-muted)',
                                background: isActive ? 'var(--primary)' : 'transparent',
                                justifyContent: 'flex-start',
                                padding: '12px 16px',
                                border: 'none'
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

                <style>{`
                    @media (max-width: 1024px) {
                        .sidebar {
                            transform: translateX(-120%);
                            margin: 0;
                            height: 100vh;
                            border-radius: 0;
                        }
                        .sidebar.open {
                            transform: translateX(0);
                        }
                        .mobile-only {
                            display: block !important;
                        }
                    }
                `}</style>
            </aside>
        </>
    );
};

export default Sidebar;
