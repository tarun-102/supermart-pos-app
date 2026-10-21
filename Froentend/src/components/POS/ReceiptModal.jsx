import React from 'react';
import { printThermalReceipt, shareBillOnWhatsApp } from '../../utils/printHelper';
import { toast } from 'react-toastify';

export default function ReceiptModal({ isOpen, onClose, bill, storeConfig }) {
    if (!isOpen || !bill) return null;

    const handlePrint = () => {
        printThermalReceipt(bill, storeConfig);
        toast.info('🖨️ Opening Thermal Receipt print preview...');
    };

    const handleWhatsApp = () => {
        shareBillOnWhatsApp(bill, storeConfig);
        toast.success('📱 Opening WhatsApp to share digital invoice...');
    };

    const dateFormatted = new Date(bill.createdAt || Date.now()).toLocaleString('en-IN', {
        dateStyle: 'medium',
        timeStyle: 'short'
    });

    return (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(15, 23, 42, 0.75)', zIndex: 1060 }} tabIndex="-1">
            <div className="modal-dialog modal-dialog-centered modal-md">
                <div className="modal-content border-0 shadow-lg" style={{ borderRadius: '16px', overflow: 'hidden' }}>
                    {/* Modal Header */}
                    <div className="modal-header bg-white border-bottom text-dark py-2 px-3 no-print">
                        <div className="d-flex align-items-center gap-2">
                            <i className="bi bi-receipt-cutoff text-primary fs-5"></i>
                            <h6 className="modal-title fw-bold mb-0">Tax Invoice / Thermal Receipt</h6>
                        </div>
                        <button type="button" className="btn-close" onClick={onClose}></button>
                    </div>

                    {/* Receipt Scroll Area */}
                    <div className="modal-body p-3 bg-light text-center" style={{ maxHeight: '78vh', overflowY: 'auto' }}>
                        {/* Printable Thermal Slip */}
                        <div className="thermal-receipt print-area shadow-sm">
                            {/* Store Header */}
                            <div className="thermal-receipt-header">
                                <div style={{ fontSize: '18px', fontWeight: '900', letterSpacing: '1px' }}>
                                    {storeConfig?.storeName?.toUpperCase() || 'SUPERSTORE POS'}
                                </div>
                                {storeConfig?.storeType && (
                                    <div style={{ fontSize: '10px', fontWeight: '700' }}>
                                        {storeConfig.storeType}
                                    </div>
                                )}
                                {storeConfig?.address && (
                                    <div style={{ fontSize: '9px', color: '#334155' }}>
                                        {storeConfig.address}
                                    </div>
                                )}
                                {storeConfig?.gstin && (
                                    <div style={{ fontSize: '9px', color: '#334155' }}>
                                        GSTIN: {storeConfig.gstin}
                                    </div>
                                )}
                                {storeConfig?.contact && (
                                    <div style={{ fontSize: '9px', color: '#334155' }}>
                                        Tel / Mobile: {storeConfig.contact}
                                    </div>
                                )}
                            </div>

                            <div className="thermal-receipt-divider"></div>

                            {/* Bill Meta */}
                            <div className="text-start" style={{ fontSize: '10px' }}>
                                <div className="d-flex justify-content-between">
                                    <span><strong>Invoice No:</strong> {bill.billNumber}</span>
                                    <span>{dateFormatted}</span>
                                </div>
                                <div className="d-flex justify-content-between">
                                    <span><strong>Counter:</strong> {bill.counterNo || 'Counter-01'}</span>
                                    <span><strong>Cashier:</strong> {bill.cashierName || 'Rahul Sharma'}</span>
                                </div>
                                {bill.customerPhone && (
                                    <div className="d-flex justify-content-between">
                                        <span><strong>Customer:</strong> {bill.customerName || 'Customer'}</span>
                                        <span><strong>Mob:</strong> {bill.customerPhone}</span>
                                    </div>
                                )}
                            </div>

                            <div className="thermal-receipt-divider"></div>

                            {/* Items Table */}
                            <table className="w-100 text-start" style={{ fontSize: '10px', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ borderBottom: '1px solid #000' }}>
                                        <th style={{ padding: '3px 0' }}>Item / Barcode</th>
                                        <th className="text-center">Qty</th>
                                        <th className="text-end">MRP</th>
                                        <th className="text-end">Rate</th>
                                        <th className="text-end">Amount</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {(bill.items || []).map((it, idx) => (
                                        <tr key={idx} style={{ borderBottom: '1px dotted #ccc' }}>
                                            <td style={{ padding: '4px 0', maxWidth: '140px' }}>
                                                <div className="text-truncate fw-bold">{it.name}</div>
                                                <div style={{ fontSize: '8px', color: '#666' }}>
                                                    {it.barcode} ({it.unit})
                                                </div>
                                            </td>
                                            <td className="text-center align-top" style={{ padding: '4px 0' }}>
                                                {it.quantity} {it.unit !== 'pc' ? it.unit : ''}
                                            </td>
                                            <td className="text-end align-top" style={{ padding: '4px 0' }}>
                                                ₹{it.mrp}
                                            </td>
                                            <td className="text-end align-top" style={{ padding: '4px 0' }}>
                                                ₹{it.sellingPrice}
                                            </td>
                                            <td className="text-end align-top fw-bold" style={{ padding: '4px 0' }}>
                                                ₹{it.total}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>

                            <div className="thermal-receipt-divider"></div>

                            {/* Summary Calculations */}
                            <div className="text-end" style={{ fontSize: '11px' }}>
                                <div className="d-flex justify-content-between">
                                    <span>Total Items / Qty:</span>
                                    <span>{bill.items?.length} items ({bill.items?.reduce((s, i) => s + (Number(i.quantity) || 1), 0).toFixed(1)})</span>
                                </div>
                                <div className="d-flex justify-content-between">
                                    <span>Gross MRP Value:</span>
                                    <span>₹{(bill.grossMrpTotal || (bill.netPayable + (bill.totalSavings || 0))).toFixed(2)}</span>
                                </div>
                                <div className="d-flex justify-content-between fw-bold text-success">
                                    <span>Special Store Discount:</span>
                                    <span>-₹{(bill.totalSavings || 0).toFixed(2)}</span>
                                </div>
                                <div className="d-flex justify-content-between small text-muted">
                                    <span>Taxable Net Turnover:</span>
                                    <span>₹{(bill.taxableAmount || (bill.netPayable - (bill.taxAmount || 0))).toFixed(2)}</span>
                                </div>
                                <div className="d-flex justify-content-between small text-muted">
                                    <span>Central GST (CGST):</span>
                                    <span>₹{((bill.taxAmount || 0) / 2).toFixed(2)}</span>
                                </div>
                                <div className="d-flex justify-content-between small text-muted">
                                    <span>State GST (SGST):</span>
                                    <span>₹{((bill.taxAmount || 0) / 2).toFixed(2)}</span>
                                </div>
                                <div className="d-flex justify-content-between small text-dark fw-bold">
                                    <span>Total GST Tax:</span>
                                    <span>₹{(bill.taxAmount || 0).toFixed(2)}</span>
                                </div>

                                <div className="thermal-receipt-divider"></div>

                                <div className="d-flex justify-content-between fw-bolder" style={{ fontSize: '14px' }}>
                                    <span>NET PAYABLE:</span>
                                    <span>₹{bill.netPayable?.toLocaleString('en-IN')}</span>
                                </div>
                            </div>

                            <div className="thermal-receipt-divider"></div>

                            {/* Payment Breakdown (Split Mode Highlight) */}
                            <div className="text-start" style={{ fontSize: '10px' }}>
                                <div className="fw-bold mb-1">PAYMENT DETAILS: [{bill.paymentMethod}]</div>
                                {bill.paymentMethod === 'SPLIT' && bill.splitBreakdown ? (
                                    <div className="p-1 bg-light rounded" style={{ fontSize: '9.5px' }}>
                                        {bill.splitBreakdown.cashAmount > 0 && (
                                            <div className="d-flex justify-content-between">
                                                <span>• CASH:</span>
                                                <span className="fw-bold">₹{bill.splitBreakdown.cashAmount}</span>
                                            </div>
                                        )}
                                        {bill.splitBreakdown.upiAmount > 0 && (
                                            <div className="d-flex justify-content-between">
                                                <span>• UPI / QR:</span>
                                                <span className="fw-bold">₹{bill.splitBreakdown.upiAmount}</span>
                                            </div>
                                        )}
                                        {bill.splitBreakdown.cardAmount > 0 && (
                                            <div className="d-flex justify-content-between">
                                                <span>• CARD / EDC:</span>
                                                <span className="fw-bold">₹{bill.splitBreakdown.cardAmount}</span>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="d-flex justify-content-between">
                                        <span>• Paid via {bill.paymentMethod}:</span>
                                        <span className="fw-bold">₹{bill.netPayable}</span>
                                    </div>
                                )}

                                {bill.cashTendered > 0 && bill.cashTendered !== bill.netPayable && (
                                    <div className="d-flex justify-content-between mt-1" style={{ fontSize: '9px', color: '#444' }}>
                                        <span>Cash Tendered: ₹{bill.cashTendered}</span>
                                        <span>Change Returned: ₹{bill.changeReturned || 0}</span>
                                    </div>
                                )}
                            </div>

                            <div className="thermal-receipt-divider"></div>

                            {/* Savings Banner */}
                            <div className="p-2 border border-dark rounded text-center my-2" style={{ backgroundColor: '#f0fdf4' }}>
                                <div style={{ fontSize: '11px', fontWeight: '800', color: '#166534' }}>
                                    YOU SAVED ₹{(bill.totalSavings || 0).toFixed(2)} ON THIS BILL!
                                </div>
                                <div style={{ fontSize: '8px', color: '#15803d' }}>
                                    SuperStore Promise: Guaranteed Everyday Lowest Prices
                                </div>
                            </div>

                            {/* Barcode Graphic */}
                            <div className="thermal-receipt-barcode">
                                {bill.billNumber}
                            </div>
                            <div style={{ fontSize: '8px', color: '#666', marginTop: '2px', fontWeight: 'bold' }}>
                                {storeConfig?.receiptTagline || 'Thank You For Shopping With Us! Visit Again.'}
                            </div>
                            <div style={{ fontSize: '8px', color: '#999' }}>
                                Goods once sold can be exchanged within 7 days with bill.
                            </div>
                        </div>
                    </div>

                    {/* Modal Footer (No Print) */}
                    <div className="modal-footer bg-white border-top p-3 d-flex flex-wrap justify-content-between gap-2 no-print">
                        <button type="button" className="btn btn-outline-secondary px-3" onClick={onClose}>
                            Close (Esc)
                        </button>
                        <div className="d-flex gap-2 flex-wrap">
                            <button
                                type="button"
                                className="btn btn-outline-success px-3 fw-bold d-flex align-items-center gap-2"
                                onClick={handleWhatsApp}
                                title="Send e-bill directly to customer's WhatsApp"
                            >
                                <i className="bi bi-whatsapp fs-6 text-success"></i>
                                <span>WhatsApp Bill</span>
                            </button>
                            <button
                                type="button"
                                className="btn btn-primary px-4 fw-bold d-flex align-items-center gap-2 shadow-sm"
                                onClick={handlePrint}
                            >
                                <i className="bi bi-printer fs-6"></i>
                                <span>Print Thermal Slip (Ctrl+P)</span>
                            </button>
                            <button
                                type="button"
                                className="btn btn-dark px-4 fw-bold"
                                onClick={onClose}
                            >
                                <i className="bi bi-cart-plus me-1"></i>
                                <span>Next Customer</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

