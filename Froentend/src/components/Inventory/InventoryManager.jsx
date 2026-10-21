import React, { useState, useEffect } from 'react';
import { apiFetch } from '../../utils/api';
import CameraScannerBox from '../POS/CameraScannerBox';
import { UNIVERSAL_SHOP_SECTORS, ALL_FLAT_CATEGORIES, GST_SLABS } from '../../utils/categories';
import { printHtmlViaIframe } from '../../utils/printHelper';

export default function InventoryManager() {
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [inventoryTab, setInventoryTab] = useState('ALL'); // 'ALL' or 'SHORT_BOOK'
    const [selectedSector, setSelectedSector] = useState('ALL');
    const [categoryFilter, setCategoryFilter] = useState('ALL');
    const [sortBy, setSortBy] = useState('shortFirst'); // 'shortFirst', 'nameAsc', 'nameDesc', 'stockAsc', 'stockDesc', 'priceDesc', 'priceAsc'
    const [storeConfig, setStoreConfig] = useState(null);
    const [toastMessage, setToastMessage] = useState(null);

    // Add / Edit Modal state
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [isCameraScanningForProduct, setIsCameraScanningForProduct] = useState(false);
    const [editingProduct, setEditingProduct] = useState(null);
    const [customCategoryInput, setCustomCategoryInput] = useState('');
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

    const loadProducts = async () => {
        setLoading(true);
        try {
            const res = await apiFetch('/inventory');
            if (res.products) {
                setProducts(res.products);
            }
        } catch (err) {
            console.error('Failed to load inventory:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleOpenAdd = () => {
        setEditingProduct(null);
        setIsCameraScanningForProduct(false);
        setCustomCategoryInput('');
        setFormData({
            barcode: '',
            name: '',
            category: 'Staples & Flour',
            unit: 'pc',
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
        setCustomCategoryInput('');
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
            const payload = {
                ...formData,
                category: customCategoryInput.trim() ? customCategoryInput.trim() : formData.category
            };

            if (editingProduct) {
                // UPDATE
                await apiFetch(`/inventory/${editingProduct._id}`, {
                    method: 'PUT',
                    body: JSON.stringify(payload)
                });
            } else {
                // CREATE
                await apiFetch('/inventory', {
                    method: 'POST',
                    body: JSON.stringify(payload)
                });
            }
            setIsFormOpen(false);
            loadProducts();
            showToast('✅ Product saved to inventory successfully!');
        } catch (err) {
            alert('Error saving product: ' + err.message);
        }
    };

    const handleDeleteProduct = async (id, name) => {
        if (!window.confirm(`Are you sure you want to delete "${name}" from inventory?`)) return;
        try {
            await apiFetch(`/inventory/${id}`, { method: 'DELETE' });
            loadProducts();
            showToast('🗑️ Product deleted from inventory.');
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
            const oldName = adjustModalProduct.name;
            const addedQty = stockChangeQty;
            setAdjustModalProduct(null);
            setStockChangeQty('');
            loadProducts();
            showToast(`⚡ Stock updated: ${oldName} (${addedQty > 0 ? `+${addedQty}` : addedQty})`);
        } catch (err) {
            alert('Failed to adjust stock: ' + err.message);
        }
    };

    const handleResetCatalog = async () => {
        if (window.confirm('Reset catalog to default supermarket catalog? Custom items will be replaced.')) {
            try {
                await apiFetch('/inventory/reset-seeds', { method: 'POST' });
                loadProducts();
                showToast('🔄 Catalog restored to default retail products.');
            } catch (err) {
                alert(err.message);
            }
        }
    };

    const showToast = (msg) => {
        setToastMessage(msg);
        setTimeout(() => setToastMessage(null), 3500);
    };

    // Thermal Barcode Sticker Print (Never blank)
    const handlePrintSticker = (prod) => {
        const storeName = storeConfig?.storeName || 'SuperStore POS';
        const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <title>Barcode - ${prod.barcode}</title>
                <style>
                    @page { size: 50mm 35mm; margin: 1mm; }
                    * { box-sizing: border-box; margin: 0; padding: 0; font-family: Arial, sans-serif; text-align: center; color: #000; }
                    body { width: 48mm; margin: 0 auto; padding: 3mm 1mm; }
                    .store { font-size: 8px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px; }
                    .name { font-size: 10.5px; font-weight: 800; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin: 1px 0; }
                    .barcode-bars { font-family: 'Courier New', monospace; font-size: 14px; letter-spacing: 3px; font-weight: bold; margin: 2px 0; }
                    .code-text { font-family: monospace; font-size: 10px; font-weight: bold; }
                    .price-box { margin-top: 3px; font-size: 12px; font-weight: 900; }
                    .mrp { font-size: 9px; color: #555; text-decoration: line-through; margin-right: 4px; font-weight: normal; }
                </style>
            </head>
            <body>
                <div class="store">${storeName}</div>
                <div class="name">${prod.name}</div>
                <div style="font-size: 8px; color: #444;">${prod.category || 'General'} | Unit: ${prod.unit}</div>
                <div class="barcode-bars">||||| | ||||| ||</div>
                <div class="code-text">${prod.barcode}</div>
                <div class="price-box">
                    <span class="mrp">MRP ₹${prod.mrp}</span>
                    <span>₹${prod.sellingPrice}</span>
                </div>
            </body>
            </html>
        `;
        printHtmlViaIframe(html, `Sticker_${prod.barcode}`);
    };

    // WhatsApp Supplier Order Generation
    const shortItemsList = products.filter(p => Number(p.stock) <= Number(p.minStockAlert || 10));

    const handleCopySupplierOrder = () => {
        if (shortItemsList.length === 0) {
            alert('No short items to order!');
            return;
        }
        const storeName = storeConfig?.storeName || 'SuperStore';
        const lines = shortItemsList.map((p, idx) => {
            const curr = Number(p.stock);
            const min = Number(p.minStockAlert || 10);
            const deficit = Math.max(min * 2 - curr, 10);
            return `${idx + 1}. ${p.name} (${p.unit}) - Current: ${curr}, Order: ${deficit} ${p.unit} [Barcode: ${p.barcode}]`;
        });

        const text = `📦 *${storeName.toUpperCase()} - SHORTAGE PURCHASE ORDER*\n` +
            `Date: ${new Date().toLocaleDateString('en-IN')} ${new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}\n` +
            `Total Short Items: ${shortItemsList.length}\n` +
            `------------------------------------\n` +
            `${lines.join('\n')}\n` +
            `------------------------------------\n` +
            `Please dispatch urgent stock. Thank you!`;

        navigator.clipboard.writeText(text);
        showToast('📋 Short list copied to clipboard! Paste directly in WhatsApp.');
    };

    const handleWhatsAppSupplierOrder = () => {
        if (shortItemsList.length === 0) {
            alert('No short items to order!');
            return;
        }
        const storeName = storeConfig?.storeName || 'SuperStore';
        const lines = shortItemsList.map((p, idx) => {
            const curr = Number(p.stock);
            const min = Number(p.minStockAlert || 10);
            const deficit = Math.max(min * 2 - curr, 10);
            return `${idx + 1}. ${p.name} (${p.unit}) - Curr: ${curr}, Need: ${deficit} ${p.unit}`;
        });

        const text = `📦 *${storeName.toUpperCase()} - SHORTAGE REORDER LIST*%0A` +
            `Date: ${new Date().toLocaleDateString('en-IN')}%0A` +
            `Total Short Items: ${shortItemsList.length}%0A` +
            `------------------------------------%0A` +
            `${lines.join('%0A')}%0A` +
            `------------------------------------%0A` +
            `Please dispatch stock with invoice.`;

        window.open(`https://wa.me/?text=${text}`, '_blank');
    };

    // Dynamic categories based on chosen sector
    const currentSectorObj = UNIVERSAL_SHOP_SECTORS.find(s => s.id === selectedSector);
    const availableCategories = ['ALL', ...(currentSectorObj && currentSectorObj.categories.length > 0
        ? currentSectorObj.categories
        : Array.from(new Set(products.map(p => p.category).filter(Boolean).concat(ALL_FLAT_CATEGORIES.slice(0, 20)))))];

    // Filter and Sort displayed items
    const baseList = inventoryTab === 'SHORT_BOOK' ? shortItemsList : products;

    const displayedProducts = baseList.filter(p => {
        // Sector filter
        if (selectedSector !== 'ALL' && currentSectorObj?.categories?.length) {
            if (!currentSectorObj.categories.includes(p.category)) return false;
        }
        // Category filter
        if (categoryFilter !== 'ALL' && p.category !== categoryFilter) return false;
        // Search
        if (search) {
            const q = search.toLowerCase();
            return p.name.toLowerCase().includes(q) || p.barcode.includes(q) || (p.category && p.category.toLowerCase().includes(q));
        }
        return true;
    }).sort((a, b) => {
        if (sortBy === 'shortFirst') {
            const defA = (Number(a.minStockAlert) || 10) - Number(a.stock);
            const defB = (Number(b.minStockAlert) || 10) - Number(b.stock);
            return defB - defA;
        }
        if (sortBy === 'nameAsc') return a.name.localeCompare(b.name);
        if (sortBy === 'nameDesc') return b.name.localeCompare(a.name);
        if (sortBy === 'stockAsc') return Number(a.stock) - Number(b.stock);
        if (sortBy === 'stockDesc') return Number(b.stock) - Number(a.stock);
        if (sortBy === 'priceDesc') return Number(b.sellingPrice) - Number(a.sellingPrice);
        if (sortBy === 'priceAsc') return Number(a.sellingPrice) - Number(b.sellingPrice);
        return 0;
    });

    // Valuation stats
    const totalInventoryItems = products.length;
    const lowStockCount = shortItemsList.length;
    const totalValuation = products.reduce((s, p) => s + (Number(p.sellingPrice) * Number(p.stock)), 0);

    return (
        <div className="container-fluid py-4 px-3">
            {/* Toast notification */}
            {toastMessage && (
                <div
                    className="position-fixed bottom-0 end-0 p-3"
                    style={{ zIndex: 1090 }}
                >
                    <div className="toast show align-items-center text-white bg-dark border-0 shadow-lg px-3 py-2 rounded-3">
                        <div className="d-flex align-items-center gap-2">
                            <span className="fs-5">ℹ️</span>
                            <div className="fw-semibold small">{toastMessage}</div>
                        </div>
                    </div>
                </div>
            )}

            {/* Header Toolbar */}
            <div className="d-flex flex-wrap justify-content-between align-items-center mb-3 gap-2">
                <div>
                    <div className="d-flex align-items-center gap-2">
                        <span className="fs-3">📦</span>
                        <h4 className="fw-bolder mb-0 text-dark">Universal Inventory &amp; Stock Master</h4>
                    </div>
                    <p className="text-muted small mb-0">
                        Multi-shop category catalog, stock refill, shortage book, barcode stickers &amp; GST tax slabs.
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
                        className="btn btn-primary fw-bold d-flex align-items-center gap-2 shadow-sm flex-grow-1 flex-sm-grow-0 justify-content-center"
                        onClick={handleOpenAdd}
                    >
                        <i className="bi bi-plus-lg fs-5"></i>
                        <span>+ Add New Product</span>
                    </button>
                </div>
            </div>

            {/* Main Tabs: All Inventory vs Short Book (Shortage Register) */}
            <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3 border-bottom pb-2">
                <div className="btn-group" role="group">
                    <button
                        type="button"
                        className={`btn fw-bold px-3 py-2 ${inventoryTab === 'ALL' ? 'btn-primary text-white shadow-sm' : 'btn-outline-secondary'}`}
                        onClick={() => { setInventoryTab('ALL'); setSortBy('nameAsc'); }}
                    >
                        <i className="bi bi-boxes me-1"></i>
                        All Products ({totalInventoryItems})
                    </button>

                    <button
                        type="button"
                        className={`btn fw-bold px-3 py-2 ${inventoryTab === 'SHORT_BOOK' ? 'btn-danger text-white shadow-sm' : 'btn-outline-danger'}`}
                        onClick={() => { setInventoryTab('SHORT_BOOK'); setSortBy('shortFirst'); }}
                        title="Products running low or out of stock"
                    >
                        <i className="bi bi-exclamation-triangle-fill me-1"></i>
                        ⚡ Short Book / कमी रजिस्टर ({lowStockCount})
                    </button>
                </div>

                {/* Quick Short Book Actions (WhatsApp Order) */}
                {inventoryTab === 'SHORT_BOOK' && (
                    <div className="d-flex gap-2 align-items-center flex-wrap">
                        <button
                            className="btn btn-sm btn-outline-dark fw-bold d-flex align-items-center gap-1 shadow-sm"
                            onClick={handleCopySupplierOrder}
                            title="Copy list to paste in supplier WhatsApp"
                        >
                            <i className="bi bi-clipboard-check text-primary"></i>
                            <span>Copy Supplier Order</span>
                        </button>
                        <button
                            className="btn btn-sm btn-success fw-bold d-flex align-items-center gap-1 shadow-sm"
                            onClick={handleWhatsAppSupplierOrder}
                            title="Send shortage order directly via WhatsApp"
                        >
                            <i className="bi bi-whatsapp"></i>
                            <span>WhatsApp Order</span>
                        </button>
                    </div>
                )}
            </div>

            {/* Shortage Alert Banner (When on Short Book Tab) */}
            {inventoryTab === 'SHORT_BOOK' && (
                <div className="alert alert-warning border-warning-subtle shadow-sm d-flex flex-wrap align-items-center justify-content-between p-3 mb-3 rounded-3">
                    <div className="d-flex align-items-center gap-2">
                        <i className="bi bi-lightning-charge-fill fs-4 text-warning"></i>
                        <div>
                            <strong>Shortage Reorder Register:</strong> {lowStockCount} items need stock replenishment from suppliers.
                            <div className="small text-muted">Click "⚡ Fill Stock" on any row to immediately add newly received inventory.</div>
                        </div>
                    </div>
                    <div className="d-flex gap-2 mt-2 mt-md-0">
                        <button
                            className="btn btn-sm btn-outline-dark fw-bold"
                            onClick={() => {
                                if (displayedProducts[0]) {
                                    setAdjustModalProduct(displayedProducts[0]);
                                    setStockChangeQty('');
                                }
                            }}
                        >
                            <i className="bi bi-box-arrow-in-down me-1"></i> Quick Refill
                        </button>
                    </div>
                </div>
            )}

            {/* KPI Cards */}
            <div className="row g-3 mb-3">
                <div className="col-md-4 col-6">
                    <div className="card border-0 shadow-sm p-3 rounded-3 bg-white border-start border-primary border-4 h-100">
                        <div className="d-flex justify-content-between align-items-center">
                            <div>
                                <small className="text-muted fw-bold text-uppercase" style={{ fontSize: '0.72rem' }}>Total Catalog SKUs</small>
                                <div className="fs-4 fw-bold font-mono text-dark">{totalInventoryItems} Products</div>
                            </div>
                            <div className="bg-primary-subtle p-2 rounded-circle text-primary fs-5">
                                <i className="bi bi-boxes"></i>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="col-md-4 col-6">
                    <div className="card border-0 shadow-sm p-3 rounded-3 bg-white border-start border-danger border-4 h-100">
                        <div className="d-flex justify-content-between align-items-center">
                            <div>
                                <small className="text-muted fw-bold text-uppercase" style={{ fontSize: '0.72rem' }}>Shortage Warnings</small>
                                <div className={`fs-4 fw-bold font-mono ${lowStockCount > 0 ? 'text-danger' : 'text-success'}`}>
                                    {lowStockCount} Items Short
                                </div>
                            </div>
                            <div className="bg-danger-subtle p-2 rounded-circle text-danger fs-5">
                                <i className="bi bi-exclamation-triangle"></i>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="col-md-4 col-12">
                    <div className="card border-0 shadow-sm p-3 rounded-3 bg-white border-start border-success border-4 h-100">
                        <div className="d-flex justify-content-between align-items-center">
                            <div>
                                <small className="text-muted fw-bold text-uppercase" style={{ fontSize: '0.72rem' }}>Total Stock Retail Value</small>
                                <div className="fs-4 fw-bold font-mono text-success">₹{Math.round(totalValuation).toLocaleString('en-IN')}</div>
                            </div>
                            <div className="bg-success-subtle p-2 rounded-circle text-success fs-5">
                                <i className="bi bi-currency-rupee"></i>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Shop Sectors Quick Filter (Universal Shop Types) */}
            <div className="card border-0 shadow-sm p-2 mb-3 rounded-3 bg-white">
                <div className="d-flex align-items-center gap-1 overflow-auto pb-1" style={{ whiteSpace: 'nowrap' }}>
                    <small className="fw-bold text-muted text-uppercase me-2" style={{ fontSize: '0.7rem' }}>Shop Sector:</small>
                    {UNIVERSAL_SHOP_SECTORS.map(sec => (
                        <button
                            key={sec.id}
                            type="button"
                            className={`btn btn-sm rounded-pill fw-bold px-3 py-1 ${selectedSector === sec.id ? 'btn-primary text-white shadow-sm' : 'btn-light border text-dark'}`}
                            onClick={() => { setSelectedSector(sec.id); setCategoryFilter('ALL'); }}
                            style={{ fontSize: '0.78rem' }}
                        >
                            <span className="me-1">{sec.icon}</span>
                            {sec.name}
                        </button>
                    ))}
                </div>
            </div>

            {/* Search, Category & Sorting Toolbar */}
            <div className="card border-0 shadow-sm p-3 mb-3 rounded-3 bg-white">
                <div className="row g-2 align-items-center">
                    {/* Search */}
                    <div className="col-md-4 col-12">
                        <div className="input-group input-group-sm">
                            <span className="input-group-text bg-light"><i className="bi bi-search"></i></span>
                            <input
                                type="text"
                                className="form-control"
                                placeholder="Search Name, Barcode or Category..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                            {search && (
                                <button className="btn btn-outline-secondary" onClick={() => setSearch('')}>
                                    <i className="bi bi-x"></i>
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Category Filter */}
                    <div className="col-md-4 col-sm-6 col-12">
                        <div className="d-flex align-items-center gap-1">
                            <label className="small text-muted fw-bold text-nowrap mb-0" style={{ fontSize: '0.72rem' }}>Category:</label>
                            <select
                                className="form-select form-select-sm fw-semibold"
                                value={categoryFilter}
                                onChange={(e) => setCategoryFilter(e.target.value)}
                            >
                                {availableCategories.map(c => (
                                    <option key={c} value={c}>{c === 'ALL' ? 'All Categories' : c}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Sort Bharne Ka Option (Sorting) */}
                    <div className="col-md-4 col-sm-6 col-12">
                        <div className="d-flex align-items-center gap-1 justify-content-md-end">
                            <label className="small text-muted fw-bold text-nowrap mb-0" style={{ fontSize: '0.72rem' }}>Sort By:</label>
                            <select
                                className="form-select form-select-sm fw-semibold"
                                value={sortBy}
                                onChange={(e) => setSortBy(e.target.value)}
                            >
                                <option value="shortFirst">⚡ Shortest Stock First</option>
                                <option value="nameAsc">Name (A to Z)</option>
                                <option value="nameDesc">Name (Z to A)</option>
                                <option value="stockAsc">Stock: Low to High</option>
                                <option value="stockDesc">Stock: High to Low</option>
                                <option value="priceDesc">Price: High to Low</option>
                                <option value="priceAsc">Price: Low to High</option>
                            </select>
                        </div>
                    </div>
                </div>
            </div>

            {/* Mobile View: Touch Cards (< md) */}
            <div className="d-block d-md-none mb-3">
                {loading ? (
                    <div className="card border-0 shadow-sm p-5 text-center text-muted bg-white">
                        <div className="spinner-border text-primary mx-auto mb-2"></div>
                        <div>Loading inventory items...</div>
                    </div>
                ) : displayedProducts.length === 0 ? (
                    <div className="card border-0 shadow-sm p-4 text-center text-muted bg-white">
                        <i className="bi bi-box-seam display-4 opacity-50 mb-2"></i>
                        <div className="fw-semibold">
                            {inventoryTab === 'SHORT_BOOK' ? '🎉 Great news! Zero shortage items in this category.' : 'No products found.'}
                        </div>
                    </div>
                ) : (
                    <div className="d-flex flex-column gap-2">
                        {displayedProducts.map((p) => {
                            const stockNum = Number(p.stock);
                            const minAlert = Number(p.minStockAlert || 10);
                            const isOut = stockNum === 0;
                            const isShort = stockNum > 0 && stockNum <= minAlert;

                            return (
                                <div key={p._id} className="card border-0 shadow-sm p-3 rounded-3 bg-white">
                                    <div className="d-flex justify-content-between align-items-start mb-2">
                                        <div className="pe-2 text-truncate" style={{ maxWidth: '75%' }}>
                                            <div className="fw-bold text-dark text-truncate" style={{ fontSize: '0.95rem' }}>
                                                {p.name}
                                            </div>
                                            <div className="d-flex align-items-center gap-1 mt-1 flex-wrap">
                                                <span className="badge bg-light text-dark border" style={{ fontSize: '0.7rem' }}>
                                                    {p.category || 'General'}
                                                </span>
                                                <span className="badge bg-light text-muted border font-mono" style={{ fontSize: '0.7rem' }}>
                                                    {p.barcode}
                                                </span>
                                                <span className="badge bg-light text-secondary border font-mono" style={{ fontSize: '0.7rem' }}>
                                                    {p.unit}
                                                </span>
                                            </div>
                                        </div>
                                        <div>
                                            {isOut ? (
                                                <span className="badge bg-danger text-white px-2 py-1 fw-bold" style={{ fontSize: '0.75rem' }}>
                                                    Out of Stock (0)
                                                </span>
                                            ) : isShort ? (
                                                <span className="badge bg-warning text-dark px-2 py-1 fw-bold border border-warning" style={{ fontSize: '0.75rem' }}>
                                                    ⚡ Short: {stockNum} {p.unit}
                                                </span>
                                            ) : (
                                                <span className="badge bg-success-subtle text-success border border-success-subtle px-2 py-1 fw-bold" style={{ fontSize: '0.75rem' }}>
                                                    ✓ Stock: {stockNum} {p.unit}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    <div className="d-flex justify-content-between align-items-center py-2 border-top border-bottom my-1 bg-light rounded-2 px-2">
                                        <div>
                                            <span className="text-muted text-decoration-line-through small me-1 font-mono">
                                                ₹{p.mrp}
                                            </span>
                                            <span className="fw-bolder fs-6 text-primary font-mono">
                                                ₹{p.sellingPrice}
                                            </span>
                                            <span className="text-muted small"> / {p.unit}</span>
                                        </div>
                                        <div className="small font-mono text-muted">
                                            Cost: ₹{p.purchasePrice || 0} | GST: {p.taxPercent || 0}%
                                        </div>
                                    </div>

                                    <div className="d-flex gap-2 align-items-center mt-2">
                                        <button
                                            type="button"
                                            className="btn btn-sm btn-warning text-dark fw-bold flex-grow-1 py-2 d-flex align-items-center justify-content-center gap-1 shadow-sm"
                                            onClick={() => {
                                                setAdjustModalProduct(p);
                                                setStockChangeQty('');
                                            }}
                                            title="Quick Stock Refill / माल भरें"
                                        >
                                            <i className="bi bi-box-arrow-in-down"></i>
                                            <span>⚡ Fill Stock</span>
                                        </button>
                                        <button
                                            type="button"
                                            className="btn btn-sm btn-outline-secondary px-3 py-2"
                                            onClick={() => handlePrintSticker(p)}
                                            title="Print Barcode Sticker"
                                        >
                                            <i className="bi bi-printer"></i>
                                        </button>
                                        <button
                                            type="button"
                                            className="btn btn-sm btn-outline-primary px-3 py-2"
                                            onClick={() => handleOpenEdit(p)}
                                            title="Edit Product"
                                        >
                                            <i className="bi bi-pencil"></i>
                                        </button>
                                        <button
                                            type="button"
                                            className="btn btn-sm btn-outline-danger px-3 py-2"
                                            onClick={() => handleDeleteProduct(p._id, p.name)}
                                            title="Delete"
                                        >
                                            <i className="bi bi-trash"></i>
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Desktop Products Table (d-none d-md-block) */}
            <div className="card border-0 shadow-sm rounded-3 overflow-hidden bg-white d-none d-md-block">
                <div className="table-responsive">
                    <table className="table table-hover align-middle mb-0">
                        <thead className="table-light">
                            <tr>
                                <th style={{ minWidth: '135px' }}>Barcode / SKU</th>
                                <th style={{ minWidth: '180px' }}>Product Name</th>
                                <th>Category</th>
                                <th>Unit</th>
                                <th className="text-center">GST %</th>
                                <th className="text-end">Cost (₹)</th>
                                <th className="text-end">MRP</th>
                                <th className="text-end">Rate (₹)</th>
                                <th className="text-center">Stock Status</th>
                                <th className="text-center" style={{ minWidth: '170px' }}>Quick Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan="10" className="text-center py-5">
                                        <div className="spinner-border text-primary"></div>
                                        <div className="mt-2 text-muted">Loading inventory items...</div>
                                    </td>
                                </tr>
                            ) : displayedProducts.length === 0 ? (
                                <tr>
                                    <td colSpan="10" className="text-center py-5 text-muted">
                                        <i className="bi bi-box-seam display-4 opacity-50"></i>
                                        <div className="mt-2 fw-semibold">
                                            {inventoryTab === 'SHORT_BOOK' ? '🎉 Great news! Zero shortage items in this category.' : 'No products found.'}
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                displayedProducts.map((p) => {
                                    const stockNum = Number(p.stock);
                                    const minAlert = Number(p.minStockAlert || 10);
                                    const isOut = stockNum === 0;
                                    const isShort = stockNum > 0 && stockNum <= minAlert;
                                    const savingsAmount = Math.max(0, p.mrp - p.sellingPrice);

                                    return (
                                        <tr key={p._id} className={isOut ? 'table-danger' : isShort ? 'table-warning' : ''}>
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
                                                <small className="text-muted d-block" style={{ fontSize: '0.72rem' }}>
                                                    Min Alert: {minAlert} {p.unit}
                                                </small>
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

                                            {/* GST Tax % */}
                                            <td className="text-center">
                                                <span className="badge bg-info-subtle text-info-emphasis border border-info-subtle font-mono">
                                                    {p.taxPercent || 0}%
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
                                            <td className="text-end font-mono fw-bolder fs-6 text-dark">
                                                ₹{p.sellingPrice}
                                            </td>

                                            {/* Stock Status Badge */}
                                            <td className="text-center">
                                                {isOut ? (
                                                    <span className="badge bg-danger text-white px-2 py-1 fw-bold">
                                                        ⚠️ Out of Stock (0)
                                                    </span>
                                                ) : isShort ? (
                                                    <span className="badge bg-warning text-dark px-2 py-1 fw-bold border border-warning">
                                                        ⚡ Short: {stockNum} {p.unit}
                                                    </span>
                                                ) : (
                                                    <span className="badge bg-success-subtle text-success border border-success-subtle px-2 py-1 fw-bold">
                                                        ✓ {stockNum} {p.unit}
                                                    </span>
                                                )}
                                            </td>

                                            {/* Actions */}
                                            <td className="text-center">
                                                <div className="d-flex justify-content-center align-items-center gap-1">
                                                    {/* SHORT BHARNE KA OPTION (Quick Refill) */}
                                                    <button
                                                        className="btn btn-sm btn-outline-warning text-dark fw-bold d-flex align-items-center gap-1"
                                                        onClick={() => {
                                                            setAdjustModalProduct(p);
                                                            setStockChangeQty('');
                                                        }}
                                                        title="Quick Stock Refill / माल भरें"
                                                    >
                                                        <i className="bi bi-box-arrow-in-down text-dark"></i>
                                                        <span>Fill Stock</span>
                                                    </button>

                                                    <button
                                                        className="btn btn-sm btn-outline-primary"
                                                        onClick={() => handleOpenEdit(p)}
                                                        title="Edit Product"
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
                <div className="modal show d-block" style={{ backgroundColor: 'rgba(15, 23, 42, 0.75)', zIndex: 1055 }} tabIndex="-1">
                    <div className="modal-dialog modal-dialog-centered modal-lg">
                        <div className="modal-content border-0 shadow-lg" style={{ borderRadius: '16px' }}>
                            <div className="modal-header bg-dark text-white py-3 px-4">
                                <h5 className="modal-title fw-bold mb-0">
                                    {editingProduct ? '✏️ Edit Inventory Product' : '➕ Add New Product to Inventory'}
                                </h5>
                                <button type="button" className="btn-close btn-close-white" onClick={() => setIsFormOpen(false)}></button>
                            </div>

                            <form onSubmit={handleSaveProduct}>
                                <div className="modal-body p-4 bg-light">
                                    <div className="row g-3">
                                        {/* Barcode */}
                                        <div className="col-md-6">
                                            <label className="form-label fw-bold small text-muted text-uppercase">
                                                Barcode / SKU <span className="text-danger">*</span>
                                            </label>
                                            <div className="input-group">
                                                <input
                                                    type="text"
                                                    className="form-control font-mono fw-bold"
                                                    placeholder="Scan barcode or type SKU..."
                                                    value={formData.barcode}
                                                    onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                                                    required
                                                />
                                                <button
                                                    type="button"
                                                    className={`btn fw-bold d-flex align-items-center gap-1 ${isCameraScanningForProduct ? 'btn-danger text-white' : 'btn-primary'}`}
                                                    onClick={() => setIsCameraScanningForProduct(prev => !prev)}
                                                    title="Scan barcode with camera"
                                                >
                                                    <i className={`bi ${isCameraScanningForProduct ? 'bi-x-lg' : 'bi-camera-fill'}`}></i>
                                                    <span className="d-none d-sm-inline">{isCameraScanningForProduct ? 'Close' : 'Camera'}</span>
                                                </button>
                                                <button
                                                    type="button"
                                                    className="btn btn-outline-secondary"
                                                    onClick={() => setFormData(prev => ({ ...prev, barcode: '890' + Math.floor(1000000000 + Math.random() * 9000000000) }))}
                                                    title="Auto generate barcode SKU"
                                                >
                                                    ⚡ Auto
                                                </button>
                                            </div>
                                            <small className="text-muted" style={{ fontSize: '0.72rem' }}>
                                                Point camera at product packaging barcode, or click ⚡ Auto for loose items.
                                            </small>
                                        </div>

                                        {/* Name */}
                                        <div className="col-md-6">
                                            <label className="form-label fw-bold small text-muted text-uppercase">
                                                Product Title / Name <span className="text-danger">*</span>
                                            </label>
                                            <input
                                                type="text"
                                                className="form-control fw-bold"
                                                placeholder="e.g. Parle-G Glucose Biscuit (800g)"
                                                value={formData.name}
                                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                                required
                                            />
                                        </div>

                                        {/* Inline Camera Scanner */}
                                        {isCameraScanningForProduct && (
                                            <div className="col-12">
                                                <CameraScannerBox
                                                    containerId="admin-camera-scanner-viewfinder"
                                                    title="📷 Scan Product Barcode"
                                                    onDetected={(scannedCode) => {
                                                        setFormData(prev => ({ ...prev, barcode: scannedCode }));
                                                        setIsCameraScanningForProduct(false);
                                                        showToast(`✅ Scanned Barcode: ${scannedCode}`);
                                                    }}
                                                    onClose={() => setIsCameraScanningForProduct(false)}
                                                    autoCloseOnScan={true}
                                                />
                                            </div>
                                        )}

                                        {/* Category Selection */}
                                        <div className="col-md-6">
                                            <label className="form-label fw-bold small text-muted text-uppercase">
                                                Category (Select or Type New)
                                            </label>
                                            <select
                                                className="form-select mb-1"
                                                value={formData.category}
                                                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                                            >
                                                {ALL_FLAT_CATEGORIES.map(c => (
                                                    <option key={c} value={c}>{c}</option>
                                                ))}
                                            </select>
                                            <input
                                                type="text"
                                                className="form-control form-control-sm"
                                                placeholder="Or type custom category name..."
                                                value={customCategoryInput}
                                                onChange={(e) => setCustomCategoryInput(e.target.value)}
                                            />
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
                                                <option value="pc">pc (Piece / Nos)</option>
                                                <option value="kg">kg (Kilogram)</option>
                                                <option value="gm">gm (Gram)</option>
                                                <option value="liter">liter (Litre)</option>
                                                <option value="ml">ml (Millilitre)</option>
                                                <option value="pack">pack (Packet)</option>
                                                <option value="box">box (Box / Carton)</option>
                                                <option value="pair">pair (Pair)</option>
                                                <option value="meter">meter (Meter)</option>
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
                                                className="form-control font-mono fw-bold text-dark"
                                                placeholder="Shop Selling Rate"
                                                value={formData.sellingPrice}
                                                onChange={(e) => setFormData({ ...formData, sellingPrice: e.target.value })}
                                                required
                                            />
                                        </div>

                                        {/* Purchase Cost */}
                                        <div className="col-md-4">
                                            <label className="form-label fw-bold small text-muted text-uppercase">
                                                Purchase Cost Price (₹)
                                            </label>
                                            <input
                                                type="number"
                                                step="0.01"
                                                className="form-control font-mono text-muted"
                                                placeholder="Wholesale Cost"
                                                value={formData.purchasePrice}
                                                onChange={(e) => setFormData({ ...formData, purchasePrice: e.target.value })}
                                            />
                                        </div>

                                        {/* Current Stock */}
                                        <div className="col-md-4">
                                            <label className="form-label fw-bold small text-muted text-uppercase">
                                                Initial Stock Qty
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
                                                Min Stock Alert Level
                                            </label>
                                            <input
                                                type="number"
                                                className="form-control font-mono"
                                                value={formData.minStockAlert}
                                                onChange={(e) => setFormData({ ...formData, minStockAlert: e.target.value })}
                                            />
                                        </div>

                                        {/* Proper GST Slabs Selector */}
                                        <div className="col-md-4">
                                            <label className="form-label fw-bold small text-muted text-uppercase">
                                                GST Tax Rate Slab
                                            </label>
                                            <select
                                                className="form-select font-mono fw-semibold"
                                                value={formData.taxPercent}
                                                onChange={(e) => setFormData({ ...formData, taxPercent: e.target.value })}
                                            >
                                                {GST_SLABS.map(s => (
                                                    <option key={s.value} value={s.value}>{s.label}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                </div>

                                <div className="modal-footer bg-white border-top p-3 d-flex justify-content-between">
                                    <button type="button" className="btn btn-outline-secondary" onClick={() => setIsFormOpen(false)}>
                                        Cancel
                                    </button>
                                    <button type="submit" className="btn btn-primary fw-bold px-4 shadow-sm">
                                        Save Product
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {/* QUICK ADJUST STOCK / SHORT BHARNE KA MODAL */}
            {adjustModalProduct && (
                <div className="modal show d-block" style={{ backgroundColor: 'rgba(15, 23, 42, 0.75)', zIndex: 1055 }} tabIndex="-1">
                    <div className="modal-dialog modal-dialog-centered modal-sm">
                        <div className="modal-content border-0 shadow-lg" style={{ borderRadius: '16px' }}>
                            <div className="modal-header bg-dark text-white py-3">
                                <div className="d-flex align-items-center gap-2">
                                    <i className="bi bi-box-arrow-in-down text-warning fs-5"></i>
                                    <h6 className="modal-title fw-bold mb-0">⚡ Quick Stock Refill</h6>
                                </div>
                                <button type="button" className="btn-close btn-close-white" onClick={() => setAdjustModalProduct(null)}></button>
                            </div>
                            <form onSubmit={handleStockAdjust}>
                                <div className="modal-body p-3">
                                    <div className="fw-bold mb-1 text-dark fs-6">{adjustModalProduct.name}</div>
                                    <div className="d-flex justify-content-between small text-muted mb-2">
                                        <span>Current Stock: <strong>{adjustModalProduct.stock} {adjustModalProduct.unit}</strong></span>
                                        <span>Alert Level: <strong>{adjustModalProduct.minStockAlert || 10}</strong></span>
                                    </div>

                                    <label className="form-label small text-muted fw-bold">Enter Quantity Received / Added (+):</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        className="form-control form-control-lg font-mono fw-bolder text-dark mb-2"
                                        placeholder="e.g. 25"
                                        value={stockChangeQty}
                                        onChange={(e) => setStockChangeQty(e.target.value)}
                                        required
                                        autoFocus
                                    />

                                    {/* Quick Increment Shortcut Pills */}
                                    <div className="d-flex flex-wrap gap-1">
                                        {[+5, +10, +25, +50, +100, +200].map(amt => (
                                            <button
                                                key={amt}
                                                type="button"
                                                className="btn btn-sm btn-outline-secondary py-0 px-2 fw-bold"
                                                onClick={() => setStockChangeQty(prev => String((Number(prev) || 0) + amt))}
                                                style={{ fontSize: '0.75rem' }}
                                            >
                                                +{amt}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div className="modal-footer p-2 bg-light d-flex justify-content-between">
                                    <button type="button" className="btn btn-sm btn-secondary" onClick={() => setAdjustModalProduct(null)}>
                                        Cancel
                                    </button>
                                    <button type="submit" className="btn btn-sm btn-primary fw-bold px-3 shadow-sm">
                                        Add to Stock
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {/* BARCODE STICKER PREVIEW MODAL */}
            {stickerProduct && (
                <div className="modal show d-block" style={{ backgroundColor: 'rgba(15, 23, 42, 0.75)', zIndex: 1055 }} tabIndex="-1">
                    <div className="modal-dialog modal-dialog-centered modal-sm">
                        <div className="modal-content border-0 shadow-lg text-center" style={{ borderRadius: '16px' }}>
                            <div className="modal-header bg-light py-2">
                                <h6 className="modal-title small fw-bold mb-0">Print Shelf Barcode Sticker</h6>
                                <button type="button" className="btn-close" onClick={() => setStickerProduct(null)}></button>
                            </div>
                            <div className="modal-body p-3">
                                <div className="p-3 border rounded bg-white shadow-sm">
                                    <div className="fw-bolder fs-6 text-dark text-truncate">{stickerProduct.name}</div>
                                    <div className="small text-muted">{storeConfig?.storeName || 'SuperStore'} | Unit: {stickerProduct.unit}</div>
                                    <div style={{ fontFamily: 'Libre Barcode 128', fontSize: '50px', lineHeight: '1', margin: '10px 0' }}>
                                        {stickerProduct.barcode}
                                    </div>
                                    <div className="font-mono fw-bold small">{stickerProduct.barcode}</div>
                                    <div className="d-flex justify-content-center gap-3 mt-2">
                                        <span className="text-muted text-decoration-line-through">MRP: ₹{stickerProduct.mrp}</span>
                                        <span className="fw-bolder text-dark fs-5">₹{stickerProduct.sellingPrice}</span>
                                    </div>
                                </div>
                            </div>
                            <div className="modal-footer p-2 justify-content-center gap-2">
                                <button
                                    type="button"
                                    className="btn btn-sm btn-primary fw-bold px-3"
                                    onClick={() => handlePrintSticker(stickerProduct)}
                                >
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
