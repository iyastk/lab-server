import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Monitoring from './pages/Monitoring';
import UserManagement from './pages/UserManagement';
import Dashboard from './pages/Dashboard';
import History from './pages/History';
import Download from './pages/Download';

function App() {
    return (
        <Router>
            <Routes>
                <Route path="/" element={<Layout />}>
                    <Route index element={<Dashboard />} />
                    <Route path="monitoring" element={<Monitoring />} />
                    <Route path="history" element={<History />} />
                    <Route path="users" element={<UserManagement />} />
                    <Route path="download" element={<Download />} />
                    <Route path="settings" element={
                        <div className="glass-panel" style={{ padding: '30px' }}>
                            <h1>Settings</h1>
                            <p style={{ color: 'var(--text-muted)' }}>System and Lab configurations.</p>
                        </div>
                    } />
                </Route>
            </Routes>
        </Router>
    );
}

export default App;
