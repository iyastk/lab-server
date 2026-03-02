import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';

const Monitoring = lazy(() => import('./pages/Monitoring'));
const UserManagement = lazy(() => import('./pages/UserManagement'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const History = lazy(() => import('./pages/History'));
const Download = lazy(() => import('./pages/Download'));
const Scheduling = lazy(() => import('./pages/Scheduling'));

const Fallback = () => (
    <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
        Loading module...
    </div>
);

function App() {
    return (
        <Router>
            <Suspense fallback={<Fallback />}>
                <Routes>
                    <Route path="/" element={<Layout />}>
                        <Route index element={<Dashboard />} />
                        <Route path="monitoring" element={<Monitoring />} />
                        <Route path="history" element={<History />} />
                        <Route path="users" element={<UserManagement />} />
                        <Route path="download" element={<Download />} />
                        <Route path="automation" element={<Scheduling />} />
                        <Route path="settings" element={
                            <div className="glass-panel" style={{ padding: '30px' }}>
                                <h1>Settings</h1>
                                <p style={{ color: 'var(--text-muted)' }}>System and Lab configurations.</p>
                            </div>
                        } />
                    </Route>
                </Routes>
                {/* Deployment Sync Indicator */}
                <div style={{ position: 'fixed', bottom: '10px', right: '10px', fontSize: '0.65rem', color: 'var(--text-muted)', opacity: 0.5, pointerEvents: 'none', zIndex: 10000 }}>
                    LabGuard Admin v1.9.1 (UI Redesign)
                </div>
            </Suspense>
        </Router>
    );
}

export default App;
