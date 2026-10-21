import React, { useState, useEffect } from 'react';
import { apiFetch } from '../../utils/api';
import { printHtmlViaIframe } from '../../utils/printHelper';
import { useConfirm } from '../../context/ConfirmContext';
import { toast } from 'react-toastify';

export default function ShiftDrawerModal({
    isOpen,
    onClose,
    currentUser,
    activeShift,
    onShiftUpdated
}) {
    const confirm = useConfirm();
    // Starting a new shift state
    const [counterNo, setCounterNo] = useState(currentUser.counterAssigned || 'Counter-01');
    const [openingFloat, setOpeningFloat] = useState('2000');

    // Closing shift denomination state (VERTICAL: 500 to 1 + Coins)
    const [denominations, setDenominations] = useState({
        500: '',
        200: '',
        100: '',
        50: '',
        20: '',
        10: '',
        5: '',
        2: '',
        1: '',
        coins: ''
    });

    const [cashierNotes, setCashierNotes] = useState('');
    const [isClosingShift, setIsClosingShift] = useState(false);
    const [officerList, setOfficerList] = useState([]);
    const [selectedOfficerId, setSelectedOfficerId] = useState('');
    const [selectedOfficerName, setSelectedOfficerName] = useState('');
    const [isManualOfficer, setIsManualOfficer] = useState(false);
    const [manualOfficerId, setManualOfficerId] = useState('');
    const [submittedVoucher, setSubmittedVoucher] = useState(null);
    const [availableCounters, setAvailableCounters] = useState([]);
    const [storeConfig, setStoreConfig] = useState(null);
    const [customCounterInput, setCustomCounterInput] = useState('');
    const [isCustomCounter, setIsCustomCounter] = useState(false);

    useEffect(() => {
        if (isOpen) {
            loadOfficers();
            loadCounters();
            loadStoreConfig();
            setSubmittedVoucher(null);
            setIsClosingShift(false);
            setIsCustomCounter(false);
        }
    }, [isOpen]);

    const loadStoreConfig = async () => {
        try {
            const res = await apiFetch('/store/config');
            if (res.config) {
                setStoreConfig(res.config);
            }
        } catch (e) {}
    };

    const loadCounters = async () => {
        try {
            const res = await apiFetch('/store/counters/status');
            if (res.counters && res.counters.length > 0) {
                setAvailableCounters(res.counters);
                // Preselect first free counter, or user assigned counter if available
                const freeCounter = res.counters.find(c => !c.isOccupied);
                if (freeCounter) {
                    setCounterNo(freeCounter.name);
                } else {
                    setCounterNo(res.counters[0].name);
                }
            }
        } catch (err) {
            console.warn('Could not load counters status:', err);
        }
    };

    const loadOfficers = async () => {
        try {
            const res = await apiFetch('/auth/users');
            if (res.users) {
                const officers = res.users.filter(u => u.role === 'cash_officer' && u.status === 'APPROVED');
                setOfficerList(officers);
                if (officers.length > 0) {
                    setSelectedOfficerId(officers[0].username || officers[0].id);
                    setSelectedOfficerName(officers[0].name);
                } else {
                    setSelectedOfficerId('officer1');
                    setSelectedOfficerName('Vikram Singh (Head Cash Officer)');
                }
            }
        } catch (err) {
            console.warn('Could not load officers list:', err);
            setSelectedOfficerId('officer1');
            setSelectedOfficerName('Vikram Singh (Head Cash Officer)');
        }
    };

    if (!isOpen) return null;

    // Denomination weights (500 down to 1 + coins)
    const denomWeights = {
        500: 500,
        200: 200,
        100: 100,
        50: 50,
        20: 20,
        10: 10,
        5: 5,
        2: 2,
        1: 1,
        coins: 1
    };

    // Calculate counted physical cash
    let physicalCountedCash = 0;
    Object.entries(denominations).forEach(([d, count]) => {
        const w = denomWeights[d] !== undefined ? denomWeights[d] : (Number(d) || 0);
        physicalCountedCash += (Number(count) || 0) * w;
    });

    // START SHIFT
    const handleStartShift = async (e) => {
        e.preventDefault();
        const finalCounter = isCustomCounter ? customCounterInput.trim() : counterNo;
        if (!finalCounter) {
            toast.warning('Please select or specify your register counter.');
            return;
        }

        // Warn if counter is occupied by another cashier
        const matchingCounter = availableCounters.find(c => c.name === finalCounter);
        if (matchingCounter && matchingCounter.isOccupied && matchingCounter.activeCashierId !== currentUser.id) {
            const isOk = await confirm({
                title: 'Register Counter Occupied',
                message: `Notice: ${finalCounter} is currently marked active under cashier "${matchingCounter.activeCashier}". Do you want to take over this register?`,
                confirmText: 'Take Over Counter',
                confirmVariant: 'warning',
                icon: 'bi-exclamation-triangle-fill'
            });
            if (!isOk) return;
        }

        try {
            await apiFetch('/shifts/start', {
                method: 'POST',
                body: JSON.stringify({
                    cashierId: currentUser.id,
                    cashierName: currentUser.name,
                    counterNo: finalCounter,
                    openingFloat: Number(openingFloat) || 0
                })
            });
            toast.success(`🚀 Shift started at ${finalCounter} with ₹${openingFloat} opening float!`);
            onShiftUpdated();
            onClose();
        } catch (err) {
            toast.error('Failed to open shift: ' + err.message);
        }
    };

    // CLOSE SHIFT & HANDOVER (Blind submission - Cashier does NOT see tally difference)
    const handleCloseShift = async (e) => {
        e.preventDefault();
        if (!activeShift) return;

        if (physicalCountedCash === 0) {
            const isZeroOk = await confirm({
                title: 'Zero Physical Cash Counted',
                message: 'Total counted physical cash is ₹0. Are you sure you want to submit shift handover with zero cash?',
                confirmText: 'Yes, Submit ₹0',
                confirmVariant: 'danger',
                icon: 'bi-cash-coin'
            });
            if (!isZeroOk) return;
        }

        const finalOfficerId = isManualOfficer ? manualOfficerId.trim() : selectedOfficerId;
        const finalOfficerName = isManualOfficer
            ? manualOfficerId.trim()
            : selectedOfficerName || selectedOfficerId;

        if (!finalOfficerId) {
            toast.warning('Please select or enter the Cash Officer ID for the handover.');
            return;
        }

        try {
            const res = await apiFetch(`/shifts/close/${activeShift._id}`, {
                method: 'POST',
                body: JSON.stringify({
                    denominations,
                    physicalCashSubmitted: physicalCountedCash,
                    cashierNotes,
                    handoverToOfficerId: finalOfficerId,
                    handoverToOfficerName: finalOfficerName
                })
            });

            if (res.shift) {
                setSubmittedVoucher({
                    ...res.shift,
                    handoverToOfficerId: finalOfficerId,
                    handoverToOfficerName: finalOfficerName,
                    physicalCashHandedOver: physicalCountedCash,
                    denominations
                });
            }

            toast.success('🔒 Shift closed and submitted for Cash Officer audit!');
            onShiftUpdated();
        } catch (err) {
            toast.error('Failed to close shift: ' + err.message);
        }
    };

    const handlePrintVoucher = () => {
        const v = submittedVoucher || activeShift;
        if (!v) {
            window.print();
            return;
        }
        const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <title>Shift Voucher - ${v.shiftNumber || 'Shift'}</title>
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
                    <div style="font-size: 16px; font-weight: bold;">${storeConfig?.storeName?.toUpperCase() || 'SUPERSTORE POS'}</div>
                    <div style="font-size: 11px; font-weight: bold;">SHIFT SETTLEMENT &amp; HANDOVER VOUCHER</div>
                    <div style="font-size: 9px;">${new Date().toLocaleString('en-IN')}</div>
                </div>
                <div class="divider"></div>
                <div class="flex-between"><span>Shift Number:</span><span><strong>${v.shiftNumber || 'Current'}</strong></span></div>
                <div class="flex-between"><span>Cashier:</span><span>${v.cashierName || currentUser.name} (${v.counterNo || counterNo})</span></div>
                ${v.handoverToOfficerName ? `<div class="flex-between"><span>Handover Officer:</span><span>${v.handoverToOfficerName}</span></div>` : ''}
                <div class="divider"></div>
                <div class="flex-between"><span>Opening Float:</span><span>₹${v.openingFloat || openingFloat}</span></div>
                <div class="flex-between"><span>Total Bills:</span><span>${v.billsCount || 0} bills</span></div>
                <div class="flex-between"><span>Net Sales:</span><span>₹${v.netSales || 0}</span></div>
                <div class="flex-between"><span>• Cash:</span><span>₹${v.paymentSummary?.cash || 0}</span></div>
                <div class="flex-between"><span>• UPI:</span><span>₹${v.paymentSummary?.upi || 0}</span></div>
                <div class="flex-between"><span>• Card:</span><span>₹${v.paymentSummary?.card || 0}</span></div>
                <div class="divider"></div>
                <div class="flex-between"><span>Expected Cash:</span><span>₹${v.expectedCashInDrawer || 0}</span></div>
                ${v.physicalCashHandedOver !== undefined ? `<div class="flex-between"><span>Physical Handed Over:</span><span>₹${v.physicalCashHandedOver}</span></div>` : ''}
                ${v.cashDifference !== undefined ? `<div class="flex-between" style="font-weight: bold;"><span>Cash Variance:</span><span>₹${v.cashDifference} (${v.tallyStatus || 'PENDING'})</span></div>` : ''}
                <div class="double-divider"></div>
                <div class="flex-between text-center" style="margin-top: 25px;">
                    <div><div style="border-top: 1px solid #000; width: 85px; margin-bottom: 3px;"></div>Cashier Sign</div>
                    <div><div style="border-top: 1px solid #000; width: 85px; margin-bottom: 3px;"></div>Officer Sign</div>
                </div>
            </body>
            </html>
        `;
        printHtmlViaIframe(html, `ShiftVoucher_${v.shiftNumber || Date.now()}`);
    };

    const handleOfficerSelectChange = (e) => {
        const val = e.target.value;
        if (val === 'MANUAL') {
            setIsManualOfficer(true);
        } else {
            setIsManualOfficer(false);
            const found = officerList.find(o => (o.username || o.id) === val);
            setSelectedOfficerId(val);
            setSelectedOfficerName(found ? found.name : val);
        }
    };

    return (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(15, 23, 42, 0.75)', zIndex: 1055 }} tabIndex="-1">
            <div className="modal-dialog modal-dialog-centered modal-lg">
                <div className="modal-content border-0 shadow-lg" style={{ borderRadius: '18px', overflow: 'hidden' }}>
                    {/* Header */}
                    <div className="modal-header bg-dark text-white py-3 no-print">
                        <div className="d-flex align-items-center gap-2">
                            <i className="bi bi-safe text-warning fs-4"></i>
                            <div>
                                <h5 className="modal-title fw-bold mb-0">Counter Register &amp; Shift Drawer</h5>
                                <small className="text-white-50">{currentUser.name} &bull; {currentUser.counterAssigned || 'Counter-01'}</small>
                            </div>
                        </div>
                        <button type="button" className="btn-close btn-close-white" onClick={onClose}></button>
                    </div>

                    <div className="modal-body p-4 bg-light" style={{ maxHeight: '82vh', overflowY: 'auto' }}>
                        {/* 1. POST-SUBMISSION: CASHIER HANDOVER VOUCHER (Blind Close Confirmation) */}
                        {submittedVoucher ? (
                            <div>
                                <div className="alert alert-success d-flex align-items-center justify-content-between mb-3 no-print shadow-sm">
                                    <div className="d-flex align-items-center gap-2">
                                        <i className="bi bi-check-circle-fill fs-3 text-success"></i>
                                        <div>
                                            <strong className="fs-6">Cash Handover Submitted to Cash Officer!</strong>
                                            <div className="small text-muted">
                                                Assigned to Officer: <strong>{submittedVoucher.handoverToOfficerName}</strong> (ID: <code>{submittedVoucher.handoverToOfficerId}</code>)
                                            </div>
                                            <div className="small text-muted" style={{ fontSize: '0.78rem' }}>
                                                Reconciliation report will be verified inside the Cash Officer's terminal.
                                            </div>
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        className="btn btn-dark fw-bold btn-sm shadow-sm d-flex align-items-center gap-1"
                                        onClick={handlePrintVoucher}
                                    >
                                        <i className="bi bi-printer-fill"></i>
                                        <span>Print Handover Voucher</span>
                                    </button>
                                </div>

                                {/* Printable Shift Settlement Statement & Cash Handover Slip */}
                                <div className="bg-white p-4 rounded-3 border shadow-sm mx-auto thermal-receipt print-area" style={{ maxWidth: '440px', fontFamily: 'monospace' }}>
                                    <div className="text-center mb-2">
                                        <h5 className="fw-bolder mb-0 text-dark">{storeConfig?.storeName?.toUpperCase() || 'SUPERSTORE POS'}</h5>
                                        {storeConfig?.address && <div className="text-muted" style={{ fontSize: '0.72rem' }}>{storeConfig.address}</div>}
                                        <div className="small fw-bold text-uppercase mt-1">Shift Settlement Statement &amp; Handover</div>
                                        <div style={{ fontSize: '0.75rem', color: '#666' }}>
                                            Printed: {new Date().toLocaleDateString()} {new Date().toLocaleTimeString()}
                                        </div>
                                    </div>

                                    <hr className="my-2 border-dark" />

                                    <div className="small">
                                        <div className="d-flex justify-content-between">
                                            <span>Shift Number:</span>
                                            <strong>{submittedVoucher.shiftNumber}</strong>
                                        </div>
                                        <div className="d-flex justify-content-between">
                                            <span>Counter:</span>
                                            <span>{submittedVoucher.counterNo}</span>
                                        </div>
                                        <div className="d-flex justify-content-between">
                                            <span>Cashier:</span>
                                            <strong>{submittedVoucher.cashierName}</strong>
                                        </div>
                                        <div className="d-flex justify-content-between">
                                            <span>Handover to Officer:</span>
                                            <strong>{submittedVoucher.handoverToOfficerName} ({submittedVoucher.handoverToOfficerId})</strong>
                                        </div>
                                        <div className="d-flex justify-content-between">
                                            <span>Shift Timing:</span>
                                            <span>
                                                {new Date(submittedVoucher.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} &mdash; {new Date(submittedVoucher.endTime || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        </div>
                                    </div>

                                    <hr className="my-2 border-dashed" />

                                    {/* Shift Sales & Bill Summary */}
                                    <div className="small">
                                        <div className="fw-bold text-uppercase mb-1">Shift Billing Summary:</div>
                                        <div className="d-flex justify-content-between">
                                            <span>Total Bills Processed:</span>
                                            <strong>{submittedVoucher.billsCount || 0} bills</strong>
                                        </div>
                                        <div className="d-flex justify-content-between">
                                            <span>Gross Sales (MRP):</span>
                                            <span>₹{(submittedVoucher.grossSales || 0).toLocaleString('en-IN')}</span>
                                        </div>
                                        <div className="d-flex justify-content-between">
                                            <span>Total Discounts Given:</span>
                                            <span>₹{(submittedVoucher.totalDiscount || 0).toLocaleString('en-IN')}</span>
                                        </div>
                                        <div className="d-flex justify-content-between fw-bold border-top pt-1 mt-1">
                                            <span>Net Sales Revenue:</span>
                                            <span>₹{(submittedVoucher.netSales || 0).toLocaleString('en-IN')}</span>
                                        </div>
                                    </div>

                                    <hr className="my-2 border-dashed" />

                                    {/* All Payment Mode Collections Breakdown (UPI, Card, Cash) */}
                                    <div className="small">
                                        <div className="fw-bold text-uppercase mb-2 text-primary">Payment Collections Breakdown:</div>

                                        {/* 1. UPI Details */}
                                        <div className="p-2 bg-light rounded mb-2 border">
                                            <div className="d-flex justify-content-between align-items-center">
                                                <div>
                                                    <strong className="text-dark">📱 UPI Collections</strong>
                                                    <div className="text-muted" style={{ fontSize: '0.72rem' }}>
                                                        {submittedVoucher.paymentSummary?.upiCount || 0} transaction(s)
                                                    </div>
                                                </div>
                                                <div className="fs-6 fw-bold font-mono text-dark">
                                                    ₹{(submittedVoucher.paymentSummary?.upi || 0).toLocaleString('en-IN')}
                                                </div>
                                            </div>
                                        </div>

                                        {/* 2. CARD Details */}
                                        <div className="p-2 bg-light rounded mb-2 border">
                                            <div className="d-flex justify-content-between align-items-center">
                                                <div>
                                                    <strong className="text-dark">💳 Card Collections</strong>
                                                    <div className="text-muted" style={{ fontSize: '0.72rem' }}>
                                                        {submittedVoucher.paymentSummary?.cardCount || 0} transaction(s)
                                                    </div>
                                                </div>
                                                <div className="fs-6 fw-bold font-mono text-dark">
                                                    ₹{(submittedVoucher.paymentSummary?.card || 0).toLocaleString('en-IN')}
                                                </div>
                                            </div>
                                        </div>

                                        {/* 3. CASH Handover Details */}
                                        <div className="p-2 bg-light rounded mb-2 border">
                                            <div className="d-flex justify-content-between align-items-center">
                                                <div>
                                                    <strong className="text-dark">💵 Physical Cash Handover</strong>
                                                    <div className="text-muted" style={{ fontSize: '0.72rem' }}>
                                                        {submittedVoucher.paymentSummary?.cashCount || 0} cash bill(s) + Float
                                                    </div>
                                                </div>
                                                <div className="fs-6 fw-bold font-mono text-success">
                                                    ₹{(submittedVoucher.physicalCashHandedOver || 0).toLocaleString('en-IN')}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Grand Total Collections */}
                                        <div className="d-flex justify-content-between border-top border-bottom py-1 my-1 fw-bold fs-6">
                                            <span>TOTAL SETTLEMENT:</span>
                                            <span className="font-mono text-dark">
                                                ₹{((Number(submittedVoucher.physicalCashHandedOver) || 0) + (Number(submittedVoucher.paymentSummary?.upi) || 0) + (Number(submittedVoucher.paymentSummary?.card) || 0)).toLocaleString('en-IN')}
                                            </span>
                                        </div>
                                    </div>

                                    <hr className="my-2 border-dashed" />

                                    {/* Vertical Denominations Breakdown (500 to 1) */}
                                    <div className="small">
                                        <div className="fw-bold text-uppercase mb-1">Enclosed Cash Denominations:</div>
                                        <table className="w-100 text-end" style={{ fontSize: '0.8rem' }}>
                                            <thead>
                                                <tr className="border-bottom text-muted">
                                                    <th className="text-start">Denom</th>
                                                    <th className="text-center">Count</th>
                                                    <th>Total</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {[500, 200, 100, 50, 20, 10, 5, 2, 1].map(d => {
                                                    const count = Number(submittedVoucher.denominations?.[d]) || 0;
                                                    if (count === 0) return null;
                                                    return (
                                                        <tr key={d}>
                                                            <td className="text-start font-mono">₹{d}</td>
                                                            <td className="text-center font-mono">{count} pcs</td>
                                                            <td className="font-mono fw-bold">₹{d * count}</td>
                                                        </tr>
                                                    );
                                                })}
                                                {Number(submittedVoucher.denominations?.coins) > 0 && (
                                                    <tr>
                                                        <td className="text-start">Coins</td>
                                                        <td className="text-center">-</td>
                                                        <td className="font-mono fw-bold">₹{submittedVoucher.denominations.coins}</td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>

                                    <hr className="my-3 border-dark" />

                                    <div className="p-2 bg-light rounded small text-center text-muted mb-3" style={{ fontSize: '0.72rem' }}>
                                        <i className="bi bi-shield-lock me-1"></i>
                                        Blind Handover: System expected cash and reconciliation tally are confidential and accessible only by Cash Officer <strong>{submittedVoucher.handoverToOfficerId}</strong>.
                                    </div>

                                    {/* Signatures */}
                                    <div className="d-flex justify-content-between pt-3 text-center" style={{ fontSize: '0.75rem' }}>
                                        <div>
                                            <div className="border-bottom border-dark pb-3 mb-1" style={{ width: '130px' }}></div>
                                            <span>Cashier Signature</span>
                                        </div>
                                        <div>
                                            <div className="border-bottom border-dark pb-3 mb-1" style={{ width: '130px' }}></div>
                                            <span>Officer Signature</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : !activeShift ? (
                            /* 2. NO ACTIVE SHIFT: START SHIFT FORM */
                            <form onSubmit={handleStartShift}>
                                <div className="text-center py-3 mb-3">
                                    <div className="display-4 text-success mb-2">💼</div>
                                    <h5 className="fw-bold text-dark">Open Counter Drawer for Daily Billing</h5>
                                    <p className="text-muted small">
                                        Select your assigned counter register and enter the opening float cash issued from the vault.
                                    </p>
                                </div>

                                <div className="row g-3 bg-white p-4 rounded-3 border shadow-sm">
                                    <div className="col-md-6">
                                        <div className="d-flex justify-content-between align-items-center mb-1">
                                            <label className="form-label fw-bold small text-muted text-uppercase mb-0">
                                                Select Your Register Counter Today:
                                            </label>
                                            <button
                                                type="button"
                                                className="btn btn-link btn-sm p-0 text-decoration-none small text-success fw-bold"
                                                onClick={() => setIsCustomCounter(!isCustomCounter)}
                                            >
                                                {isCustomCounter ? 'Choose from List' : '+ Custom / New Desk'}
                                            </button>
                                        </div>

                                        {!isCustomCounter ? (
                                            <select
                                                className="form-select form-select-lg fw-bold"
                                                value={counterNo}
                                                onChange={(e) => setCounterNo(e.target.value)}
                                            >
                                                {availableCounters.map(c => (
                                                    <option key={c.name} value={c.name}>
                                                        {c.name} {c.isOccupied ? `(⚠️ In-use: ${c.activeCashier})` : '(✅ Free)'}
                                                    </option>
                                                ))}
                                                {availableCounters.length === 0 && (
                                                    <option value="Counter-01">Counter-01 (Express Grocery)</option>
                                                )}
                                            </select>
                                        ) : (
                                            <input
                                                type="text"
                                                className="form-control form-control-lg fw-bold font-mono"
                                                placeholder="e.g. Counter-05, Quick Billing"
                                                value={customCounterInput}
                                                onChange={(e) => setCustomCounterInput(e.target.value)}
                                                required
                                            />
                                        )}
                                        <small className="text-muted d-block mt-1" style={{ fontSize: '0.75rem' }}>
                                            <i className="bi bi-info-circle me-1 text-primary"></i>
                                            Select the counter you are sitting at today. Will appear on all receipts.
                                        </small>
                                    </div>

                                    <div className="col-md-6">
                                        <label className="form-label fw-bold small text-muted text-uppercase">
                                            Opening Float Cash (Vault Change)
                                        </label>
                                        <div className="input-group input-group-lg">
                                            <span className="input-group-text bg-light fw-bold">₹</span>
                                            <input
                                                type="number"
                                                className="form-control font-mono fw-bold"
                                                placeholder="2000"
                                                value={openingFloat}
                                                onChange={(e) => setOpeningFloat(e.target.value)}
                                                required
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="mt-4 text-end">
                                    <button type="submit" className="btn btn-success btn-lg px-4 fw-bold shadow">
                                        <i className="bi bi-play-circle-fill me-2"></i> Start Register Shift
                                    </button>
                                </div>
                            </form>
                        ) : (
                            /* 3. ACTIVE SHIFT RUNNING */
                            <div>
                                {/* Active Shift Overview Card (DOES NOT REVEAL EXPECTED CASH) */}
                                <div className="p-3 bg-white rounded-3 border mb-3 shadow-sm">
                                    <div className="d-flex justify-content-between align-items-center mb-2">
                                        <div>
                                            <span className="badge bg-success px-2 py-1 me-2">
                                                <i className="bi bi-circle-fill me-1 small"></i> REGISTER ACTIVE
                                            </span>
                                            <strong className="font-mono text-dark">{activeShift.shiftNumber}</strong>
                                        </div>
                                        <small className="text-muted">
                                            Started: {new Date(activeShift.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </small>
                                    </div>

                                    {/* Blind Metrics Grid (Float, Bills Count, Total Sales - NO Expected Cash) */}
                                    <div className="row g-2 text-center pt-2 border-top">
                                        <div className="col-4">
                                            <small className="text-muted d-block">Opening Float</small>
                                            <span className="font-mono fw-bold text-dark fs-6">
                                                ₹{activeShift.openingFloat?.toLocaleString('en-IN')}
                                            </span>
                                        </div>
                                        <div className="col-4 border-start">
                                            <small className="text-muted d-block">
                                                Total Bills Processed
                                            </small>
                                            <span className="font-mono fw-bold text-dark fs-6">
                                                {activeShift.billsCount || 0} bills
                                            </span>
                                        </div>
                                        <div className="col-4 border-start">
                                            <small className="text-muted d-block">
                                                Gross Sales Value
                                            </small>
                                            <span className="font-mono fw-bold text-success fs-6">
                                                ₹{(activeShift.netSales || 0).toLocaleString('en-IN')}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Digital & Cash Breakdown Summary */}
                                    <div className="row g-2 text-center pt-2 border-top mt-2">
                                        <div className="col-4">
                                            <span className="badge bg-light text-dark border px-2 py-1">
                                                📱 UPI: ₹{(activeShift.paymentSummary?.upi || 0).toLocaleString('en-IN')}
                                            </span>
                                            <small className="d-block text-muted" style={{ fontSize: '0.72rem' }}>
                                                {activeShift.paymentSummary?.upiCount || 0} txns
                                            </small>
                                        </div>
                                        <div className="col-4 border-start">
                                            <span className="badge bg-light text-dark border px-2 py-1">
                                                💳 Card: ₹{(activeShift.paymentSummary?.card || 0).toLocaleString('en-IN')}
                                            </span>
                                            <small className="d-block text-muted" style={{ fontSize: '0.72rem' }}>
                                                {activeShift.paymentSummary?.cardCount || 0} txns
                                            </small>
                                        </div>
                                        <div className="col-4 border-start">
                                            <span className="badge bg-light text-dark border px-2 py-1">
                                                💵 Cash: ₹{(activeShift.paymentSummary?.cash || 0).toLocaleString('en-IN')}
                                            </span>
                                            <small className="d-block text-muted" style={{ fontSize: '0.72rem' }}>
                                                {activeShift.paymentSummary?.cashCount || 0} bills
                                            </small>
                                        </div>
                                    </div>
                                </div>

                                {/* Shift Close Toggle */}
                                {!isClosingShift ? (
                                    <div className="text-center py-4 bg-white rounded-3 border">
                                        <i className="bi bi-clock-history display-5 text-muted mb-2"></i>
                                        <h6 className="fw-bold">Your Counter Register is Actively Billing</h6>
                                        <p className="text-muted small mb-3">
                                            When duty ends, count your drawer currency, print your shift settlement statement with all UPI and Card totals, and handover cash to the Cash Officer.
                                        </p>
                                        <div className="d-flex justify-content-center gap-2 flex-wrap">
                                            <button
                                                type="button"
                                                className="btn btn-outline-dark fw-bold px-3 shadow-sm d-flex align-items-center gap-1"
                                                onClick={handlePrintVoucher}
                                                title="Print running shift statement (X-Report)"
                                            >
                                                <i className="bi bi-printer"></i>
                                                <span>Print Shift Statement (X-Report)</span>
                                            </button>
                                            <button
                                                type="button"
                                                className="btn btn-warning text-dark fw-bold px-4 shadow-sm d-flex align-items-center gap-1"
                                                onClick={() => setIsClosingShift(true)}
                                            >
                                                <i className="bi bi-box-arrow-right"></i>
                                                <span>Close Register &amp; Settlement Handover</span>
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    /* PHYSICAL CASH DENOMINATIONS FORM - VERTICAL (500 TO 1) */
                                    <form onSubmit={handleCloseShift} className="bg-white p-3 rounded-3 border shadow-sm">
                                        <div className="d-flex justify-content-between align-items-center mb-3 border-bottom pb-2">
                                            <h6 className="fw-bold text-dark mb-0">
                                                <i className="bi bi-calculator me-1"></i> Count Physical Cash in Drawer:
                                            </h6>
                                            <button
                                                type="button"
                                                className="btn btn-sm btn-link text-decoration-none text-muted"
                                                onClick={() => setIsClosingShift(false)}
                                            >
                                                Back to active view
                                            </button>
                                        </div>

                                        {/* Cash Officer Selection: Enter or Select Officer ID */}
                                        <div className="mb-3 p-3 bg-light rounded-3 border">
                                            <div className="d-flex justify-content-between align-items-center mb-1">
                                                <label className="form-label small fw-bold text-dark text-uppercase mb-0">
                                                    <i className="bi bi-person-badge text-primary me-1"></i>
                                                    Select On-Duty Cash Officer (Whose ID to Submit to):
                                                </label>
                                                <button
                                                    type="button"
                                                    className="btn btn-sm btn-link text-decoration-none p-0"
                                                    style={{ fontSize: '0.75rem' }}
                                                    onClick={() => setIsManualOfficer(!isManualOfficer)}
                                                >
                                                    {isManualOfficer ? 'Choose from list' : '+ Type Officer ID manually'}
                                                </button>
                                            </div>

                                            {!isManualOfficer ? (
                                                <select
                                                    className="form-select form-select-sm fw-bold"
                                                    value={selectedOfficerId}
                                                    onChange={handleOfficerSelectChange}
                                                    required
                                                >
                                                    {officerList.map(off => (
                                                        <option key={off.id} value={off.username || off.id}>
                                                            {off.name} (Officer ID: {off.username || off.id})
                                                        </option>
                                                    ))}
                                                    {officerList.length === 0 && (
                                                        <option value="officer1">
                                                            Vikram Singh (Officer ID: officer1)
                                                        </option>
                                                    )}
                                                </select>
                                            ) : (
                                                <div className="input-group input-group-sm">
                                                    <span className="input-group-text bg-white fw-bold">Officer ID:</span>
                                                    <input
                                                        type="text"
                                                        className="form-control font-mono fw-bold"
                                                        placeholder="e.g. officer1, vikram_singh"
                                                        value={manualOfficerId}
                                                        onChange={(e) => setManualOfficerId(e.target.value)}
                                                        required
                                                    />
                                                </div>
                                            )}

                                            <small className="text-muted d-block mt-1" style={{ fontSize: '0.75rem' }}>
                                                <i className="bi bi-shield-check text-success me-1"></i>
                                                This report and tally reconciliation will appear strictly inside this Cash Officer's account.
                                            </small>
                                        </div>

                                        {/* VERTICAL DENOMINATION TABLE (500 TO 1 + COINS) */}
                                        <div className="mb-3">
                                            <div className="d-flex justify-content-between align-items-center mb-2">
                                                <label className="form-label small fw-bold text-muted text-uppercase mb-0">
                                                    Physical Currency Breakdown (₹500 to ₹1):
                                                </label>
                                                <span className="badge bg-light text-muted border">Vertical Layout</span>
                                            </div>

                                            <div className="table-responsive border rounded-3 overflow-hidden bg-white">
                                                <table className="table table-sm table-hover align-middle mb-0">
                                                    <thead className="table-light text-muted small text-uppercase">
                                                        <tr>
                                                            <th style={{ width: '30%' }}>Note / Denom</th>
                                                            <th style={{ width: '35%' }} className="text-center">Count (Pcs)</th>
                                                            <th style={{ width: '35%' }} className="text-end">Total Amount (₹)</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {[500, 200, 100, 50, 20, 10, 5, 2, 1].map(val => {
                                                            const pcs = Number(denominations[val]) || 0;
                                                            const rowTotal = pcs * val;
                                                            return (
                                                                <tr key={val}>
                                                                    <td className="fw-bold">
                                                                        <span className="badge bg-light text-dark border font-mono px-2 py-1 me-1">
                                                                            ₹{val}
                                                                        </span>
                                                                        <span className="small text-muted">{val >= 10 ? 'Note' : 'Note / Coin'}</span>
                                                                    </td>
                                                                    <td className="text-center">
                                                                        <div className="input-group input-group-sm w-75 mx-auto">
                                                                            <input
                                                                                type="number"
                                                                                min="0"
                                                                                className="form-control text-center font-mono fw-bold"
                                                                                placeholder="0"
                                                                                value={denominations[val]}
                                                                                onChange={(e) => setDenominations({ ...denominations, [val]: e.target.value })}
                                                                            />
                                                                            <span className="input-group-text bg-light" style={{ fontSize: '0.72rem' }}>pcs</span>
                                                                        </div>
                                                                    </td>
                                                                    <td className="text-end font-mono fw-bold">
                                                                        ₹{rowTotal.toLocaleString('en-IN')}
                                                                    </td>
                                                                </tr>
                                                            );
                                                        })}

                                                        {/* Coins Row */}
                                                        <tr>
                                                            <td className="fw-bold">
                                                                <span className="badge bg-light text-dark border font-mono px-2 py-1 me-1">
                                                                    Coins
                                                                </span>
                                                                <span className="small text-muted">Loose Coins</span>
                                                            </td>
                                                            <td className="text-center">
                                                                <div className="input-group input-group-sm w-75 mx-auto">
                                                                    <span className="input-group-text bg-light">₹</span>
                                                                    <input
                                                                        type="number"
                                                                        min="0"
                                                                        className="form-control text-center font-mono fw-bold"
                                                                        placeholder="0"
                                                                        value={denominations.coins}
                                                                        onChange={(e) => setDenominations({ ...denominations, coins: e.target.value })}
                                                                    />
                                                                </div>
                                                            </td>
                                                            <td className="text-end font-mono fw-bold">
                                                                ₹{(Number(denominations.coins) || 0).toLocaleString('en-IN')}
                                                            </td>
                                                        </tr>
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>

                                        {/* Total Physical Cash Counted Banner (NO EXPECTED OR TALLY DIFFERENCE SHOWN) */}
                                        <div className="p-3 bg-light rounded-3 border mb-3 text-center">
                                            <div className="text-muted small fw-bold text-uppercase">Total Physical Cash Counted</div>
                                            <div className="fs-2 fw-bolder font-mono text-primary">
                                                ₹{physicalCountedCash.toLocaleString('en-IN')}
                                            </div>
                                            <small className="text-muted">
                                                Enclose physical notes &amp; coins in counter handover pouch.
                                            </small>
                                        </div>

                                        {/* Cashier Remarks */}
                                        <div className="mb-3">
                                            <label className="form-label small fw-bold text-muted text-uppercase">
                                                Cashier Closing Remarks / Comments:
                                            </label>
                                            <input
                                                type="text"
                                                className="form-control form-control-sm"
                                                placeholder="e.g. Counter pouch sealed for handover..."
                                                value={cashierNotes}
                                                onChange={(e) => setCashierNotes(e.target.value)}
                                            />
                                        </div>

                                        <div className="d-flex justify-content-between">
                                            <button
                                                type="button"
                                                className="btn btn-outline-secondary"
                                                onClick={() => setIsClosingShift(false)}
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                type="submit"
                                                className="btn btn-danger fw-bold px-4 shadow d-flex align-items-center gap-2"
                                            >
                                                <i className="bi bi-box-arrow-right"></i>
                                                <span>
                                                    Submit Handover to {isManualOfficer ? (manualOfficerId || 'Cash Officer') : (selectedOfficerName || selectedOfficerId)}
                                                </span>
                                            </button>
                                        </div>
                                    </form>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="modal-footer bg-white p-3 no-print">
                        <button type="button" className="btn btn-secondary" onClick={onClose}>
                            Close
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
