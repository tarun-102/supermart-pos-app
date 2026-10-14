import React, { useState, useEffect } from 'react';

export default function SplitPaymentModal({
    isOpen,
    onClose,
    netPayable = 0,
    storeConfig = null,
    onCompletePayment
}) {
    // Modes: 'CASH', 'UPI', 'CARD', 'SPLIT'
    const [mode, setMode] = useState('CASH');

    // Split allocations
    const [cashAllocated, setCashAllocated] = useState('');
    const [upiAllocated, setUpiAllocated] = useState('');
    const [cardAllocated, setCardAllocated] = useState('');

    // Tendered Cash
    const [cashTendered, setCashTendered] = useState('');

    // Initialize when modal opens or total changes
    useEffect(() => {
        if (isOpen) {
            setMode('CASH');
            setCashAllocated(netPayable.toString());
            setUpiAllocated('0');
            setCardAllocated('0');
            setCashTendered(netPayable.toString());
        }
    }, [isOpen, netPayable]);

    if (!isOpen) return null;

    // Handle mode selection
    const handleSelectMode = (selectedMode) => {
        setMode(selectedMode);
        if (selectedMode === 'CASH') {
            setCashAllocated(netPayable.toString());
            setUpiAllocated('0');
            setCardAllocated('0');
            setCashTendered(netPayable.toString());
        } else if (selectedMode === 'UPI') {
            setCashAllocated('0');
            setUpiAllocated(netPayable.toString());
            setCardAllocated('0');
            setCashTendered('0');
        } else if (selectedMode === 'CARD') {
            setCashAllocated('0');
            setUpiAllocated('0');
            setCardAllocated(netPayable.toString());
            setCashTendered('0');
        } else if (selectedMode === 'SPLIT') {
            const half = Math.floor(netPayable / 2);
            const remaining = netPayable - half;
            setCashAllocated(half.toString());
            setUpiAllocated(remaining.toString());
            setCardAllocated('0');
            setCashTendered(half.toString());
        }
    };

    // Calculate amounts
    const numCashAllocated = mode === 'CASH'
        ? netPayable
        : mode === 'SPLIT'
            ? (Number(cashAllocated) || 0)
            : 0;

    const numUpiAllocated = mode === 'UPI'
        ? netPayable
        : mode === 'SPLIT'
            ? (Number(upiAllocated) || 0)
            : 0;

    const numCardAllocated = mode === 'CARD'
        ? netPayable
        : mode === 'SPLIT'
            ? (Number(cardAllocated) || 0)
            : 0;

    const totalAllocated = numCashAllocated + numUpiAllocated + numCardAllocated;
    const splitBalanceRemaining = netPayable - totalAllocated;

    // Cash tendered & change calculation
    const numTendered = Number(cashTendered) || 0;
    const changeToReturn = numCashAllocated > 0 && numTendered >= numCashAllocated
        ? numTendered - numCashAllocated
        : 0;
    const cashDeficit = numCashAllocated > 0 && numTendered < numCashAllocated
        ? numCashAllocated - numTendered
        : 0;

    // Validation
    const isSplitValid = mode === 'SPLIT'
        ? Math.abs(splitBalanceRemaining) === 0 && (numCashAllocated === 0 || numTendered >= numCashAllocated)
        : true;

    const isCashValid = mode === 'CASH'
        ? numTendered >= netPayable
        : true;

    const canComplete = mode === 'CASH'
        ? isCashValid
        : mode === 'SPLIT'
            ? isSplitValid
            : true;

    // Quick cash increment helper
    const handleAddCash = (amount) => {
        const current = Number(cashTendered) || 0;
        setCashTendered((current + amount).toString());
    };

    const handleSetExactCash = (amount) => {
        setCashTendered(amount.toString());
    };

    const handleFillRemaining = (target) => {
        if (target === 'cash') {
            const needed = Math.max(0, netPayable - (numUpiAllocated + numCardAllocated));
            setCashAllocated(needed.toString());
            setCashTendered(needed.toString());
        } else if (target === 'upi') {
            const needed = Math.max(0, netPayable - (numCashAllocated + numCardAllocated));
            setUpiAllocated(needed.toString());
        } else if (target === 'card') {
            const needed = Math.max(0, netPayable - (numCashAllocated + numUpiAllocated));
            setCardAllocated(needed.toString());
        }
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!canComplete) return;

        onCompletePayment({
            paymentMethod: mode,
            splitBreakdown: {
                cashAmount: numCashAllocated,
                upiAmount: numUpiAllocated,
                cardAmount: numCardAllocated
            },
            cashTendered: numCashAllocated > 0 ? numTendered : 0,
            changeReturned: changeToReturn
        });
    };

    return (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(15, 23, 42, 0.75)', zIndex: 1055 }} tabIndex="-1">
            <div className="modal-dialog modal-dialog-centered modal-lg">
                <div className="modal-content border-0 shadow-lg" style={{ borderRadius: '18px', overflow: 'hidden' }}>
                    {/* Modal Header */}
                    <div className="modal-header bg-success text-white py-3 px-4">
                        <div className="d-flex align-items-center gap-2">
                            <span className="fs-3">💳</span>
                            <div>
                                <h5 className="modal-title fw-bold mb-0">Checkout &amp; Payment Settlement</h5>
                                <small className="text-white-50">Select customer payment mode or split tender</small>
                            </div>
                        </div>
                        <button type="button" className="btn-close btn-close-white" onClick={onClose}></button>
                    </div>

                    <form onSubmit={handleSubmit}>
                        <div className="modal-body p-4 bg-light">
                            {/* Net Payable Banner */}
                            <div className="d-flex align-items-center justify-content-between p-3 bg-white rounded-3 border mb-3 shadow-sm">
                                <div>
                                    <div className="text-muted small fw-bold text-uppercase">Net Bill Payable</div>
                                    <div className="display-6 fw-bolder text-success">
                                        ₹{netPayable.toLocaleString('en-IN')}
                                    </div>
                                </div>
                                <div className="text-end">
                                    <span className="badge bg-success-subtle text-success border border-success-subtle px-3 py-2 fs-6 fw-bold">
                                        <i className="bi bi-shield-check me-1"></i> Ready for Tender
                                    </span>
                                </div>
                            </div>

                            {/* Payment Mode Selector Tabs - Responsive Grid */}
                            <div className="mb-3">
                                <label className="form-label fw-bold small text-muted text-uppercase mb-2">
                                    Select Payment Method:
                                </label>
                                <div className="row g-2">
                                    <div className="col-6 col-sm-3">
                                        <button
                                            type="button"
                                            className={`btn w-100 py-2 fw-bold rounded-3 ${mode === 'CASH' ? 'btn-success text-white shadow-sm' : 'btn-outline-secondary'}`}
                                            onClick={() => handleSelectMode('CASH')}
                                            style={{ fontSize: '0.85rem' }}
                                        >
                                            <i className="bi bi-cash-stack me-1"></i> Cash
                                        </button>
                                    </div>
                                    <div className="col-6 col-sm-3">
                                        <button
                                            type="button"
                                            className={`btn w-100 py-2 fw-bold rounded-3 ${mode === 'CARD' ? 'btn-success text-white shadow-sm' : 'btn-outline-secondary'}`}
                                            onClick={() => handleSelectMode('CARD')}
                                            style={{ fontSize: '0.85rem' }}
                                        >
                                            <i className="bi bi-credit-card me-1"></i> Card
                                        </button>
                                    </div>
                                    <div className="col-6 col-sm-3">
                                        <button
                                            type="button"
                                            className={`btn w-100 py-2 fw-bold rounded-3 ${mode === 'UPI' ? 'btn-success text-white shadow-sm' : 'btn-outline-secondary'}`}
                                            onClick={() => handleSelectMode('UPI')}
                                            style={{ fontSize: '0.85rem' }}
                                        >
                                            <i className="bi bi-qr-code-scan me-1"></i> UPI QR
                                        </button>
                                    </div>
                                    <div className="col-6 col-sm-3">
                                        <button
                                            type="button"
                                            className={`btn w-100 py-2 fw-bold rounded-3 ${mode === 'SPLIT' ? 'btn-success text-white shadow-sm' : 'btn-outline-secondary'}`}
                                            onClick={() => handleSelectMode('SPLIT')}
                                            style={{ fontSize: '0.85rem' }}
                                        >
                                            <i className="bi bi-pie-chart me-1"></i> Split
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* 1. CASH PAYMENT VIEW */}
                            {mode === 'CASH' && (
                                <div className="card border-0 shadow-sm p-4 bg-white rounded-3 mb-3">
                                    <div className="row g-3 align-items-center">
                                        <div className="col-md-6">
                                            <label className="form-label fw-bold small text-muted text-uppercase mb-1">
                                                Cash Received from Customer (Tendered)
                                            </label>
                                            <div className="input-group input-group-lg mb-2">
                                                <span className="input-group-text bg-light fw-bold fs-4">₹</span>
                                                <input
                                                    type="number"
                                                    className="form-control form-control-lg fw-bolder font-mono fs-3 text-dark"
                                                    placeholder="Enter amount"
                                                    value={cashTendered}
                                                    onChange={(e) => setCashTendered(e.target.value)}
                                                    autoFocus
                                                    min="0"
                                                    step="1"
                                                />
                                            </div>

                                            {/* Quick Tender Currency Shortcut Buttons */}
                                            <div className="d-flex flex-wrap gap-1 mt-2">
                                                <button
                                                    type="button"
                                                    className="btn btn-sm btn-outline-success fw-bold"
                                                    onClick={() => handleSetExactCash(netPayable)}
                                                >
                                                    Exact (₹{netPayable})
                                                </button>
                                                <button
                                                    type="button"
                                                    className="btn btn-sm btn-outline-secondary fw-semibold"
                                                    onClick={() => handleAddCash(10)}
                                                >
                                                    +₹10
                                                </button>
                                                <button
                                                    type="button"
                                                    className="btn btn-sm btn-outline-secondary fw-semibold"
                                                    onClick={() => handleAddCash(50)}
                                                >
                                                    +₹50
                                                </button>
                                                <button
                                                    type="button"
                                                    className="btn btn-sm btn-outline-secondary fw-semibold"
                                                    onClick={() => handleAddCash(100)}
                                                >
                                                    +₹100
                                                </button>
                                                <button
                                                    type="button"
                                                    className="btn btn-sm btn-outline-primary fw-bold"
                                                    onClick={() => handleSetExactCash(500)}
                                                >
                                                    ₹500 Note
                                                </button>
                                                <button
                                                    type="button"
                                                    className="btn btn-sm btn-outline-primary fw-bold"
                                                    onClick={() => handleSetExactCash(1000)}
                                                >
                                                    ₹1000
                                                </button>
                                                <button
                                                    type="button"
                                                    className="btn btn-sm btn-outline-primary fw-bold"
                                                    onClick={() => handleSetExactCash(2000)}
                                                >
                                                    ₹2000
                                                </button>
                                            </div>
                                        </div>

                                        {/* BIG PROMINENT CHANGE TO RETURN CARD */}
                                        <div className="col-md-6">
                                            {numTendered >= netPayable ? (
                                                <div
                                                    className="p-3 rounded-3 text-center border border-success border-2 shadow-sm"
                                                    style={{ backgroundColor: '#f0fdf4' }}
                                                >
                                                    <div className="text-uppercase small fw-bold text-success mb-1 tracking-wider">
                                                        <i className="bi bi-cash-coin me-1 fs-5 align-middle"></i>
                                                        CHANGE TO RETURN TO CUSTOMER
                                                    </div>
                                                    <div
                                                        className="fw-bolder text-success font-mono"
                                                        style={{ fontSize: '2.5rem', lineHeight: '1.1' }}
                                                    >
                                                        ₹{changeToReturn.toFixed(2)}
                                                    </div>
                                                    <small className="text-muted d-block mt-1">
                                                        Hand over exact change and print invoice
                                                    </small>
                                                </div>
                                            ) : (
                                                <div
                                                    className="p-3 rounded-3 text-center border border-danger border-2 shadow-sm"
                                                    style={{ backgroundColor: '#fef2f2' }}
                                                >
                                                    <div className="text-uppercase small fw-bold text-danger mb-1 tracking-wider">
                                                        <i className="bi bi-exclamation-circle-fill me-1"></i>
                                                        INSUFFICIENT CASH TENDERED
                                                    </div>
                                                    <div
                                                        className="fw-bolder text-danger font-mono"
                                                        style={{ fontSize: '2.2rem', lineHeight: '1.1' }}
                                                    >
                                                        -₹{cashDeficit.toFixed(2)}
                                                    </div>
                                                    <small className="text-danger d-block mt-1 fw-semibold">
                                                        Collect ₹{cashDeficit.toFixed(2)} more to complete bill
                                                    </small>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* 2. CARD PAYMENT VIEW */}
                            {mode === 'CARD' && (
                                <div className="card border-0 shadow-sm p-4 bg-white rounded-3 mb-3 text-center">
                                    <div className="display-4 text-dark mb-2">💳</div>
                                    <h5 className="fw-bold text-dark">Debit / Credit Card POS Payment</h5>
                                    <p className="text-muted small mb-3">
                                        Swipe, insert chip, or tap contactless card on the EDC Card terminal for the exact amount.
                                    </p>
                                    <div className="p-3 bg-light rounded-3 border d-inline-block mx-auto mb-2" style={{ minWidth: '300px' }}>
                                        <div className="text-muted small fw-bold text-uppercase">Card Charge Amount</div>
                                        <div className="fs-2 fw-bolder text-dark font-mono">
                                            ₹{netPayable.toLocaleString('en-IN')}
                                        </div>
                                        <span className="badge bg-success-subtle text-success border border-success-subtle mt-1 px-3 py-1">
                                            <i className="bi bi-check2-circle me-1"></i> Auto-settled (No Change Required)
                                        </span>
                                    </div>
                                </div>
                            )}

                            {/* 3. UPI QR PAYMENT VIEW */}
                            {mode === 'UPI' && (
                                <div className="card border-0 shadow-sm p-4 bg-white rounded-3 mb-3 text-center">
                                    <div className="row g-3 align-items-center justify-content-center">
                                        <div className="col-auto">
                                            <div className="p-2 bg-white rounded-3 border shadow-sm">
                                                <img
                                                    src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(`upi://pay?pa=${storeConfig?.contact ? storeConfig.contact.replace(/[^0-9]/g, '') + '@upi' : 'superstorepos@bank'}&pn=${encodeURIComponent(storeConfig?.storeName || 'SuperStorePOS')}&am=${netPayable}&cu=INR`)}`}
                                                    alt="UPI Dynamic QR Code"
                                                    style={{ width: '150px', height: '150px' }}
                                                />
                                            </div>
                                        </div>
                                        <div className="col-md-6 text-md-start">
                                            <span className="badge bg-primary px-3 py-1 mb-2">UPI Instant Payment</span>
                                            <div className="text-muted small fw-bold text-uppercase">Scan to Pay Exact Amount</div>
                                            <div className="fs-2 fw-bolder text-primary font-mono mb-1">
                                                ₹{netPayable.toLocaleString('en-IN')}
                                            </div>
                                            <p className="text-muted small mb-2">
                                                Scan using Google Pay, PhonePe, Paytm, or any UPI app.
                                            </p>
                                            <span className="badge bg-success-subtle text-success border border-success-subtle px-2 py-1 small">
                                                <i className="bi bi-shield-check me-1"></i> Auto-settled
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* 4. SPLIT PAYMENT VIEW (Multi-Mode) */}
                            {mode === 'SPLIT' && (
                                <div>
                                    <div className="row g-3 mb-3">
                                        {/* Cash Split Port */}
                                        <div className="col-md-4">
                                            <div className="card h-100 border-0 shadow-sm p-3 bg-white rounded-3">
                                                <div className="d-flex justify-content-between align-items-center mb-1">
                                                    <span className="fw-bold small text-muted text-uppercase">
                                                        <i className="bi bi-cash me-1 text-success"></i> Cash Settled
                                                    </span>
                                                    <button
                                                        type="button"
                                                        className="btn btn-sm btn-link text-decoration-none p-0 text-success fw-semibold"
                                                        onClick={() => handleFillRemaining('cash')}
                                                    >
                                                        Fill Balance
                                                    </button>
                                                </div>
                                                <div className="input-group mb-2">
                                                    <span className="input-group-text bg-light fw-bold">₹</span>
                                                    <input
                                                        type="number"
                                                        className="form-control fw-bold font-mono"
                                                        value={cashAllocated}
                                                        onChange={(e) => {
                                                            setCashAllocated(e.target.value);
                                                            if (!cashTendered || Number(cashTendered) < Number(e.target.value)) {
                                                                setCashTendered(e.target.value);
                                                            }
                                                        }}
                                                    />
                                                </div>

                                                {numCashAllocated > 0 && (
                                                    <div className="p-2 bg-light rounded border small">
                                                        <div className="d-flex justify-content-between align-items-center mb-1">
                                                            <span className="text-muted">Cash Tendered:</span>
                                                            <input
                                                                type="number"
                                                                className="form-control form-control-sm text-end fw-bold font-mono"
                                                                style={{ width: '85px' }}
                                                                value={cashTendered}
                                                                onChange={(e) => setCashTendered(e.target.value)}
                                                            />
                                                        </div>
                                                        <div className="d-flex justify-content-between align-items-center pt-1 border-top">
                                                            <strong className="text-success">Return Change:</strong>
                                                            <strong className="text-success font-mono fs-6">
                                                                ₹{changeToReturn.toFixed(2)}
                                                            </strong>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* UPI Split Port */}
                                        <div className="col-md-4">
                                            <div className="card h-100 border-0 shadow-sm p-3 bg-white rounded-3">
                                                <div className="d-flex justify-content-between align-items-center mb-1">
                                                    <span className="fw-bold small text-muted text-uppercase">
                                                        <i className="bi bi-qr-code me-1 text-primary"></i> UPI / QR
                                                    </span>
                                                    <button
                                                        type="button"
                                                        className="btn btn-sm btn-link text-decoration-none p-0 text-primary fw-semibold"
                                                        onClick={() => handleFillRemaining('upi')}
                                                    >
                                                        Fill Balance
                                                    </button>
                                                </div>
                                                <div className="input-group mb-2">
                                                    <span className="input-group-text bg-light fw-bold">₹</span>
                                                    <input
                                                        type="number"
                                                        className="form-control fw-bold font-mono text-primary"
                                                        value={upiAllocated}
                                                        onChange={(e) => setUpiAllocated(e.target.value)}
                                                    />
                                                </div>
                                                {numUpiAllocated > 0 && (
                                                    <div className="text-center p-1 bg-light rounded border">
                                                        <small className="text-muted d-block" style={{ fontSize: '0.75rem' }}>
                                                            Customer scans QR for ₹{numUpiAllocated}
                                                        </small>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Card Split Port */}
                                        <div className="col-md-4">
                                            <div className="card h-100 border-0 shadow-sm p-3 bg-white rounded-3">
                                                <div className="d-flex justify-content-between align-items-center mb-1">
                                                    <span className="fw-bold small text-muted text-uppercase">
                                                        <i className="bi bi-credit-card me-1 text-dark"></i> Card / EDC
                                                    </span>
                                                    <button
                                                        type="button"
                                                        className="btn btn-sm btn-link text-decoration-none p-0 text-dark fw-semibold"
                                                        onClick={() => handleFillRemaining('card')}
                                                    >
                                                        Fill Balance
                                                    </button>
                                                </div>
                                                <div className="input-group mb-2">
                                                    <span className="input-group-text bg-light fw-bold">₹</span>
                                                    <input
                                                        type="number"
                                                        className="form-control fw-bold font-mono text-dark"
                                                        value={cardAllocated}
                                                        onChange={(e) => setCardAllocated(e.target.value)}
                                                    />
                                                </div>
                                                {numCardAllocated > 0 && (
                                                    <div className="text-center p-1 bg-light rounded border">
                                                        <small className="text-muted d-block" style={{ fontSize: '0.75rem' }}>
                                                            Swipe card for ₹{numCardAllocated}
                                                        </small>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Split Reconciliation Status Bar */}
                                    <div className="p-3 bg-white rounded-3 border shadow-sm">
                                        <div className="d-flex justify-content-between align-items-center mb-1">
                                            <div>
                                                <span className="text-muted small fw-bold text-uppercase">Allocated: </span>
                                                <span className="font-mono fw-bold fs-6">₹{totalAllocated}</span>
                                                <span className="text-muted small"> / ₹{netPayable}</span>
                                            </div>
                                            <div>
                                                {splitBalanceRemaining === 0 ? (
                                                    <span className="badge bg-success px-3 py-2 fs-6 fw-bold">
                                                        <i className="bi bi-check-circle-fill me-1"></i> Exact Bill Matched
                                                    </span>
                                                ) : splitBalanceRemaining > 0 ? (
                                                    <span className="badge bg-warning text-dark px-3 py-2 fs-6 fw-bold">
                                                        <i className="bi bi-exclamation-triangle-fill me-1"></i> Balance Due: ₹{splitBalanceRemaining}
                                                    </span>
                                                ) : (
                                                    <span className="badge bg-danger px-3 py-2 fs-6 fw-bold">
                                                        <i className="bi bi-x-circle-fill me-1"></i> Overallocated by ₹{Math.abs(splitBalanceRemaining)}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Modal Footer */}
                        <div className="modal-footer bg-white border-top p-3 d-flex justify-content-between">
                            <button type="button" className="btn btn-outline-secondary px-4 fw-semibold" onClick={onClose}>
                                Cancel (Esc)
                            </button>

                            <button
                                type="submit"
                                className="btn btn-success btn-lg px-4 fw-bold shadow d-flex align-items-center gap-2"
                                disabled={!canComplete}
                            >
                                <i className="bi bi-printer-fill fs-5"></i>
                                <span>Complete Sale &amp; Print Bill (F4)</span>
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
