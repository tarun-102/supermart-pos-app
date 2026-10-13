import React, { useState } from 'react';

export default function QuickAddModal({ isOpen, onClose, onAddItem }) {
    const [name, setName] = useState('');
    const [barcode, setBarcode] = useState('');
    const [unit, setUnit] = useState('kg');
    const [quantity, setQuantity] = useState('1');
    const [mrp, setMrp] = useState('');
    const [sellingPrice, setSellingPrice] = useState('');
    const [category, setCategory] = useState('Fresh Produce');
    const [saveToInventory, setSaveToInventory] = useState(true);

    if (!isOpen) return null;

    const generateRandomBarcode = () => {
        const rand = '890' + Math.floor(1000000000 + Math.random() * 9000000000);
        setBarcode(rand);
    };

    const handleFormSubmit = (e) => {
        e.preventDefault();
        if (!name || !sellingPrice) {
            alert('Please enter Item Name and Selling Price');
            return;
        }

        const numQty = Number(quantity) || 1;
        const numMrp = Number(mrp) || Number(sellingPrice);
        const numSp = Number(sellingPrice);
        const finalBarcode = barcode.trim() || `CUST-${Date.now().toString().slice(-6)}`;

        const newItem = {
            productId: `custom_${Date.now()}`,
            barcode: finalBarcode,
            name: name.trim(),
            category,
            unit,
            quantity: numQty,
            mrp: numMrp,
            sellingPrice: numSp,
            taxPercent: unit === 'kg' ? 0 : 5,
            saveToInventory
        };

        onAddItem(newItem);
        // Reset form
        setName('');
        setBarcode('');
        setMrp('');
        setSellingPrice('');
        setQuantity('1');
        onClose();
    };

    return (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(15, 23, 42, 0.7)', zIndex: 1055 }} tabIndex="-1">
            <div className="modal-dialog modal-dialog-centered">
                <div className="modal-content border-0 shadow-lg" style={{ borderRadius: '14px', overflow: 'hidden' }}>
                    <div className="modal-header bg-success text-white py-3">
                        <div className="d-flex align-items-center gap-2">
                            <i className="bi bi-bag-plus-fill fs-5"></i>
                            <div>
                                <h6 className="modal-title fw-bold mb-0">Quick Add / Loose Item to Bill</h6>
                                <small className="text-white-50" style={{ fontSize: '0.75rem' }}>
                                    Add weighed veggies (kg), loose grains or unlisted items directly
                                </small>
                            </div>
                        </div>
                        <button type="button" className="btn-close btn-close-white" onClick={onClose}></button>
                    </div>

                    <form onSubmit={handleFormSubmit}>
                        <div className="modal-body p-4 bg-light">
                            {/* Product Name */}
                            <div className="mb-3">
                                <label className="form-label fw-bold small text-muted text-uppercase">
                                    Item Name <span className="text-danger">*</span>
                                </label>
                                <input
                                    type="text"
                                    className="form-control form-control-lg fw-semibold"
                                    placeholder="e.g. Fresh Tomatoes / Loose Kaju / Basmati Rice"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    required
                                    autoFocus
                                />
                            </div>

                            {/* Barcode / SKU */}
                            <div className="mb-3">
                                <div className="d-flex justify-content-between align-items-center mb-1">
                                    <label className="form-label fw-bold small text-muted text-uppercase mb-0">
                                        Barcode / Item Code
                                    </label>
                                    <button
                                        type="button"
                                        className="btn btn-sm btn-link text-decoration-none p-0 text-success fw-bold"
                                        onClick={generateRandomBarcode}
                                    >
                                        <i className="bi bi-magic me-1"></i> Auto-Generate
                                    </button>
                                </div>
                                <input
                                    type="text"
                                    className="form-control font-mono"
                                    placeholder="Scan or type barcode (Optional)"
                                    value={barcode}
                                    onChange={(e) => setBarcode(e.target.value)}
                                />
                            </div>

                            {/* Unit & Quantity */}
                            <div className="row g-2 mb-3">
                                <div className="col-6">
                                    <label className="form-label fw-bold small text-muted text-uppercase">
                                        Unit Type
                                    </label>
                                    <select
                                        className="form-select fw-semibold"
                                        value={unit}
                                        onChange={(e) => setUnit(e.target.value)}
                                    >
                                        <option value="kg">kg (Kilogram)</option>
                                        <option value="gm">gm (Gram)</option>
                                        <option value="pc">pc (Piece)</option>
                                        <option value="liter">liter (Litre)</option>
                                        <option value="ml">ml (Millilitre)</option>
                                        <option value="pack">pack (Packet)</option>
                                        <option value="box">box (Box)</option>
                                    </select>
                                </div>

                                <div className="col-6">
                                    <label className="form-label fw-bold small text-muted text-uppercase">
                                        Quantity / Weight ({unit})
                                    </label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        min="0.01"
                                        className="form-control fw-bold font-mono text-center"
                                        placeholder="1"
                                        value={quantity}
                                        onChange={(e) => setQuantity(e.target.value)}
                                        required
                                    />
                                </div>
                            </div>

                            {/* MRP & Selling Price */}
                            <div className="row g-2 mb-3">
                                <div className="col-6">
                                    <label className="form-label fw-bold small text-muted text-uppercase">
                                        MRP (₹)
                                    </label>
                                    <div className="input-group">
                                        <span className="input-group-text">₹</span>
                                        <input
                                            type="number"
                                            step="0.01"
                                            className="form-control font-mono"
                                            placeholder="MRP"
                                            value={mrp}
                                            onChange={(e) => setMrp(e.target.value)}
                                        />
                                    </div>
                                </div>

                                <div className="col-6">
                                    <label className="form-label fw-bold small text-muted text-uppercase">
                                        Selling Price (₹) <span className="text-danger">*</span>
                                    </label>
                                    <div className="input-group">
                                        <span className="input-group-text bg-success-subtle text-success fw-bold">₹</span>
                                        <input
                                            type="number"
                                            step="0.01"
                                            className="form-control font-mono fw-bold text-success"
                                            placeholder="Rate"
                                            value={sellingPrice}
                                            onChange={(e) => setSellingPrice(e.target.value)}
                                            required
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Item Calculation Preview */}
                            {sellingPrice && quantity && (
                                <div className="p-3 bg-white rounded border mb-3">
                                    <div className="d-flex justify-content-between align-items-center">
                                        <span className="text-muted small">Total for this item:</span>
                                        <span className="fs-5 fw-bold text-success font-mono">
                                            ₹{(Number(sellingPrice) * Number(quantity)).toFixed(2)}
                                        </span>
                                    </div>
                                    {mrp && Number(mrp) > Number(sellingPrice) && (
                                        <div className="d-flex justify-content-between align-items-center small text-success mt-1">
                                            <span>Customer Savings:</span>
                                            <span className="fw-bold">
                                                ₹{((Number(mrp) - Number(sellingPrice)) * Number(quantity)).toFixed(2)}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Checkbox: Also save to inventory */}
                            <div className="form-check form-switch">
                                <input
                                    className="form-check-input"
                                    type="checkbox"
                                    id="saveInvCheck"
                                    checked={saveToInventory}
                                    onChange={(e) => setSaveToInventory(e.target.checked)}
                                />
                                <label className="form-check-label small fw-semibold text-dark" htmlFor="saveInvCheck">
                                    Also save this item into permanent inventory catalog
                                </label>
                            </div>
                        </div>

                        <div className="modal-footer bg-white border-top p-3 d-flex justify-content-between">
                            <button type="button" className="btn btn-outline-secondary" onClick={onClose}>
                                Cancel
                            </button>
                            <button type="submit" className="btn btn-success px-4 fw-bold shadow-sm">
                                <i className="bi bi-cart-plus me-1"></i> Add to Current Bill
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}

