const { getStore, saveStore, getStoreId } = require('../store/dataStore');

// Helper to calculate exact counts and totals for shift bills
function enrichShiftWithBillMetrics(shift, store) {
    if (!shift) return null;
    const shiftBills = store.bills ? store.bills.filter(b => b.shiftId === shift._id) : [];

    let cashTotal = 0, cashCount = 0;
    let upiTotal = 0, upiCount = 0;
    let cardTotal = 0, cardCount = 0;
    let grossSales = 0, totalDiscount = 0, netSales = 0;

    shiftBills.forEach(b => {
        const net = Number(b.netPayable) || 0;
        const savings = Number(b.totalSavings) || 0;
        const gross = Number(b.grossMrpTotal) || (net + savings);

        netSales += net;
        grossSales += gross;
        totalDiscount += savings;

        if (b.paymentMethod === 'CASH') {
            cashTotal += net;
            cashCount++;
        } else if (b.paymentMethod === 'UPI') {
            upiTotal += net;
            upiCount++;
        } else if (b.paymentMethod === 'CARD') {
            cardTotal += net;
            cardCount++;
        } else if (b.paymentMethod === 'SPLIT' && b.splitBreakdown) {
            const sc = Number(b.splitBreakdown.cashAmount) || 0;
            const su = Number(b.splitBreakdown.upiAmount) || 0;
            const sa = Number(b.splitBreakdown.cardAmount) || 0;
            if (sc > 0) { cashTotal += sc; cashCount++; }
            if (su > 0) { upiTotal += su; upiCount++; }
            if (sa > 0) { cardTotal += sa; cardCount++; }
        }
    });

    // If shift had previously recorded counts but no matching bills array (e.g. mock seed), preserve fallback
    if (shiftBills.length > 0) {
        shift.billsCount = shiftBills.length;
        shift.grossSales = grossSales;
        shift.totalDiscount = totalDiscount;
        shift.netSales = netSales;
        shift.paymentSummary = {
            cash: cashTotal,
            cashCount,
            upi: upiTotal,
            upiCount,
            card: cardTotal,
            cardCount
        };
    } else {
        if (!shift.paymentSummary) {
            shift.paymentSummary = { cash: 0, cashCount: 0, upi: 0, upiCount: 0, card: 0, cardCount: 0 };
        }
        if (shift.paymentSummary.cashCount === undefined) shift.paymentSummary.cashCount = shift.paymentSummary.cash > 0 ? 1 : 0;
        if (shift.paymentSummary.upiCount === undefined) shift.paymentSummary.upiCount = shift.paymentSummary.upi > 0 ? 1 : 0;
        if (shift.paymentSummary.cardCount === undefined) shift.paymentSummary.cardCount = shift.paymentSummary.card > 0 ? 1 : 0;
    }

    shift.expectedCashInDrawer = (Number(shift.openingFloat) || 0) + (Number(shift.paymentSummary.cash) || 0);
    return shift;
}

// 1. GET ACTIVE SHIFT FOR CASHIER
const getActiveShift = async (req, res) => {
    try {
        const { cashierId } = req.params;
        const store = getStore();
        const storeId = getStoreId(req);

        const activeShift = (store.shifts || []).find(s =>
            (s.cashierId === cashierId || s.cashierName === cashierId) &&
            s.status === 'ACTIVE' &&
            (s.storeId || 'store_default') === storeId
        );

        if (!activeShift) {
            return res.status(200).json({
                success: true,
                hasActiveShift: false,
                shift: null,
                message: 'No active shift found. Open a new register shift to start billing.'
            });
        }

        enrichShiftWithBillMetrics(activeShift, store);

        res.status(200).json({
            success: true,
            hasActiveShift: true,
            shift: activeShift
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
};

// 2. START NEW SHIFT (Open Drawer with Float Cash)
const startShift = async (req, res) => {
    try {
        const store = getStore();
        const storeId = req.body.storeId || getStoreId(req);
        const {
            cashierId = 'usr_cashier1',
            cashierName = 'Rahul Sharma',
            counterNo = 'Counter-01',
            openingFloat = 2000
        } = req.body;

        // Check if cashier already has an active shift
        const existing = (store.shifts || []).find(s =>
            (s.cashierId === cashierId || s.cashierName === cashierName) &&
            s.status === 'ACTIVE' &&
            (s.storeId || 'store_default') === storeId
        );

        if (existing) {
            return res.status(400).json({
                success: false,
                message: `Active shift (${existing.shiftNumber}) is already running on ${existing.counterNo}. Close the current shift first.`,
                shift: existing
            });
        }

        const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        const shiftSeq = (store.shifts || []).filter(s => (s.storeId || 'store_default') === storeId).length + 1;
        const newShift = {
            _id: `shift_${Date.now()}`,
            storeId,
            shiftNumber: `SH-${dateStr}-${String(shiftSeq).padStart(2, '0')}`,
            cashierId,
            cashierName,
            counterNo,
            startTime: new Date().toISOString(),
            endTime: null,
            status: 'ACTIVE',
            openingFloat: Number(openingFloat) || 0,
            billsCount: 0,
            grossSales: 0,
            totalDiscount: 0,
            netSales: 0,
            paymentSummary: {
                cash: 0,
                cashCount: 0,
                upi: 0,
                upiCount: 0,
                card: 0,
                cardCount: 0
            },
            expectedCashInDrawer: Number(openingFloat) || 0,
            physicalCashHandedOver: 0,
            cashDifference: 0,
            tallyStatus: 'PENDING',
            denominations: {},
            handoverToOfficerId: '',
            handoverToOfficerName: '',
            officerVerifiedBy: '',
            officerNotes: '',
            verifiedAt: null
        };

        store.shifts.unshift(newShift);
        saveStore();

        res.status(201).json({
            success: true,
            message: `Shift opened successfully on ${counterNo} with opening float of ₹${openingFloat}.`,
            shift: newShift
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
};

// 3. CLOSE SHIFT / CASHIER CASH HANDOVER (With Denominations 500 to 1 & Officer Assignment)
const closeShift = async (req, res) => {
    try {
        const { shiftId } = req.params;
        const {
            denominations = {},
            physicalCashSubmitted,
            cashierNotes = '',
            handoverToOfficerId = '',
            handoverToOfficerName = ''
        } = req.body;
        const store = getStore();

        const shift = store.shifts.find(s => s._id === shiftId || s.shiftNumber === shiftId);
        if (!shift) {
            return res.status(404).json({ success: false, message: 'Shift not found.' });
        }

        if (shift.status !== 'ACTIVE') {
            return res.status(400).json({
                success: false,
                message: `Shift is already in status: ${shift.status}.`
            });
        }

        // Recompute metrics from bills
        enrichShiftWithBillMetrics(shift, store);

        // Denominations weights from ₹500 down to ₹1 + coins
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

        let calcFromDenom = 0;
        Object.entries(denominations).forEach(([d, count]) => {
            const w = denomWeights[d] !== undefined ? denomWeights[d] : (Number(d) || 0);
            calcFromDenom += (Number(count) || 0) * w;
        });

        const actualPhysicalCash = physicalCashSubmitted !== undefined && physicalCashSubmitted !== null
            ? Number(physicalCashSubmitted)
            : calcFromDenom;

        const expectedCash = (Number(shift.openingFloat) || 0) + (Number(shift.paymentSummary.cash) || 0);
        const difference = actualPhysicalCash - expectedCash;

        let tallyStatus = 'TALLIED';
        if (difference < -1) {
            tallyStatus = 'SHORTAGE'; // Physical cash less than expected
        } else if (difference > 1) {
            tallyStatus = 'EXCESS'; // Physical cash more than expected
        }

        shift.endTime = new Date().toISOString();
        shift.status = 'CLOSED_PENDING_APPROVAL';
        shift.expectedCashInDrawer = expectedCash;
        shift.physicalCashHandedOver = actualPhysicalCash;
        shift.cashDifference = difference;
        shift.tallyStatus = tallyStatus;
        shift.denominations = denominations;
        shift.handoverToOfficerId = handoverToOfficerId;
        shift.handoverToOfficerName = handoverToOfficerName;
        if (cashierNotes) {
            shift.officerNotes = `[Cashier Remarks: ${cashierNotes}]`;
        }

        saveStore();

        res.status(200).json({
            success: true,
            message: `Shift closed. Cash handover of ₹${actualPhysicalCash} submitted to Cash Officer (${handoverToOfficerName || handoverToOfficerId || 'Vault'}). Reconciliation is pending Cash Officer audit.`,
            shift: {
                _id: shift._id,
                shiftNumber: shift.shiftNumber,
                cashierId: shift.cashierId,
                cashierName: shift.cashierName,
                counterNo: shift.counterNo,
                startTime: shift.startTime,
                endTime: shift.endTime,
                status: shift.status,
                openingFloat: shift.openingFloat,
                physicalCashHandedOver: actualPhysicalCash,
                denominations: shift.denominations,
                handoverToOfficerId: shift.handoverToOfficerId,
                handoverToOfficerName: shift.handoverToOfficerName,
                billsCount: shift.billsCount,
                grossSales: shift.grossSales || 0,
                totalDiscount: shift.totalDiscount || 0,
                netSales: shift.netSales,
                paymentSummary: shift.paymentSummary
            }
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
};

// 4. CASH OFFICER: GET ALL SHIFTS WITH SORT & FILTER
const getAllShifts = async (req, res) => {
    try {
        const store = getStore();
        const storeId = getStoreId(req);
        const {
            tallyStatus,   // ALL, TALLIED, SHORTAGE, EXCESS, PENDING
            status,        // ACTIVE, CLOSED_PENDING_APPROVAL, TALLIED_APPROVED
            cashierId,
            counterNo,
            officerId,     // Filter by assigned cash officer ID / Name
            sortBy = 'date_desc' // date_desc, date_asc, cashier_asc, diff_asc, sales_desc
        } = req.query;

        // Enrich all shifts with bill metrics
        store.shifts.forEach(s => enrichShiftWithBillMetrics(s, store));

        let list = (store.shifts || []).filter(s => (s.storeId || 'store_default') === storeId);

        // Filters
        if (tallyStatus && tallyStatus !== 'ALL') {
            list = list.filter(s => s.tallyStatus === tallyStatus);
        }

        if (status && status !== 'ALL') {
            list = list.filter(s => s.status === status);
        }

        if (cashierId && cashierId !== 'ALL') {
            list = list.filter(s => s.cashierId === cashierId || s.cashierName === cashierId);
        }

        if (counterNo && counterNo !== 'ALL') {
            list = list.filter(s => s.counterNo === counterNo);
        }

        if (officerId && officerId !== 'ALL') {
            const cleanOff = String(officerId).toLowerCase().trim();
            list = list.filter(s =>
                (s.handoverToOfficerId && String(s.handoverToOfficerId).toLowerCase().includes(cleanOff)) ||
                (s.handoverToOfficerName && String(s.handoverToOfficerName).toLowerCase().includes(cleanOff)) ||
                (s.officerVerifiedBy && String(s.officerVerifiedBy).toLowerCase().includes(cleanOff))
            );
        }

        // Sorting
        if (sortBy === 'date_desc') {
            list.sort((a, b) => new Date(b.startTime) - new Date(a.startTime));
        } else if (sortBy === 'date_asc') {
            list.sort((a, b) => new Date(a.startTime) - new Date(b.startTime));
        } else if (sortBy === 'cashier_asc') {
            list.sort((a, b) => a.cashierName.localeCompare(b.cashierName));
        } else if (sortBy === 'diff_asc') {
            list.sort((a, b) => (a.cashDifference || 0) - (b.cashDifference || 0));
        } else if (sortBy === 'sales_desc') {
            list.sort((a, b) => (b.netSales || 0) - (a.netSales || 0));
        }

        res.status(200).json({
            success: true,
            count: list.length,
            totalShifts: store.shifts.length,
            shifts: list
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
};

// 5. CASH OFFICER: VERIFY & APPROVE / FLAG TALLY
const verifyShiftTally = async (req, res) => {
    try {
        const { shiftId } = req.params;
        const {
            officerVerifiedBy = 'Cash Officer',
            officerNotes = '',
            approvedStatus = 'TALLIED_APPROVED' // TALLIED_APPROVED or DISCREPANCY_FLAGGED
        } = req.body;

        const store = getStore();
        const shift = store.shifts.find(s => s._id === shiftId || s.shiftNumber === shiftId);

        if (!shift) {
            return res.status(404).json({ success: false, message: 'Shift not found.' });
        }

        shift.status = approvedStatus;
        shift.officerVerifiedBy = officerVerifiedBy;
        shift.officerNotes = officerNotes || `Audited & confirmed by Cash Officer ${officerVerifiedBy}.`;
        shift.verifiedAt = new Date().toISOString();

        saveStore();

        res.status(200).json({
            success: true,
            message: `Shift ${shift.shiftNumber} tally audited and marked as ${approvedStatus}.`,
            shift
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
};

// 6. CASH OFFICER CENTRAL VAULT & DASHBOARD METRICS
const getCashOfficeDashboard = async (req, res) => {
    try {
        const store = getStore();
        const storeId = getStoreId(req);
        const shifts = (store.shifts || []).filter(s => (s.storeId || 'store_default') === storeId);
        const bills = (store.bills || []).filter(b => (b.storeId || 'store_default') === storeId);

        let totalRevenue = 0;
        let totalCash = 0;
        let totalUpi = 0;
        let totalCard = 0;
        let totalFloatsIssued = 0;
        let totalPhysicalCashReceived = 0;
        let totalShortageAmount = 0;
        let totalExcessAmount = 0;
        let activeCountersCount = 0;
        let talliedCount = 0;
        let shortageCount = 0;
        let excessCount = 0;

        shifts.forEach(s => {
            totalFloatsIssued += Number(s.openingFloat) || 0;
            totalPhysicalCashReceived += Number(s.physicalCashHandedOver) || 0;

            if (s.status === 'ACTIVE') {
                activeCountersCount++;
            }

            if (s.tallyStatus === 'TALLIED') talliedCount++;
            if (s.tallyStatus === 'SHORTAGE') {
                shortageCount++;
                totalShortageAmount += Math.abs(Number(s.cashDifference) || 0);
            }
            if (s.tallyStatus === 'EXCESS') {
                excessCount++;
                totalExcessAmount += Number(s.cashDifference) || 0;
            }
        });

        bills.forEach(b => {
            totalRevenue += Number(b.netPayable) || 0;
            if (b.paymentMethod === 'CASH') {
                totalCash += Number(b.netPayable) || 0;
            } else if (b.paymentMethod === 'UPI') {
                totalUpi += Number(b.netPayable) || 0;
            } else if (b.paymentMethod === 'CARD') {
                totalCard += Number(b.netPayable) || 0;
            } else if (b.paymentMethod === 'SPLIT' && b.splitBreakdown) {
                totalCash += Number(b.splitBreakdown.cashAmount) || 0;
                totalUpi += Number(b.splitBreakdown.upiAmount) || 0;
                totalCard += Number(b.splitBreakdown.cardAmount) || 0;
            }
        });

        res.status(200).json({
            success: true,
            metrics: {
                totalRevenue,
                totalBills: bills.length,
                totalCash,
                totalUpi,
                totalCard,
                totalFloatsIssued,
                totalPhysicalCashInVault: totalPhysicalCashReceived,
                totalShortageAmount,
                totalExcessAmount,
                activeCountersCount,
                talliedCount,
                shortageCount,
                excessCount,
                shiftsCount: shifts.length
            }
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
};

// 7. CASHIER: UPDATE ACTIVE SHIFT COUNTER DESK
const updateShiftCounter = async (req, res) => {
    try {
        const { shiftId } = req.params;
        const { counterNo } = req.body;
        const store = getStore();

        if (!counterNo || !counterNo.trim()) {
            return res.status(400).json({ success: false, message: 'Counter number is required.' });
        }

        const shift = (store.shifts || []).find(s => s._id === shiftId || s.shiftNumber === shiftId);
        if (!shift) {
            return res.status(404).json({ success: false, message: 'Shift not found.' });
        }

        shift.counterNo = counterNo.trim();
        saveStore();

        res.status(200).json({
            success: true,
            message: `Shift counter updated to ${shift.counterNo}`,
            shift
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
};

module.exports = {
    getActiveShift,
    startShift,
    closeShift,
    getAllShifts,
    verifyShiftTally,
    getCashOfficeDashboard,
    updateShiftCounter
};
