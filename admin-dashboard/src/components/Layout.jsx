import React from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';

const Layout = () => {
    return (
        <div style={{ display: 'flex', minHeight: '100vh' }}>
            <Sidebar />
            <main style={{ marginLeft: '320px', flex: 1, padding: '40px 40px 40px 0' }}>
                <Outlet />
            </main>
        </div>
    );
};

export default Layout;
