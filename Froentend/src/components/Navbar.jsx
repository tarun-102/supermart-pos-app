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
        <header className="navbar-dmart sticky-top px-2 px-md-3 py-2">
            <div className="container-fluid p-0">
                {/* Top Row: Brand & Quick Action Controls */}
                <div className="d-flex align-items-center justify-content-between gap-2 pb-2 pb-md-0 border-bottom border-white border-opacity-10 mb-md-0 border-md-0">
                    {/* Brand & Store Info */}
                    <div className="d-flex align-items-center gap-2 text-truncate">
                        <span className="fs-3">🏬</span>
                        <div className="text-truncate">
                            <div className="d-flex align-items-center gap-2">
                                <span className="fw-bolder fs-5 text-white text-truncate" style={{ maxWidth: '180px' }}>
                                    {storeConfig?.storeName || 'SuperStore POS'}
                                </span>
                                <span className="brand-badge text-uppercase d-none d-sm-inline">
                                    {storeConfig?.storeType || 'POS System'}
                                </span>
                                <span className="badge bg-warning text-dark fw-bold px-2 py-0 d-inline-block d-md-none" style={{ fontSize: '0.68rem' }}>
                                    {currentCounter}
                                </span>
                            </div>
                            <small className="text-white-50 d-none d-sm-block text-truncate" style={{ fontSize: '0.7rem', maxWidth: '280px' }}>
                                {storeConfig?.address || 'Universal Retail Billing & Cash Office ERP'}
                            </small>
                        </div>

                        <div className="vr bg-white opacity-25 mx-1 d-none d-lg-block" style={{ height: '32px' }}></div>

                        {/* Counter & Clock badge for Desktop */}
                        <div className="d-none d-lg-flex flex-column text-white">
                            <div className="d-flex align-items-center gap-2">
                                <span className="badge bg-warning text-dark fw-bold px-2 py-1">
                                    <i className="bi bi-display me-1"></i>
                                    {currentCounter}
                                </span>
                                <span className="font-mono text-warning fw-semibold small">
                                    <i className="bi bi-clock me-1"></i>{currentTime}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Navigation Pills (Integrated for Desktop >= md) */}
                    <nav className="nav nav-pills nav-pills-pos d-none d-md-flex align-items-center">
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
                                <span>Stock &amp; Inventory</span>
                                <span className="badge bg-dark text-warning ms-1" style={{ fontSize: '0.65rem' }}>Admin</span>
                            </button>
                        )}

                        {isOfficer && (
                            <button
                                className={`nav-link ${activeTab === 'cash_officer' ? 'active' : ''}`}
                                onClick={() => setActiveTab('cash_officer')}
                            >
                                <i className="bi bi-cash-coin"></i>
                                <span>Cash Officer &amp; Tally</span>
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
                                className="btn btn-sm btn-outline-warning text-white fw-bold d-flex align-items-center gap-1 shadow-sm px-2 py-1"
                                onClick={onOpenStoreSettings}
                                title="Setup Store Profile & Counters"
                                style={{ fontSize: '0.75rem' }}
                            >
                                <i className="bi bi-gear-fill text-warning"></i>
                                <span className="d-none d-xl-inline">Shop Setup</span>
                            </button>
                        )}

                        {isAdmin && (
                            <button
                                className="btn btn-sm btn-warning text-dark fw-bold d-flex align-items-center gap-1 shadow-sm position-relative px-2 py-1"
                                onClick={onOpenStaffApprovals}
                                title="Manage & Approve Cashier / Officer Registration Requests"
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
                                className="btn btn-sm btn-outline-light d-flex align-items-center gap-1 fw-semibold px-2 py-1"
                                onClick={onOpenShiftModal}
                                title="Open or Close Register Shift & View Cash Drawer"
                                style={{ fontSize: '0.75rem' }}
                            >
                                <i className="bi bi-safe"></i>
                                <span className="d-none d-xl-inline">Drawer</span>
                            </button>
                        )}

                        {/* User Pill */}
                        <div className="d-flex align-items-center gap-1 bg-white bg-opacity-10 px-2 py-1 rounded text-white border border-white border-opacity-25" style={{ fontSize: '0.75rem' }}>
                            <i className="bi bi-person-circle text-warning"></i>
                            <span className="fw-bold d-none d-sm-inline text-truncate" style={{ maxWidth: '90px' }}>
                                {currentUser.name}
                            </span>
                        </div>

                        {/* Logout */}
                        <button
                            className="btn btn-sm btn-outline-danger text-white border-white border-opacity-50 d-flex align-items-center gap-1 fw-bold px-2 py-1"
                            onClick={onLogout}
                            title="Sign Out"
                            style={{ fontSize: '0.75rem' }}
                        >
                            <i className="bi bi-box-arrow-right"></i>
                        </button>
                    </div>
                </div>

                {/* Bottom Row on Mobile (< md): Full Horizontal Scrollable Tab Bar */}
                <div className="d-block d-md-none pt-2">
                    <nav className="nav nav-pills nav-pills-pos w-100">
                        {isCashier && (
                            <button
                                className={`nav-link ${activeTab === 'pos' ? 'active' : ''}`}
                                onClick={() => setActiveTab('pos')}
                            >
                                <i className="bi bi-upc-scan"></i>
                                <span>POS Billing</span>
                                {heldCount > 0 && (
                                    <span className="badge rounded-pill bg-danger ms-1" style={{ fontSize: '0.62rem' }}>
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
                </div>
            </div>
        </header>
    );
}
