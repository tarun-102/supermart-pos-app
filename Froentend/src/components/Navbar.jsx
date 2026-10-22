import React, { useState, useEffect } from 'react';

export default function Navbar({
    activeTab,
    setActiveTab,
    currentUser,
    activeShift,
    onOpenShiftModal,
    onOpenStaffApprovals,
    onOpenStoreSettings,
    storeConfig,
    pendingStaffCount = 0,
    heldCount = 0,
    onLogout
}) {
    const [currentTime, setCurrentTime] = useState(new Date().toLocaleTimeString());

    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    const isAdmin = currentUser.role === 'admin';
    const isOfficer = currentUser.role === 'cash_officer' || isAdmin;
    const isCashier = currentUser.role === 'cashier' || isAdmin;
    const currentCounter = activeShift?.counterNo || currentUser.counterAssigned || 'Counter-01';

    return (
        <header className="navbar-modern sticky-top px-2 px-md-3 py-2">
            <div className="container-fluid p-0">
                <div className="d-flex align-items-center justify-content-between gap-1 gap-sm-2">
                    {/* Brand & Store Info */}
                    <div className="d-flex align-items-center gap-2 text-truncate" style={{ maxWidth: '55%', minWidth: 0 }}>
                        <div
                            className="rounded-3 d-flex align-items-center justify-content-center flex-shrink-0 shadow-sm"
                            style={{
                                width: '36px',
                                height: '36px',
                                background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.25) 0%, rgba(56, 189, 248, 0.25) 100%)',
                                border: '1px solid rgba(99, 102, 241, 0.45)',
                                color: '#38bdf8'
                            }}
                        >
                            <i className="bi bi-shop-window fs-5"></i>
                        </div>
                        <div className="text-truncate">
                            <div className="d-flex align-items-center gap-1 text-truncate">
                                <span className="fw-bolder fs-6 text-white text-truncate" style={{ letterSpacing: '-0.2px' }}>
                                    {storeConfig?.storeName || 'ShiftFlow POS'}
                                </span>
                                <span className="brand-badge text-uppercase d-none d-sm-inline">
                                    {storeConfig?.storeType || 'Retail POS'}
                                </span>
                                <span
                                    className="badge font-mono fw-bold px-1 py-0 d-inline-block d-md-none flex-shrink-0"
                                    style={{
                                        fontSize: '0.65rem',
                                        background: 'rgba(56, 189, 248, 0.15)',
                                        color: '#38bdf8',
                                        border: '1px solid rgba(56, 189, 248, 0.35)'
                                    }}
                                >
                                    {currentCounter ? currentCounter.split(' ')[0] : 'Desk-01'}
                                </span>
                            </div>
                            <small className="text-muted d-none d-sm-block text-truncate" style={{ fontSize: '0.7rem', maxWidth: '280px' }}>
                                {storeConfig?.address || 'Universal Retail Billing & Cash Office ERP'}
                            </small>
                        </div>

                        <div className="vr opacity-25 mx-2 d-none d-lg-block" style={{ height: '28px', backgroundColor: 'rgba(255, 255, 255, 0.2)' }}></div>

                        {/* Counter & Clock badge for Desktop */}
                        <div className="d-none d-lg-flex flex-column">
                            <div className="d-flex align-items-center gap-2">
                                <span
                                    className="badge fw-bold px-2 py-1"
                                    style={{
                                        background: 'rgba(99, 102, 241, 0.15)',
                                        color: '#a5b4fc',
                                        border: '1px solid rgba(99, 102, 241, 0.35)'
                                    }}
                                >
                                    <i className="bi bi-display me-1 text-info"></i>
                                    {currentCounter}
                                </span>
                                <span className="font-mono text-muted fw-semibold small" style={{ fontSize: '0.78rem' }}>
                                    <i className="bi bi-clock me-1 text-info"></i>{currentTime}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Navigation Pills (Integrated for Desktop >= md) */}
                    <nav className="nav nav-pills nav-pills-pos d-none d-md-flex align-items-center flex-nowrap overflow-auto">
                        {isCashier && (
                            <button
                                className={`nav-link ${activeTab === 'pos' ? 'active' : ''}`}
                                onClick={() => setActiveTab('pos')}
                            >
                                <i className="bi bi-upc-scan"></i>
                                <span>POS Billing</span>
                                {heldCount > 0 && (
                                    <span className="badge rounded-pill bg-danger ms-1" style={{ fontSize: '0.65rem' }}>
                                        {heldCount}
                                    </span>
                                )}
                            </button>
                        )}

                        {isAdmin && (
                            <button
                                className={`nav-link ${activeTab === 'inventory' ? 'active' : ''}`}
                                onClick={() => setActiveTab('inventory')}
                            >
                                <i className="bi bi-boxes"></i>
                                <span>Stock Master</span>
                            </button>
                        )}

                        {isOfficer && (
                            <button
                                className={`nav-link ${activeTab === 'cash_officer' ? 'active' : ''}`}
                                onClick={() => setActiveTab('cash_officer')}
                            >
                                <i className="bi bi-cash-coin"></i>
                                <span>Cash Tally</span>
                            </button>
                        )}

                        <button
                            className={`nav-link ${activeTab === 'bills' ? 'active' : ''}`}
                            onClick={() => setActiveTab('bills')}
                        >
                            <i className="bi bi-receipt"></i>
                            <span>Bills</span>
                        </button>
                    </nav>

                    {/* Right Area: Action Buttons (Shop Setup, Staff, Drawer, User, Logout) */}
                    <div className="d-flex align-items-center gap-1 gap-sm-2 flex-shrink-0">
                        {isAdmin && (
                            <button
                                className="btn btn-sm btn-outline-secondary fw-bold d-none d-sm-flex align-items-center gap-1 shadow-sm px-2 py-1"
                                onClick={onOpenStoreSettings}
                                title="Setup Store Profile & Counters"
                                style={{ fontSize: '0.75rem' }}
                            >
                                <i className="bi bi-gear-fill text-info"></i>
                                <span className="d-none d-xl-inline">Shop Setup</span>
                            </button>
                        )}

                        {isAdmin && (
                            <button
                                className="btn btn-sm btn-primary fw-bold d-flex align-items-center gap-1 shadow-sm position-relative px-2 py-1"
                                onClick={onOpenStaffApprovals}
                                title="Manage Staff Requests"
                                style={{ fontSize: '0.75rem' }}
                            >
                                <i className="bi bi-person-check-fill"></i>
                                <span className="d-none d-xl-inline">Staff</span>
                                {pendingStaffCount > 0 && (
                                    <span className="badge bg-danger text-white rounded-pill ms-1">
                                        {pendingStaffCount}
                                    </span>
                                )}
                            </button>
                        )}

                        {isCashier && (
                            <button
                                className="btn btn-sm btn-outline-primary d-flex align-items-center gap-1 fw-semibold px-2 py-1"
                                onClick={onOpenShiftModal}
                                title="Register Drawer & Shift"
                                style={{ fontSize: '0.75rem' }}
                            >
                                <i className="bi bi-safe2"></i>
                                <span className="d-none d-xl-inline">Drawer</span>
                            </button>
                        )}

                        {/* User Pill */}
                        <div
                            className="d-flex align-items-center gap-1 px-2 py-1 rounded-3 text-white"
                            style={{
                                fontSize: '0.75rem',
                                background: 'rgba(255, 255, 255, 0.05)',
                                border: '1px solid rgba(255, 255, 255, 0.1)'
                            }}
                        >
                            <i className="bi bi-person-circle text-info"></i>
                            <span className="fw-bold d-none d-sm-inline text-truncate" style={{ maxWidth: '90px' }}>
                                {currentUser.name}
                            </span>
                        </div>

                        {/* Logout */}
                        <button
                            className="btn btn-sm btn-outline-danger d-flex align-items-center gap-1 fw-bold px-2 py-1"
                            onClick={onLogout}
                            title="Sign Out"
                            style={{ fontSize: '0.75rem' }}
                        >
                            <i className="bi bi-box-arrow-right"></i>
                        </button>
                    </div>
                </div>
            </div>
        </header>
    );
}
