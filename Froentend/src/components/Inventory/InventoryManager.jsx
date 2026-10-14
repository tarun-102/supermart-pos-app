import React, { useState, useEffect } from 'react';
import { apiFetch } from '../../utils/api';
import CameraScannerBox from '../POS/CameraScannerBox';

export default function InventoryManager() {
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('ALL');
    const [lowStockOnly, setLowStockOnly] = useState(false);

    // Add / Edit Modal state
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [isCameraScanningForProduct, setIsCameraScanningForProduct] = useState(false);
    const [editingProduct, setEditingProduct] = useState(null);
    const [formData, setFormData] = useState({
        barcode: '',
        name: '',
        category: 'Staples & Flour',
        unit: 'kg',
        mrp: '',
        sellingPrice: '',
        purchasePrice: '',
        taxPercent: '5',
        stock: '50',
        minStockAlert: '10'
    });

    // Quick stock adjust modal
    const [adjustModalProduct, setAdjustModalProduct] = useState(null);
    const [stockChangeQty, setStockChangeQty] = useState('');

    // Barcode Sticker print modal
    const [stickerProduct, setStickerProduct] = useState(null);

    useEffect(() => {
        loadProducts();
    }, [categoryFilter, lowStockOnly]);

    const loadProducts = async () => {
        setLoading(true);
        try {
            const queryParams = new URLSearchParams();
            if (categoryFilter !== 'ALL') queryParams.append('category', categoryFilter);
            if (lowStockOnly) queryParams.append('lowStock', 'true');
            if (search) queryParams.append('search', search);

            const res = await apiFetch(`/inventory?${queryParams.toString()}`);
            if (res.products) {
                setProducts(res.products);
            }
        } catch (err) {
            console.error('Failed to load inventory:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleSearchSubmit = (e) => {
        e.preventDefault();
        loadProducts();
    };

    const handleOpenAdd = () => {
        setEditingProduct(null);
        setIsCameraScanningForProduct(false);
        setFormData({
            barcode: '890' + Math.floor(1000000000 + Math.random() * 9000000000),
            name: '',
            category: 'Staples & Flour',
            unit: 'kg',
            mrp: '',
            sellingPrice: '',
            purchasePrice: '',
            taxPercent: '5',
            stock: '50',
            minStockAlert: '10'
        });
        setIsFormOpen(true);
    };

    const handleOpenEdit = (p) => {
        setEditingProduct(p);
        setIsCameraScanningForProduct(false);
        setFormData({
            barcode: p.barcode,
            name: p.name,
            category: p.category || 'General',
            unit: p.unit || 'pc',
            mrp: p.mrp.toString(),
            sellingPrice: p.sellingPrice.toString(),
            purchasePrice: (p.purchasePrice || 0).toString(),
            taxPercent: (p.taxPercent || 0).toString(),
            stock: p.stock.toString(),
            minStockAlert: (p.minStockAlert || 10).toString()
        });
        setIsFormOpen(true);
    };

    const handleSaveProduct = async (e) => {
        e.preventDefault();
        try {
            if (editingProduct) {
                // UPDATE
                await apiFetch(`/inventory/${editingProduct._id}`, {
                    method: 'PUT',
                    body: JSON.stringify(formData)
                });
            } else {
                // CREATE
                await apiFetch('/inventory', {
                    method: 'POST',
                    body: JSON.stringify(formData)
                });
            }
            setIsFormOpen(false);
            loadProducts();
        } catch (err) {
            alert('Error saving product: ' + err.message);
        }
    };

    const handleDeleteProduct = async (id, name) => {
        if (!window.confirm(`Are you sure you want to delete "${name}" from inventory?`)) return;
        try {
            await apiFetch(`/inventory/${id}`, { method: 'DELETE' });
            loadProducts();
        } catch (err) {
            alert('Delete failed: ' + err.message);
        }
    };

    const handleStockAdjust = async (e) => {
        e.preventDefault();
        if (!adjustModalProduct || !stockChangeQty) return;
        try {
            await apiFetch('/inventory/adjust-stock', {
                method: 'POST',
                body: JSON.stringify({
                    productId: adjustModalProduct._id,
                    changeAmount: Number(stockChangeQty)
                })
            });
            setAdjustModalProduct(null);
            setStockChangeQty('');
            loadProducts();
        } catch (err) {
            alert('Failed to adjust stock: ' + err.message);
        }
    };

    const handleResetCatalog = async () => {
        if (window.confirm('Reset catalog to default D-Mart items? Custom items will be replaced.')) {
            try {
                await apiFetch('/inventory/reset-seeds', { method: 'POST' });
                loadProducts();
            } catch (err) {
                alert(err.message);
            }
        }
    };

    // Client-side search filtering
    const displayedProducts = products.filter(p => {
        if (!search) return true;
        const q = search.toLowerCase();
        return p.name.toLowerCase().includes(q) || p.barcode.includes(q);
    });

    const categories = ['ALL', 'Staples & Flour', 'Edible Oils', 'Spices & Seasoning', 'Dairy & Refrigerated', 'Rice & Grains', 'Household & Cleaning', 'Snacks & Namkeen', 'Packaged Foods', 'Personal Care', 'Biscuits & Bakery', 'Vegetables & Fruits', 'Pulses & Dals'];

    // Valuation stats
    const totalInventoryItems = products.length;
    const lowStockCount = products.filter(p => Number(p.stock) <= Number(p.minStockAlert || 10)).length;
    const totalValuation = products.reduce((s, p) => s + (Number(p.sellingPrice) * Number(p.stock)), 0);

    return (
        <div className="container-fluid py-4 px-3">
            {/* Header Toolbar */}
            <div className="d-flex flex-wrap justify-content-between align-items-center mb-4 gap-2">
                <div>
                    <div className="d-flex align-items-center gap-2">
                        <span className="fs-3">📦</span>
                        <h4 className="fw-bolder mb-0 text-dark">Supermarket Inventory &amp; Stock Master</h4>
                    </div>
                    <p className="text-muted small mb-0">
                        Manage items, barcodes, units (kg/gm/pc), MRP, selling rates, and stock alerts.
                    </p>
                </div>

                <div className="d-flex gap-2 w-100 w-sm-auto justify-content-between justify-content-sm-end flex-wrap">
                    <button
                        className="btn btn-outline-secondary btn-sm fw-semibold flex-grow-1 flex-sm-grow-0"
                        onClick={handleResetCatalog}
                        title="Restore initial supermarket demo products"
                    >
                        <i className="bi bi-arrow-counterclockwise me-1"></i> Reset Catalog
                    </button>
                    <button
                        className="btn btn-success fw-bold d-flex align-items-center gap-2 shadow-sm flex-grow-1 flex-sm-grow-0 justify-content-center"
                        onClick={handleOpenAdd}
                    >
                        <i className="bi bi-plus-lg fs-5"></i>
                        <span>+ Add New Product</span>
                    </button>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="row g-3 mb-4">
                <div className="col-md-4">
                    <div className="card border-0 shadow-sm p-3 rounded-3 bg-white border-start border-success border-4">
                        <div className="d-flex justify-content-between align-items-center">
                            <div>
                                <small className="text-muted fw-bold text-uppercase">Total Catalog SKUs</small>
                                <div className="fs-3 fw-bold font-mono text-dark">{totalInventoryItems} Products</div>
                            </div>
                            <div className="bg-success-subtle p-3 rounded-circle text-success fs-4">
                                <i className="bi bi-boxes"></i>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="col-md-4">
                    <div className="card border-0 shadow-sm p-3 rounded-3 bg-white border-start border-warning border-4">
                        <div className="d-flex justify-content-between align-items-center">
                            <div>
                                <small className="text-muted fw-bold text-uppercase">Low Stock Warnings</small>
                                <div className={`fs-3 fw-bold font-mono ${lowStockCount > 0 ? 'text-warning' : 'text-success'}`}>
                                    {lowStockCount} Products
                                </div>
                            </div>
                            <div className="bg-warning-subtle p-3 rounded-circle text-warning fs-4">
                                <i className="bi bi-exclamation-triangle"></i>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="col-md-4">
                    <div className="card border-0 shadow-sm p-3 rounded-3 bg-white border-start border-primary border-4">
                        <div className="d-flex justify-content-between align-items-center">
                            <div>
                                <small className="text-muted fw-bold text-uppercase">Total Stock Retail Value</small>
                                <div className="fs-3 fw-bold font-mono text-primary">₹{Math.round(totalValuation).toLocaleString('en-IN')}</div>
                            </div>
                            <div className="bg-primary-subtle p-3 rounded-circle text-primary fs-4">
                                <i className="bi bi-currency-rupee"></i>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Filter Bar */}
            <div className="card border-0 shadow-sm p-3 mb-3 rounded-3 bg-white">
                <div className="row g-2 align-items-center">
                    <div className="col-md-5">
                        <form onSubmit={handleSearchSubmit}>
                            <div className="input-group">
                                <span className="input-group-text bg-light"><i className="bi bi-search"></i></span>
                                <input
                                    type="text"
                                    className="form-control"
                                    placeholder="Search by product name or scan barcode..."
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                />
                                <button type="submit" className="btn btn-outline-success">Search</button>
                            </div>
                        </form>
                    </div>

                    <div className="col-md-4">
                        <select
                            className="form-select fw-semibold"
                            value={categoryFilter}
                            onChange={(e) => setCategoryFilter(e.target.value)}
                        >
                            {categories.map(c => (
                                <option key={c} value={c}>{c === 'ALL' ? 'All Categories' : c}</option>
                            ))}
                        </select>
                    </div>

                    <div className="col-md-3 text-md-end">
                        <div className="form-check form-switch d-inline-block">
                            <input
                                className="form-check-input"
                                type="checkbox"
                                id="lowStockToggle"
                                checked={lowStockOnly}
                                onChange={(e) => setLowStockOnly(e.target.checked)}
                            />
                            <label className="form-check-label small fw-bold text-muted" htmlFor="lowStockToggle">
                                Low Stock Only
                            </label>
                        </div>
                    </div>
                </div>
            </div>

            {/* Products Table */}
            <div className="card border-0 shadow-sm rounded-3 overflow-hidden bg-white">
                <div className="table-responsive">
                    <table className="table table-hover align-middle mb-0">
                        <thead className="table-light">
                            <tr>
                                <th style={{ minWidth: '135px' }}>Barcode / SKU</th>
                                <th style={{ minWidth: '180px' }}>Product Name</th>
                                <th>Category</th>
                                <th>Unit</th>
                                <th className="text-end">Cost Price</th>
                                <th className="text-end">MRP</th>
                                <th className="text-end">DMart Rate</th>
                                <th className="text-center">Savings / Discount</th>
                                <th className="text-center">Stock</th>
                                <th className="text-center" style={{ minWidth: '130px' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan="10" className="text-center py-5">
                                        <div className="spinner-border text-success"></div>
                                        <div className="mt-2 text-muted">Loading inventory items...</div>
                                    </td>
                                </tr>
                            ) : displayedProducts.length === 0 ? (
                                <tr>
                                    <td colSpan="10" className="text-center py-5 text-muted">
                                        <i className="bi bi-box-seam display-4 opacity-50"></i>
                                        <div className="mt-2 fw-semibold">No products found.</div>
                                    </td>
                                </tr>
                            ) : (
                                displayedProducts.map((p) => {
                                    const isLow = Number(p.stock) <= Number(p.minStockAlert || 10);
                                    const savingsAmount = Math.max(0, p.mrp - p.sellingPrice);
                                    const savingsPct = p.mrp > 0 ? Math.round((savingsAmount / p.mrp) * 100) : 0;

                                    return (
                                        <tr key={p._id}>
                                            {/* Barcode */}
                                            <td>
                                                <div className="d-flex align-items-center gap-1 font-mono fw-bold text-dark">
                                                    <span>{p.barcode}</span>
                                                    <button
                                                        type="button"
                                                        className="btn btn-sm btn-link p-0 text-muted"
                                                        onClick={() => setStickerProduct(p)}
                                                        title="Print Barcode Sticker"
                                                    >
                                                        <i className="bi bi-upc"></i>
                                                    </button>
                                                </div>
                                            </td>

                                            {/* Name */}
                                            <td>
                                                <div className="fw-bold text-dark">{p.name}</div>
                                            </td>

                                            {/* Category */}
                                            <td>
                                                <span className="badge bg-light text-dark border">
                                                    {p.category || 'General'}
                                                </span>
                                            </td>

                                            {/* Unit */}
                                            <td>
                                                <span className="badge bg-secondary-subtle text-secondary-emphasis fw-bold">
                                                    {p.unit}
                                                </span>
                                            </td>

                                            {/* Cost Price */}
                                            <td className="text-end font-mono text-muted">
                                                ₹{p.purchasePrice || 0}
                                            </td>

                                            {/* MRP */}
                                            <td className="text-end font-mono">
                                                <span className="text-muted text-decoration-line-through">₹{p.mrp}</span>
                                            </td>

                                            {/* Selling Price */}
                                            <td className="text-end font-mono fw-bolder fs-6 text-success">
                                                ₹{p.sellingPrice}
                                            </td>

                                            {/* Savings */}
                                            <td className="text-center">
                                                {savingsAmount > 0 ? (
                                                    <span className="badge bg-success-subtle text-success border border-success-subtle">
                                                        Save ₹{savingsAmount} ({savingsPct}%)
                                                    </span>
                                                ) : (
                                                    <span className="text-muted small">-</span>
                                                )}
                                            </td>

                                            {/* Stock */}
                                            <td className="text-center">
                                                <span className={`badge px-2 py-1 fw-bold ${isLow ? 'bg-danger-subtle text-danger border border-danger-subtle' : 'bg-success-subtle text-success border border-success-subtle'}`}>
                                                    {p.stock} {p.unit}
                                                    {isLow && ' (Low)'}
                                                </span>
                                            </td>

                                            {/* Actions */}
                                            <td className="text-center" style={{ minWidth: '130px' }}>
                                                <div className="d-flex justify-content-center gap-1">
                                                    <button
                                                        className="btn btn-sm btn-outline-success"
                                                        onClick={() => {
                                                            setAdjustModalProduct(p);
                                                            setStockChangeQty('');
                                                        }}
                                                        title="Quick Stock In / Out"
                                                    >
                                                        <i className="bi bi-plus-slash-minus"></i>
                                                    </button>
                                                    <button
                                                        className="btn btn-sm btn-outline-primary"
                                                        onClick={() => handleOpenEdit(p)}
                                                        title="Edit Details"
                                                    >
                                                        <i className="bi bi-pencil"></i>
                                                    </button>
                                                    <button
                                                        className="btn btn-sm btn-outline-danger"
                                                        onClick={() => handleDeleteProduct(p._id, p.name)}
                                                        title="Delete"
                                                    >
                                                        <i className="bi bi-trash"></i>
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

            {/* ADD / EDIT PRODUCT MODAL */}
            {isFormOpen && (
                <div className="modal show d-block" style={{ backgroundColor: 'rgba(15, 23, 42, 0.7)', zIndex: 1055 }}>
                    <div className="modal-dialog modal-dialog-centered modal-lg">
                        <div className="modal-content border-0 shadow-lg" style={{ borderRadius: '16px' }}>
                            <div className="modal-header bg-success text-white py-3">
                                <h6 className="modal-title fw-bold mb-0">
                                    {editingProduct ? 'Edit Product Details' : 'Add New Inventory SKU'}
                                </h6>
                                <button type="button" className="btn-close btn-close-white" onClick={() => setIsFormOpen(false)}></button>
                            </div>

                            <form onSubmit={handleSaveProduct}>
                                <div className="modal-body p-4 bg-light">
                                    <div className="row g-3">
                                        {/* Name */}
                                        <div className="col-md-8">
                                            <label className="form-label fw-bold small text-muted text-uppercase">
                                                Product / Item Name <span className="text-danger">*</span>
                                            </label>
                                            <input
                                                type="text"
                                                className="form-control"
                                                placeholder="e.g. Aashirvaad Shudh Chakki Atta 5kg"
                                                value={formData.name}
                                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                                required
                                            />
                                        </div>

                                        {/* Barcode with Camera Scan button */}
                                        <div className="col-md-4">
                                            <div className="d-flex justify-content-between align-items-center mb-1">
                                                <label className="form-label fw-bold small text-muted text-uppercase mb-0">
                                                    Barcode / EAN <span className="text-danger">*</span>
                                                </label>
                                                <button
                                                    type="button"
                                                    className={`btn btn-xs fw-bold py-0 px-2 rounded small ${isCameraScanningForProduct ? 'btn-danger text-white' : 'btn-primary'}`}
                                                    style={{ fontSize: '0.72rem' }}
                                                    onClick={() => setIsCameraScanningForProduct(!isCameraScanningForProduct)}
                                                >
                                                    <i className="bi bi-camera-fill me-1"></i>
                                                    {isCameraScanningForProduct ? '✕ Close Cam' : '📷 Camera Scan'}
                                                </button>
                                            </div>
                                            <div className="input-group">
                                                <input
                                                    type="text"
                                                    className="form-control font-mono fw-bold"
                                                    placeholder="Scan or type barcode"
                                                    value={formData.barcode}
                                                    onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                                                    required
                                                />
                                                <button
                                                    type="button"
                                                    className="btn btn-outline-secondary"
                                                    title="Auto-Generate Random Barcode"
                                                    onClick={() => setFormData({
                                                        ...formData,
                                                        barcode: '890' + Math.floor(1000000000 + Math.random() * 9000000000)
                                                    })}
                                                >
                                                    <i className="bi bi-magic"></i>
                                                </button>
                                            </div>
                                        </div>

                                        {/* Inline Camera Scanner for Admin Barcode Add */}
                                        {isCameraScanningForProduct && (
                                            <div className="col-12">
                                                <CameraScannerBox
                                                    containerId="admin-camera-scanner-viewfinder"
                                                    title="📷 Scan product barcode with camera (Auto-fills barcode field)"
                                                    onDetected={(scannedCode) => {
                                                        setFormData(prev => ({ ...prev, barcode: scannedCode }));
                                                        setIsCameraScanningForProduct(false);
                                                    }}
                                                    onClose={() => setIsCameraScanningForProduct(false)}
                                                    autoCloseOnScan={true}
                                                />
                                            </div>
                                        )}

                                        {/* Category */}
                                        <div className="col-md-6">
                                            <label className="form-label fw-bold small text-muted text-uppercase">
                                                Category
                                            </label>
                                            <select
                                                className="form-select"
                                                value={formData.category}
                                                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                                            >
                                                {categories.filter(c => c !== 'ALL').map(c => (
                                                    <option key={c} value={c}>{c}</option>
                                                ))}
                                            </select>
                                        </div>

                                        {/* Unit */}
                                        <div className="col-md-6">
                                            <label className="form-label fw-bold small text-muted text-uppercase">
                                                Unit of Measure
                                            </label>
                                            <select
                                                className="form-select"
                                                value={formData.unit}
                                                onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                                            >
                                                <option value="kg">kg (Kilogram)</option>
                                                <option value="gm">gm (Gram)</option>
                                                <option value="liter">liter (Litre)</option>
                                                <option value="ml">ml (Millilitre)</option>
                                                <option value="pc">pc (Piece)</option>
                                                <option value="pack">pack (Packet)</option>
                                                <option value="box">box (Box)</option>
                                            </select>
                                        </div>

                                        {/* MRP */}
                                        <div className="col-md-4">
                                            <label className="form-label fw-bold small text-muted text-uppercase">
                                                MRP (₹) <span className="text-danger">*</span>
                                            </label>
                                            <input
                                                type="number"
                                                step="0.01"
                                                className="form-control font-mono"
                                                placeholder="MRP"
                                                value={formData.mrp}
                                                onChange={(e) => setFormData({ ...formData, mrp: e.target.value })}
                                                required
                                            />
                                        </div>

                                        {/* Selling Price */}
                                        <div className="col-md-4">
                                            <label className="form-label fw-bold small text-muted text-uppercase">
                                                Selling Price (₹) <span className="text-danger">*</span>
                                            </label>
                                            <input
                                                type="number"
                                                step="0.01"
                                                className="form-control font-mono fw-bold text-success"
                                                placeholder="Our Price"
                                                value={formData.sellingPrice}
                                                onChange={(e) => setFormData({ ...formData, sellingPrice: e.target.value })}
                                                required
                                            />
                                        </div>

                                        {/* Purchase Cost */}
                                        <div className="col-md-4">
                                            <label className="form-label fw-bold small text-muted text-uppercase">
                                                Cost Price (₹)
                                            </label>
                                            <input
                                                type="number"
                                                step="0.01"
                                                className="form-control font-mono text-muted"
                                                placeholder="Cost"
                                                value={formData.purchasePrice}
                                                onChange={(e) => setFormData({ ...formData, purchasePrice: e.target.value })}
                                            />
                                        </div>

                                        {/* Current Stock */}
                                        <div className="col-md-4">
                                            <label className="form-label fw-bold small text-muted text-uppercase">
                                                Current Stock ({formData.unit})
                                            </label>
                                            <input
                                                type="number"
                                                step="0.01"
                                                className="form-control font-mono"
                                                value={formData.stock}
                                                onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
                                            />
                                        </div>

                                        {/* Min Alert Level */}
                                        <div className="col-md-4">
                                            <label className="form-label fw-bold small text-muted text-uppercase">
                                                Low Stock Alert Level
                                            </label>
                                            <input
                                                type="number"
                                                className="form-control font-mono"
                                                value={formData.minStockAlert}
                                                onChange={(e) => setFormData({ ...formData, minStockAlert: e.target.value })}
                                            />
                                        </div>

                                        {/* Tax % */}
                                        <div className="col-md-4">
                                            <label className="form-label fw-bold small text-muted text-uppercase">
                                                GST Tax %
                                            </label>
                                            <select
                                                className="form-select"
                                                value={formData.taxPercent}
                                                onChange={(e) => setFormData({ ...formData, taxPercent: e.target.value })}
                                            >
                                                <option value="0">0% (Nil / Essential)</option>
                                                <option value="5">5% (Grocery / Staples)</option>
                                                <option value="12">12% (Packaged Foods / Dairy)</option>
                                                <option value="18">18% (Household / Toiletries)</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>

                                <div className="modal-footer bg-white border-top p-3 d-flex justify-content-between">
                                    <button type="button" className="btn btn-secondary" onClick={() => setIsFormOpen(false)}>
                                        Cancel
                                    </button>
                                    <button type="submit" className="btn btn-success fw-bold px-4">
                                        Save Product
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {/* QUICK ADJUST STOCK MODAL */}
            {adjustModalProduct && (
                <div className="modal show d-block" style={{ backgroundColor: 'rgba(15, 23, 42, 0.7)', zIndex: 1055 }}>
                    <div className="modal-dialog modal-dialog-centered modal-sm">
                        <div className="modal-content border-0 shadow-lg" style={{ borderRadius: '16px' }}>
                            <div className="modal-header bg-dark text-white py-3">
                                <h6 className="modal-title fw-bold mb-0">Adjust Stock</h6>
                                <button type="button" className="btn-close btn-close-white" onClick={() => setAdjustModalProduct(null)}></button>
                            </div>
                            <form onSubmit={handleStockAdjust}>
                                <div className="modal-body p-3">
                                    <div className="fw-bold mb-1">{adjustModalProduct.name}</div>
                                    <div className="small text-muted mb-3">Current Stock: {adjustModalProduct.stock} {adjustModalProduct.unit}</div>

                                    <label className="form-label small text-muted fw-bold">Add or Remove Quantity (+ / -):</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        className="form-control font-mono fw-bold"
                                        placeholder="e.g. +25 or -5"
                                        value={stockChangeQty}
                                        onChange={(e) => setStockChangeQty(e.target.value)}
                                        required
                                        autoFocus
                                    />
                                </div>
                                <div className="modal-footer p-2">
                                    <button type="button" className="btn btn-sm btn-secondary" onClick={() => setAdjustModalProduct(null)}>
                                        Cancel
                                    </button>
                                    <button type="submit" className="btn btn-sm btn-success fw-bold">
                                        Update Stock
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {/* BARCODE STICKER PREVIEW MODAL */}
            {stickerProduct && (
                <div className="modal show d-block" style={{ backgroundColor: 'rgba(15, 23, 42, 0.7)', zIndex: 1055 }}>
                    <div className="modal-dialog modal-dialog-centered modal-sm">
                        <div className="modal-content border-0 shadow-lg text-center" style={{ borderRadius: '16px' }}>
                            <div className="modal-header bg-light py-2">
                                <h6 className="modal-title small fw-bold mb-0">Printable Shelf Barcode Sticker</h6>
                                <button type="button" className="btn-close" onClick={() => setStickerProduct(null)}></button>
                            </div>
                            <div className="modal-body p-3">
                                <div className="p-3 border rounded bg-white shadow-sm">
                                    <div className="fw-bolder fs-6 text-dark text-truncate">{stickerProduct.name}</div>
                                    <div className="small text-muted">DMart Superstore | Unit: {stickerProduct.unit}</div>
                                    <div style={{ fontFamily: 'Libre Barcode 128', fontSize: '50px', lineHeight: '1', margin: '10px 0' }}>
                                        {stickerProduct.barcode}
                                    </div>
                                    <div className="font-mono fw-bold small">{stickerProduct.barcode}</div>
                                    <div className="d-flex justify-content-center gap-3 mt-2">
                                        <span className="text-muted text-decoration-line-through">MRP: ₹{stickerProduct.mrp}</span>
                                        <span className="fw-bolder text-success fs-5">₹{stickerProduct.sellingPrice}</span>
                                    </div>
                                </div>
                            </div>
                            <div className="modal-footer p-2 justify-content-center">
                                <button type="button" className="btn btn-sm btn-primary fw-bold" onClick={() => window.print()}>
                                    <i className="bi bi-printer me-1"></i> Print Sticker
                                </button>
                                <button type="button" className="btn btn-sm btn-secondary" onClick={() => setStickerProduct(null)}>
                                    Close
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

