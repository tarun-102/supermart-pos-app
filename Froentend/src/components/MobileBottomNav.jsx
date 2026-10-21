import React from 'react';

export default function MobileBottomNav({
    activeTab,
    setActiveTab,
    currentUser,
    heldCount = 0,
    onOpenShiftModal
}) {
    const isAdmin = currentUser?.role === 'admin';
    const isOfficer = currentUser?.role === 'cash_officer' || isAdmin;
    const isCashier = currentUser?.role === 'cashier' || isAdmin;

    return (
        <nav className="mobile-bottom-nav d-flex d-md-none" aria-label="Mobile Navigation">
            {/* POS Billing Tab */}
            {isCashier && (
                <button
                    type="button"
                    className={`mobile-nav-item ${activeTab === 'pos' ? 'active' : ''}`}
                    onClick={() => setActiveTab('pos')}
                >
                    <div className="position-relative">
                        <i className="bi bi-upc-scan"></i>
                        {heldCount > 0 && (
                            <span className="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger" style={{ fontSize: '0.6rem', padding: '2px 5px' }}>
                                {heldCount}
                            </span>
                        )}
                    </div>
                    <span>POS Bill</span>
                    {activeTab === 'pos' && <span className="nav-indicator-dot"></span>}
                </button>
            )}

            {/* Inventory / Stock Tab (Admin) */}
            {isAdmin && (
                <button
                    type="button"
                    className={`mobile-nav-item ${activeTab === 'inventory' ? 'active' : ''}`}
                    onClick={() => setActiveTab('inventory')}
                >
                    <i className="bi bi-boxes"></i>
                    <span>Stock</span>
                    {activeTab === 'inventory' && <span className="nav-indicator-dot"></span>}
                </button>
            )}

            {/* Cash Officer / Tally Tab */}
            {isOfficer && (
                <button
                    type="button"
                    className={`mobile-nav-item ${activeTab === 'cash_officer' ? 'active' : ''}`}
                    onClick={() => setActiveTab('cash_officer')}
                >
                    <i className="bi bi-cash-coin"></i>
                    <span>Tally</span>
                    {activeTab === 'cash_officer' && <span className="nav-indicator-dot"></span>}
                </button>
            )}

            {/* Invoices / Bills Tab */}
            <button
                type="button"
                className={`mobile-nav-item ${activeTab === 'bills' ? 'active' : ''}`}
                onClick={() => setActiveTab('bills')}
            >
                <i className="bi bi-receipt"></i>
                <span>Bills</span>
                {activeTab === 'bills' && <span className="nav-indicator-dot"></span>}
            </button>

            {/* Cash Drawer / Shift Modal Trigger */}
            {onOpenShiftModal && (
                <button
                    type="button"
                    className="mobile-nav-item text-secondary"
                    onClick={onOpenShiftModal}
                    title="Open Shift / Cash Drawer"
                >
                    <i className="bi bi-safe2"></i>
                    <span>Drawer</span>
                </button>
            )}
        </nav>
    );
}

