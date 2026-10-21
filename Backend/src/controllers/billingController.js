const { getStore, saveStore, getStoreId } = require('../store/dataStore');

// Generate unique bill number (INV-YYYYMMDD-XXXX)
function generateBillNumber() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const rand = Math.floor(1000 + Math.random() * 9000);
    return `INV-${y}${m}${d}-${rand}`;
}

// CHECKOUT / GENERATE BILL
const checkout = async (req, res) => {
    try {
        const store = getStore();
        const storeId = req.body.storeId || getStoreId(req);
        const storeInfo = (store.stores || []).find(s => s._id === storeId) || store.storeConfig;

        const {
            cashierId,
            cashierName = 'Cashier',
            counterNo = 'Counter-01',
            shiftId,
            customerName = 'Walk-in Customer',
            customerPhone = '',
            items,
            paymentMethod = 'CASH', // CASH, UPI, CARD, SPLIT
            splitBreakdown = { cashAmount: 0, upiAmount: 0, cardAmount: 0 },
            cashTendered = 0
        } = req.body;

        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ success: false, message: 'Cart items cannot be empty.' });
        }

        // Calculate totals
        let subtotal = 0;
        let grossMrpTotal = 0;
        let totalSavings = 0;
        let taxAmount = 0;
        let taxableAmount = 0;
        const gstBreakdown = {};

        const processedItems = items.map(item => {
            const qty = Number(item.quantity) || 1;
            const mrp = Number(item.mrp) || Number(item.sellingPrice) || 0;
            const sp = Number(item.sellingPrice) || 0;
            const itemGross = mrp * qty;
            const itemTotal = sp * qty;
            const discount = Math.max(0, itemGross - itemTotal);
            const taxPct = Number(item.taxPercent) || 0;
            const itemTax = (itemTotal * taxPct) / (100 + taxPct); // Tax included in MRP/Selling Price
            const itemTaxable = itemTotal - itemTax;
            const itemCgst = itemTax / 2;
            const itemSgst = itemTax / 2;

            grossMrpTotal += itemGross;
            subtotal += itemTotal;
            totalSavings += discount;
            taxAmount += itemTax;
            taxableAmount += itemTaxable;

            // Group by GST rate slab
            const slabKey = `${taxPct}%`;
            if (!gstBreakdown[slabKey]) {
                gstBreakdown[slabKey] = { rate: taxPct, taxable: 0, cgst: 0, sgst: 0, totalTax: 0 };
            }
            gstBreakdown[slabKey].taxable = Number((gstBreakdown[slabKey].taxable + itemTaxable).toFixed(2));
            gstBreakdown[slabKey].cgst = Number((gstBreakdown[slabKey].cgst + itemCgst).toFixed(2));
            gstBreakdown[slabKey].sgst = Number((gstBreakdown[slabKey].sgst + itemSgst).toFixed(2));
            gstBreakdown[slabKey].totalTax = Number((gstBreakdown[slabKey].totalTax + itemTax).toFixed(2));

            // Deduct stock in inventory ONLY for this specific store
            const prod = (store.products || []).find(
                p => (p.barcode === item.barcode || p._id === item.productId) &&
                     (p.storeId || 'store_default') === storeId
            );
            if (prod) {
                prod.stock = Math.max(0, Number(prod.stock) - qty);
            }

            return {
                productId: item.productId || (prod ? prod._id : null),
                barcode: item.barcode || '',
                name: item.name || 'Item',
                unit: item.unit || 'pc',
                quantity: qty,
                mrp: mrp,
                sellingPrice: sp,
                discount: Number(discount.toFixed(2)),
                total: Number(itemTotal.toFixed(2)),
                taxPercent: taxPct,
                taxableValue: Number(itemTaxable.toFixed(2)),
                cgstAmount: Number(itemCgst.toFixed(2)),
                sgstAmount: Number(itemSgst.toFixed(2))
            };
        });

        const netPayable = Math.round(subtotal);

        // Validate payment amounts
        let finalSplit = {
            cashAmount: 0,
            upiAmount: 0,
            cardAmount: 0
        };

        if (paymentMethod === 'CASH') {
            finalSplit.cashAmount = netPayable;
        } else if (paymentMethod === 'UPI') {
            finalSplit.upiAmount = netPayable;
        } else if (paymentMethod === 'CARD') {
            finalSplit.cardAmount = netPayable;
        } else if (paymentMethod === 'SPLIT') {
            finalSplit.cashAmount = Number(splitBreakdown.cashAmount) || 0;
            finalSplit.upiAmount = Number(splitBreakdown.upiAmount) || 0;
            finalSplit.cardAmount = Number(splitBreakdown.cardAmount) || 0;

            const totalSplitEntered = finalSplit.cashAmount + finalSplit.upiAmount + finalSplit.cardAmount;
            if (Math.abs(totalSplitEntered - netPayable) > 1) { // allow +/- 1 round off
                return res.status(400).json({
                    success: false,
                    message: `Split payment mismatch. Total entered ₹${totalSplitEntered} does not equal net bill ₹${netPayable}.`
                });
            }
        }

        // Cash change calculation
        let changeReturned = 0;
        const tendered = Number(cashTendered) || finalSplit.cashAmount;
        if (finalSplit.cashAmount > 0 && tendered >= finalSplit.cashAmount) {
            changeReturned = Math.max(0, tendered - finalSplit.cashAmount);
        }

        // Find or create active shift for cashier
        let activeShift = null;
        if (shiftId) {
            activeShift = store.shifts.find(s => s._id === shiftId && s.status === 'ACTIVE');
        }
        if (!activeShift) {
            activeShift = store.shifts.find(s =>
                (s.cashierId === cashierId || s.cashierName === cashierName) &&
                s.status === 'ACTIVE' &&
                (s.storeId || 'store_default') === storeId
            );
        }

        // If no active shift, auto-create one with default 2000 float starting at 0 bills
        if (!activeShift) {
            const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
            const shiftSeq = (store.shifts || []).filter(s => (s.storeId || 'store_default') === storeId).length + 1;
            activeShift = {
                _id: `shift_${Date.now()}`,
                storeId,
                shiftNumber: `SH-${dateStr}-${String(shiftSeq).padStart(2, '0')}`,
                cashierId: cashierId || 'usr_cashier1',
                cashierName: cashierName || 'Rahul Sharma',
                counterNo: counterNo || 'Counter-01',
                startTime: new Date().toISOString(),
                endTime: null,
                status: 'ACTIVE',
                openingFloat: 2000,
                billsCount: 0,
                grossSales: 0,
                totalDiscount: 0,
                netSales: 0,
                paymentSummary: { cash: 0, cashCount: 0, upi: 0, upiCount: 0, card: 0, cardCount: 0 },
                expectedCashInDrawer: 2000,
                physicalCashHandedOver: 0,
                cashDifference: 0,
                tallyStatus: 'PENDING',
                denominations: {},
                officerVerifiedBy: '',
                officerNotes: '',
                verifiedAt: null
            };
            store.shifts.unshift(activeShift);
        }

        // Update active shift tally
        activeShift.billsCount = (Number(activeShift.billsCount) || 0) + 1;
        activeShift.grossSales = (Number(activeShift.grossSales) || 0) + grossMrpTotal;
        activeShift.totalDiscount = (Number(activeShift.totalDiscount) || 0) + totalSavings;
        activeShift.netSales = (Number(activeShift.netSales) || 0) + netPayable;

        if (!activeShift.paymentSummary) {
            activeShift.paymentSummary = { cash: 0, cashCount: 0, upi: 0, upiCount: 0, card: 0, cardCount: 0 };
        }
        if (finalSplit.cashAmount > 0) {
            activeShift.paymentSummary.cash = (Number(activeShift.paymentSummary.cash) || 0) + finalSplit.cashAmount;
            activeShift.paymentSummary.cashCount = (Number(activeShift.paymentSummary.cashCount) || 0) + 1;
        }
        if (finalSplit.upiAmount > 0) {
            activeShift.paymentSummary.upi = (Number(activeShift.paymentSummary.upi) || 0) + finalSplit.upiAmount;
            activeShift.paymentSummary.upiCount = (Number(activeShift.paymentSummary.upiCount) || 0) + 1;
        }
        if (finalSplit.cardAmount > 0) {
            activeShift.paymentSummary.card = (Number(activeShift.paymentSummary.card) || 0) + finalSplit.cardAmount;
            activeShift.paymentSummary.cardCount = (Number(activeShift.paymentSummary.cardCount) || 0) + 1;
        }
        activeShift.expectedCashInDrawer = (Number(activeShift.openingFloat) || 0) + (activeShift.paymentSummary.cash || 0);

        // Create new bill with dynamic store details
        const newBill = {
            _id: `bill_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
            billNumber: generateBillNumber(),
            storeId,
            storeName: storeInfo?.storeName || 'SuperStore',
            storeType: storeInfo?.storeType || 'Supermarket',
            storeAddress: storeInfo?.address || '',
            storeContact: storeInfo?.contact || '',
            storeGstin: storeInfo?.gstin || '',
            storeTagline: storeInfo?.receiptTagline || 'Thank you for shopping with us! Visit again.',
            counterNo,
            cashierName,
            cashierId: activeShift.cashierId,
            shiftId: activeShift._id,
            customerName: customerName.trim(),
            customerPhone: customerPhone.trim(),
            items: processedItems,
            grossMrpTotal: Number(grossMrpTotal.toFixed(2)),
            subtotal: Number(subtotal.toFixed(2)),
            totalSavings: Number(totalSavings.toFixed(2)),
            taxableAmount: Number(taxableAmount.toFixed(2)),
            cgstAmount: Number((taxAmount / 2).toFixed(2)),
            sgstAmount: Number((taxAmount / 2).toFixed(2)),
            taxAmount: Number(taxAmount.toFixed(2)),
            gstBreakdown: gstBreakdown,
            netPayable: netPayable,
            paymentMethod,
            splitBreakdown: finalSplit,
            cashTendered: tendered,
            changeReturned: changeReturned,
            status: 'COMPLETED',
            createdAt: new Date().toISOString()
        };

        if (!store.bills) store.bills = [];
        store.bills.unshift(newBill);
        saveStore();

        res.status(201).json({
            success: true,
            message: 'Bill created successfully.',
            bill: newBill,
            shiftUpdated: {
                shiftNumber: activeShift.shiftNumber,
                billsCount: activeShift.billsCount,
                netSales: activeShift.netSales,
                expectedCashInDrawer: activeShift.expectedCashInDrawer
            }
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
};

// GET ALL BILLS (Scoped to Store)
const getBills = async (req, res) => {
    try {
        const store = getStore();
        const storeId = getStoreId(req);
        const { date, cashierId, shiftId, paymentMethod, search, limit = 50 } = req.query;

        let bills = (store.bills || []).filter(
            b => (b.storeId || 'store_default') === storeId
        );

        if (shiftId && shiftId !== 'ALL') {
            bills = bills.filter(b => b.shiftId === shiftId);
        }

        if (cashierId && cashierId !== 'ALL') {
            bills = bills.filter(b => b.cashierId === cashierId || b.cashierName === cashierId);
        }

        if (paymentMethod && paymentMethod !== 'ALL') {
            bills = bills.filter(b => b.paymentMethod === paymentMethod);
        }

        if (search) {
            const q = search.toLowerCase();
            bills = bills.filter(b =>
                b.billNumber.toLowerCase().includes(q) ||
                (b.customerPhone && b.customerPhone.includes(q)) ||
                (b.customerName && b.customerName.toLowerCase().includes(q))
            );
        }

        if (date) {
            bills = bills.filter(b => b.createdAt.startsWith(date));
        }

        // Sort latest first
        bills.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        const sliced = bills.slice(0, Number(limit));

        res.status(200).json({
            success: true,
            count: sliced.length,
            totalBills: bills.length,
            bills: sliced
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
};

// GET SINGLE BILL
const getBillById = async (req, res) => {
    try {
        const { id } = req.params;
        const store = getStore();
        const bill = (store.bills || []).find(b => b._id === id || b.billNumber === id);

        if (!bill) {
            return res.status(404).json({ success: false, message: 'Bill not found.' });
        }

        res.status(200).json({ success: true, bill });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
};

// HOLD BILL (Scoped to Store)
const holdBill = async (req, res) => {
    try {
        const store = getStore();
        const storeId = req.body.storeId || getStoreId(req);
        const { cashierId, cashierName, counterNo, customerName, customerPhone, items } = req.body;

        if (!items || items.length === 0) {
            return res.status(400).json({ success: false, message: 'No items to hold.' });
        }

        const heldItem = {
            _id: `held_${Date.now()}`,
            storeId,
            heldAt: new Date().toISOString(),
            cashierId,
            cashierName,
            counterNo,
            customerName: customerName || 'Held Customer',
            customerPhone: customerPhone || '',
            items
        };

        if (!store.heldBills) store.heldBills = [];
        store.heldBills.unshift(heldItem);
        saveStore();

        res.status(201).json({
            success: true,
            message: 'Cart placed on hold.',
            heldBill: heldItem
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
};

// GET HELD BILLS (Scoped to Store)
const getHeldBills = async (req, res) => {
    try {
        const store = getStore();
        const storeId = getStoreId(req);
        const held = (store.heldBills || []).filter(h => (h.storeId || 'store_default') === storeId);

        res.status(200).json({
            success: true,
            heldBills: held
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
};

// RECALL / DELETE HELD BILL
const deleteHeldBill = async (req, res) => {
    try {
        const { id } = req.params;
        const store = getStore();
        store.heldBills = (store.heldBills || []).filter(h => h._id !== id);
        saveStore();
        res.status(200).json({ success: true, message: 'Held cart removed.' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
};

module.exports = {
    checkout,
    getBills,
    getBillById,
    holdBill,
    getHeldBills,
    deleteHeldBill
};
