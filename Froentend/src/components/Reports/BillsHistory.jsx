import React, { useState, useEffect } from 'react';
import { apiFetch } from '../../utils/api';
import ReceiptModal from '../POS/ReceiptModal';

export default function BillsHistory({ currentUser, activeShift, onOpenShiftModal }) {
    const isCashier = currentUser?.role === 'cashier';
    const [scopeFilter, setScopeFilter] = useState(isCashier ? 'CURRENT_SHIFT' : 'ALL');
    const [bills, setBills] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [paymentFilter, setPaymentFilter] = useState('ALL');
    const [selectedBill, setSelectedBill] = useState(null);

    useEffect(() => {
        loadBills();
    }, [paymentFilter, scopeFilter, activeShift]);

    const loadBills = async () => {
        setLoading(true);
        try {
            const queryParams = new URLSearchParams();
            if (paymentFilter !== 'ALL') queryParams.append('paymentMethod', paymentFilter);
            if (search) queryParams.append('search', search);

            if (scopeFilter === 'CURRENT_SHIFT') {
                if (!activeShift) {
                    setBills([]);
                    setLoading(false);
                    return;
                }
                queryParams.append('shiftId', activeShift._id);
            } else if (isCashier) {
                queryParams.append('cashierId', currentUser.id);
            }

            const res = await apiFetch(`/billing/bills?${queryParams.toString()}`);
            if (res.bills) setBills(res.bills);
        } catch (err) {
            console.error('Failed to load bills:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleSearchSubmit = (e) => {
        e.preventDefault();
        loadBills();
    };

    // Quick stats
    const totalSalesSum = bills.reduce((s, b) => s + (Number(b.netPayable) || 0), 0);
    const totalSavingsGiven = bills.reduce((s, b) => s + (Number(b.totalSavings) || 0), 0);

    return (
        <div className="container-fluid py-4 px-3">
            {/* Header */}
            <div className="d-flex flex-wrap justify-content-between align-items-center mb-4 gap-2">
                <div>
                    <div className="d-flex align-items-center gap-2">
                        <span className="fs-3">📑</span>
                        <h4 className="fw-bolder mb-0 text-dark">Customer Invoices &amp; Billing History</h4>
                    </div>
                    <p className="text-muted small mb-0">
                        View past customer transactions, inspect split payment breakdowns, and re-print receipts.
                    </p>
                </div>
                <div className="d-flex gap-2 align-items-center flex-wrap">
                    <div className="btn-group btn-group-sm" role="group">
                        <button
                            type="button"
                            className={`btn fw-bold ${scopeFilter === 'CURRENT_SHIFT' ? 'btn-primary text-white' : 'btn-outline-secondary'}`}
                            onClick={() => setScopeFilter('CURRENT_SHIFT')}
                        >
                            <i className="bi bi-clock-history me-1"></i>
                            Current Shift {activeShift ? `(${bills.length})` : '(0)'}
                        </button>
                        <button
                            type="button"
                            className={`btn fw-bold ${scopeFilter === 'ALL' ? 'btn-primary text-white' : 'btn-outline-secondary'}`}
                            onClick={() => setScopeFilter('ALL')}
                        >
                            All {isCashier ? 'My Invoices' : 'Store Invoices'}
                        </button>
                    </div>

                    <button className="btn btn-outline-success btn-sm fw-bold" onClick={loadBills}>
                        <i className="bi bi-arrow-clockwise me-1"></i> Refresh
                    </button>
                </div>
            </div>

            {/* Quick Metrics */}
            <div className="row g-3 mb-4">
                <div className="col-md-4">
                    <div className="card border-0 shadow-sm p-3 rounded-3 bg-white border-start border-success border-4">
                        <small className="text-muted fw-bold text-uppercase">
                            {scopeFilter === 'CURRENT_SHIFT' ? 'Current Shift Invoiced' : 'Total Invoiced Amount'}
                        </small>
                        <div className="fs-3 fw-bold font-mono text-success">₹{totalSalesSum.toLocaleString('en-IN')}</div>
                    </div>
                </div>
                <div className="col-md-4">
                    <div className="card border-0 shadow-sm p-3 rounded-3 bg-white border-start border-warning border-4">
                        <small className="text-muted fw-bold text-uppercase">Total Savings Delivered</small>
                        <div className="fs-3 fw-bold font-mono text-warning">₹{totalSavingsGiven.toFixed(2)}</div>
                    </div>
                </div>
                <div className="col-md-4">
                    <div className="card border-0 shadow-sm p-3 rounded-3 bg-white border-start border-primary border-4">
                        <small className="text-muted fw-bold text-uppercase">
                            {scopeFilter === 'CURRENT_SHIFT' ? 'Current Shift Bills' : 'Total Bills Issued'}
                        </small>
                        <div className="fs-3 fw-bold font-mono text-dark">{bills.length} Bills</div>
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div className="card border-0 shadow-sm p-3 mb-3 rounded-3 bg-white">
                <div className="row g-2 align-items-center">
                    <div className="col-md-6">
                        <form onSubmit={handleSearchSubmit}>
                            <div className="input-group">
                                <span className="input-group-text bg-light"><i className="bi bi-search"></i></span>
                                <input
                                    type="text"
                                    className="form-control"
                                    placeholder="Search Bill Number (e.g. DM-...) or Mobile..."
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                />
                                <button type="submit" className="btn btn-outline-success">Search</button>
                            </div>
                        </form>
                    </div>

                    <div className="col-md-6">
                        <div className="d-flex align-items-center justify-content-md-end gap-2">
                            <label className="small text-muted fw-bold text-nowrap mb-0">Payment Method:</label>
                            <select
                                className="form-select form-select-sm fw-semibold w-auto"
                                value={paymentFilter}
                                onChange={(e) => setPaymentFilter(e.target.value)}
                            >
                                <option value="ALL">All Payment Methods</option>
                                <option value="SPLIT">Split Payment (Multi-Mode)</option>
                                <option value="CASH">Cash</option>
                                <option value="UPI">UPI QR</option>
                                <option value="CARD">Debit / Credit Card</option>
                            </select>
                        </div>
                    </div>
                </div>
            </div>

            {/* Bills Table */}
            <div className="card border-0 shadow-sm rounded-3 overflow-hidden bg-white">
                <div className="table-responsive">
                    <table className="table table-hover align-middle mb-0">
                        <thead className="table-light">
                            <tr>
                                <th>Invoice No &amp; Time</th>
                                <th>Counter &amp; Cashier</th>
                                <th>Customer Details</th>
                                <th className="text-center">Items</th>
                                <th className="text-end">Savings (₹)</th>
                                <th className="text-end">Net Amount</th>
                                <th className="text-center">Payment Mode</th>
                                <th className="text-center">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan="8" className="text-center py-5">
                                        <div className="spinner-border text-success"></div>
                                        <div className="mt-2 text-muted">Loading invoices...</div>
                                    </td>
                                </tr>
                            ) : bills.length === 0 ? (
                                <tr>
                                    <td colSpan="8" className="text-center py-5 text-muted">
                                        <i className="bi bi-receipt display-4 opacity-50"></i>
                                        <div className="mt-2 fw-semibold">
                                            {scopeFilter === 'CURRENT_SHIFT' ? (
                                                !activeShift ? (
                                                    <div>
                                                        <div>Register Drawer is Closed</div>
                                                        <small className="text-muted">Start a new shift to begin billing.</small>
                                                        {onOpenShiftModal && (
                                                            <div className="mt-2">
                                                                <button className="btn btn-warning btn-sm fw-bold" onClick={onOpenShiftModal}>
                                                                    Open Register Drawer
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <div>
                                                        <div>0 Bills in Current Shift</div>
                                                        <small className="text-muted">Your shift counter is fresh. Go to POS Billing and scan products to generate your first bill.</small>
                                                    </div>
                                                )
                                            ) : (
                                                'No invoices matching criteria.'
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                bills.map(b => (
                                    <tr key={b._id}>
                                        {/* Invoice # & Time */}
                                        <td>
                                            <div className="fw-bold font-mono text-dark">{b.billNumber}</div>
                                            <small className="text-muted">
                                                {new Date(b.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}{' '}
                                                {new Date(b.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </small>
                                        </td>

                                        {/* Counter & Cashier */}
                                        <td>
                                            <div className="fw-semibold text-dark">{b.cashierName}</div>
                                            <span className="badge bg-light text-dark border small">
                                                {b.counterNo}
                                            </span>
                                        </td>

                                        {/* Customer */}
                                        <td>
                                            <div className="fw-semibold">{b.customerName || 'Walk-in'}</div>
                                            {b.customerPhone && (
                                                <small className="text-muted font-mono">{b.customerPhone}</small>
                                            )}
                                        </td>

                                        {/* Items count */}
                                        <td className="text-center">
                                            <span className="badge bg-secondary-subtle text-secondary-emphasis">
                                                {b.items?.length || 0} items
                                            </span>
                                        </td>

                                        {/* Savings */}
                                        <td className="text-end font-mono text-success fw-bold">
                                            ₹{(b.totalSavings || 0).toFixed(2)}
                                        </td>

                                        {/* Net Amount */}
                                        <td className="text-end font-mono fw-bolder fs-6 text-dark">
                                            ₹{b.netPayable?.toLocaleString('en-IN')}
                                        </td>

                                        {/* Payment Mode */}
                                        <td className="text-center">
                                            {b.paymentMethod === 'SPLIT' ? (
                                                <div>
                                                    <span className="badge bg-primary px-2 py-1 small fw-bold">
                                                        <i className="bi bi-pie-chart-fill me-1"></i> SPLIT
                                                    </span>
                                                    {b.splitBreakdown && (
                                                        <div className="small text-muted mt-1 font-mono" style={{ fontSize: '0.7rem' }}>
                                                            C:₹{b.splitBreakdown.cashAmount} | U:₹{b.splitBreakdown.upiAmount}
                                                            {b.splitBreakdown.cardAmount > 0 ? ` | Card:₹${b.splitBreakdown.cardAmount}` : ''}
                                                        </div>
                                                    )}
                                                </div>
                                            ) : (
                                                <span className={`badge px-2 py-1 small ${b.paymentMethod === 'CASH' ? 'bg-success' : b.paymentMethod === 'UPI' ? 'bg-info text-dark' : 'bg-dark'}`}>
                                                    {b.paymentMethod}
                                                </span>
                                            )}
                                        </td>

                                        {/* Actions */}
                                        <td className="text-center">
                                            <button
                                                className="btn btn-sm btn-outline-success fw-semibold d-flex align-items-center gap-1 mx-auto"
                                                onClick={() => setSelectedBill(b)}
                                            >
                                                <i className="bi bi-printer"></i>
                                                <span>Receipt</span>
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Receipt Modal */}
            <ReceiptModal
                isOpen={!!selectedBill}
                onClose={() => setSelectedBill(null)}
                bill={selectedBill}
            />
        </div>
    );
}

