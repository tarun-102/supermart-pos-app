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
        <header className="navbar-dmart sticky-top px-3 py-2">
            <div className="container-fluid d-flex flex-wrap align-items-center justify-content-between gap-2">
                {/* Brand & Store Info */}
                <div className="d-flex align-items-center gap-3">
                    <div className="d-flex align-items-center gap-2">
                        <span className="fs-3">🏬</span>
                        <div>
                            <div className="d-flex align-items-center gap-2">
                                <span className="fw-bolder fs-5 tracking-wide text-white text-truncate" style={{ maxWidth: '240px' }}>
                                    {storeConfig?.storeName || 'SuperStore POS'}
                                </span>
                                <span className="brand-badge text-uppercase d-none d-sm-inline" style={{ fontSize: '0.72rem' }}>
                                    {storeConfig?.storeType || 'POS System'}
                                </span>
                            </div>
                            <small className="text-white-50 d-none d-sm-block" style={{ fontSize: '0.72rem' }}>
                                {storeConfig?.address || 'Universal Retail Billing & Cash Office ERP'}
                            </small>
                        </div>
                    </div>

                    <div className="vr bg-white opacity-25 mx-1 d-none d-md-block" style={{ height: '35px' }}></div>

                    {/* Counter & Clock badge */}
                    <div className="d-none d-md-flex flex-column text-white">
                        <div className="d-flex align-items-center gap-2">
                            <span className="badge bg-warning text-dark fw-bold px-2 py-1">
                                <i className="bi bi-display me-1"></i>
                                {currentCounter}
                            </span>
                            <span className="font-mono text-warning fw-semibold small">
                                <i className="bi bi-clock me-1"></i>{currentTime}
                            </span>
                        </div>
                        <small className="text-white-50" style={{ fontSize: '0.7rem' }}>
                            {activeShift ? `Shift: ${activeShift.shiftNumber}` : 'Drawer: Not Opened'}
                        </small>
                    </div>
                </div>

                {/* Navigation Pills */}
                <nav className="nav nav-pills nav-pills-pos">
                    {/* POS Billing: Available to Cashier & Admin */}
                    {isCashier && (
                        <button
                            className={`nav-link ${activeTab === 'pos' ? 'active' : ''}`}
                            onClick={() => setActiveTab('pos')}
                        >
                            <i className="bi bi-upc-scan"></i>
                            <span>POS Billing</span>
                            {heldCount > 0 && (
                                <span className="badge rounded-pill bg-danger ms-1" style={{ fontSize: '0.65rem' }}>
                                    {heldCount} Hold
                                </span>
                            )}
                        </button>
                    )}

                    {/* Inventory: ONLY Available to Admin (Restricted from Cashier & Officer) */}
                    {isAdmin && (
                        <button
                            className={`nav-link ${activeTab === 'inventory' ? 'active' : ''}`}
                            onClick={() => setActiveTab('inventory')}
                        >
                            <i className="bi bi-boxes"></i>
                            <span>Stock &amp; Inventory</span>
                            <span className="badge bg-dark text-warning ms-1" style={{ fontSize: '0.65rem' }}>Admin</span>
                        </button>
                    )}

                    {/* Cash Officer & Tally: Available to Cash Officer & Admin */}
                    {isOfficer && (
                        <button
                            className={`nav-link ${activeTab === 'cash_officer' ? 'active' : ''}`}
                            onClick={() => setActiveTab('cash_officer')}
                        >
                            <i className="bi bi-cash-coin"></i>
                            <span>Cash Officer &amp; Tally</span>
                            <span className="badge bg-light text-success ms-1 small fw-bold">Report</span>
                        </button>
                    )}

                    {/* Bills History */}
                    <button
                        className={`nav-link ${activeTab === 'bills' ? 'active' : ''}`}
                        onClick={() => setActiveTab('bills')}
                    >
                        <i className="bi bi-receipt"></i>
                        <span>Bills</span>
                    </button>
                </nav>

                {/* Right Area: Store Settings (Admin), Staff Approvals, Shift Drawer, User badge, and Logout */}
                <div className="d-flex align-items-center gap-2">
                    {/* Store Settings Button (Admin / Store Owner) */}
                    {isAdmin && (
                        <button
                            className="btn btn-sm btn-outline-warning text-white fw-bold d-flex align-items-center gap-1 shadow-sm"
                            onClick={onOpenStoreSettings}
                            title="Setup Store Profile & Counters"
                        >
                            <i className="bi bi-gear-fill text-warning"></i>
                            <span className="d-none d-lg-inline">Shop Setup</span>
                        </button>
                    )}

                    {/* Admin Staff Approvals Button */}
                    {isAdmin && (
                        <button
                            className="btn btn-sm btn-warning text-dark fw-bold d-flex align-items-center gap-1 shadow-sm position-relative"
                            onClick={onOpenStaffApprovals}
                            title="Manage & Approve Cashier / Officer Registration Requests"
                        >
                            <i className="bi bi-person-check-fill"></i>
                            <span className="d-none d-lg-inline">Staff Requests</span>
                            {pendingStaffCount > 0 && (
                                <span className="badge bg-danger text-white rounded-pill ms-1 animate__animated animate__pulse">
                                    {pendingStaffCount} New
                                </span>
                            )}
                        </button>
                    )}

                    {/* Shift Register Button (for Cashiers) */}
                    {isCashier && (
                        <button
                            className="btn btn-sm btn-outline-light d-flex align-items-center gap-1 fw-semibold"
                            onClick={onOpenShiftModal}
                            title="Open or Close Register Shift & View Cash Drawer"
                        >
                            <i className="bi bi-safe"></i>
                            <span className="d-none d-lg-inline">Drawer Tally</span>
                        </button>
                    )}

                    {/* Logged-in User Badge */}
                    <div className="d-flex align-items-center gap-2 bg-white bg-opacity-10 px-2 py-1 rounded text-white border border-white border-opacity-25">
                        <i className="bi bi-person-circle fs-5 text-warning"></i>
                        <div className="d-none d-sm-block text-start leading-tight">
                            <div className="fw-bold small text-truncate" style={{ maxWidth: '120px' }}>
                                {currentUser.name}
                            </div>
                            <small className="badge bg-secondary text-uppercase" style={{ fontSize: '0.6rem' }}>
                                {currentUser.role}
                            </small>
                        </div>
                    </div>

                    {/* Logout Button */}
                    <button
                        className="btn btn-sm btn-outline-light d-flex align-items-center gap-1 fw-bold"
                        onClick={onLogout}
                        title="Sign Out / Logout"
                    >
                        <i className="bi bi-box-arrow-right"></i>
                        <span className="d-none d-md-inline">Logout</span>
                    </button>
                </div>
            </div>
        </header>
    );
}
