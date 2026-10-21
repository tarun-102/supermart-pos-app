import React, { useState, useEffect } from 'react';
import { apiFetch } from '../../utils/api';
import ReceiptModal from '../POS/ReceiptModal';
import { printSalesReport, printThermalReceipt, shareBillOnWhatsApp } from '../../utils/printHelper';

export default function BillsHistory({ currentUser, activeShift, onOpenShiftModal }) {
    const isCashier = currentUser?.role === 'cashier';
    const [scopeFilter, setScopeFilter] = useState(isCashier ? 'CURRENT_SHIFT' : 'ALL');
    const [bills, setBills] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [paymentFilter, setPaymentFilter] = useState('ALL');
    const [selectedBill, setSelectedBill] = useState(null);
    const [storeConfig, setStoreConfig] = useState(null);

    useEffect(() => {
        loadStoreConfig();
    }, []);

    const loadStoreConfig = async () => {
        try {
            const res = await apiFetch('/store/config');
            if (res.config) setStoreConfig(res.config);
        } catch (e) {
            console.warn('Could not load store config:', e);
        }
    };

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

    // Quick stats & GST counts
    const totalSalesSum = bills.reduce((s, b) => s + (Number(b.netPayable) || 0), 0);
    const totalSavingsGiven = bills.reduce((s, b) => s + (Number(b.totalSavings) || 0), 0);
    const totalTaxCollected = bills.reduce((s, b) => s + (Number(b.taxAmount) || 0), 0);
    const totalTaxableSum = totalSalesSum - totalTaxCollected;

    const handlePrintReport = () => {
        printSalesReport(bills, storeConfig, {
            scope: scopeFilter === 'CURRENT_SHIFT' ? 'Current Shift Invoices' : 'All Invoices',
            payment: paymentFilter
        });
    };

    return (
        <div className="container-fluid py-4 px-3">
            {/* Header */}
            <div className="d-flex flex-wrap justify-content-between align-items-center mb-4 gap-2">
                <div>
                    <div className="d-flex align-items-center gap-2">
                        <span className="fs-3">📑</span>
                        <h4 className="fw-bolder mb-0 text-dark">Customer Invoices &amp; GST Sales Register</h4>
                    </div>
                    <p className="text-muted small mb-0">
                        View customer transactions, inspect GST (CGST+SGST) tax breakdown, print official reports &amp; receipts.
                    </p>
                </div>
                <div className="d-flex gap-2 align-items-center flex-wrap">
                    <button
                        className="btn btn-primary btn-sm fw-bold d-flex align-items-center gap-2 shadow-sm"
                        onClick={handlePrintReport}
                        title="Print official GST tax report (never blank)"
                    >
                        <i className="bi bi-printer-fill fs-6"></i>
                        <span>Print GST Sales Report</span>
                    </button>

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

                    <button className="btn btn-outline-secondary btn-sm fw-bold" onClick={loadBills}>
                        <i className="bi bi-arrow-clockwise me-1"></i> Refresh
                    </button>
                </div>
            </div>

            {/* Quick Metrics & GST Tax Counters */}
            <div className="row g-3 mb-4">
                <div className="col-md-3 col-6">
                    <div className="card border-0 shadow-sm p-3 rounded-3 bg-white border-start border-primary border-4 h-100">
                        <small className="text-muted fw-bold text-uppercase" style={{ fontSize: '0.72rem' }}>
                            {scopeFilter === 'CURRENT_SHIFT' ? 'Shift Gross Sales' : 'Total Gross Turnover'}
                        </small>
                        <div className="fs-4 fw-bold font-mono text-primary mt-1">₹{totalSalesSum.toLocaleString('en-IN')}</div>
                        <small className="text-muted" style={{ fontSize: '0.75rem' }}>{bills.length} Invoices Issued</small>
                    </div>
                </div>

                <div className="col-md-3 col-6">
                    <div className="card border-0 shadow-sm p-3 rounded-3 bg-white border-start border-secondary border-4 h-100">
                        <small className="text-muted fw-bold text-uppercase" style={{ fontSize: '0.72rem' }}>Net Taxable Turnover</small>
                        <div className="fs-4 fw-bold font-mono text-dark mt-1">₹{totalTaxableSum.toFixed(2)}</div>
                        <small className="text-muted" style={{ fontSize: '0.75rem' }}>Excl. all GST taxes</small>
                    </div>
                </div>

                <div className="col-md-3 col-6">
                    <div className="card border-0 shadow-sm p-3 rounded-3 bg-white border-start border-success border-4 h-100">
                        <small className="text-muted fw-bold text-uppercase" style={{ fontSize: '0.72rem' }}>GST Tax Collected</small>
                        <div className="fs-4 fw-bold font-mono text-success mt-1">₹{totalTaxCollected.toFixed(2)}</div>
                        <small className="text-success fw-semibold" style={{ fontSize: '0.7rem' }}>
                            CGST: ₹{(totalTaxCollected / 2).toFixed(2)} | SGST: ₹{(totalTaxCollected / 2).toFixed(2)}
                        </small>
                    </div>
                </div>

                <div className="col-md-3 col-6">
                    <div className="card border-0 shadow-sm p-3 rounded-3 bg-white border-start border-warning border-4 h-100">
                        <small className="text-muted fw-bold text-uppercase" style={{ fontSize: '0.72rem' }}>Customer Savings Given</small>
                        <div className="fs-4 fw-bold font-mono text-warning mt-1">₹{totalSavingsGiven.toFixed(2)}</div>
                        <small className="text-muted" style={{ fontSize: '0.75rem' }}>Discounts Delivered</small>
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
                                <button type="submit" className="btn btn-outline-primary">Search</button>
                            </div>
                        </form>
                    </div>

                    <div className="col-md-6">
                        <div className="d-flex align-items-center justify-content-start justify-content-md-end gap-2 flex-wrap">
                            <label className="small text-muted fw-bold text-nowrap mb-0">Payment Method:</label>
                            <select
                                className="form-select form-select-sm fw-semibold w-auto flex-grow-1 flex-md-grow-0"
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

            {/* Mobile Invoices View: Touch Cards (< md) */}
            <div className="d-block d-md-none mb-3">
                {loading ? (
                    <div className="card border-0 shadow-sm p-5 text-center text-muted bg-white">
                        <div className="spinner-border text-primary mx-auto mb-2"></div>
                        <div>Loading invoices...</div>
                    </div>
                ) : bills.length === 0 ? (
                    <div className="card border-0 shadow-sm p-4 text-center text-muted bg-white">
                        <i className="bi bi-receipt display-4 opacity-50 mb-2"></i>
                        <div className="fw-semibold">No invoices matching criteria.</div>
                    </div>
                ) : (
                    <div className="d-flex flex-column gap-2">
                        {bills.map((b) => (
                            <div key={b._id} className="card border-0 shadow-sm p-3 rounded-3 bg-white">
                                <div className="d-flex justify-content-between align-items-start mb-2">
                                    <div>
                                        <div className="fw-bolder font-mono text-dark" style={{ fontSize: '0.95rem' }}>
                                            {b.billNumber}
                                        </div>
                                        <div className="text-muted small">
                                            {new Date(b.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}{' '}
                                            {new Date(b.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </div>
                                    </div>
                                    <div className="text-end">
                                        <div className="fs-5 fw-bolder text-primary font-mono">
                                            ₹{b.netPayable?.toLocaleString('en-IN')}
                                        </div>
                                        <span className={`badge px-2 py-1 small fw-bold ${b.paymentMethod === 'SPLIT' ? 'bg-primary' : b.paymentMethod === 'CASH' ? 'bg-success' : b.paymentMethod === 'UPI' ? 'bg-info text-dark' : 'bg-dark'}`}>
                                            {b.paymentMethod}
                                        </span>
                                    </div>
                                </div>

                                <div className="d-flex justify-content-between align-items-center py-2 border-top border-bottom my-1 bg-light rounded-2 px-2 small font-mono">
                                    <span className="text-muted">
                                        Customer: <strong className="text-dark">{b.customerName || 'Walk-in'}</strong>
                                    </span>
                                    <span className="text-muted">
                                        Items: <strong className="text-dark">{b.items?.length || 0}</strong> | GST: <strong className="text-success">₹{Number(b.taxAmount || 0).toFixed(1)}</strong>
                                    </span>
                                </div>

                                <div className="d-flex gap-2 align-items-center mt-2">
                                    <button
                                        type="button"
                                        className="btn btn-sm btn-outline-primary fw-bold flex-grow-1 py-2 d-flex align-items-center justify-content-center gap-1 shadow-sm"
                                        onClick={() => setSelectedBill(b)}
                                    >
                                        <i className="bi bi-receipt"></i>
                                        <span>View Bill</span>
                                    </button>
                                    <button
                                        type="button"
                                        className="btn btn-sm btn-outline-secondary px-3 py-2"
                                        onClick={() => printThermalReceipt(b, storeConfig)}
                                        title="Print Thermal Receipt"
                                    >
                                        <i className="bi bi-printer"></i>
                                    </button>
                                    <button
                                        type="button"
                                        className="btn btn-sm btn-outline-success px-3 py-2"
                                        onClick={() => shareBillOnWhatsApp(b, storeConfig)}
                                        title="Share on WhatsApp"
                                    >
                                        <i className="bi bi-whatsapp"></i>
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Desktop Bills Table (d-none d-md-block) */}
            <div className="card border-0 shadow-sm rounded-3 overflow-hidden bg-white d-none d-md-block">
                <div className="table-responsive">
                    <table className="table table-hover align-middle mb-0">
                        <thead className="table-light">
                            <tr>
                                <th>Invoice No &amp; Time</th>
                                <th>Counter &amp; Cashier</th>
                                <th>Customer Details</th>
                                <th className="text-center">Items</th>
                                <th className="text-end">Taxable (₹)</th>
                                <th className="text-end">GST Tax (₹)</th>
                                <th className="text-end">Net Amount</th>
                                <th className="text-center">Payment Mode</th>
                                <th className="text-center">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan="9" className="text-center py-5">
                                        <div className="spinner-border text-success"></div>
                                        <div className="mt-2 text-muted">Loading invoices...</div>
                                    </td>
                                </tr>
                            ) : bills.length === 0 ? (
                                <tr>
                                    <td colSpan="9" className="text-center py-5 text-muted">
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

                                        {/* Taxable */}
                                        <td className="text-end font-mono text-muted">
                                            ₹{(Number(b.taxableAmount) || (Number(b.netPayable) - Number(b.taxAmount || 0))).toFixed(2)}
                                        </td>

                                        {/* GST Tax */}
                                        <td className="text-end font-mono text-success fw-semibold">
                                            ₹{Number(b.taxAmount || 0).toFixed(2)}
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
                                            <div className="d-flex align-items-center justify-content-center gap-1">
                                                <button
                                                    className="btn btn-sm btn-outline-primary fw-semibold d-flex align-items-center gap-1"
                                                    onClick={() => setSelectedBill(b)}
                                                    title="View detailed tax invoice"
                                                >
                                                    <i className="bi bi-receipt"></i>
                                                    <span className="d-none d-md-inline">Receipt</span>
                                                </button>
                                                <button
                                                    className="btn btn-sm btn-outline-secondary fw-semibold"
                                                    onClick={() => printThermalReceipt(b, storeConfig)}
                                                    title="Quick print thermal slip"
                                                >
                                                    <i className="bi bi-printer"></i>
                                                </button>
                                                <button
                                                    className="btn btn-sm btn-outline-success fw-semibold"
                                                    onClick={() => shareBillOnWhatsApp(b, storeConfig)}
                                                    title="Share on WhatsApp"
                                                >
                                                    <i className="bi bi-whatsapp"></i>
                                                </button>
                                            </div>
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
                storeConfig={storeConfig}
            />
        </div>
    );
}

