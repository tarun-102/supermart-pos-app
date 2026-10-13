import React from 'react';

export default function HeldBillsModal({ isOpen, onClose, heldBills = [], onResumeBill, onDeleteHeld }) {
    if (!isOpen) return null;

    return (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(15, 23, 42, 0.7)', zIndex: 1055 }} tabIndex="-1">
            <div className="modal-dialog modal-dialog-centered modal-lg">
                <div className="modal-content border-0 shadow-lg" style={{ borderRadius: '16px', overflow: 'hidden' }}>
                    <div className="modal-header bg-warning text-dark py-3">
                        <div className="d-flex align-items-center gap-2">
                            <i className="bi bi-pause-circle-fill fs-5"></i>
                            <div>
                                <h6 className="modal-title fw-bold mb-0">Held Bills / Paused Carts</h6>
                                <small className="text-muted">Resume customer cart when they return to the counter</small>
                            </div>
                        </div>
                        <button type="button" className="btn-close" onClick={onClose}></button>
                    </div>

                    <div className="modal-body p-3 bg-light" style={{ maxHeight: '65vh', overflowY: 'auto' }}>
                        {heldBills.length === 0 ? (
                            <div className="text-center py-5 text-muted">
                                <i className="bi bi-cart-check display-4 opacity-50"></i>
                                <div className="mt-2 fw-semibold">No bills currently on hold.</div>
                                <small>Use the "Hold Bill" button in POS if a customer steps away.</small>
                            </div>
                        ) : (
                            <div className="row g-3">
                                {heldBills.map((hb) => {
                                    const total = hb.items.reduce((s, i) => s + (Number(i.sellingPrice) * Number(i.quantity)), 0);
                                    const timeStr = new Date(hb.heldAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                                    return (
                                        <div key={hb._id} className="col-md-6">
                                            <div className="card h-100 border-0 shadow-sm p-3">
                                                <div className="d-flex justify-content-between align-items-center mb-2">
                                                    <div>
                                                        <span className="fw-bold">{hb.customerName || 'Customer'}</span>
                                                        {hb.customerPhone && (
                                                            <div className="small text-muted">{hb.customerPhone}</div>
                                                        )}
                                                    </div>
                                                    <span className="badge bg-warning-subtle text-warning-emphasis border">
                                                        <i className="bi bi-clock me-1"></i>{timeStr}
                                                    </span>
                                                </div>

                                                <div className="bg-light p-2 rounded mb-2 small" style={{ maxHeight: '90px', overflowY: 'auto' }}>
                                                    {hb.items.map((it, idx) => (
                                                        <div key={idx} className="d-flex justify-content-between text-muted">
                                                            <span className="text-truncate" style={{ maxWidth: '180px' }}>
                                                                {it.name} (x{it.quantity} {it.unit})
                                                            </span>
                                                            <span className="font-mono">₹{it.sellingPrice * it.quantity}</span>
                                                        </div>
                                                    ))}
                                                </div>

                                                <div className="d-flex justify-content-between align-items-center mb-3">
                                                    <small className="text-muted">{hb.items.length} items</small>
                                                    <div className="fw-bolder fs-5 text-success font-mono">
                                                        ₹{total.toFixed(2)}
                                                    </div>
                                                </div>

                                                <div className="d-flex gap-2">
                                                    <button
                                                        className="btn btn-sm btn-outline-danger"
                                                        onClick={() => onDeleteHeld(hb._id)}
                                                    >
                                                        <i className="bi bi-trash"></i>
                                                    </button>
                                                    <button
                                                        className="btn btn-sm btn-success flex-grow-1 fw-bold"
                                                        onClick={() => {
                                                            onResumeBill(hb);
                                                            onClose();
                                                        }}
                                                    >
                                                        <i className="bi bi-play-circle me-1"></i> Resume Bill
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    <div className="modal-footer bg-white p-3">
                        <button type="button" className="btn btn-secondary" onClick={onClose}>
                            Close
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

