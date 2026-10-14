import React, { useState, useEffect } from 'react';
import { apiFetch } from '../../utils/api';
import { printHtmlViaIframe } from '../../utils/printHelper';

export default function CashOfficerTally({ currentUser }) {
    const [shifts, setShifts] = useState([]);
    const [metrics, setMetrics] = useState(null);
    const [loading, setLoading] = useState(true);

    // Filters and Sorting
    const [tallyStatusFilter, setTallyStatusFilter] = useState('ALL');
    const [cashierFilter, setCashierFilter] = useState('ALL');
    const [officerFilter, setOfficerFilter] = useState(
        currentUser?.role === 'cash_officer' ? (currentUser.username || currentUser.name) : 'ALL'
    );
    const [sortBy, setSortBy] = useState('date_desc');
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        if (currentUser?.role === 'cash_officer') {
            setOfficerFilter(currentUser.username || currentUser.name);
        }
    }, [currentUser]);

    // Audit verification modal
    const [selectedShift, setSelectedShift] = useState(null);
    const [officerNotes, setOfficerNotes] = useState('');
    const [auditStatus, setAuditStatus] = useState('TALLIED_APPROVED');

    // Denomination breakdown view modal
    const [viewingDenomShift, setViewingDenomShift] = useState(null);

    // Print settlement slip modal
    const [printingShift, setPrintingShift] = useState(null);

    useEffect(() => {
        loadData();
    }, [tallyStatusFilter, cashierFilter, officerFilter, sortBy]);

    const loadData = async () => {
        setLoading(true);
        try {
            const queryParams = new URLSearchParams({
                tallyStatus: tallyStatusFilter,
                cashierId: cashierFilter,
                officerId: officerFilter,
                sortBy: sortBy
            });

            const [shiftsRes, summaryRes] = await Promise.all([
                apiFetch(`/shifts/all?${queryParams.toString()}`),
                apiFetch('/shifts/dashboard-summary')
            ]);

            if (shiftsRes.shifts) setShifts(shiftsRes.shifts);
            if (summaryRes.metrics) setMetrics(summaryRes.metrics);
        } catch (err) {
            console.error('Failed to load cash officer data:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleOpenAuditModal = (shift) => {
        setSelectedShift(shift);
        setOfficerNotes(shift.officerNotes || '');
        setAuditStatus(shift.cashDifference === 0 ? 'TALLIED_APPROVED' : 'DISCREPANCY_FLAGGED');
    };

    const handleSaveAudit = async (e) => {
        e.preventDefault();
        if (!selectedShift) return;

        try {
            await apiFetch(`/shifts/verify/${selectedShift._id}`, {
                method: 'PUT',
                body: JSON.stringify({
                    officerVerifiedBy: currentUser.name || 'Cash Officer',
                    officerNotes: officerNotes.trim(),
                    approvedStatus: auditStatus
                })
            });

            setSelectedShift(null);
            loadData();
        } catch (err) {
            alert('Failed to save audit: ' + err.message);
        }
    };

    // Client-side search filter
    const displayedShifts = shifts.filter(s => {
        if (!searchQuery) return true;
        const q = searchQuery.toLowerCase();
        return (
            s.cashierName?.toLowerCase().includes(q) ||
            s.shiftNumber?.toLowerCase().includes(q) ||
            s.counterNo?.toLowerCase().includes(q) ||
            s.handoverToOfficerName?.toLowerCase().includes(q)
        );
    });

    const handlePrintReceipt = (shift) => {
        setPrintingShift(shift);
        const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <title>Shift Statement - ${shift.shiftNumber}</title>
                <style>
                    @page { size: 80mm auto; margin: 0; }
                    * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Courier New', Courier, monospace; color: #000; }
                    body { width: 76mm; margin: 0 auto; padding: 5mm 3mm; font-size: 11px; line-height: 1.35; }
                    .text-center { text-align: center; }
                    .flex-between { display: flex; justify-content: space-between; }
                    .divider { border-bottom: 1px dashed #000; margin: 6px 0; }
                    .double-divider { border-bottom: 2px solid #000; margin: 6px 0; }
                </style>
            </head>
            <body>
                <div class="text-center">
                    <div style="font-size: 16px; font-weight: bold;">SUPERSTORE POS</div>
                    <div style="font-size: 11px; font-weight: bold;">SHIFT SETTLEMENT STATEMENT (X-REPORT)</div>
                    <div style="font-size: 9px;">${new Date().toLocaleString('en-IN')}</div>
                </div>
                <div class="divider"></div>
                <div class="flex-between"><span>Shift ID:</span><span>${shift.shiftNumber}</span></div>
                <div class="flex-between"><span>Cashier:</span><span>${shift.cashierName} (${shift.counterNo})</span></div>
                <div class="flex-between"><span>Audit Officer:</span><span>${shift.handoverToOfficerName || 'Vault Officer'}</span></div>
                <div class="divider"></div>
                <div class="flex-between"><span>Opening Float:</span><span>₹${shift.openingFloat}</span></div>
                <div class="flex-between"><span>Net Sales:</span><span>₹${shift.netSales} (${shift.billsCount} bills)</span></div>
                <div class="flex-between"><span>• Cash Sales:</span><span>₹${shift.paymentSummary?.cash || 0}</span></div>
                <div class="flex-between"><span>• Card Sales:</span><span>₹${shift.paymentSummary?.card || 0}</span></div>
                <div class="flex-between"><span>• UPI Sales:</span><span>₹${shift.paymentSummary?.upi || 0}</span></div>
                <div class="divider"></div>
                <div class="flex-between"><span>Expected Cash:</span><span>₹${shift.expectedCashInDrawer}</span></div>
                <div class="flex-between"><span>Physical Handed Over:</span><span>₹${shift.physicalCashHandedOver}</span></div>
                <div class="flex-between" style="font-weight: bold; font-size: 12px;"><span>Variance / Difference:</span><span>₹${shift.cashDifference || 0} (${shift.tallyStatus})</span></div>
                <div class="double-divider"></div>
                <div class="flex-between text-center" style="margin-top: 25px;">
                    <div><div style="border-top: 1px solid #000; width: 85px; margin-bottom: 3px;"></div>Cashier Sign</div>
                    <div><div style="border-top: 1px solid #000; width: 85px; margin-bottom: 3px;"></div>Officer Sign</div>
                </div>
            </body>
            </html>
        `;
        printHtmlViaIframe(html, `Shift_${shift.shiftNumber}`);
    };

    return (
        <div className="container-fluid py-4 px-3">
            {/* Header */}
            <div className="d-flex flex-wrap justify-content-between align-items-center mb-4 gap-2 no-print">
                <div>
                    <div className="d-flex align-items-center gap-2">
                        <span className="fs-3">💰</span>
                        <h4 className="fw-bolder mb-0 text-dark">Cash Officer — Daily Cashier Tally &amp; Vault Central</h4>
                    </div>
                    <p className="text-muted small mb-0">
                        Audit cashier counter registers, verify physical cash handover vs collections, and record vault settlements.
                    </p>
                </div>
                <div className="d-flex gap-2">
                    <button
                        className="btn btn-outline-success fw-bold d-flex align-items-center gap-2 shadow-sm"
                        onClick={loadData}
                    >
                        <i className="bi bi-arrow-clockwise"></i>
                        <span>Refresh Tally Reports</span>
                    </button>
                </div>
            </div>

            {/* Central Vault KPI Metrics */}
            {metrics && (
                <div className="row g-3 mb-4 no-print">
                    {/* Vault Cash */}
                    <div className="col-xl-3 col-md-6">
                        <div className="card border-0 shadow-sm rounded-3 p-3 bg-white h-100 border-start border-primary border-4">
                            <div className="d-flex justify-content-between align-items-center">
                                <div>
                                    <div className="text-muted small fw-bold text-uppercase">Physical Cash in Vault</div>
                                    <div className="fs-3 fw-bolder font-mono text-primary">
                                        ₹{metrics.totalPhysicalCashInVault.toLocaleString('en-IN')}
                                    </div>
                                    <small className="text-muted">From handed-over shifts</small>
                                </div>
                                <div className="bg-primary-subtle p-3 rounded-circle text-primary fs-3">
                                    <i className="bi bi-safe-fill"></i>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Digital Payments (UPI + Card) */}
                    <div className="col-xl-3 col-md-6">
                        <div className="card border-0 shadow-sm rounded-3 p-3 bg-white h-100 border-start border-primary border-4">
                            <div className="d-flex justify-content-between align-items-center">
                                <div>
                                    <div className="text-muted small fw-bold text-uppercase">Total Digital Sales</div>
                                    <div className="fs-3 fw-bolder font-mono text-primary">
                                        ₹{(metrics.totalUpi + metrics.totalCard).toLocaleString('en-IN')}
                                    </div>
                                    <small className="text-muted">UPI: ₹{metrics.totalUpi} &bull; Card: ₹{metrics.totalCard}</small>
                                </div>
                                <div className="bg-primary-subtle p-3 rounded-circle text-primary fs-3">
                                    <i className="bi bi-qr-code-scan"></i>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Tally Health */}
                    <div className="col-xl-3 col-md-6">
                        <div className="card border-0 shadow-sm rounded-3 p-3 bg-white h-100 border-start border-info border-4">
                            <div className="d-flex justify-content-between align-items-center">
                                <div>
                                    <div className="text-muted small fw-bold text-uppercase">Shifts Tallied OK</div>
                                    <div className="fs-3 fw-bolder font-mono text-dark">
                                        {metrics.talliedCount} / {metrics.shiftsCount}
                                    </div>
                                    <small className="text-success fw-semibold">
                                        <i className="bi bi-check-circle-fill me-1"></i> Exact ₹0 Variance
                                    </small>
                                </div>
                                <div className="bg-info-subtle p-3 rounded-circle text-info fs-3">
                                    <i className="bi bi-calculator"></i>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Discrepancy / Shortage Alert */}
                    <div className="col-xl-3 col-md-6">
                        <div className={`card border-0 shadow-sm rounded-3 p-3 bg-white h-100 border-start ${metrics.totalShortageAmount > 0 ? 'border-danger border-4' : 'border-secondary'}`}>
                            <div className="d-flex justify-content-between align-items-center">
                                <div>
                                    <div className="text-muted small fw-bold text-uppercase">Cash Shortage (Deficit)</div>
                                    <div className={`fs-3 fw-bolder font-mono ${metrics.totalShortageAmount > 0 ? 'text-danger' : 'text-secondary'}`}>
                                        -₹{metrics.totalShortageAmount.toLocaleString('en-IN')}
                                    </div>
                                    <small className={metrics.shortageCount > 0 ? 'text-danger fw-bold' : 'text-muted'}>
                                        {metrics.shortageCount} Shift(s) with Shortage
                                    </small>
                                </div>
                                <div className={`p-3 rounded-circle fs-3 ${metrics.totalShortageAmount > 0 ? 'bg-danger-subtle text-danger' : 'bg-light text-muted'}`}>
                                    <i className="bi bi-exclamation-triangle-fill"></i>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Filter & Sort Controls Toolbar */}
            <div className="card border-0 shadow-sm p-3 mb-4 rounded-3 bg-white no-print">
                <div className="row g-2 align-items-center">
                    {/* Search */}
                    <div className="col-lg-3 col-md-6">
                        <div className="input-group input-group-sm">
                            <span className="input-group-text bg-light"><i className="bi bi-search"></i></span>
                            <input
                                type="text"
                                className="form-control"
                                placeholder="Search Cashier or Shift ID..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Filter by Tally Status */}
                    <div className="col-lg-3 col-md-6">
                        <div className="d-flex align-items-center gap-2">
                            <label className="small text-muted fw-bold text-nowrap mb-0">Tally Status:</label>
                            <select
                                className="form-select form-select-sm fw-semibold"
                                value={tallyStatusFilter}
                                onChange={(e) => setTallyStatusFilter(e.target.value)}
                            >
                                <option value="ALL">All Tally Statuses</option>
                                <option value="TALLIED">✅ Tallied (Exact Match)</option>
                                <option value="SHORTAGE">⚠️ Shortage (Deficit)</option>
                                <option value="EXCESS">ℹ️ Excess (Surplus)</option>
                                <option value="PENDING">⏳ Active / Pending Close</option>
                            </select>
                        </div>
                    </div>

                    {/* Sort Order */}
                    <div className="col-lg-3 col-md-6">
                        <div className="d-flex align-items-center gap-2">
                            <label className="small text-muted fw-bold text-nowrap mb-0">
                                <i className="bi bi-sort-down me-1"></i>Sort By:
                            </label>
                            <select
                                className="form-select form-select-sm fw-semibold"
                                value={sortBy}
                                onChange={(e) => setSortBy(e.target.value)}
                            >
                                <option value="date_desc">Newest Shift First</option>
                                <option value="date_asc">Oldest Shift First</option>
                                <option value="diff_asc">Shortages First (High Discrepancy)</option>
                                <option value="sales_desc">Highest Sales First</option>
                                <option value="cashier_asc">Cashier Name (A to Z)</option>
                            </select>
                        </div>
                    </div>

                    {/* Handover Officer Filter */}
                    <div className="col-lg-3 col-md-6">
                        <div className="d-flex align-items-center gap-2">
                            <label className="small text-muted fw-bold text-nowrap mb-0">Officer:</label>
                            <select
                                className="form-select form-select-sm fw-semibold"
                                value={officerFilter}
                                onChange={(e) => setOfficerFilter(e.target.value)}
                            >
                                {currentUser?.role === 'cash_officer' ? (
                                    <>
                                        <option value={currentUser?.username || currentUser?.name}>
                                            Assigned to Me ({currentUser?.username || currentUser?.name})
                                        </option>
                                        <option value="ALL">All Officer Shifts</option>
                                    </>
                                ) : (
                                    <>
                                        <option value="ALL">All Vault Handover Shifts</option>
                                        {currentUser?.name && (
                                            <option value={currentUser?.username || currentUser?.name}>
                                                Assigned to Me ({currentUser?.username || currentUser?.name})
                                            </option>
                                        )}
                                    </>
                                )}
                            </select>
                        </div>
                    </div>
                </div>
            </div>

            {/* Cashier Tally Records Table */}
            <div className="card border-0 shadow-sm rounded-3 overflow-hidden bg-white no-print">
                <div className="table-responsive">
                    <table className="table table-hover align-middle mb-0">
                        <thead className="table-light">
                            <tr>
                                <th>Shift Details</th>
                                <th>Cashier &amp; Counter</th>
                                <th>Assigned Officer</th>
                                <th className="text-end">Collections Breakdown</th>
                                <th className="text-end">Expected Cash</th>
                                <th className="text-end">Physical Cash</th>
                                <th className="text-center">Tally Difference</th>
                                <th className="text-center">Audit Status</th>
                                <th className="text-center">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan="9" className="text-center py-5">
                                        <div className="spinner-border text-success"></div>
                                        <div className="mt-2 text-muted">Loading cashier tally reports...</div>
                                    </td>
                                </tr>
                            ) : displayedShifts.length === 0 ? (
                                <tr>
                                    <td colSpan="9" className="text-center py-5 text-muted">
                                        <i className="bi bi-file-earmark-text display-4 opacity-50"></i>
                                        <div className="mt-2 fw-semibold">No shift records matching criteria.</div>
                                    </td>
                                </tr>
                            ) : (
                                displayedShifts.map((sh) => {
                                    const diff = sh.cashDifference || 0;
                                    const isTallied = sh.tallyStatus === 'TALLIED' || diff === 0;
                                    const isShort = sh.tallyStatus === 'SHORTAGE' || diff < -1;
                                    const isExcess = sh.tallyStatus === 'EXCESS' || diff > 1;

                                    return (
                                        <tr key={sh._id}>
                                            {/* Shift Info */}
                                            <td>
                                                <div className="fw-bold font-mono text-dark">{sh.shiftNumber}</div>
                                                <small className="text-muted">
                                                    {new Date(sh.startTime).toLocaleDateString([], { month: 'short', day: 'numeric' })}{' '}
                                                    {new Date(sh.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </small>
                                            </td>

                                            {/* Cashier & Counter */}
                                            <td>
                                                <div className="fw-semibold text-dark">{sh.cashierName}</div>
                                                <span className="badge bg-light text-dark border">
                                                    {sh.counterNo}
                                                </span>
                                            </td>

                                            {/* Receiving Officer */}
                                            <td>
                                                <span className="badge bg-primary-subtle text-primary border border-primary-subtle">
                                                    <i className="bi bi-person-badge me-1"></i>
                                                    {sh.handoverToOfficerName || 'Vault Officer'}
                                                </span>
                                            </td>

                                            {/* Collections Breakdown with Counts */}
                                            <td className="text-end font-mono">
                                                <div className="fw-bold text-dark">
                                                    Net: ₹{sh.netSales?.toLocaleString('en-IN')}
                                                </div>
                                                <div className="text-muted" style={{ fontSize: '0.72rem' }}>
                                                    Cash: ₹{sh.paymentSummary?.cash || 0} ({sh.paymentSummary?.cashCount || 0})
                                                </div>
                                                <div className="text-muted" style={{ fontSize: '0.72rem' }}>
                                                    Card: ₹{sh.paymentSummary?.card || 0} ({sh.paymentSummary?.cardCount || 0}) &bull; UPI: ₹{sh.paymentSummary?.upi || 0} ({sh.paymentSummary?.upiCount || 0})
                                                </div>
                                            </td>

                                            {/* Expected Cash in Drawer */}
                                            <td className="text-end font-mono fw-bold">
                                                ₹{sh.expectedCashInDrawer?.toLocaleString('en-IN')}
                                                <div className="text-muted small" style={{ fontSize: '0.7rem' }}>
                                                    Float: ₹{sh.openingFloat}
                                                </div>
                                            </td>

                                            {/* Physical Cash Handed Over */}
                                            <td className="text-end font-mono fw-bolder">
                                                {sh.status === 'ACTIVE' ? (
                                                    <span className="text-muted small">Shift In-Progress</span>
                                                ) : (
                                                    <span className="text-primary fs-6">
                                                        ₹{sh.physicalCashHandedOver?.toLocaleString('en-IN')}
                                                    </span>
                                                )}
                                            </td>

                                            {/* Tally Difference */}
                                            <td className="text-center">
                                                {sh.status === 'ACTIVE' ? (
                                                    <span className="badge bg-light text-muted border">
                                                        Active Counter
                                                    </span>
                                                ) : isTallied ? (
                                                    <span className="badge bg-success-subtle text-success border border-success-subtle px-2 py-1 fw-bold">
                                                        <i className="bi bi-check-circle-fill me-1"></i> Tallied (₹0)
                                                    </span>
                                                ) : isShort ? (
                                                    <span className="badge bg-danger-subtle text-danger border border-danger-subtle px-2 py-1 fw-bold">
                                                        <i className="bi bi-dash-circle-fill me-1"></i> Shortage (-₹{Math.abs(diff)})
                                                    </span>
                                                ) : (
                                                    <span className="badge bg-info-subtle text-info border border-info-subtle px-2 py-1 fw-bold">
                                                        <i className="bi bi-plus-circle-fill me-1"></i> Excess (+₹{diff})
                                                    </span>
                                                )}
                                            </td>

                                            {/* Audit Status */}
                                            <td className="text-center">
                                                {sh.status === 'TALLIED_APPROVED' ? (
                                                    <span className="badge bg-success px-2 py-1 small">
                                                        <i className="bi bi-shield-check me-1"></i> Approved
                                                    </span>
                                                ) : sh.status === 'DISCREPANCY_FLAGGED' ? (
                                                    <span className="badge bg-danger px-2 py-1 small">
                                                        <i className="bi bi-flag-fill me-1"></i> Flagged
                                                    </span>
                                                ) : sh.status === 'CLOSED_PENDING_APPROVAL' ? (
                                                    <span className="badge bg-warning text-dark px-2 py-1 small">
                                                        Pending Audit
                                                    </span>
                                                ) : (
                                                    <span className="badge bg-secondary px-2 py-1 small">
                                                        Active
                                                    </span>
                                                )}
                                            </td>

                                            {/* Actions */}
                                            <td className="text-center">
                                                <div className="d-flex justify-content-center gap-1">
                                                    {/* Print Settlement Slip */}
                                                    <button
                                                        type="button"
                                                        className="btn btn-sm btn-outline-dark"
                                                        onClick={() => handlePrintReceipt(sh)}
                                                        title="Print Settlement Slip (X-Report)"
                                                    >
                                                        <i className="bi bi-printer"></i>
                                                    </button>

                                                    {/* View Denominations button */}
                                                    {sh.denominations && Object.keys(sh.denominations).length > 0 && (
                                                        <button
                                                            type="button"
                                                            className="btn btn-sm btn-outline-secondary"
                                                            onClick={() => setViewingDenomShift(sh)}
                                                            title="View Denomination Breakdown"
                                                        >
                                                            <i className="bi bi-cash-stack"></i>
                                                        </button>
                                                    )}

                                                    {/* Audit / Verify button */}
                                                    <button
                                                        type="button"
                                                        className="btn btn-sm btn-success fw-semibold"
                                                        onClick={() => handleOpenAuditModal(sh)}
                                                        title="Cash Officer Audit & Sign Off"
                                                    >
                                                        <i className="bi bi-pencil-square me-1"></i> Audit
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Officer Audit & Verification Modal */}
            {selectedShift && (
                <div className="modal show d-block no-print" style={{ backgroundColor: 'rgba(15, 23, 42, 0.7)', zIndex: 1055 }}>
                    <div className="modal-dialog modal-dialog-centered">
                        <div className="modal-content border-0 shadow-lg" style={{ borderRadius: '16px' }}>
                            <div className="modal-header bg-dark text-white py-3">
                                <div className="d-flex align-items-center gap-2">
                                    <i className="bi bi-shield-check text-warning fs-5"></i>
                                    <div>
                                        <h6 className="modal-title fw-bold mb-0">Audit &amp; Sign-Off Shift Tally</h6>
                                        <small className="text-white-50">{selectedShift.shiftNumber} &bull; {selectedShift.cashierName}</small>
                                    </div>
                                </div>
                                <button type="button" className="btn-close btn-close-white" onClick={() => setSelectedShift(null)}></button>
                            </div>

                            <form onSubmit={handleSaveAudit}>
                                <div className="modal-body p-4 bg-light">
                                    {/* Reconciliation Card */}
                                    <div className="bg-white p-3 rounded border mb-3">
                                        <div className="row g-2 text-center">
                                            <div className="col-4 border-end">
                                                <small className="text-muted d-block">Expected Cash</small>
                                                <span className="font-mono fw-bold fs-6">₹{selectedShift.expectedCashInDrawer}</span>
                                            </div>
                                            <div className="col-4 border-end">
                                                <small className="text-muted d-block">Physical Handed</small>
                                                <span className="font-mono fw-bold fs-6 text-primary">₹{selectedShift.physicalCashHandedOver}</span>
                                            </div>
                                            <div className="col-4">
                                                <small className="text-muted d-block">Tally Variance</small>
                                                <span className={`font-mono fw-bolder fs-6 ${selectedShift.cashDifference === 0 ? 'text-success' : selectedShift.cashDifference < 0 ? 'text-danger' : 'text-info'}`}>
                                                    {selectedShift.cashDifference >= 0 ? `+₹${selectedShift.cashDifference}` : `-₹${Math.abs(selectedShift.cashDifference)}`}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Audit Decision */}
                                    <div className="mb-3">
                                        <label className="form-label fw-bold small text-muted text-uppercase">
                                            Audit Decision:
                                        </label>
                                        <div className="btn-group w-100" role="group">
                                            <button
                                                type="button"
                                                className={`btn ${auditStatus === 'TALLIED_APPROVED' ? 'btn-success text-white fw-bold' : 'btn-outline-secondary'}`}
                                                onClick={() => setAuditStatus('TALLIED_APPROVED')}
                                            >
                                                <i className="bi bi-check-circle me-1"></i> Approve &amp; Vault Accept
                                            </button>
                                            <button
                                                type="button"
                                                className={`btn ${auditStatus === 'DISCREPANCY_FLAGGED' ? 'btn-danger text-white fw-bold' : 'btn-outline-secondary'}`}
                                                onClick={() => setAuditStatus('DISCREPANCY_FLAGGED')}
                                            >
                                                <i className="bi bi-flag me-1"></i> Flag Discrepancy
                                            </button>
                                        </div>
                                    </div>

                                    {/* Notes */}
                                    <div className="mb-3">
                                        <label className="form-label fw-bold small text-muted text-uppercase">
                                            Officer Audit Remarks / Notes:
                                        </label>
                                        <textarea
                                            className="form-control"
                                            rows="3"
                                            placeholder="e.g. Cash verified and stored in central vault locker. Shortage verified with cashier..."
                                            value={officerNotes}
                                            onChange={(e) => setOfficerNotes(e.target.value)}
                                        ></textarea>
                                    </div>
                                </div>

                                <div className="modal-footer bg-white border-top p-3 d-flex justify-content-between">
                                    <button type="button" className="btn btn-secondary" onClick={() => setSelectedShift(null)}>
                                        Cancel
                                    </button>
                                    <button type="submit" className="btn btn-success fw-bold px-4">
                                        Save Audit Sign-Off
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {/* Denomination Viewer Modal */}
            {viewingDenomShift && (
                <div className="modal show d-block no-print" style={{ backgroundColor: 'rgba(15, 23, 42, 0.7)', zIndex: 1055 }}>
                    <div className="modal-dialog modal-dialog-centered">
                        <div className="modal-content border-0 shadow-lg" style={{ borderRadius: '16px' }}>
                            <div className="modal-header bg-success text-white py-3">
                                <div className="d-flex align-items-center gap-2">
                                    <i className="bi bi-cash-stack fs-5"></i>
                                    <div>
                                        <h6 className="modal-title fw-bold mb-0">Physical Currency Breakdown</h6>
                                        <small className="text-white-50">{viewingDenomShift.cashierName} &bull; {viewingDenomShift.counterNo}</small>
                                    </div>
                                </div>
                                <button type="button" className="btn-close btn-close-white" onClick={() => setViewingDenomShift(null)}></button>
                            </div>

                            <div className="modal-body p-4 bg-light">
                                <table className="table table-bordered bg-white mb-0 text-center font-mono">
                                    <thead className="table-light">
                                        <tr>
                                            <th>Note / Coin</th>
                                            <th>Count</th>
                                            <th>Total (₹)</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {[500, 200, 100, 50, 20, 10, 5, 2, 1, 'coins'].map(denom => {
                                            const count = Number(viewingDenomShift.denominations?.[denom]) || 0;
                                            const weight = denom === 'coins' ? 1 : Number(denom);
                                            const val = count * weight;
                                            if (count === 0) return null;
                                            return (
                                                <tr key={denom}>
                                                    <td className="fw-bold">{denom === 'coins' ? 'Coins' : `₹${denom}`}</td>
                                                    <td>{count}</td>
                                                    <td className="fw-bold text-success">₹{val}</td>
                                                </tr>
                                            );
                                        })}
                                        <tr className="table-active fw-bolder fs-6">
                                            <td colSpan="2" className="text-end">Total Counted:</td>
                                            <td className="text-primary font-mono">
                                                ₹{viewingDenomShift.physicalCashHandedOver}
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>

                            <div className="modal-footer bg-white p-3">
                                <button type="button" className="btn btn-secondary" onClick={() => setViewingDenomShift(null)}>
                                    Close
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Hidden Printable Settlement Slip (when officer clicks print) */}
            {printingShift && (
                <div className="print-area d-none d-print-block" style={{ maxWidth: '400px', margin: '0 auto', fontFamily: 'monospace' }}>
                    <div className="text-center mb-2">
                        <h5 className="fw-bold mb-0">SUPERSTORE POS</h5>
                        <div className="small fw-bold text-uppercase">Shift Settlement Slip (X-Report)</div>
                        <div style={{ fontSize: '0.75rem' }}>{new Date().toLocaleString()}</div>
                    </div>
                    <hr className="my-1 border-dark" />
                    <div className="small">
                        <div><strong>Shift:</strong> {printingShift.shiftNumber}</div>
                        <div><strong>Cashier:</strong> {printingShift.cashierName} ({printingShift.counterNo})</div>
                        <div><strong>Receiving Officer:</strong> {printingShift.handoverToOfficerName || 'Vault Officer'}</div>
                        <div><strong>Opening Float:</strong> ₹{printingShift.openingFloat}</div>
                        <div><strong>Net Sales:</strong> ₹{printingShift.netSales} ({printingShift.billsCount} bills)</div>
                        <div><strong>Cash Sales:</strong> ₹{printingShift.paymentSummary?.cash || 0} ({printingShift.paymentSummary?.cashCount || 0} bills)</div>
                        <div><strong>Card Sales:</strong> ₹{printingShift.paymentSummary?.card || 0} ({printingShift.paymentSummary?.cardCount || 0} txns)</div>
                        <div><strong>UPI Sales:</strong> ₹{printingShift.paymentSummary?.upi || 0} ({printingShift.paymentSummary?.upiCount || 0} txns)</div>
                        <div><strong>Expected Cash:</strong> ₹{printingShift.expectedCashInDrawer}</div>
                        <div><strong>Physical Cash Handed Over:</strong> ₹{printingShift.physicalCashHandedOver}</div>
                        <div><strong>Tally Variance:</strong> ₹{printingShift.cashDifference || 0} ({printingShift.tallyStatus})</div>
                    </div>
                    <hr className="my-2 border-dark" />
                    <div className="d-flex justify-content-between pt-3 text-center" style={{ fontSize: '0.75rem' }}>
                        <div>
                            <div className="border-bottom border-dark pb-2 mb-1" style={{ width: '120px' }}></div>
                            <span>Cashier Sign</span>
                        </div>
                        <div>
                            <div className="border-bottom border-dark pb-2 mb-1" style={{ width: '120px' }}></div>
                            <span>Officer Sign</span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
