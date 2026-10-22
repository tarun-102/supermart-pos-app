import React, { useState, useEffect, useRef } from 'react';
import { apiFetch } from '../../utils/api';
import { playBarcodeBeep, playErrorBeep, playSuccessChime } from '../../utils/audio';
import SplitPaymentModal from './SplitPaymentModal';
import ReceiptModal from './ReceiptModal';
import QuickAddModal from './QuickAddModal';
import HeldBillsModal from './HeldBillsModal';
import CameraScannerBox from './CameraScannerBox';
import { useConfirm } from '../../context/ConfirmContext';
import { toast } from 'react-toastify';

export default function PosBilling({ currentUser, activeShift, refreshShifts, onOpenShiftModal, storeConfig }) {
    const confirm = useConfirm();
    // POS State
    const [cart, setCart] = useState([]);
    const [barcodeInput, setBarcodeInput] = useState('');
    const [customerName, setCustomerName] = useState('');
    const [customerPhone, setCustomerPhone] = useState('');
    const [catalog, setCatalog] = useState([]);
    const [catalogSearch, setCatalogSearch] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('ALL');
    const [isLoadingScan, setIsLoadingScan] = useState(false);
    const [scanMessage, setScanMessage] = useState(null);

    // Modals
    const [isPaymentOpen, setIsPaymentOpen] = useState(false);
    const [isReceiptOpen, setIsReceiptOpen] = useState(false);
    const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
    const [isHeldModalOpen, setIsHeldModalOpen] = useState(false);
    const [isCameraScannerOpen, setIsCameraScannerOpen] = useState(false);
    const [heldBills, setHeldBills] = useState([]);
    const [completedBill, setCompletedBill] = useState(null);
    const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 768);

    const barcodeInputRef = useRef(null);

    // Track mobile viewport resize & initial camera launch
    useEffect(() => {
        const handleResize = () => {
            setIsMobile(window.innerWidth < 768);
        };
        handleResize();
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Auto-dismiss scan feedback message after 4.5 seconds
    useEffect(() => {
        if (scanMessage) {
            const timer = setTimeout(() => {
                setScanMessage(null);
            }, 4500);
            return () => clearTimeout(timer);
        }
    }, [scanMessage]);

    // Load inventory catalog for quick-click shelf
    useEffect(() => {
        loadCatalog();
        loadHeldBills();
        // On mobile devices, enable camera scanner by default for instant scanning!
        if (window.innerWidth < 768) {
            setIsCameraScannerOpen(true);
        }
        // Auto focus barcode input on desktop only
        if (window.innerWidth >= 768 && barcodeInputRef.current) {
            barcodeInputRef.current.focus();
        }
    }, []);

    // Global Keyboard Shortcuts
    useEffect(() => {
        const handleKeyDown = (e) => {
            // F2: Focus Barcode Scanner
            if (e.key === 'F2') {
                e.preventDefault();
                if (barcodeInputRef.current) barcodeInputRef.current.focus();
            }
            // F4: Open Payment Modal
            if (e.key === 'F4' && cart.length > 0 && !isPaymentOpen && !isReceiptOpen) {
                e.preventDefault();
                setIsPaymentOpen(true);
            }
            // F7: Hold Bill
            if (e.key === 'F7' && cart.length > 0) {
                e.preventDefault();
                handleHoldBill();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [cart, isPaymentOpen, isReceiptOpen]);

    const loadCatalog = async () => {
        try {
            const data = await apiFetch('/inventory');
            if (data.products) {
                setCatalog(data.products);
            }
        } catch (err) {
            console.error('Failed to load catalog:', err);
        }
    };

    const loadHeldBills = async () => {
        try {
            const data = await apiFetch('/billing/held-bills');
            if (data.heldBills) {
                setHeldBills(data.heldBills);
            }
        } catch (err) {
            console.error('Failed to load held bills:', err);
        }
    };

    const [selectedCounter, setSelectedCounter] = useState(
        activeShift?.counterNo || currentUser?.counterAssigned || 'Counter-01'
    );

    useEffect(() => {
        if (activeShift?.counterNo) {
            setSelectedCounter(activeShift.counterNo);
        }
    }, [activeShift]);

    const handleCounterChange = async (newCounter) => {
        setSelectedCounter(newCounter);
        if (activeShift) {
            try {
                await apiFetch(`/shifts/update-counter/${activeShift._id}`, {
                    method: 'PUT',
                    body: JSON.stringify({ counterNo: newCounter })
                });
                if (refreshShifts) refreshShifts();
            } catch (err) {
                console.warn('Could not update active shift counter:', err);
            }
        }
    };

    // BARCODE SCAN HANDLER (Used by Scanner Gun, Camera, and Manual input)
    // ONLY items present in inventory are added; otherwise "Item Not Found" is shown!
    // Directly adds to cart with ZERO confirmation popups!
    const scanBarcodeString = async (code, fromCamera = false) => {
        if (!code || !code.trim()) return;
        const cleanCode = code.trim();
        setIsLoadingScan(true);
        setScanMessage(null);

        try {
            // Check local catalog first (including trim / leading zero tolerance)
            let found = catalog.find(p =>
                p.barcode === cleanCode ||
                p.barcode.trim() === cleanCode ||
                p.barcode.replace(/^0+/, '') === cleanCode.replace(/^0+/, '')
            );

            if (!found) {
                // Fetch from server if not found locally
                const res = await apiFetch(`/inventory/barcode/${encodeURIComponent(cleanCode)}`);
                if (res.product) found = res.product;
            }

            if (found) {
                // AUTOMATICALLY & DIRECTLY ADD TO CART WITH ZERO CONFIRMATION PROMPTS!
                addProductToCart(found);

                // Play exactly ONE crisp retail confirmation beep
                playBarcodeBeep();

                setBarcodeInput('');
                setScanMessage({
                    type: 'success',
                    text: `✅ Added: ${found.name} (${found.unit}) • ₹${found.sellingPrice}`
                });
            } else {
                // NOT FOUND IN INVENTORY: Sound warning buzzer and reject barcode
                playErrorBeep();
                setBarcodeInput('');
                setScanMessage({
                    type: 'error',
                    text: `❌ Barcode "${cleanCode}" is not registered in this store's inventory!`
                });
            }
        } catch (err) {
            playErrorBeep();
            setBarcodeInput('');
            setScanMessage({
                type: 'error',
                text: `❌ Barcode "${cleanCode}" is not registered in this store's inventory!`
            });
        } finally {
            setIsLoadingScan(false);
            if (!isMobile && barcodeInputRef.current) barcodeInputRef.current.focus();
        }
    };

    const handleBarcodeScan = async (e) => {
        if (e) e.preventDefault();
        await scanBarcodeString(barcodeInput, false);
    };

    // Add product to cart (Always positions the latest item at the top of the bill)
    const addProductToCart = (prod, customQty = 1) => {
        setCart(prev => {
            const existingIdx = prev.findIndex(item => item.barcode === prod.barcode);
            if (existingIdx > -1) {
                const current = prev[existingIdx];
                const newQty = Number((Number(current.quantity) + Number(customQty)).toFixed(2));
                const itemTotal = Number((newQty * current.sellingPrice).toFixed(2));
                const itemGross = Number((newQty * current.mrp).toFixed(2));
                const discount = Math.max(0, Number((itemGross - itemTotal).toFixed(2)));

                const updatedItem = {
                    ...current,
                    quantity: newQty,
                    total: itemTotal,
                    discount: discount
                };
                // Move updated item to front so cashier sees the change immediately at the top
                const rest = prev.filter((_, i) => i !== existingIdx);
                return [updatedItem, ...rest];
            } else {
                const qty = Number(customQty);
                const mrp = Number(prod.mrp) || Number(prod.sellingPrice);
                const sp = Number(prod.sellingPrice);
                const itemTotal = Number((qty * sp).toFixed(2));
                const itemGross = Number((qty * mrp).toFixed(2));
                const discount = Math.max(0, Number((itemGross - itemTotal).toFixed(2)));

                return [
                    {
                        productId: prod._id,
                        barcode: prod.barcode,
                        name: prod.name,
                        unit: prod.unit || 'pc',
                        category: prod.category,
                        quantity: qty,
                        mrp: mrp,
                        sellingPrice: sp,
                        discount: discount,
                        total: itemTotal,
                        taxPercent: prod.taxPercent || 0
                    },
                    ...prev
                ];
            }
        });
    };

    // Update quantity in cart - NEVER deletes item on backspace or empty string!
    const handleUpdateQuantity = (idx, newQty) => {
        setCart(prev => {
            const updated = [...prev];
            const item = updated[idx];
            if (!item) return prev;

            // If empty string during backspace, keep empty so user can type freely without deleting item
            if (newQty === '' || newQty === undefined) {
                updated[idx] = {
                    ...item,
                    quantity: '',
                    total: 0,
                    discount: 0
                };
                return updated;
            }

            const num = Number(newQty);
            const qty = isNaN(num) ? 0 : Math.max(0, num);
            const itemTotal = Number((qty * item.sellingPrice).toFixed(2));
            const itemGross = Number((qty * item.mrp).toFixed(2));
            const discount = Math.max(0, Number((itemGross - itemTotal).toFixed(2)));

            updated[idx] = {
                ...item,
                quantity: newQty,
                total: itemTotal,
                discount: discount
            };
            return updated;
        });
    };

    const handleQuantityBlur = (idx) => {
        setCart(prev => {
            const updated = [...prev];
            const item = updated[idx];
            if (!item) return prev;
            // If cashier left it blank or 0 on blur, restore default 1
            if (!item.quantity || Number(item.quantity) <= 0) {
                const qty = 1;
                const itemTotal = Number((qty * item.sellingPrice).toFixed(2));
                const itemGross = Number((qty * item.mrp).toFixed(2));
                const discount = Math.max(0, Number((itemGross - itemTotal).toFixed(2)));
                updated[idx] = {
                    ...item,
                    quantity: 1,
                    total: itemTotal,
                    discount: discount
                };
            }
            return updated;
        });
    };

    // Remove single item
    const handleRemoveItem = (idx) => {
        setCart(prev => prev.filter((_, i) => i !== idx));
    };

    // Clear entire cart
    const handleClearCart = async () => {
        if (cart.length === 0) return;
        const isOk = await confirm({
            title: 'Clear Active Cart',
            message: `Are you sure you want to remove all ${cart.length} item(s) from the current bill?`,
            confirmText: 'Clear Cart',
            confirmVariant: 'danger',
            icon: 'bi-cart-x-fill'
        });
        if (isOk) {
            setCart([]);
            setScanMessage(null);
            toast.info('🛒 Cart cleared.');
        }
    };

    // Quick Add Custom Loose Item
    const handleQuickAdd = async (itemData) => {
        if (itemData.saveToInventory) {
            try {
                const targetStoreId = currentUser?.storeId || storeConfig?.storeId || storeConfig?._id || localStorage.getItem('pos_store_id') || 'store_default';
                const res = await apiFetch('/inventory', {
                    method: 'POST',
                    body: JSON.stringify({
                        storeId: targetStoreId,
                        barcode: itemData.barcode,
                        name: itemData.name,
                        category: itemData.category,
                        unit: itemData.unit,
                        mrp: itemData.mrp,
                        sellingPrice: itemData.sellingPrice,
                        stock: 50,
                        taxPercent: itemData.taxPercent
                    })
                });
                if (res.product) {
                    setCatalog(prev => [res.product, ...prev]);
                }
            } catch (err) {
                console.warn('Could not save custom item to inventory:', err.message);
            }
        }

        addProductToCart(itemData, itemData.quantity);
        setScanMessage({ type: 'success', text: `Added custom item: ${itemData.name}` });
    };

    // HOLD BILL
    const handleHoldBill = async () => {
        if (cart.length === 0) return;
        try {
            const res = await apiFetch('/billing/hold', {
                method: 'POST',
                body: JSON.stringify({
                    storeId: currentUser.storeId || storeConfig?._id,
                    cashierId: currentUser.id,
                    cashierName: currentUser.name,
                    counterNo: activeShift?.counterNo || currentUser.counterAssigned || 'Counter-01',
                    customerName: customerName || 'Held Customer',
                    customerPhone,
                    items: cart
                })
            });

            if (res.heldBill) {
                setHeldBills(prev => [res.heldBill, ...prev]);
                setCart([]);
                setCustomerName('');
                setCustomerPhone('');
                setScanMessage({ type: 'info', text: 'Cart placed on hold successfully!' });
                toast.info('⏸️ Current bill placed on hold.');
            }
        } catch (err) {
            toast.error('Failed to hold bill: ' + err.message);
        }
    };

    // RESUME HELD BILL
    const handleResumeBill = (held) => {
        setCart(held.items);
        setCustomerName(held.customerName || '');
        setCustomerPhone(held.customerPhone || '');
        // Delete from backend
        handleDeleteHeld(held._id);
        setScanMessage({ type: 'success', text: `Resumed cart for ${held.customerName}` });
    };

    const handleDeleteHeld = async (heldId) => {
        try {
            await apiFetch(`/billing/held-bills/${heldId}`, { method: 'DELETE' });
            setHeldBills(prev => prev.filter(h => h._id !== heldId));
        } catch (err) {
            console.error(err);
        }
    };

    // COMPLETE PAYMENT & GENERATE BILL
    const handleCompletePayment = async (paymentData) => {
        try {
            const payload = {
                storeId: currentUser.storeId || storeConfig?._id,
                cashierId: currentUser.id,
                cashierName: currentUser.name,
                counterNo: activeShift?.counterNo || currentUser.counterAssigned || 'Counter-01',
                shiftId: activeShift?._id,
                customerName: customerName || 'Walk-in Customer',
                customerPhone,
                items: cart,
                paymentMethod: paymentData.paymentMethod,
                splitBreakdown: paymentData.splitBreakdown,
                cashTendered: paymentData.cashTendered
            };

            const res = await apiFetch('/billing/checkout', {
                method: 'POST',
                body: JSON.stringify(payload)
            });

            if (res.success && res.bill) {
                const cleanNum = (res.bill.billNumber || '').replace(/^DM-/i, 'INV-');
                const cleanBill = { ...res.bill, billNumber: cleanNum };
                playSuccessChime();
                setCompletedBill(cleanBill);
                setIsPaymentOpen(false);
                setIsReceiptOpen(true);
                // Clear cart
                setCart([]);
                setCustomerName('');
                setCustomerPhone('');
                setScanMessage({ type: 'success', text: `Bill generated: ${cleanNum}` });
                toast.success(`🎉 Bill generated: ${cleanNum}`);
                // Refresh shift metrics
                if (refreshShifts) refreshShifts();
                // Reload catalog to reflect deducted inventory stock
                loadCatalog();
            }
        } catch (err) {
            toast.error('Checkout failed: ' + err.message);
        }
    };

    // Calculate Totals & GST
    const totalItemsCount = cart.length;
    const totalQty = cart.reduce((s, i) => s + Number(i.quantity), 0);
    const grossMrpTotal = cart.reduce((s, i) => s + (Number(i.mrp) * Number(i.quantity)), 0);
    const subtotal = cart.reduce((s, i) => s + Number(i.total), 0);
    const totalSavings = Math.max(0, grossMrpTotal - subtotal);
    const netPayable = Math.round(subtotal);

    // Accurate Indian GST calculations based on item taxPercent
    const totalTaxAmount = cart.reduce((s, i) => {
        const itemTotal = Number(i.total) || 0;
        const taxPct = Number(i.taxPercent) || 5;
        return s + ((itemTotal * taxPct) / (100 + taxPct));
    }, 0);
    const taxableAmount = Math.max(0, subtotal - totalTaxAmount);
    const cgstAmount = totalTaxAmount / 2;
    const sgstAmount = totalTaxAmount / 2;

    // Filter catalog items for the quick shelf
    const filteredCatalog = catalog.filter(p => {
        const matchesCategory = selectedCategory === 'ALL' || p.category === selectedCategory;
        const matchesSearch = !catalogSearch ||
            p.name.toLowerCase().includes(catalogSearch.toLowerCase()) ||
            p.barcode.includes(catalogSearch);
        return matchesCategory && matchesSearch;
    });

    const categories = ['ALL', ...Array.from(new Set(catalog.map(p => p.category).filter(Boolean)))];

    return (
        <div className={`container-fluid ${isMobile ? 'p-2' : 'py-3 px-3'}`}>
            {isMobile ? (
                /* ==============================================================
                   MOBILE-FIRST BILLING WORKSPACE: ONLY CAMERA + BILL + PAY BAR
                   ============================================================== */
                <div className="mobile-pos-container">
                    {/* Compact Mobile Status Header */}
                    <div className="d-flex align-items-center justify-content-between p-2 mb-2 bg-dark rounded-3 border border-secondary border-opacity-25 shadow-sm">
                        <div className="d-flex align-items-center gap-1 text-truncate" style={{ maxWidth: '55%' }}>
                            <div className="d-flex align-items-center gap-1 bg-primary text-white rounded px-2 py-1 shadow-sm flex-shrink-0">
                                <i className="bi bi-display small"></i>
                                <select
                                    className="form-select form-select-sm fw-bold border-0 bg-transparent text-white font-mono p-0"
                                    style={{ fontSize: '0.72rem', width: 'auto', cursor: 'pointer', appearance: 'none' }}
                                    value={selectedCounter}
                                    onChange={(e) => handleCounterChange(e.target.value)}
                                    title="Tap to switch counter"
                                >
                                    {(storeConfig?.counters || ['Counter-01', 'Counter-02', 'Counter-03']).map(c => (
                                        <option key={c} value={c} className="text-dark bg-white">{c}</option>
                                    ))}
                                </select>
                            </div>
                            <span className="text-light fw-bold small text-truncate" style={{ fontSize: '0.82rem' }}>
                                {storeConfig?.storeName || 'ShiftFlow POS'}
                            </span>
                        </div>
                        <div className="d-flex align-items-center gap-1 flex-shrink-0">
                            {activeShift ? (
                                <button
                                    type="button"
                                    className="btn btn-xs btn-outline-info text-info py-1 px-2 fw-semibold"
                                    style={{ fontSize: '0.72rem' }}
                                    onClick={onOpenShiftModal}
                                    title="Active Shift Details"
                                >
                                    Shift ({activeShift.billsCount || 0})
                                </button>
                            ) : (
                                <button
                                    type="button"
                                    className="btn btn-xs btn-warning text-dark py-1 px-2 fw-bold"
                                    style={{ fontSize: '0.72rem' }}
                                    onClick={onOpenShiftModal}
                                >
                                    Start Shift
                                </button>
                            )}
                            <button
                                type="button"
                                className={`btn btn-xs py-1 px-2 fw-bold shadow-sm ${isCameraScannerOpen ? 'btn-danger text-white' : 'btn-primary text-white'}`}
                                style={{ fontSize: '0.72rem' }}
                                onClick={() => setIsCameraScannerOpen(!isCameraScannerOpen)}
                            >
                                <i className={`bi ${isCameraScannerOpen ? 'bi-camera-video-off' : 'bi-camera'} me-1`}></i>
                                {isCameraScannerOpen ? 'Hide Cam' : 'Open Cam'}
                            </button>
                        </div>
                    </div>

                    {/* SECTION 1: EMBEDDED NON-BLOCKING LIVE CAMERA SCANNER */}
                    {isCameraScannerOpen && (
                        <div className="mobile-camera-wrapper mb-2">
                            <CameraScannerBox
                                containerId="pos-camera-scanner-viewfinder-mobile"
                                title="Live Camera Scanner"
                                onDetected={(code) => scanBarcodeString(code, true)}
                                onClose={() => setIsCameraScannerOpen(false)}
                                autoCloseOnScan={false}
                                compact={true}
                            />
                        </div>
                    )}

                    {/* SECTION 2: INSTANT SCAN FEEDBACK BANNER (High Visibility & Feedback) */}
                    {scanMessage && (
                        <div className={`mobile-scan-feedback mb-2 p-2 rounded-3 shadow-sm d-flex align-items-center justify-content-between ${scanMessage.type === 'success' ? 'bg-success bg-opacity-25 border border-success text-success' : 'bg-danger bg-opacity-25 border border-danger text-danger'}`}>
                            <div className="d-flex align-items-center gap-2 text-truncate pe-1">
                                <i className={`bi ${scanMessage.type === 'success' ? 'bi-check-circle-fill fs-5' : 'bi-exclamation-triangle-fill fs-5'}`}></i>
                                <strong className="text-truncate" style={{ fontSize: '0.84rem' }}>
                                    {scanMessage.text}
                                </strong>
                            </div>
                            <button
                                type="button"
                                className="btn-close btn-close-white btn-close-sm flex-shrink-0"
                                onClick={() => setScanMessage(null)}
                            ></button>
                        </div>
                    )}

                    {/* SECTION 3: THE CURRENT BILL (LIVE CART) - TOTAL FOCUS ON PRODUCTS */}
                    <div className="mobile-bill-sheet rounded-3 shadow-sm mb-2">
                        {/* Bill Header & Thumb Actions */}
                        <div className="p-2 d-flex align-items-center justify-content-between border-bottom border-secondary border-opacity-25 bg-dark rounded-top-3">
                            <div className="d-flex align-items-center gap-2">
                                <i className="bi bi-receipt-cutoff text-primary fs-5"></i>
                                <span className="fw-bolder text-white" style={{ fontSize: '0.95rem' }}>Current Bill</span>
                                <span className="badge bg-primary-subtle text-primary fw-bold px-2 py-1" style={{ fontSize: '0.72rem' }}>
                                    {totalItemsCount} Items ({totalQty.toFixed(1)} Qty)
                                </span>
                            </div>
                            <div className="d-flex align-items-center gap-1">
                                <button
                                    type="button"
                                    className="btn btn-sm btn-outline-warning text-warning fw-bold py-1 px-2 d-flex align-items-center gap-1"
                                    style={{ fontSize: '0.75rem' }}
                                    onClick={() => setIsQuickAddOpen(true)}
                                    title="Add Loose Item (kg/pc)"
                                >
                                    <i className="bi bi-plus-circle"></i>
                                    <span>+ Loose</span>
                                </button>
                                {cart.length > 0 && (
                                    <button
                                        type="button"
                                        className="btn btn-sm btn-outline-danger py-1 px-2"
                                        onClick={handleClearCart}
                                        title="Clear Bill"
                                    >
                                        <i className="bi bi-trash"></i>
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Barcode Quick Search / Manual Fallback */}
                        <div className="p-2 bg-dark bg-opacity-50 border-bottom border-secondary border-opacity-25">
                            <form onSubmit={handleBarcodeScan} className="d-flex gap-1">
                                <div className="input-group input-group-sm">
                                    <span className="input-group-text bg-dark border-secondary border-opacity-50 text-muted">
                                        <i className="bi bi-upc-scan"></i>
                                    </span>
                                    <input
                                        type="text"
                                        className="form-control form-control-sm bg-dark border-secondary border-opacity-50 text-white font-mono"
                                        placeholder="Type Barcode / SKU if unreadable..."
                                        value={barcodeInput}
                                        onChange={(e) => setBarcodeInput(e.target.value)}
                                        disabled={isLoadingScan}
                                    />
                                    <button
                                        type="submit"
                                        className="btn btn-sm btn-primary fw-bold px-3"
                                        disabled={isLoadingScan || !barcodeInput.trim()}
                                    >
                                        {isLoadingScan ? <span className="spinner-border spinner-border-sm"></span> : 'Add'}
                                    </button>
                                </div>
                            </form>
                        </div>

                        {/* Scanned Items List */}
                        <div className="mobile-cart-items-scroll p-2" style={{ maxHeight: isCameraScannerOpen ? '44vh' : '68vh', overflowY: 'auto' }}>
                            {cart.length === 0 ? (
                                <div className="text-center py-4 px-2">
                                    <div className="fs-1 text-muted opacity-50 mb-2">🛒</div>
                                    <h6 className="fw-bold text-light mb-1">Bill is Ready</h6>
                                    <p className="text-muted small mb-3" style={{ fontSize: '0.8rem' }}>
                                        Scan product barcodes with the camera above to add items directly to this bill.
                                    </p>
                                    <div className="d-flex justify-content-center gap-2">
                                        <button
                                            type="button"
                                            className="btn btn-sm btn-outline-warning text-warning fw-bold px-3 py-1 shadow-sm"
                                            onClick={() => setIsQuickAddOpen(true)}
                                        >
                                            <i className="bi bi-plus-circle me-1"></i> Add Loose Item (kg/pc)
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="d-flex flex-column gap-2">
                                    {cart.map((item, idx) => (
                                        <div key={idx} className="mobile-cart-card p-2 rounded-3 border border-secondary border-opacity-25 bg-dark shadow-sm">
                                            <div className="d-flex justify-content-between align-items-start mb-1">
                                                <div className="pe-1 text-truncate" style={{ maxWidth: '85%' }}>
                                                    <div className="fw-bolder text-white text-truncate" style={{ fontSize: '0.92rem' }}>
                                                        {item.name}
                                                    </div>
                                                    <div className="d-flex align-items-center gap-1 mt-1 flex-wrap">
                                                        <span className="badge bg-secondary bg-opacity-25 text-light border border-secondary border-opacity-25 font-mono" style={{ fontSize: '0.68rem' }}>
                                                            {item.barcode}
                                                        </span>
                                                        <span className="badge bg-secondary bg-opacity-25 text-info border border-secondary border-opacity-25" style={{ fontSize: '0.68rem' }}>
                                                            {item.unit}
                                                        </span>
                                                        {item.discount > 0 && (
                                                            <span className="savings-pill" style={{ fontSize: '0.68rem', padding: '1px 6px' }}>
                                                                Save ₹{item.discount}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                                <button
                                                    type="button"
                                                    className="btn btn-sm btn-link text-danger p-0"
                                                    onClick={() => handleRemoveItem(idx)}
                                                    title="Remove Item"
                                                >
                                                    <i className="bi bi-trash fs-5"></i>
                                                </button>
                                            </div>

                                            <div className="d-flex justify-content-between align-items-center pt-2 border-top border-secondary border-opacity-25 mt-1">
                                                <div>
                                                    <span className="text-muted text-decoration-line-through small me-1 font-mono" style={{ fontSize: '0.78rem' }}>
                                                        ₹{item.mrp}
                                                    </span>
                                                    <span className="fw-bolder text-info font-mono" style={{ fontSize: '1rem' }}>
                                                        ₹{item.sellingPrice}
                                                    </span>
                                                    <span className="text-muted small" style={{ fontSize: '0.75rem' }}> / {item.unit}</span>
                                                </div>

                                                <div className="d-flex align-items-center gap-2">
                                                    <div className="input-group input-group-sm" style={{ width: '115px' }}>
                                                        <button
                                                            className="btn btn-outline-secondary mobile-stepper-btn px-2 fw-bold text-light"
                                                            type="button"
                                                            onClick={() => {
                                                                const cur = Number(item.quantity) || 1;
                                                                if (cur > 1) handleUpdateQuantity(idx, cur - 1);
                                                            }}
                                                        >
                                                            -
                                                        </button>
                                                        <input
                                                            type="number"
                                                            step="0.01"
                                                            className="form-control text-center font-mono fw-bold px-1 bg-dark text-white border-secondary"
                                                            value={item.quantity}
                                                            onChange={(e) => handleUpdateQuantity(idx, e.target.value)}
                                                            onBlur={() => handleQuantityBlur(idx)}
                                                            style={{ fontSize: '0.9rem' }}
                                                        />
                                                        <button
                                                            className="btn btn-outline-secondary mobile-stepper-btn px-2 fw-bold text-light"
                                                            type="button"
                                                            onClick={() => {
                                                                const cur = Number(item.quantity) || 0;
                                                                handleUpdateQuantity(idx, cur + 1);
                                                            }}
                                                        >
                                                            +
                                                        </button>
                                                    </div>
                                                    <div className="fw-bolder font-mono text-white text-end" style={{ minWidth: '60px', fontSize: '1.05rem' }}>
                                                        ₹{item.total}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* SECTION 4: MOBILE STICKY BOTTOM BILL CHECKOUT BAR */}
                    {cart.length > 0 && (
                        <div className="mobile-sticky-checkout-bar shadow-lg">
                            <div className="d-flex justify-content-between align-items-center mb-1">
                                <div>
                                    <span className="text-muted small" style={{ fontSize: '0.75rem' }}>
                                        Total: <strong className="text-white">{totalItemsCount} items</strong> ({totalQty.toFixed(1)} qty)
                                    </span>
                                    {totalSavings > 0 && (
                                        <span className="text-success small fw-bold ms-2" style={{ fontSize: '0.75rem' }}>
                                            Save ₹{totalSavings.toFixed(0)}
                                        </span>
                                    )}
                                </div>
                                <div className="d-flex align-items-center gap-1">
                                    <button
                                        type="button"
                                        className="btn btn-xs btn-outline-secondary py-1 px-2 text-light"
                                        style={{ fontSize: '0.72rem' }}
                                        onClick={handleHoldBill}
                                        title="Hold Bill"
                                    >
                                        <i className="bi bi-pause-circle me-1"></i> Hold
                                    </button>
                                    <button
                                        type="button"
                                        className="btn btn-xs btn-outline-secondary py-1 px-2 text-light"
                                        style={{ fontSize: '0.72rem' }}
                                        onClick={() => setIsHeldModalOpen(true)}
                                        title="View Held Bills"
                                    >
                                        Held ({heldBills.length})
                                    </button>
                                </div>
                            </div>

                            <div className="d-flex align-items-center justify-content-between gap-2">
                                <div>
                                    <div className="small text-muted text-uppercase fw-bold" style={{ fontSize: '0.68rem', letterSpacing: '0.5px' }}>
                                        Net Payable
                                    </div>
                                    <div className="fs-4 fw-bolder text-info font-mono" style={{ lineHeight: 1.1 }}>
                                        ₹{netPayable.toLocaleString('en-IN')}
                                    </div>
                                </div>

                                <button
                                    type="button"
                                    className="btn btn-success btn-lg fw-bolder px-4 py-2 d-flex align-items-center gap-2 shadow rounded-pill flex-grow-1 justify-content-center"
                                    style={{ fontSize: '1.1rem', letterSpacing: '0.5px', background: 'var(--gradient-emerald)', boxShadow: '0 8px 24px -4px rgba(16, 185, 129, 0.5)' }}
                                    onClick={() => setIsPaymentOpen(true)}
                                >
                                    <i className="bi bi-wallet2 fs-5"></i>
                                    <span>PAY ₹{netPayable}</span>
                                    <i className="bi bi-arrow-right-short fs-4"></i>
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            ) : (
                /* ==============================================================
                   DESKTOP POS BILLING WORKSPACE: FULL 2-COLUMN LAYOUT
                   ============================================================== */
                <>
            {/* Shift Status Bar / Drawer Alert */}
            {!activeShift ? (
                <div className="card border-warning-subtle bg-warning-subtle shadow-sm mb-3">
                    <div className="card-body p-2 p-md-3">
                        <div className="d-flex flex-column flex-md-row align-items-start align-items-md-center justify-content-between gap-2">
                            <div className="d-flex align-items-center gap-2">
                                <div className="rounded-circle bg-warning text-dark p-2 d-flex align-items-center justify-content-center flex-shrink-0" style={{ width: '36px', height: '36px' }}>
                                    <i className="bi bi-exclamation-triangle-fill fs-6"></i>
                                </div>
                                <div>
                                    <strong className="text-dark d-block">Cash Register Drawer is Closed</strong>
                                    <div className="small text-muted" style={{ fontSize: '0.78rem' }}>
                                        Select your counter below and open drawer to begin billing.
                                    </div>
                                </div>
                            </div>
                            <div className="d-flex flex-column flex-sm-row align-items-stretch align-items-sm-center gap-2 w-100 w-md-auto">
                                <div className="d-flex align-items-center gap-1 bg-white border border-warning rounded px-2 py-1 shadow-sm flex-grow-1 flex-sm-grow-0">
                                    <i className="bi bi-display text-warning"></i>
                                    <span className="small fw-bold text-muted text-uppercase" style={{ fontSize: '0.7rem' }}>Counter:</span>
                                    <select
                                        className="form-select form-select-sm fw-bold border-0 bg-transparent font-mono p-0 text-dark flex-grow-1"
                                        style={{ minWidth: '110px', fontSize: '0.82rem', cursor: 'pointer' }}
                                        value={selectedCounter}
                                        onChange={(e) => handleCounterChange(e.target.value)}
                                    >
                                        {(storeConfig?.counters || ['Counter-01', 'Counter-02', 'Counter-03']).map(c => (
                                            <option key={c} value={c}>{c}</option>
                                        ))}
                                    </select>
                                </div>
                                {onOpenShiftModal && (
                                    <button
                                        type="button"
                                        className="btn btn-warning text-dark fw-bold btn-sm shadow-sm py-2 px-3 text-nowrap d-flex align-items-center justify-content-center gap-1"
                                        onClick={onOpenShiftModal}
                                    >
                                        <i className="bi bi-play-circle-fill"></i>
                                        <span>Start Shift (0 Bills)</span>
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="card border-0 shadow-sm border-start border-primary border-4 bg-white mb-3">
                    <div className="card-body p-2 p-md-3">
                        <div className="d-flex flex-column flex-md-row align-items-start align-items-md-center justify-content-between gap-2">
                            <div className="d-flex align-items-center gap-2 flex-wrap">
                                <span className="badge bg-primary text-white px-2 py-1 fw-bold">
                                    <i className="bi bi-circle-fill small me-1"></i> ACTIVE
                                </span>
                                <strong className="font-mono text-dark">{activeShift.shiftNumber}</strong>

                                <div className="d-flex align-items-center gap-1 bg-light border rounded px-2 py-1 shadow-sm">
                                    <i className="bi bi-display-fill text-primary"></i>
                                    <span className="small fw-bold text-muted text-uppercase" style={{ fontSize: '0.68rem' }}>Desk:</span>
                                    <select
                                        className="form-select form-select-sm fw-bold border-0 bg-transparent font-mono p-0 text-primary"
                                        style={{ minWidth: '100px', fontSize: '0.82rem', cursor: 'pointer' }}
                                        value={selectedCounter}
                                        onChange={(e) => handleCounterChange(e.target.value)}
                                        title="Change current counter desk"
                                    >
                                        {(storeConfig?.counters || ['Counter-01', 'Counter-02', 'Counter-03']).map(c => (
                                            <option key={c} value={c}>{c}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            <div className="d-flex align-items-center gap-1 gap-md-2 font-mono small flex-wrap w-100 w-md-auto justify-content-between justify-content-md-end">
                                <span className="badge bg-light text-dark border">
                                    Bills: <strong>{activeShift.billsCount || 0}</strong>
                                </span>
                                <span className="badge bg-light text-dark border">
                                    Sales: <strong>₹{(activeShift.netSales || 0).toLocaleString('en-IN')}</strong>
                                </span>
                                <span className="badge bg-light text-primary border d-none d-sm-inline">
                                    UPI: <strong>₹{(activeShift.paymentSummary?.upi || 0).toLocaleString('en-IN')}</strong>
                                </span>
                                {onOpenShiftModal && (
                                    <button
                                        type="button"
                                        className="btn btn-outline-secondary btn-sm py-1 px-2 fw-semibold"
                                        onClick={onOpenShiftModal}
                                        title="Drawer & Shift Details"
                                    >
                                        <i className="bi bi-safe me-1"></i> Drawer
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Top Bar: Barcode Scan & Quick Actions */}
            <div className="row g-2 align-items-center mb-3">
                {/* Large Barcode Scanner Input */}
                <div className="col-12 col-md-7">
                    <form onSubmit={handleBarcodeScan}>
                        <div className="barcode-scan-box p-1 d-flex align-items-center">
                            <div className="px-2 px-sm-3 d-flex align-items-center gap-1 text-primary">
                                <span className="scan-pulse"></span>
                                <i className="bi bi-upc-scan fs-5 fs-sm-4"></i>
                            </div>
                            <input
                                ref={barcodeInputRef}
                                type="text"
                                className="form-control form-control-md border-0 shadow-none font-mono fw-bold"
                                placeholder="Scan Barcode / SKU (F2)..."
                                value={barcodeInput}
                                onChange={(e) => setBarcodeInput(e.target.value)}
                                disabled={isLoadingScan}
                                style={{ fontSize: '1rem' }}
                            />
                            <button
                                type="submit"
                                className="btn btn-primary btn-md px-3 fw-bold me-1 flex-shrink-0"
                                disabled={isLoadingScan || !barcodeInput.trim()}
                            >
                                {isLoadingScan ? (
                                    <span className="spinner-border spinner-border-sm"></span>
                                ) : (
                                    <span>Scan</span>
                                )}
                            </button>
                        </div>
                    </form>
                </div>

                {/* Actions: Camera Scanner + Quick Add Loose Item + Held Bills + Clear */}
                <div className="col-12 col-md-5">
                    <div className="row g-1 g-sm-2">
                        <div className="col-3">
                            <button
                                type="button"
                                className={`btn btn-sm w-100 py-2 px-1 fw-bold d-flex flex-column flex-sm-row align-items-center justify-content-center gap-1 rounded-3 shadow-sm ${isCameraScannerOpen ? 'btn-danger text-white' : 'btn-dark text-white'}`}
                                onClick={() => setIsCameraScannerOpen(!isCameraScannerOpen)}
                                title="Toggle Camera Scanner"
                            >
                                <i className={`bi ${isCameraScannerOpen ? 'bi-camera-video-off-fill' : 'bi-camera-fill'}`}></i>
                                <span style={{ fontSize: '0.75rem' }}>{isCameraScannerOpen ? 'Close' : 'Camera'}</span>
                            </button>
                        </div>

                        <div className="col-4">
                            <button
                                type="button"
                                className="btn btn-sm btn-warning text-dark fw-bold w-100 py-2 px-1 d-flex flex-column flex-sm-row align-items-center justify-content-center gap-1 rounded-3 shadow-sm"
                                onClick={() => setIsQuickAddOpen(true)}
                                title="Add Loose Item (by kg/gm/wt)"
                            >
                                <i className="bi bi-plus-circle-fill"></i>
                                <span style={{ fontSize: '0.75rem' }}>+ Loose</span>
                            </button>
                        </div>

                        <div className="col-3">
                            <button
                                type="button"
                                className="btn btn-sm btn-outline-secondary fw-semibold w-100 py-2 px-1 d-flex flex-column flex-sm-row align-items-center justify-content-center gap-1 rounded-3"
                                onClick={() => setIsHeldModalOpen(true)}
                                title="View Held Bills"
                            >
                                <i className="bi bi-pause-circle"></i>
                                <span style={{ fontSize: '0.75rem' }}>Held ({heldBills.length})</span>
                            </button>
                        </div>

                        <div className="col-2">
                            <button
                                type="button"
                                className="btn btn-sm btn-outline-danger fw-semibold w-100 py-2 px-1 d-flex align-items-center justify-content-center rounded-3"
                                onClick={handleClearCart}
                                disabled={cart.length === 0}
                                title="Clear Cart"
                            >
                                <i className="bi bi-trash"></i>
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Scan Feedback Message */}
            {scanMessage && (
                <div className={`alert alert-${scanMessage.type === 'success' ? 'success' : 'danger'} py-2 px-3 mb-3 d-flex align-items-center justify-content-between small shadow-sm`}>
                    <div className="d-flex align-items-center gap-2 flex-wrap">
                        <span className="fw-semibold">
                            <i className={`bi bi-${scanMessage.type === 'success' ? 'check-circle-fill text-success' : 'x-octagon-fill text-danger'} me-2 fs-6`}></i>
                            {scanMessage.text}
                        </span>
                    </div>
                    <button type="button" className="btn-close btn-close-sm" onClick={() => setScanMessage(null)}></button>
                </div>
            )}

            {/* Main Billing Grid */}
            <div className="row g-3">
                {/* LEFT: CART ITEMS TABLE + EMBEDDED NON-BLOCKING CAMERA */}
                <div className="col-xl-8 col-lg-7">
                    {/* Embedded Non-Blocking Live Camera Barcode Scanner */}
                    {isCameraScannerOpen && (
                        <CameraScannerBox
                            containerId="pos-camera-scanner-viewfinder"
                            title="Live Camera Barcode Scanner (Cart active below)"
                            onDetected={(code) => scanBarcodeString(code, true)}
                            onClose={() => setIsCameraScannerOpen(false)}
                            autoCloseOnScan={false}
                        />
                    )}

                    <div className="pos-table-card shadow-sm h-100 d-flex flex-column">
                        <div className="p-3 bg-white border-bottom d-flex align-items-center justify-content-between">
                            <div className="d-flex align-items-center gap-2">
                                <span className="fs-5 fw-bold text-dark">Active Cart</span>
                                <span className="badge bg-primary-subtle text-primary fw-bold px-2 py-1">
                                    {totalItemsCount} Items ({totalQty.toFixed(1)} Qty)
                                </span>
                            </div>
                            <small className="text-muted d-none d-sm-inline">
                                Shortcuts: <kbd>F2</kbd> Scan | <kbd>F4</kbd> Checkout | <kbd>F7</kbd> Hold
                            </small>
                        </div>

                        {/* Cart View: Desktop Data Table (d-none d-md-block) */}
                        <div className="d-none d-md-block table-responsive flex-grow-1 cart-table-wrapper" style={{ minHeight: '260px', maxHeight: 'clamp(300px, 48vh, 560px)', overflowY: 'auto' }}>
                            {cart.length === 0 ? (
                                <div className="text-center py-5">
                                    <div className="display-4 text-muted opacity-50 mb-2">🛒</div>
                                    <h5 className="fw-bold text-secondary">Billing Counter is Ready!</h5>
                                    <p className="text-muted small mb-3">
                                        Scan barcode using barcode gun, or click any sample item below to test:
                                    </p>
                                    <div className="d-flex justify-content-center flex-wrap gap-2 px-3">
                                        {catalog.slice(0, 5).map(p => (
                                            <button
                                                key={p._id}
                                                className="btn btn-sm btn-outline-primary fw-semibold shadow-sm"
                                                onClick={() => addProductToCart(p)}
                                            >
                                                + {p.name.split(' ')[0]} ({p.unit}) ₹{p.sellingPrice}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                <table className="table pos-table mb-0 align-middle">
                                    <thead>
                                        <tr>
                                            <th style={{ width: '5%' }}>#</th>
                                            <th style={{ width: '38%' }}>Item Details</th>
                                            <th style={{ width: '10%' }}>Unit</th>
                                            <th style={{ width: '15%' }} className="text-center">Quantity / Wt</th>
                                            <th style={{ width: '12%' }} className="text-end">MRP</th>
                                            <th style={{ width: '12%' }} className="text-end">Our Rate</th>
                                            <th style={{ width: '13%' }} className="text-end">Total</th>
                                            <th style={{ width: '5%' }} className="text-center">Del</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {cart.map((item, idx) => (
                                            <tr key={idx} className="cart-item-row">
                                                <td className="text-muted small fw-bold">{idx + 1}</td>
                                                <td>
                                                    <div className="fw-bold text-dark text-truncate" style={{ maxWidth: '280px' }}>
                                                        {item.name}
                                                    </div>
                                                    <div className="d-flex align-items-center gap-2 mt-1">
                                                        <span className="font-mono text-muted small" style={{ fontSize: '0.75rem' }}>
                                                            {item.barcode}
                                                        </span>
                                                        {item.discount > 0 && (
                                                            <span className="savings-pill">
                                                                Save ₹{item.discount}
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td>
                                                    <span className="badge bg-light text-dark border fw-semibold">
                                                        {item.unit}
                                                    </span>
                                                </td>
                                                <td className="text-center">
                                                    <div className="input-group input-group-sm justify-content-center" style={{ width: '110px', margin: '0 auto' }}>
                                                        <button
                                                            className="btn btn-outline-secondary px-2"
                                                            type="button"
                                                            onClick={() => {
                                                                const cur = Number(item.quantity) || 1;
                                                                if (cur > 1) {
                                                                    handleUpdateQuantity(idx, cur - 1);
                                                                }
                                                            }}
                                                        >
                                                            -
                                                        </button>
                                                        <input
                                                            type="number"
                                                            step="0.01"
                                                            className="form-control text-center font-mono fw-bold px-1"
                                                            value={item.quantity}
                                                            onChange={(e) => handleUpdateQuantity(idx, e.target.value)}
                                                            onBlur={() => handleQuantityBlur(idx)}
                                                        />
                                                        <button
                                                            className="btn btn-outline-secondary px-2"
                                                            type="button"
                                                            onClick={() => {
                                                                const cur = Number(item.quantity) || 0;
                                                                handleUpdateQuantity(idx, cur + 1);
                                                            }}
                                                        >
                                                            +
                                                        </button>
                                                    </div>
                                                </td>
                                                <td className="text-end">
                                                    <span className="price-strike font-mono">
                                                        ₹{item.mrp}
                                                    </span>
                                                </td>
                                                <td className="text-end">
                                                    <span className="price-sp font-mono">
                                                        ₹{item.sellingPrice}
                                                    </span>
                                                </td>
                                                <td className="text-end font-mono fw-bolder fs-6 text-dark">
                                                    ₹{item.total}
                                                </td>
                                                <td className="text-center">
                                                    <button
                                                        type="button"
                                                        className="btn btn-sm btn-link text-danger p-0"
                                                        onClick={() => handleRemoveItem(idx)}
                                                        title="Remove"
                                                    >
                                                        <i className="bi bi-trash fs-6"></i>
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>

                        {/* Cart View: Native Mobile App Cards (d-block d-md-none) */}
                        <div className="d-block d-md-none p-2 flex-grow-1" style={{ minHeight: '220px', maxHeight: 'clamp(260px, 45vh, 460px)', overflowY: 'auto' }}>
                            {cart.length === 0 ? (
                                <div className="text-center py-4">
                                    <div className="fs-1 text-muted opacity-50 mb-1">🛒</div>
                                    <h6 className="fw-bold text-secondary">Billing Counter is Ready</h6>
                                    <p className="text-muted small mb-2" style={{ fontSize: '0.78rem' }}>
                                        Scan barcode with camera or tap any quick sample below:
                                    </p>
                                    <div className="d-flex justify-content-center flex-wrap gap-1 px-1">
                                        {catalog.slice(0, 5).map(p => (
                                            <button
                                                key={p._id}
                                                className="btn btn-sm btn-outline-primary fw-semibold shadow-sm py-1 px-2"
                                                style={{ fontSize: '0.75rem' }}
                                                onClick={() => addProductToCart(p)}
                                            >
                                                + {p.name.split(' ')[0]} ({p.unit}) ₹{p.sellingPrice}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                <div className="d-flex flex-column gap-2">
                                    {cart.map((item, idx) => (
                                        <div key={idx} className="mobile-cart-card p-2">
                                            <div className="d-flex justify-content-between align-items-start mb-1">
                                                <div className="pe-1 text-truncate" style={{ maxWidth: '85%' }}>
                                                    <div className="fw-bold text-dark text-truncate" style={{ fontSize: '0.88rem' }}>
                                                        {item.name}
                                                    </div>
                                                    <div className="d-flex align-items-center gap-1 mt-1 flex-wrap">
                                                        <span className="badge bg-light text-muted border font-mono" style={{ fontSize: '0.65rem' }}>
                                                            {item.barcode}
                                                        </span>
                                                        <span className="badge bg-light text-dark border" style={{ fontSize: '0.65rem' }}>
                                                            {item.unit}
                                                        </span>
                                                        {item.discount > 0 && (
                                                            <span className="savings-pill" style={{ fontSize: '0.65rem', padding: '1px 5px' }}>
                                                                Save ₹{item.discount}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                                <button
                                                    type="button"
                                                    className="btn btn-sm btn-link text-danger p-0"
                                                    onClick={() => handleRemoveItem(idx)}
                                                    title="Remove Item"
                                                >
                                                    <i className="bi bi-trash fs-5"></i>
                                                </button>
                                            </div>

                                            <div className="d-flex justify-content-between align-items-center pt-2 border-top mt-1">
                                                <div>
                                                    <span className="text-muted text-decoration-line-through small me-1 font-mono" style={{ fontSize: '0.75rem' }}>
                                                        ₹{item.mrp}
                                                    </span>
                                                    <span className="fw-bold text-dark font-mono" style={{ fontSize: '0.95rem' }}>
                                                        ₹{item.sellingPrice}
                                                    </span>
                                                    <span className="text-muted small" style={{ fontSize: '0.75rem' }}> / {item.unit}</span>
                                                </div>

                                                <div className="d-flex align-items-center gap-2">
                                                    <div className="input-group input-group-sm" style={{ width: '105px' }}>
                                                        <button
                                                            className="btn btn-outline-secondary mobile-stepper-btn px-2"
                                                            type="button"
                                                            onClick={() => {
                                                                const cur = Number(item.quantity) || 1;
                                                                if (cur > 1) handleUpdateQuantity(idx, cur - 1);
                                                            }}
                                                        >
                                                            -
                                                        </button>
                                                        <input
                                                            type="number"
                                                            step="0.01"
                                                            className="form-control text-center font-mono fw-bold px-1"
                                                            value={item.quantity}
                                                            onChange={(e) => handleUpdateQuantity(idx, e.target.value)}
                                                            onBlur={() => handleQuantityBlur(idx)}
                                                            style={{ fontSize: '0.85rem' }}
                                                        />
                                                        <button
                                                            className="btn btn-outline-secondary mobile-stepper-btn px-2"
                                                            type="button"
                                                            onClick={() => {
                                                                const cur = Number(item.quantity) || 0;
                                                                handleUpdateQuantity(idx, cur + 1);
                                                            }}
                                                        >
                                                            +
                                                        </button>
                                                    </div>
                                                    <div className="fw-bolder font-mono text-dark text-end" style={{ minWidth: '55px', fontSize: '0.95rem' }}>
                                                        ₹{item.total}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Quick Visual Shelf / Fast Pick Bar */}
                        <div className="p-2 bg-light border-top">
                            <div className="d-flex align-items-center justify-content-between mb-2">
                                <span className="small fw-bold text-muted text-uppercase">
                                    <i className="bi bi-grid-3x3-gap me-1"></i> Quick Pick Shelf:
                                </span>
                                <div className="d-flex gap-1 overflow-auto" style={{ maxWidth: '70%' }}>
                                    {categories.slice(0, 4).map(cat => (
                                        <button
                                            key={cat}
                                            type="button"
                                            className={`btn btn-xs py-0 px-2 rounded-pill small ${selectedCategory === cat ? 'btn-primary text-white' : 'btn-outline-secondary'}`}
                                            onClick={() => setSelectedCategory(cat)}
                                            style={{ fontSize: '0.72rem', whiteSpace: 'nowrap' }}
                                        >
                                            {cat}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="d-flex gap-2 overflow-auto py-1" style={{ whiteSpace: 'nowrap' }}>
                                {filteredCatalog.slice(0, 8).map(prod => (
                                    <button
                                        key={prod._id}
                                        type="button"
                                        className="btn btn-sm btn-white bg-white border text-start shadow-sm flex-shrink-0"
                                        style={{ width: '150px' }}
                                        onClick={() => addProductToCart(prod)}
                                    >
                                        <div className="text-truncate fw-bold text-dark small">{prod.name}</div>
                                        <div className="d-flex justify-content-between align-items-center mt-1">
                                            <span className="badge bg-light text-muted small">{prod.unit}</span>
                                            <span className="text-primary fw-bold font-mono small">₹{prod.sellingPrice}</span>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* RIGHT: BILL SUMMARY & CHECKOUT */}
                <div className="col-xl-4 col-lg-5">
                    <div className="pos-summary-card p-3 d-flex flex-column justify-content-between" style={{ minHeight: '100%' }}>
                        <div>
                            {/* Customer Details Box */}
                            <div className="bg-white p-3 rounded-3 border mb-3 shadow-sm">
                                <div className="d-flex justify-content-between align-items-center mb-2">
                                    <span className="fw-bold small text-muted text-uppercase">
                                        <i className="bi bi-person me-1"></i> Customer Info (Optional)
                                    </span>
                                </div>
                                <div className="row g-2">
                                    <div className="col-6">
                                        <input
                                            type="tel"
                                            className="form-control form-control-sm font-mono"
                                            placeholder="Mobile Number"
                                            value={customerPhone}
                                            onChange={(e) => setCustomerPhone(e.target.value)}
                                        />
                                    </div>
                                    <div className="col-6">
                                        <input
                                            type="text"
                                            className="form-control form-control-sm"
                                            placeholder="Customer Name"
                                            value={customerName}
                                            onChange={(e) => setCustomerName(e.target.value)}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Price Breakdown */}
                            <div className="bg-white p-3 rounded-3 border mb-3 shadow-sm">
                                <div className="d-flex justify-content-between text-muted mb-2">
                                    <span>Total Items:</span>
                                    <span className="fw-semibold text-dark font-mono">{totalItemsCount} items</span>
                                </div>
                                <div className="d-flex justify-content-between text-muted mb-2">
                                    <span>Total Quantity:</span>
                                    <span className="fw-semibold text-dark font-mono">{totalQty.toFixed(2)} units</span>
                                </div>
                                <div className="d-flex justify-content-between text-muted mb-2">
                                    <span>Gross MRP Value:</span>
                                    <span className="fw-semibold text-dark font-mono">₹{grossMrpTotal.toFixed(2)}</span>
                                </div>

                                {/* Total Savings Banner */}
                                <div className="d-flex justify-content-between align-items-center p-2 rounded-2 bg-primary-subtle text-primary fw-bold mb-2">
                                    <div className="d-flex align-items-center gap-1">
                                        <i className="bi bi-tag-fill"></i>
                                        <span>Total Savings:</span>
                                    </div>
                                    <span className="fs-6 font-mono">-₹{totalSavings.toFixed(2)}</span>
                                </div>

                                {/* Detailed GST Tax Counts */}
                                <div className="d-flex justify-content-between text-muted small pt-1 border-top">
                                    <span>Taxable Net Turnover:</span>
                                    <span className="font-mono fw-semibold">₹{taxableAmount.toFixed(2)}</span>
                                </div>
                                <div className="d-flex justify-content-between text-muted small">
                                    <span>CGST (Central Tax):</span>
                                    <span className="font-mono">₹{cgstAmount.toFixed(2)}</span>
                                </div>
                                <div className="d-flex justify-content-between text-muted small">
                                    <span>SGST (State Tax):</span>
                                    <span className="font-mono">₹{sgstAmount.toFixed(2)}</span>
                                </div>
                                <div className="d-flex justify-content-between text-success small fw-bold pb-1">
                                    <span>Total GST Included:</span>
                                    <span className="font-mono">₹{totalTaxAmount.toFixed(2)}</span>
                                </div>
                            </div>

                            {/* Grand Total Banner */}
                            <div className="grand-total-banner mb-3 text-center">
                                <div className="text-white-50 small text-uppercase fw-bold letter-spacing-1">
                                    Net Payable Amount
                                </div>
                                <div className="display-5 fw-bolder font-mono my-1">
                                    ₹{netPayable.toLocaleString('en-IN')}
                                </div>
                                <small className="text-white-50">
                                    Includes all retail taxes &amp; store discounts
                                </small>
                            </div>
                        </div>

                        {/* Action Buttons */}
                        <div>
                            <div className="d-flex gap-2 mb-2">
                                <button
                                    type="button"
                                    className="btn btn-outline-warning w-50 py-2 fw-bold text-warning"
                                    onClick={handleHoldBill}
                                    disabled={cart.length === 0}
                                    title="Hold Bill (F7)"
                                >
                                    <i className="bi bi-pause-circle me-1"></i> Hold Bill (F7)
                                </button>
                                <button
                                    type="button"
                                    className="btn btn-outline-danger w-50 py-2 fw-semibold"
                                    onClick={handleClearCart}
                                    disabled={cart.length === 0}
                                >
                                    <i className="bi bi-x-circle me-1"></i> Clear Cart
                                </button>
                            </div>

                            {/* Big Checkout Button */}
                            <button
                                type="button"
                                className="btn btn-success btn-lg w-100 py-3 fw-bolder shadow-sm d-flex align-items-center justify-content-center gap-2"
                                style={{ fontSize: '1.25rem', letterSpacing: '0.5px' }}
                                onClick={() => setIsPaymentOpen(true)}
                                disabled={cart.length === 0}
                            >
                                <i className="bi bi-wallet2 fs-4"></i>
                                <span>PAY &amp; SPLIT BILL (F4)</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
            </>
            )}

            {/* Split Payment Modal */}
            <SplitPaymentModal
                isOpen={isPaymentOpen}
                onClose={() => setIsPaymentOpen(false)}
                netPayable={netPayable}
                storeConfig={storeConfig}
                onCompletePayment={handleCompletePayment}
            />

            {/* Thermal Receipt Modal */}
            <ReceiptModal
                isOpen={isReceiptOpen}
                onClose={() => setIsReceiptOpen(false)}
                bill={completedBill}
                storeConfig={storeConfig}
            />

            {/* Quick Add Custom Item Modal */}
            <QuickAddModal
                isOpen={isQuickAddOpen}
                onClose={() => setIsQuickAddOpen(false)}
                onAddItem={handleQuickAdd}
            />

            {/* Held Bills Modal */}
            <HeldBillsModal
                isOpen={isHeldModalOpen}
                onClose={() => setIsHeldModalOpen(false)}
                heldBills={heldBills}
                onResumeBill={handleResumeBill}
                onDeleteHeld={handleDeleteHeld}
            />
        </div>
    );
}

